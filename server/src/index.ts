import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { v4 as uuidv4 } from 'uuid';
import passport from './auth/passport-config.js';
import { configurePassport } from './auth/passport-config.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import jwt from 'jsonwebtoken';
import { GameStorage, DataStorage } from './storage/index.js';
import { UserStore } from './models/User.js';

const app = express();
const httpServer = createServer(app);

// Configure CORS
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// Initialize Passport
app.use(passport.initialize());
configurePassport();

// Authentication routes
app.use('/auth', authRoutes);
// Also mount under /api for Discord Activity /.proxy compatibility
app.use('/api', authRoutes);

// Profile routes
app.use('/api/profile', profileRoutes);

// Socket.IO server
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
  }
});

// File-based storage (using event sourcing with .jsonl files)
interface Player {
  id: string;
  username: string;
  socketId: string;
  connected: boolean;
}

interface Spectator {
  id: string;
  username: string;
  socketId: string;
  joinedAt: number;
}

interface GameRoom {
  id: string;
  name: string;
  hostId: string;
  players: Player[];
  maxPlayers: number;
  status: 'waiting' | 'playing' | 'finished';
}

// Game actions (event log) - each game has its own action stream
interface GameAction {
  type: string;
  payload: any;
  playerId: string;
  timestamp: number;
  sequence: number; // Sequential number for ordering
}

// Initialize storage
const dataDir = process.env.DATA_DIR || './data';
const gameStorage = new GameStorage(`${dataDir}/games`);
const sessionStorage = new DataStorage(`${dataDir}/sessions`, 'sessions.jsonl');

// In-memory cache for active socket connections
// Maps socket.id -> Player info (ephemeral, for current connections)
const players = new Map<string, Player>();

// Track spectators for each game - maps gameId -> Map of spectators
// spectators are keyed by socket.id for quick lookup
const gameSpectators = new Map<string, Map<string, Spectator>>();

// Track rematch games - maps new game ID to original game's player list and spectators
// Used to emit game_ready when players rejoin after rematch and to re-add spectators after seating
const rematchGames = new Map<string, { 
  players: Array<{ id: string; username: string; playerIndex: number }>, 
  joinedCount: number,
  spectators?: Array<{ id: string; username: string }>,
  oldGameId?: string // Track old game ID to notify spectators
}>();

// Initialize storage on startup
async function initializeStorage() {
  await gameStorage.initialize();
  await sessionStorage.initialize();
  await UserStore.init(); // Load users from persistent storage
  console.log('✅ File-based storage initialized');
  
  // Start cleanup job for expired anonymous users
  startAnonymousUserCleanup();
}

/**
 * Background job to clean up expired anonymous users
 * Runs daily at 3 AM local time
 */
function startAnonymousUserCleanup() {
  async function cleanupExpiredAnonymousUsers() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const allUsers = UserStore.getAll();
    const expiredUsers = allUsers.filter(user => 
      user.isAnonymous && 
      new Date(user.lastActive) < thirtyDaysAgo
    );
    
    if (expiredUsers.length > 0) {
      console.log(`🧹 Cleaning up ${expiredUsers.length} expired anonymous users...`);
      for (const user of expiredUsers) {
        console.log(`   Deleting expired anonymous user: ${user.id} (last active: ${user.lastActive})`);
        await UserStore.delete(user.id);
      }
      console.log(`✅ Cleanup completed. Deleted ${expiredUsers.length} users.`);
    }
  }

  // Run cleanup immediately on startup (in case server was down for a while)
  cleanupExpiredAnonymousUsers().catch(err => {
    console.error('Error in anonymous user cleanup:', err);
  });

  // Then run daily (every 24 hours)
  setInterval(() => {
    cleanupExpiredAnonymousUsers().catch(err => {
      console.error('Error in anonymous user cleanup:', err);
    });
  }, 24 * 60 * 60 * 1000);
  
  console.log('✅ Anonymous user cleanup job scheduled (runs daily)');
}

// Validate environment variables and log warnings
function validateEnvironment() {
  console.log('🔍 Checking environment configuration...');
  
  // Check Discord OAuth/Activity credentials
  const discordClientId = process.env.DISCORD_CLIENT_ID;
  const discordClientSecret = process.env.DISCORD_CLIENT_SECRET;
  
  if (!discordClientId || !discordClientSecret) {
    console.warn('⚠️  Discord Activity support is DISABLED');
    console.warn('   Missing environment variables:');
    if (!discordClientId) console.warn('   - DISCORD_CLIENT_ID');
    if (!discordClientSecret) console.warn('   - DISCORD_CLIENT_SECRET');
    console.warn('   Discord Activity token exchange endpoint will return 500 errors');
    console.warn('   Set these variables to enable Discord Activity support');
  } else {
    console.log('✅ Discord Activity credentials configured');
  }
  
  // Check other optional credentials
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!googleClientId || !googleClientSecret) {
    console.warn('⚠️  Google OAuth is DISABLED (missing credentials)');
  } else {
    console.log('✅ Google OAuth credentials configured');
  }
  
  // Check JWT secret
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret === 'dev-secret-change-in-production') {
    console.warn('⚠️  Using default JWT_SECRET - please set a strong secret in production!');
  } else {
    console.log('✅ JWT_SECRET configured');
  }
  
  console.log('');
}

// Validate environment
validateEnvironment();

// Call initialization
await initializeStorage();

// Session management helpers
interface UserSession {
  userId: string;
  username: string;
  activeGameIds: string[];
  lastSeen: number;
  connectionState: 'connected' | 'disconnected';
  currentSocketId?: string; // Current active socket
  lastKnownState: {
    [gameId: string]: {
      lastActionSequence: number; // Last action they processed
      lastSeenTimestamp: number;
    }
  }
}

/**
 * Update user session with their active games
 */
async function updateUserSession(userId: string, username: string, gameIds: string[], socketId?: string, connectionState?: 'connected' | 'disconnected'): Promise<void> {
  const existingSession = getUserSession(userId);
  const session: UserSession = {
    userId,
    username,
    activeGameIds: gameIds,
    lastSeen: Date.now(),
    connectionState: connectionState ?? existingSession?.connectionState ?? 'connected',
    currentSocketId: socketId ?? existingSession?.currentSocketId,
    lastKnownState: existingSession?.lastKnownState ?? {}
  };
  await sessionStorage.set(userId, session);
}

/**
 * Get user session to find their active games
 */
function getUserSession(userId: string): UserSession | null {
  return sessionStorage.get(userId) || null;
}

/**
 * Add a game to user's session
 */
async function addGameToUserSession(userId: string, username: string, gameId: string, socketId?: string): Promise<void> {
  const session = getUserSession(userId);
  const activeGameIds = session ? [...new Set([...session.activeGameIds, gameId])] : [gameId];
  await updateUserSession(userId, username, activeGameIds, socketId, 'connected');
}

/**
 * Remove a game from user's session
 */
async function removeGameFromUserSession(userId: string, gameId: string): Promise<void> {
  const session = getUserSession(userId);
  if (session) {
    const activeGameIds = session.activeGameIds.filter(id => id !== gameId);
    await updateUserSession(userId, session.username, activeGameIds);
  }
}

// REST API endpoints

// Health check
app.get('/health', async (req, res) => {
  try {
    const gameIds = await gameStorage.listGames();
    res.json({ 
      status: 'ok', 
      games: gameIds.length, 
      players: players.size,
      storage: 'file-based'
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Storage unavailable' });
  }
});

// Get all available rooms
app.get('/api/rooms', async (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;
    const gameIds = await gameStorage.listGames();
    const rooms = await Promise.all(
      gameIds.map(async (gameId) => {
        const state = await gameStorage.getGameState(gameId);
        return state;
      })
    );
    
    // For authenticated users, include their active games even if not in 'waiting' status
    let userGameIds: string[] = [];
    if (userId) {
      const session = getUserSession(userId);
      if (session) {
        userGameIds = session.activeGameIds;
      }
    }
    
    const availableRooms = rooms
      .filter(room => {
        if (!room) return false;
        // Include if:
        // 1. Waiting (anyone can join as player)
        // 2. Playing or finished (anyone can spectate)
        // 3. One of the user's active games (can rejoin)
        return room.status === 'waiting' || 
               room.status === 'playing' || 
               room.status === 'finished' ||
               (userId && userGameIds.includes(room.gameId));
      })
      .map(room => {
        const spectators = gameSpectators.get(room!.gameId);
        const spectatorCount = spectators ? spectators.size : 0;
        
        return {
          id: room!.gameId,
          name: room!.name,
          hostId: room!.hostId,
          playerCount: room!.players.length,
          maxPlayers: room!.maxPlayers,
          status: room!.status,
          spectatorCount,
          players: room!.players.map(p => ({ id: p.id, username: p.username }))
        };
      });
    
    res.json({ rooms: availableRooms });
  } catch (error) {
    console.error('Error listing rooms:', error);
    res.status(500).json({ error: 'Failed to list rooms' });
  }
});

// Create a new room
app.post('/api/rooms', async (req, res) => {
  const { name, maxPlayers, hostId, roomId } = req.body;
  
  if (!name || !hostId || !maxPlayers) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (maxPlayers < 2 || maxPlayers > 6) {
    return res.status(400).json({ error: 'maxPlayers must be between 2 and 6' });
  }

  // Use custom roomId if provided (for Discord Activities), otherwise generate one
  const finalRoomId = roomId || uuidv4();
  
  try {
    // Check if room already exists (for Discord channel rooms)
    if (roomId) {
      const existingState = await gameStorage.getGameState(roomId);
      if (existingState) {
        // Room already exists, return it
        return res.json({ room: { id: roomId, name: existingState.name, maxPlayers: existingState.maxPlayers } });
      }
    }
    
    await gameStorage.createGame(finalRoomId, name, hostId, maxPlayers);
    res.json({ room: { id: finalRoomId, name, maxPlayers } });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Create a rematch game (new game with same players and settings)
app.post('/api/rooms/:roomId/rematch', async (req, res) => {
  const { roomId } = req.params;
  const { playerId } = req.body;
  
  if (!playerId) {
    return res.status(400).json({ error: 'Missing playerId' });
  }
  
  try {
    const currentState = await gameStorage.getGameState(roomId);
    
    if (!currentState) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    // Create a new game with the same settings
    const newGameId = uuidv4();
    const newGameName = `${currentState.name} (Rematch)`;
    
    await gameStorage.createGame(newGameId, newGameName, currentState.hostId, currentState.maxPlayers);
    
    // Return the new game information
    res.json({ 
      newGameId,
      oldGameId: roomId,
      name: newGameName,
      maxPlayers: currentState.maxPlayers,
      hostId: currentState.hostId,
      players: currentState.players.map(p => ({ id: p.id, username: p.username }))
    });
  } catch (error) {
    console.error('Error creating rematch:', error);
    res.status(500).json({ error: 'Failed to create rematch' });
  }
});

// Get user's active games (for reconnection)
app.get('/api/users/:userId/games', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const session = getUserSession(userId);
    if (!session) {
      return res.json({ games: [] });
    }
    
    // Get details for each active game
    const games = await Promise.all(
      session.activeGameIds.map(async (gameId) => {
        const state = await gameStorage.getGameState(gameId);
        if (!state) return null;
        
        return {
          id: state.gameId,
          name: state.name,
          status: state.status,
          playerCount: state.players.length,
          maxPlayers: state.maxPlayers,
          hostId: state.hostId
        };
      })
    );
    
    // Filter out null entries (games that no longer exist)
    const activeGames = games.filter(g => g !== null);
    
    res.json({ games: activeGames, username: session.username });
  } catch (error) {
    console.error('Error getting user games:', error);
    res.status(500).json({ error: 'Failed to get user games' });
  }
});

// Socket.IO connection handling with optional JWT authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (token) {
    try {
      const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      socket.data.userId = decoded.userId;
      socket.data.authenticated = true;
    } catch (err) {
      console.log('Invalid token provided, allowing anonymous connection');
      socket.data.authenticated = false;
    }
  } else {
    socket.data.authenticated = false;
  }
  
  next();
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id, socket.data.authenticated ? '(authenticated)' : '(anonymous)');

  // Player identification
  socket.on('identify', async (data: { username: string }) => {
    // Use authenticated userId if available, otherwise use socket.id
    const userId = socket.data.authenticated ? socket.data.userId : socket.id;
    const playerId = userId; // playerId is now persistent for authenticated users
    
    const player: Player = {
      id: playerId,
      username: data.username,
      socketId: socket.id,
      connected: true
    };
    players.set(socket.id, player);
    
    // For authenticated users, load their session to find active games
    let activeGames: string[] = [];
    let previousSocketId: string | undefined;
    if (socket.data.authenticated) {
      const session = getUserSession(userId);
      if (session) {
        activeGames = session.activeGameIds;
        previousSocketId = session.currentSocketId;
        
        // Handle multiple simultaneous connections (Section 2.2.3, item 3)
        // If user is already connected from another socket, notify that socket
        if (previousSocketId && previousSocketId !== socket.id && players.has(previousSocketId)) {
          const previousSocket = io.sockets.sockets.get(previousSocketId);
          if (previousSocket) {
            console.log(`User ${player.username} connected from new location. Notifying previous connection.`);
            previousSocket.emit('connected_elsewhere', {
              message: 'You have connected from another device or browser. This connection is now read-only.'
            });
            // Note: We don't disconnect the old socket, just notify it
            // The client should handle this by showing a message and preventing actions
          }
        }
        
        console.log(`Player ${player.username} reconnected with ${activeGames.length} active games`);
        // Update session with new socket ID and connection state
        await updateUserSession(userId, data.username, session.activeGameIds, socket.id, 'connected');
      } else {
        // Create initial session
        await updateUserSession(userId, data.username, [], socket.id, 'connected');
      }
    }
    
    console.log('Player identified:', player.username, socket.data.authenticated ? '(authenticated user)' : '(anonymous)');
    socket.emit('identified', { 
      playerId, 
      username: player.username,
      authenticated: socket.data.authenticated,
      activeGames // Send list of games the player is in
    });
  });

  // Heartbeat mechanism - client sends periodic heartbeat to maintain connection
  socket.on('heartbeat', async () => {
    const player = players.get(socket.id);
    if (!player) return;
    
    // Update lastSeen timestamp in session for authenticated users
    if (socket.data.authenticated) {
      const session = getUserSession(socket.data.userId);
      if (session) {
        await updateUserSession(
          socket.data.userId, 
          session.username, 
          session.activeGameIds, 
          socket.id, 
          'connected'
        );
      }
    }
  });

  // Join a room
  socket.on('join_room', async (data: { roomId: string }) => {
    const { roomId } = data;
    const player = players.get(socket.id);

    if (!player) {
      socket.emit('error', { message: 'Player not identified' });
      return;
    }

    try {
      const state = await gameStorage.getGameState(roomId);
      
      if (!state) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      // Check if player is already in the room (for rejoining in-progress games)
      const existingPlayer = state.players.find(p => p.id === player.id);
      const isRejoining = existingPlayer !== undefined;

      // Allow joining in-progress games (both new and rejoining players)
      // Players can join during setup phase or as spectators later
      // Note: Room capacity check removed to support spectator mode and flexible joining

      // Add player via action only if they're not already in the room
      if (!existingPlayer) {
        const joinAction: GameAction = {
          type: 'JOIN_GAME',
          payload: { player },
          playerId: player.id,
          timestamp: Date.now(),
          sequence: 0 // Will be overwritten by storage
        };
        await gameStorage.appendAction(roomId, joinAction);
      }

      socket.join(roomId);
      
      // Track session for authenticated users
      if (socket.data.authenticated) {
        await addGameToUserSession(socket.data.userId, player.username, roomId, socket.id);
      }
      
      // Get updated state
      const updatedState = await gameStorage.getGameState(roomId);
      
      // If rejoining, notify other players
      if (isRejoining) {
        io.to(roomId).emit('player_reconnected', {
          playerId: player.id,
          username: player.username
        });
      }
      
      // Notify everyone in the room (for new joins, not reconnections to playing games)
      if (!isRejoining || updatedState!.status === 'waiting') {
        io.to(roomId).emit('player_joined', {
          player: { id: player.id, username: player.username },
          room: {
            id: updatedState!.gameId,
            name: updatedState!.name,
            players: updatedState!.players.map(p => ({ id: p.id, username: p.username })),
            hostId: updatedState!.hostId
          }
        });
      }

      // If rejoining an in-progress or finished game, notify the player to load the game
      if (isRejoining && (updatedState!.status === 'playing' || updatedState!.status === 'finished')) {
        socket.emit('game_ready', {
          gameId: updatedState!.gameId,
          players: updatedState!.players.map((p, index) => ({ 
            id: p.id, 
            username: p.username,
            playerIndex: index
          }))
        });
        console.log(`Player ${player.username} rejoined in-progress game ${updatedState!.name}`);
      } else if (rematchGames.has(roomId)) {
        // This is a rematch game - emit game_ready to the joining player
        const rematchInfo = rematchGames.get(roomId)!;
        rematchInfo.joinedCount++;
        
        socket.emit('game_ready', {
          gameId: roomId,
          players: rematchInfo.players
        });
        
        console.log(`Player ${player.username} joined rematch game ${updatedState!.name} (${rematchInfo.joinedCount}/${rematchInfo.players.length})`);
        
        // Don't clean up rematch tracking yet - we need it for spectator rejoin after COMPLETE_SEATING_PHASE
        if (rematchInfo.joinedCount >= rematchInfo.players.length) {
          console.log(`All players joined rematch game ${roomId}, will clean up after COMPLETE_SEATING_PHASE`);
        }
      } else {
        console.log(`Player ${player.username} joined room ${updatedState!.name}`);
      }
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Leave a room
  socket.on('leave_room', async (data: { roomId: string }) => {
    const { roomId } = data;
    const player = players.get(socket.id);

    if (!player) return;

    try {
      const state = await gameStorage.getGameState(roomId);
      if (!state) return;

      // Record leave action (sequence will be auto-assigned)
      const leaveAction: GameAction = {
        type: 'LEAVE_GAME',
        payload: { playerId: player.id },
        playerId: player.id,
        timestamp: Date.now(),
        sequence: 0 // Will be overwritten by storage
      };
      await gameStorage.appendAction(roomId, leaveAction);

      socket.leave(roomId);
      
      // Remove from session for authenticated users
      if (socket.data.authenticated) {
        await removeGameFromUserSession(socket.data.userId, roomId);
      }

      // Get updated state
      const updatedState = await gameStorage.getGameState(roomId);

      // Notify others
      io.to(roomId).emit('player_left', {
        playerId: player.id,
        room: {
          id: updatedState!.gameId,
          name: updatedState!.name,
          players: updatedState!.players.map(p => ({ id: p.id, username: p.username })),
          hostId: updatedState!.hostId
        }
      });

      console.log(`Player ${player.username} left room ${updatedState!.name}`);
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  });

  // Start game (host posts START_GAME action with seed)
  socket.on('start_game', async (data: { roomId: string }) => {
    const { roomId } = data;
    const player = players.get(socket.id);

    if (!player) return;

    try {
      const state = await gameStorage.getGameState(roomId);
      if (!state) return;

      // Check if this is a Discord Activity room (starts with "discord-")
      const isDiscordRoom = roomId.startsWith('discord-');

      // For Discord Activities, anyone can start the game (no host restriction)
      // For regular rooms, only the host can start
      if (!isDiscordRoom && state.hostId !== player.id) {
        socket.emit('error', { message: 'Only host can start the game' });
        return;
      }

      // For Discord Activities, allow starting with 1 player (others can join during gameplay)
      // For regular rooms, require at least 2 players
      const minPlayers = isDiscordRoom ? 1 : 2;
      if (state.players.length < minPlayers) {
        socket.emit('error', { message: 'Need at least 2 players to start' });
        return;
      }

      // Record start game action (sequence will be auto-assigned)
      const startAction: GameAction = {
        type: 'START_GAME',
        payload: {},
        playerId: player.id,
        timestamp: Date.now(),
        sequence: 0 // Will be overwritten by storage
      };
      await gameStorage.appendAction(roomId, startAction);

      // Get updated state
      const updatedState = await gameStorage.getGameState(roomId);

      // Host should now post START_GAME action with seed via post_action event
      // We just notify clients that the game is ready to start
      io.to(roomId).emit('game_ready', {
        gameId: updatedState!.gameId,
        players: updatedState!.players.map((p, index) => ({ 
          id: p.id, 
          username: p.username,
          playerIndex: index // Assign player indices for the game
        }))
      });

      console.log(`Game ready in room ${updatedState!.name}, waiting for host to post START_GAME action`);
    } catch (error) {
      console.error('Error starting game:', error);
      socket.emit('error', { message: 'Failed to start game' });
    }
  });

  // Post a game action (event sourcing)
  socket.on('post_action', async (data: { gameId: string; action: any }) => {
    const { gameId, action } = data;
    const player = players.get(socket.id);

    if (!player) return;

    try {
      const state = await gameStorage.getGameState(gameId);
      if (!state) return;
      
      // Create the action with metadata (sequence will be auto-assigned by storage)
      const gameAction: GameAction = {
        type: action.type,
        payload: action.payload || {},
        playerId: player.id,
        timestamp: Date.now(),
        sequence: 0 // Will be overwritten by storage
      };

      // Append to action log (storage assigns correct sequence)
      const finalAction = await gameStorage.appendAction(gameId, gameAction);

      // Broadcast action to all players in the game
      io.to(gameId).emit('action_posted', finalAction);

      // Check if this is a SELECT_EDGE in a rematch game
      // We trigger on every SELECT_EDGE to ensure spectators rejoin even if they miss one
      if (finalAction.type === 'SELECT_EDGE' && rematchGames.has(gameId)) {
        const rematchInfo = rematchGames.get(gameId)!;
        
        console.log(`[Rematch] SELECT_EDGE for game ${gameId}, checking for spectators...`);
        
        // Re-add spectators from the previous game
        if (rematchInfo.spectators && rematchInfo.spectators.length > 0 && rematchInfo.oldGameId) {
          console.log(`[Rematch] Re-adding ${rematchInfo.spectators.length} spectators to rematch game ${gameId}`);
          console.log(`[Rematch] Emitting to old game room: ${rematchInfo.oldGameId}`);
          
          // Notify spectators to rejoin via a custom event
          // Emit to the OLD game room where spectators are still listening
          for (const spectator of rematchInfo.spectators) {
            console.log(`[Rematch] Emitting rematch_spectator_rejoin for spectator ${spectator.id} (${spectator.username})`);
            io.to(rematchInfo.oldGameId).emit('rematch_spectator_rejoin', {
              gameId, // The NEW game ID they should join
              spectatorId: spectator.id
            });
          }
          
          // Clean up the rematch tracking now that spectators have been notified
          console.log(`[Rematch] Cleaning up rematch tracking for game ${gameId}`);
          rematchGames.delete(gameId);
        } else {
          console.log(`[Rematch] No spectators to re-add or missing oldGameId`);
        }
      }

      console.log(`Action ${finalAction.type} posted to game ${gameId} by ${player.username}`);
    } catch (error) {
      console.error('Error posting action:', error);
      socket.emit('error', { message: 'Failed to post action' });
    }
  });

  // Get all actions for a game (for new players or reconnection)
  socket.on('get_actions', async (data: { gameId: string }) => {
    const { gameId } = data;
    
    try {
      const actions = await gameStorage.readActions(gameId);
      
      socket.emit('actions_list', {
        gameId,
        actions
      });
    } catch (error) {
      console.error('Error getting actions:', error);
      socket.emit('error', { message: 'Failed to get actions' });
    }
  });

  // Request a rematch (create new game with same players)
  socket.on('request_rematch', async (data: { gameId: string }) => {
    const { gameId } = data;
    const player = players.get(socket.id);

    if (!player) {
      socket.emit('error', { message: 'Player not identified' });
      return;
    }

    try {
      const state = await gameStorage.getGameState(gameId);
      if (!state) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }

      // Create a new game with the same settings
      const newGameId = uuidv4();
      const newGameName = `${state.name} (Rematch)`;
      
      await gameStorage.createGame(newGameId, newGameName, state.hostId, state.maxPlayers);
      
      // Add all players from the old game to the new game
      // This ensures they're already in the game when they join the room
      for (const oldPlayer of state.players) {
        const joinAction: GameAction = {
          type: 'JOIN_GAME',
          payload: { player: oldPlayer },
          playerId: oldPlayer.id,
          timestamp: Date.now(),
          sequence: 0 // Will be overwritten by storage
        };
        await gameStorage.appendAction(newGameId, joinAction);
      }
      
      // Get spectators from the old game
      const oldSpectators = gameSpectators.get(gameId);
      const spectatorList = oldSpectators ? Array.from(oldSpectators.values()) : [];
      
      // Track this rematch game so we can emit game_ready when players join
      // Also store spectators to re-add them after seating
      rematchGames.set(newGameId, {
        players: state.players.map((p, index) => ({
          id: p.id,
          username: p.username,
          playerIndex: index
        })),
        joinedCount: 0,
        spectators: spectatorList.map(s => ({ id: s.id, username: s.username })),
        oldGameId: gameId // Store old game ID to notify spectators later
      });
      
      // Broadcast rematch notification to all players in the old game
      // Each client will handle joining the new game and reselecting their edge
      io.to(gameId).emit('rematch_created', {
        newGameId,
        oldGameId: gameId,
        name: newGameName,
        maxPlayers: state.maxPlayers,
        hostId: state.hostId,
        players: state.players.map(p => ({ id: p.id, username: p.username }))
      });

      console.log(`Rematch game ${newGameId} created from ${gameId} with ${state.players.length} players`);
    } catch (error) {
      console.error('Error creating rematch:', error);
      socket.emit('error', { message: 'Failed to create rematch' });
    }
  });

  // Join as spectator
  socket.on('join_as_spectator', async (data: { gameId: string }) => {
    const { gameId } = data;
    const player = players.get(socket.id);

    if (!player) {
      socket.emit('error', { message: 'Player not identified' });
      return;
    }

    try {
      const state = await gameStorage.getGameState(gameId);
      
      if (!state) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }

      // Check if player is already in the game as a player
      const isPlayer = state.players.find(p => p.id === player.id);
      if (isPlayer) {
        // Allow players to spectate their own game (useful for multi-tab scenarios)
        // but we'll track them as spectator too
        console.log(`Player ${player.username} is spectating their own game`);
      }

      // Create spectator
      const spectator: Spectator = {
        id: player.id,
        username: player.username,
        socketId: socket.id,
        joinedAt: Date.now()
      };

      // Initialize spectator map for this game if needed
      if (!gameSpectators.has(gameId)) {
        gameSpectators.set(gameId, new Map());
      }

      // Add spectator to the game
      const spectators = gameSpectators.get(gameId)!;
      spectators.set(socket.id, spectator);

      // Join the socket.io room (same room as players)
      socket.join(gameId);

      // Send full action history to spectator for replay
      const actions = await gameStorage.readActions(gameId);
      socket.emit('actions_list', {
        gameId,
        actions
      });

      // Notify all participants (players and spectators) about new spectator
      io.to(gameId).emit('spectator_joined', {
        spectator: { id: spectator.id, username: spectator.username },
        spectatorCount: spectators.size
      });

      console.log(`Spectator ${player.username} joined game ${state.name} (${spectators.size} spectators)`);
    } catch (error) {
      console.error('Error joining as spectator:', error);
      socket.emit('error', { message: 'Failed to join as spectator' });
    }
  });

  // Leave spectator
  socket.on('leave_spectator', async (data: { gameId: string }) => {
    const { gameId } = data;
    
    const spectators = gameSpectators.get(gameId);
    if (!spectators) return;

    const spectator = spectators.get(socket.id);
    if (!spectator) return;

    // Remove spectator
    spectators.delete(socket.id);
    socket.leave(gameId);

    // Notify others
    io.to(gameId).emit('spectator_left', {
      spectatorId: spectator.id,
      spectatorCount: spectators.size
    });

    // Clean up empty spectator map
    if (spectators.size === 0) {
      gameSpectators.delete(gameId);
    }

    console.log(`Spectator ${spectator.username} left game ${gameId}`);
  });

  // Disconnect
  socket.on('disconnect', async () => {
    console.log('Client disconnected:', socket.id);
    const player = players.get(socket.id);

    if (player) {
      player.connected = false;

      // Update session state to disconnected for authenticated users
      if (socket.data.authenticated) {
        const session = getUserSession(socket.data.userId);
        if (session) {
          await updateUserSession(
            socket.data.userId,
            session.username,
            session.activeGameIds,
            undefined,
            'disconnected'
          );
        }
      }

      try {
        // Find and update all games this player was in
        const gameIds = await gameStorage.listGames();
        for (const gameId of gameIds) {
          const state = await gameStorage.getGameState(gameId);
          if (state) {
            const playerInGame = state.players.find(p => p.id === player.id);
            if (playerInGame) {
              // Record disconnect action (sequence will be auto-assigned)
              const disconnectAction: GameAction = {
                type: 'PLAYER_DISCONNECT',
                payload: { playerId: player.id },
                playerId: player.id,
                timestamp: Date.now(),
                sequence: 0 // Will be overwritten by storage
              };
              await gameStorage.appendAction(gameId, disconnectAction);
              
              io.to(gameId).emit('player_disconnected', {
                playerId: player.id,
                username: player.username
              });
            }
          }
        }
      } catch (error) {
        console.error('Error handling disconnect:', error);
      }

      // Remove from in-memory map only (keep in session for reconnection)
      // Games wait indefinitely for player to reconnect - no timeout removal
      players.delete(socket.id);
      console.log(`Player ${player.username} disconnected. Games will wait for reconnection.`);
    }

    // Also check if this was a spectator and clean up
    for (const [gameId, spectators] of gameSpectators.entries()) {
      const spectator = spectators.get(socket.id);
      if (spectator) {
        spectators.delete(socket.id);
        
        // Notify others
        io.to(gameId).emit('spectator_left', {
          spectatorId: spectator.id,
          spectatorCount: spectators.size
        });
        
        // Clean up empty spectator map
        if (spectators.size === 0) {
          gameSpectators.delete(gameId);
        }
        
        console.log(`Spectator ${spectator.username} disconnected from game ${gameId}`);
      }
    }
  });
});

// Start the server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🎮 Quortex multiplayer server running on port ${PORT}`);
  console.log(`   Client URL: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
});

// Graceful shutdown
async function shutdown() {
  console.log('Shutting down gracefully...');
  try {
    await gameStorage.shutdown();
    console.log('✅ All data flushed to disk');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
