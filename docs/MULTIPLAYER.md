# Quortex Multiplayer (MVP)

This document describes how to use the multiplayer functionality in Quortex.

## Overview

The multiplayer implementation consists of:
- **Frontend**: Svelte-based UI for login, lobby, and room management
- **Backend**: Express + Socket.IO server for real-time communication
- **In-Memory Storage**: Simple room and player management (no database)

## Getting Started

### Prerequisites

- Node.js v18 or later
- npm v9 or later

### Running the Multiplayer Server

1. Start the server:
```bash
npm run dev:server
```

The server will start on `http://localhost:3001` by default.

### Running the Client

1. Start the development server:
```bash
npm run dev
```

2. Open your browser and navigate to:
```
http://localhost:5173/quortextt/multiplayer.html
```

### Playing Multiplayer

1. **Login**: Enter a username (no password required for MVP)
2. **Lobby**: View available game rooms or create a new one
3. **Create Room**: Set a room name and maximum number of players (2-6)
4. **Wait for Players**: Share the room with friends who can join
5. **Start Game**: Host starts the game when ready (minimum 2 players)

## Architecture

### Server (`/server`)

The server handles:
- WebSocket connections via Socket.IO
- Room creation and management
- Player connection/disconnection
- Real-time event broadcasting

Key files:
- `server/src/index.ts` - Main server entry point

### Client (`/src/multiplayer`)

The client provides:
- Svelte components for UI screens
- Socket.IO client for server communication
- State management via Svelte stores

Key files:
- `src/multiplayer/App.svelte` - Main multiplayer app component
- `src/multiplayer/components/` - UI screens (Login, Lobby, Room)
- `src/multiplayer/socket.ts` - Socket.IO client wrapper
- `src/multiplayer/stores/multiplayerStore.ts` - State management

### Entry Points

- `index.html` - Single-player game (original)
- `multiplayer.html` - Multiplayer game with lobby UI
- `src/main.ts` - Single-player entry point
- `src/multiplayerMain.ts` - Multiplayer entry point

## Configuration

Environment variables (create `.env` from `.env.example`):

```bash
# Server configuration
PORT=3001
CLIENT_URL=http://localhost:5173

# Client configuration (for Vite)
VITE_SERVER_URL=http://localhost:3001
```

## Current Limitations (MVP)

- No persistent storage (rooms and players are lost on server restart)
- No authentication (username only, no passwords)
- No reconnection handling after disconnect
- Game state synchronization not fully implemented yet
- No spectator mode
- No chat functionality

## Future Enhancements

Planned features for future releases:
- Database integration (MongoDB)
- OAuth authentication (Facebook, Google, Discord, Apple)
- Game state persistence and replay
- Reconnection handling
- Chat system
- Leaderboards
- Tournament support

## Troubleshooting

### Server won't start

- Check if port 3001 is already in use
- Ensure all dependencies are installed: `cd server && npm install`

### Client can't connect to server

- Verify server is running on port 3001
- Check CORS configuration in `server/src/index.ts`
- Ensure `VITE_SERVER_URL` environment variable is set correctly

### UI not displaying correctly

- Clear browser cache and reload
- Check browser console for errors
- Ensure Svelte dependencies are installed: `npm install`

## Development

### Building

Build the client:
```bash
npm run build
```

Build the server:
```bash
npm run build:server
```

### Testing

Run unit tests:
```bash
npm test
```

Note: End-to-end multiplayer tests are not yet implemented.

## API Reference

### REST Endpoints

- `GET /api/rooms` - List available rooms
- `POST /api/rooms` - Create a new room
- `GET /health` - Server health check

### Socket.IO Events

**Client → Server:**
- `identify` - Register username
- `join_room` - Join a game room
- `leave_room` - Leave a game room
- `start_game` - Start the game (host only)
- `make_move` - Submit a game move
- `game_state` - Send game state update

**Server → Client:**
- `identified` - Confirmation of player identification
- `player_joined` - Player joined the room
- `player_left` - Player left the room
- `player_disconnected` - Player disconnected
- `game_started` - Game has started
- `game_state_update` - Game state changed
- `move_made` - Move was made by a player
- `error` - Error message

## License

This project is licensed under the GNU General Public License v3.0.
