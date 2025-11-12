// Simple multiplayer server for Quortex MVP
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const httpServer = createServer(app);

// Configure CORS
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

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
  gameState?: any; // Will sync with Redux state
}

const rooms = new Map<string, GameRoom>();
const players = new Map<string, Player>();

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

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

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
    console.log('Player identified:', player.username);
    socket.emit('identified', { playerId, username: player.username });
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

  // Start game
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

    // Notify all players to start the game
    io.to(roomId).emit('game_started', {
      roomId: room.id,
      players: room.players.map(p => ({ id: p.id, username: p.username }))
    });

    console.log(`Game started in room ${room.name}`);
  });

  // Game state sync
  socket.on('game_state', (data: { roomId: string; state: any }) => {
    const { roomId, state } = data;
    const room = rooms.get(roomId);

    if (!room) return;

    room.gameState = state;

    // Broadcast state to all other players in the room
    socket.to(roomId).emit('game_state_update', { state });
  });

  // Handle moves
  socket.on('make_move', (data: { roomId: string; move: any }) => {
    const { roomId, move } = data;
    const room = rooms.get(roomId);
    const player = players.get(socket.id);

    if (!room || !player) return;

    // Broadcast move to all players in the room
    io.to(roomId).emit('move_made', {
      playerId: player.id,
      move
    });

    console.log(`Move made by ${player.username} in room ${room.name}`);
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
