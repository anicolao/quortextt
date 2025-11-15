import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import passport from './auth/passport-config.js';
import { configurePassport } from './auth/passport-config.js';
import authRoutes from './routes/auth.js';
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

// Initialize Passport
app.use(passport.initialize());
configurePassport();

// Authentication routes
app.use('/auth', authRoutes);
// Also mount under /api for Discord Activity /.proxy compatibility
app.use('/api', authRoutes);

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

// Initialize storage on startup
async function initializeStorage() {
  await gameStorage.initialize();
  await sessionStorage.initialize();
  await UserStore.init(); // Load users from persistent storage
  console.log('✅ File-based storage initialized');
}

// Call initialization
await initializeStorage();

// Session management helpers
interface UserSession {
  userId: string;
  username: string;
  activeGameIds: string[];
  lastSeen: number;
}

/**
 * Update user session with their active games
 */
async function updateUserSession(userId: string, username: string, gameIds: string[]): Promise<void> {
  const session: UserSession = {
    userId,
    username,
    activeGameIds: gameIds,
    lastSeen: Date.now()
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
async function addGameToUserSession(userId: string, username: string, gameId: string): Promise<void> {
  const session = getUserSession(userId);
  const activeGameIds = session ? [...new Set([...session.activeGameIds, gameId])] : [gameId];
  await updateUserSession(userId, username, activeGameIds);
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
        // Include if waiting OR if it's one of the user's active games
        return room.status === 'waiting' || (userId && userGameIds.includes(room.gameId));
      })
      .map(room => ({
        id: room!.gameId,
        name: room!.name,
        hostId: room!.hostId,
        playerCount: room!.players.length,
        maxPlayers: room!.maxPlayers,
        status: room!.status
      }));
    
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
    if (socket.data.authenticated) {
      const session = getUserSession(userId);
      if (session) {
        activeGames = session.activeGameIds;
        console.log(`Player ${player.username} reconnected with ${activeGames.length} active games`);
      } else {
        // Create initial session
        await updateUserSession(userId, data.username, []);
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
      
      if (!isRejoining && state.players.length >= state.maxPlayers) {
        socket.emit('error', { message: 'Room is full' });
        return;
      }

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
        await addGameToUserSession(socket.data.userId, player.username, roomId);
      }
      
      // Get updated state
      const updatedState = await gameStorage.getGameState(roomId);
      
      // Notify everyone in the room
      io.to(roomId).emit('player_joined', {
        player: { id: player.id, username: player.username },
        room: {
          id: updatedState!.gameId,
          name: updatedState!.name,
          players: updatedState!.players.map(p => ({ id: p.id, username: p.username })),
          hostId: updatedState!.hostId
        }
      });

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

      // Only host can start the game
      if (state.hostId !== player.id) {
        socket.emit('error', { message: 'Only host can start the game' });
        return;
      }

      if (state.players.length < 2) {
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

  // Disconnect
  socket.on('disconnect', async () => {
    console.log('Client disconnected:', socket.id);
    const player = players.get(socket.id);

    if (player) {
      player.connected = false;

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

      // Clean up after a timeout (give them a chance to reconnect)
      setTimeout(async () => {
        if (!player.connected) {
          players.delete(socket.id);
          
          try {
            // Remove from all games and clean up
            const gameIds = await gameStorage.listGames();
            for (const gameId of gameIds) {
              const state = await gameStorage.getGameState(gameId);
              if (state) {
                const playerInGame = state.players.find(p => p.id === player.id);
                if (playerInGame) {
                  // Record leave action (sequence will be auto-assigned)
                  const leaveAction: GameAction = {
                    type: 'LEAVE_GAME',
                    payload: { playerId: player.id },
                    playerId: player.id,
                    timestamp: Date.now(),
                    sequence: 0 // Will be overwritten by storage
                  };
                  await gameStorage.appendAction(gameId, leaveAction);
                  
                  const updatedState = await gameStorage.getGameState(gameId);
                  
                  io.to(gameId).emit('player_left', {
                    playerId: player.id,
                    room: {
                      id: updatedState!.gameId,
                      name: updatedState!.name,
                      players: updatedState!.players.map(p => ({ id: p.id, username: p.username })),
                      hostId: updatedState!.hostId
                    }
                  });
                }
              }
            }
          } catch (error) {
            console.error('Error cleaning up disconnected player:', error);
          }
        }
      }, 30000); // 30 second grace period
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
