// Simple multiplayer server for Quortex MVP - Event Sourcing Architecture
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import passport from './auth/passport-config.js';
import { configurePassport } from './auth/passport-config.js';
import authRoutes from './routes/auth.js';
import jwt from 'jsonwebtoken';

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

// Socket.IO server
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
  }
});

// In-memory storage (MVP - no database)
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

const rooms = new Map<string, GameRoom>();
const players = new Map<string, Player>();
// Actions collection: gameId -> array of actions
const gameActions = new Map<string, GameAction[]>();

// REST API endpoints

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', rooms: rooms.size, players: players.size });
});

// Get all available rooms
app.get('/api/rooms', (req, res) => {
  const availableRooms = Array.from(rooms.values())
    .filter(room => room.status === 'waiting')
    .map(room => ({
      id: room.id,
      name: room.name,
      hostId: room.hostId,
      playerCount: room.players.length,
      maxPlayers: room.maxPlayers,
      status: room.status
    }));
  res.json({ rooms: availableRooms });
});

// Create a new room
app.post('/api/rooms', (req, res) => {
  const { name, maxPlayers, hostId } = req.body;
  
  if (!name || !hostId || !maxPlayers) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (maxPlayers < 2 || maxPlayers > 6) {
    return res.status(400).json({ error: 'maxPlayers must be between 2 and 6' });
  }

  const roomId = uuidv4();
  const room: GameRoom = {
    id: roomId,
    name,
    hostId,
    players: [],
    maxPlayers,
    status: 'waiting',
  };

  rooms.set(roomId, room);
  
  res.json({ room: { id: room.id, name: room.name, maxPlayers: room.maxPlayers } });
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
  socket.on('identify', (data: { username: string }) => {
    const playerId = socket.id;
    const player: Player = {
      id: playerId,
      username: data.username,
      socketId: socket.id,
      connected: true
    };
    players.set(playerId, player);
    console.log('Player identified:', player.username, socket.data.authenticated ? '(authenticated user)' : '');
    socket.emit('identified', { 
      playerId, 
      username: player.username,
      authenticated: socket.data.authenticated 
    });
  });

  // Join a room
  socket.on('join_room', (data: { roomId: string }) => {
    const { roomId } = data;
    const room = rooms.get(roomId);
    const player = players.get(socket.id);

    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (!player) {
      socket.emit('error', { message: 'Player not identified' });
      return;
    }

    if (room.status !== 'waiting') {
      socket.emit('error', { message: 'Room is not accepting players' });
      return;
    }

    if (room.players.length >= room.maxPlayers) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }

    // Check if player is already in the room
    const existingPlayer = room.players.find(p => p.id === player.id);
    if (!existingPlayer) {
      room.players.push(player);
    }

    socket.join(roomId);
    
    // Notify everyone in the room
    io.to(roomId).emit('player_joined', {
      player: { id: player.id, username: player.username },
      room: {
        id: room.id,
        name: room.name,
        players: room.players.map(p => ({ id: p.id, username: p.username })),
        hostId: room.hostId
      }
    });

    console.log(`Player ${player.username} joined room ${room.name}`);
  });

  // Leave a room
  socket.on('leave_room', (data: { roomId: string }) => {
    const { roomId } = data;
    const room = rooms.get(roomId);
    const player = players.get(socket.id);

    if (!room || !player) return;

    // Remove player from room
    room.players = room.players.filter(p => p.id !== player.id);
    socket.leave(roomId);

    // Notify others
    io.to(roomId).emit('player_left', {
      playerId: player.id,
      room: {
        id: room.id,
        name: room.name,
        players: room.players.map(p => ({ id: p.id, username: p.username })),
        hostId: room.hostId
      }
    });

    // Delete room if empty
    if (room.players.length === 0) {
      rooms.delete(roomId);
      console.log(`Room ${room.name} deleted (empty)`);
    }

    console.log(`Player ${player.username} left room ${room.name}`);
  });

  // Start game (host posts START_GAME action with seed)
  socket.on('start_game', (data: { roomId: string }) => {
    const { roomId } = data;
    const room = rooms.get(roomId);
    const player = players.get(socket.id);

    if (!room || !player) return;

    // Only host can start the game
    if (room.hostId !== player.id) {
      socket.emit('error', { message: 'Only host can start the game' });
      return;
    }

    if (room.players.length < 2) {
      socket.emit('error', { message: 'Need at least 2 players to start' });
      return;
    }

    room.status = 'playing';
    
    // Initialize actions log for this game
    if (!gameActions.has(roomId)) {
      gameActions.set(roomId, []);
    }

    // Host should now post START_GAME action with seed via post_action event
    // We just notify clients that the game is ready to start
    io.to(roomId).emit('game_ready', {
      gameId: room.id,
      players: room.players.map((p, index) => ({ 
        id: p.id, 
        username: p.username,
        playerIndex: index // Assign player indices for the game
      }))
    });

    console.log(`Game ready in room ${room.name}, waiting for host to post START_GAME action`);
  });

  // Post a game action (event sourcing)
  socket.on('post_action', (data: { gameId: string; action: any }) => {
    const { gameId, action } = data;
    const player = players.get(socket.id);
    const room = rooms.get(gameId);

    if (!room || !player) return;

    // Get or create actions array for this game
    if (!gameActions.has(gameId)) {
      gameActions.set(gameId, []);
    }
    
    const actions = gameActions.get(gameId)!;
    
    // Create the action with metadata
    const gameAction: GameAction = {
      type: action.type,
      payload: action.payload || {},
      playerId: player.id,
      timestamp: Date.now(),
      sequence: actions.length
    };

    // Append to action log
    actions.push(gameAction);

    // Broadcast action to all players in the game
    io.to(gameId).emit('action_posted', gameAction);

    console.log(`Action ${gameAction.type} posted to game ${gameId} by ${player.username}`);
  });

  // Get all actions for a game (for new players or reconnection)
  socket.on('get_actions', (data: { gameId: string }) => {
    const { gameId } = data;
    const actions = gameActions.get(gameId) || [];
    
    socket.emit('actions_list', {
      gameId,
      actions
    });
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    const player = players.get(socket.id);

    if (player) {
      player.connected = false;

      // Find and update all rooms this player was in
      rooms.forEach((room) => {
        const playerInRoom = room.players.find(p => p.id === player.id);
        if (playerInRoom) {
          playerInRoom.connected = false;
          io.to(room.id).emit('player_disconnected', {
            playerId: player.id,
            username: player.username
          });
        }
      });

      // Clean up after a timeout (give them a chance to reconnect)
      setTimeout(() => {
        if (!player.connected) {
          players.delete(socket.id);
          
          // Remove from all rooms and clean up
          rooms.forEach((room, roomId) => {
            const idx = room.players.findIndex(p => p.id === player.id);
            if (idx !== -1) {
              room.players.splice(idx, 1);
              io.to(room.id).emit('player_left', {
                playerId: player.id,
                room: {
                  id: room.id,
                  name: room.name,
                  players: room.players.map(p => ({ id: p.id, username: p.username })),
                  hostId: room.hostId
                }
              });

              if (room.players.length === 0) {
                rooms.delete(roomId);
              }
            }
          });
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
