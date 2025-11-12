# Discord Integration Architecture for Quortex

## 1. Executive Summary

This document outlines the architecture for integrating Quortex (Flows) as a Discord Activity, enabling players to play matches directly within a dedicated Discord server using an embedded web application.

**Key Features:**
- Full Quortex web game embedded in Discord via Discord Activities
- Support for 2-6 players per game (individual and team modes)
- Real-time multiplayer using WebSocket connections
- Complete web UI reused from existing implementation
- Persistent game state across Discord restarts
- Spectator mode for other server members
- Single-server deployment on dedicated Quortex Discord server

**Implementation Approach:**
- **Discord Activities (Embedded Web App)** - Full game runs in iframe within Discord
- **No slash commands** - All interaction through the embedded web UI
- **WebSocket-based** - Real-time game state synchronization
- **Dedicated server** - Bot only operates on the Quortex Discord server

**Related Documents:**
- [RULES.md](../RULES.md) - Complete game rules
- [DESIGN_DOC.md](DESIGN_DOC.md) - Core game implementation architecture
- [UI_DESIGN.md](UI_DESIGN.md) - Visual design specifications

## 2. Discord Platform Overview

### 2.1 Discord Activities

Discord Activities allow embedding full web applications directly into Discord using iframes. This provides:

- **Full Web UI** - Complete control over interface and interactions
- **Rich Graphics** - Canvas-based rendering with animations
- **Real-time Updates** - WebSocket for instant game state sync
- **Native Feel** - Integrated into Discord's UI seamlessly
- **Reuse Existing Code** - Leverage the complete existing Vite app

### 2.2 Technology Stack

- **Discord Bot Framework:** discord.js (Node.js/TypeScript)
- **Runtime:** Node.js or Bun (single Linux server)
- **Database:** MongoDB (game state persistence)
- **Web Framework:** Vite (existing app reused)
- **Real-time:** WebSocket (Socket.io or ws library)
- **Hosting:** Single Linux box (dedicated server)
- **Game Logic:** Reuse existing TypeScript game core from `/src/game/`
- **Frontend:** Existing Vite app from repository root

## 3. Architecture Overview

### 3.1 System Components

```
┌─────────────────────────────────────────────────────────────┐
│                   Discord Platform                           │
│  ┌────────────────────────────────────────────────────┐     │
│  │         Discord Activity (Embedded iframe)         │     │
│  │                                                    │     │
│  │    ┌──────────────────────────────────────┐       │     │
│  │    │    Quortex Vite App (Client-side)   │       │     │
│  │    │  • Canvas rendering                  │       │     │
│  │    │  • Input handling                    │       │     │
│  │    │  • Animation system                  │       │     │
│  │    │  • Redux state (local)               │       │     │
│  │    │  • WebSocket client                  │       │     │
│  │    └──────────────────────────────────────┘       │     │
│  │                      ▲                             │     │
│  │                      │ WebSocket                   │     │
│  │                      ▼                             │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  Authentication via Discord SDK                             │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ HTTPS + WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Single Linux Server (Node.js/Bun)              │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Discord Bot Process                     │   │
│  │  • Handles Discord events                           │   │
│  │  • Manages Activity lifecycle                       │   │
│  │  • User authentication/authorization                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Web Server (Express/Fastify)            │   │
│  │  • Serves Vite app (static files)                   │   │
│  │  • WebSocket server (Socket.io/ws)                  │   │
│  │  • Activity authentication endpoint                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Game State Manager                      │   │
│  │  • Active games in memory                           │   │
│  │  • Player sessions (userId → gameId)                │   │
│  │  • Real-time state sync via WebSocket               │   │
│  │  • Game lifecycle management                        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Quortex Game Core                         │
│  (Reused from existing codebase)                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  board.ts│  │ tiles.ts │  │ flows.ts │  │victory.ts│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│  ┌──────────┐  ┌──────────┐                               │
│  │legality.ts  │ types.ts │                               │
│  └──────────┘  └──────────┘                               │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    MongoDB Database                          │
│  • Game states (active and completed)                       │
│  • Player data and statistics                               │
│  • Move history and game replays                            │
│  • Server configuration                                     │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Data Flow

**Activity Launch Flow:**
1. User clicks "Play Quortex" in Discord Activity shelf
2. Discord loads iframe with Quortex app URL
3. App authenticates with Discord SDK
4. Backend validates Discord user token
5. WebSocket connection established
6. User joins game lobby or creates new game

**Game Play Flow:**
1. Client sends move via WebSocket to server
2. Server validates move using game logic
3. Server updates game state in MongoDB
4. Server broadcasts state update to all connected players
5. Clients receive update and render new board state
6. All players see synchronized game state in real-time
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Persistence Layer                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Database (PostgreSQL/MongoDB)           │   │
│  │  • Game states        • Player data                 │   │
│  │  • Move history       • Statistics                  │   │
│  │  • Server settings    • Leaderboards                │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Data Flow

**Game Creation Flow:**
1. User: `/quortex new 3` (3 players)
2. Bot: Creates game lobby embed with "Join Game" button
3. Players: Click "Join" button to join
4. Bot: Updates embed showing joined players
5. Creator: Clicks "Start Game" when ready
6. Bot: Begins seating phase with edge selection
7. Bot: Starts first turn with board image and action buttons

**Turn Flow:**
1. Bot: Posts turn message with:
   - Current board state image
   - Player's drawn tile preview
   - Rotation buttons (↶ ↷)
   - Placement select menu (legal positions)
   - Confirm/Cancel buttons
2. Player: Selects rotation and position
3. Player: Clicks confirm
4. Bot: Updates game state
5. Bot: Recalculates flows
6. Bot: Checks victory conditions
7. Bot: Posts updated board image
8. Bot: Either declares winner or starts next player's turn

## 4. Discord Activity Integration

### 4.1 Activity Registration

**Discord Developer Portal Setup:**
1. Create Discord Application at https://discord.com/developers
2. Enable "Activities" in the application settings
3. Configure Activity settings:
   - **Name:** Quortex
   - **Description:** Strategic tile-placement game for 2-6 players
   - **Activity URL:** `https://your-server.com/activity`
   - **Supported Platforms:** Desktop (primary), Mobile (future)
   - **Orientation:** Landscape preferred
   - **Age Rating:** Everyone

**OAuth2 Scopes Required:**
- `activities.read` - Read activity data
- `activities.write` - Update activity state
- `identify` - Get Discord user info
- `guilds` - Verify server membership

### 4.2 Authentication Flow

Discord Activities use OAuth2 for authentication:

```typescript
// Client-side (in embedded iframe)
import { DiscordSDK } from '@discord/embedded-app-sdk';

const discordSdk = new DiscordSDK(CLIENT_ID);

async function authenticate() {
  // Wait for Discord SDK ready
  await discordSdk.ready();
  
  // Authorize with Discord
  const { code } = await discordSdk.commands.authorize({
    client_id: CLIENT_ID,
    response_type: 'code',
    state: '',
    prompt: 'none',
    scope: ['identify', 'guilds', 'activities.read', 'activities.write'],
  });
  
  // Send code to backend for validation
  const response = await fetch('/api/auth/discord', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  
  const { token, userId, username } = await response.json();
  
  // Store auth token for WebSocket
  return { token, userId, username };
}
```

```typescript
// Server-side (Node.js/Bun)
import { verifyDiscordCode } from './discord-auth';

app.post('/api/auth/discord', async (req, res) => {
  const { code } = req.body;
  
  // Exchange code for access token
  const userData = await verifyDiscordCode(code);
  
  // Verify user is in Quortex Discord server
  if (!userData.guilds.includes(QUORTEX_SERVER_ID)) {
    return res.status(403).json({ error: 'Must join Quortex Discord server' });
  }
  
  // Create session token
  const token = createSessionToken(userData.id);
  
  res.json({
    token,
    userId: userData.id,
    username: userData.username,
  });
});
```

### 4.3 Embedded Web App

The Discord Activity loads the existing Vite app with minimal modifications:

**App Entry Point (`src/main.ts`):**
```typescript
import { DiscordSDK } from '@discord/embedded-app-sdk';
import { setupWebSocket } from './discord/websocket';
import { store } from './redux/store';
import { setDiscordUser } from './redux/actions';

// Initialize Discord SDK
const discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);

async function initDiscordActivity() {
  try {
    // Authenticate with Discord
    await discordSdk.ready();
    const auth = await authenticate();
    
    // Set up WebSocket for multiplayer
    const ws = await setupWebSocket(auth.token);
    
    // Update Redux state with Discord user
    store.dispatch(setDiscordUser({
      id: auth.userId,
      username: auth.username,
      isDiscordActivity: true,
    }));
    
    // Start the existing game
    initializeGame();
  } catch (error) {
    console.error('Failed to initialize Discord Activity:', error);
    showErrorScreen('Failed to connect to Discord');
  }
}

// Check if running in Discord
if (window.location.search.includes('frame_id')) {
  initDiscordActivity();
} else {
  // Running standalone (for development/testing)
  initializeGame();
}
```

### 4.4 No UI Changes Required

The existing Vite app already has all UI components needed:
- ✅ Lobby screen (player configuration)
- ✅ Seating phase (edge selection)
- ✅ Gameplay screen (tile placement, rotation, flows)
- ✅ Game over screen (victory animation)
- ✅ All rendering via Canvas
- ✅ All input handling (touch and mouse)

**Only additions needed:**
1. Discord SDK initialization
2. WebSocket client for multiplayer sync
3. Discord user authentication
- Buttons: "↶ Rotate CCW" and "Rotate CW ↷"
- Style: Secondary (gray)
- Action: Rotate current tile orientation

**Position Select Menu:**
- Component: Select menu with autocomplete
- Options: All legal hex positions (filtered by legality)
- Format: "Row: X, Col: Y" or "Center", "Top-Left", etc.
- Action: Preview tile placement

**Confirm Placement Button:**
- Label: "✓ Place Tile"
- Style: Success (green)
- Disabled until: Position selected
- Action: Execute move, advance turn

**Cancel Placement Button:**
- Label: "✗ Cancel"
- Style: Danger (red)
- Action: Clear selection, keep tile in hand

**Show Flows Toggle:**
- Label: "👁 Show Flows" / "👁 Hide Flows"
- Style: Secondary (gray)
- Action: Toggle flow visualization on board image

## 5. WebSocket Communication

### 5.1 WebSocket Protocol

All real-time game state synchronization happens via WebSocket:

**Client → Server Messages:**
```typescript
// Join game lobby
{
  type: 'JOIN_LOBBY',
  gameId: string | null,  // null = create new game
  playerCount?: number    // for new games
}

// Select edge in seating phase
{
  type: 'SELECT_EDGE',
  gameId: string,
  edge: number  // 0-5
}

// Place tile
{
  type: 'PLACE_TILE',
  gameId: string,
  position: { row: number, col: number },
  rotation: number  // 0-5
}

// Leave game
{
  type: 'LEAVE_GAME',
  gameId: string
}
```

**Server → Client Messages:**
```typescript
// Game state update (broadcast to all players)
{
  type: 'GAME_STATE',
  gameId: string,
  state: GameState,  // Full Redux-compatible state
  timestamp: number
}

// Error message
{
  type: 'ERROR',
  message: string,
  code: 'INVALID_MOVE' | 'GAME_NOT_FOUND' | 'NOT_YOUR_TURN' | ...
}

// Player joined/left
{
  type: 'PLAYER_UPDATE',
  gameId: string,
  players: Player[]
}
```

### 5.2 WebSocket Server Implementation

```typescript
// server/websocket.ts
import { WebSocketServer } from 'ws';
import { GameStateManager } from './game-manager';
import { validateDiscordToken } from './auth';

const wss = new WebSocketServer({ port: 8080 });
const gameManager = new GameStateManager();

wss.on('connection', async (ws, req) => {
  let userId: string | null = null;
  let currentGameId: string | null = null;
  
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      // Authenticate on first message
      if (!userId && message.token) {
        userId = await validateDiscordToken(message.token);
        if (!userId) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid token' }));
          ws.close();
          return;
        }
      }
      
      // Handle game actions
      switch (message.type) {
        case 'JOIN_LOBBY':
          const gameId = message.gameId || await gameManager.createGame(userId, message.playerCount);
          await gameManager.addPlayer(gameId, userId);
          currentGameId = gameId;
          broadcastGameState(gameId);
          break;
          
        case 'SELECT_EDGE':
          await gameManager.selectEdge(message.gameId, userId, message.edge);
          broadcastGameState(message.gameId);
          break;
          
        case 'PLACE_TILE':
          await gameManager.placeTile(
            message.gameId, 
            userId, 
            message.position, 
            message.rotation
          );
          broadcastGameState(message.gameId);
          break;
          
        case 'LEAVE_GAME':
          await gameManager.removePlayer(message.gameId, userId);
          broadcastGameState(message.gameId);
          break;
      }
    } catch (error) {
      ws.send(JSON.stringify({ type: 'ERROR', message: error.message }));
    }
  });
  
  ws.on('close', () => {
    if (currentGameId && userId) {
      gameManager.removePlayer(currentGameId, userId);
    }
  });
});

function broadcastGameState(gameId: string) {
  const state = gameManager.getGameState(gameId);
  const message = JSON.stringify({
    type: 'GAME_STATE',
    gameId,
    state,
    timestamp: Date.now()
  });
  
  // Send to all connected clients in this game
  wss.clients.forEach(client => {
    if (client.gameId === gameId && client.readyState === 1) {
      client.send(message);
    }
  });
}
```

## 6. Game State Management

### 6.1 State Structure

```typescript
interface DiscordGameState {
  // Game identification
  gameId: string;              // Unique game identifier
  serverId: string;            // Discord server (guild) ID - always QUORTEX_SERVER_ID
  creatorId: string;           // Discord user ID of creator
  
  // Game phase
  phase: 'lobby' | 'seating' | 'playing' | 'finished';
  
  // Players
  players: DiscordPlayer[];
  teams: Team[];               // For 4-6 player games
  currentPlayerIndex: number;
  
  // Core game state (from existing implementation)
  board: Map<string, PlacedTile>;
  availableTiles: TileType[];
  currentTile: TileType | null;
  flows: Map<string, Set<string>>;
  
  // Game result
  winner: string | null;       // Player ID or team ID
  winType: 'flow' | 'constraint' | 'tie' | null;
  
  // Move history
  moveHistory: DiscordMove[];
  
  // Settings
  allowSpectators: boolean;
  
  // Timestamps
  createdAt: Date;
  startedAt: Date | null;
  lastMoveAt: Date;
}

interface DiscordPlayer extends Player {
  discordUserId: string;       // Discord user ID
  discordUsername: string;     // Discord username (for display)
  isAI: boolean;               // AI player flag (future)
}

interface DiscordMove extends Move {
  discordUserId: string;
  duration: number;            // Milliseconds taken for move
  timestamp: Date;
}
```

### 6.2 MongoDB Schema

**Database:** `quortex`

**Collections:**

```typescript
// games collection
{
  _id: ObjectId,
  gameId: string,              // UUID
  serverId: string,            // Always the Quortex server ID
  creatorId: string,           // Discord user ID
  phase: 'lobby' | 'seating' | 'playing' | 'finished',
  players: [{
    discordUserId: string,
    discordUsername: string,
    color: string,
    edge: number,
    isAI: boolean
  }],
  teams: [{
    player1Id: string,
    player2Id: string
  }],
  currentPlayerIndex: number,
  board: {                     // Serialized as object
    "0,0": { type: 0, rotation: 2 },
    "1,-1": { type: 1, rotation: 0 },
    // ...
  },
  availableTiles: [0, 1, 2, 0, 3, ...],  // Array of TileType
  currentTile: number | null,
  flows: {                     // Serialized as object
    "player1": ["0,0", "1,0", ...],
    "player2": ["0,1", "-1,1", ...],
  },
  winner: string | null,
  winType: string | null,
  allowSpectators: boolean,
  createdAt: ISODate,
  startedAt: ISODate | null,
  lastMoveAt: ISODate,
}

// moves collection
{
  _id: ObjectId,
  gameId: string,
  discordUserId: string,
  moveNumber: number,
  tileType: number,
  tileRotation: number,
  positionRow: number,
  positionCol: number,
  duration: number,            // Milliseconds
  timestamp: ISODate
}

// player_stats collection
{
  _id: ObjectId,
  discordUserId: string,
  discordUsername: string,
  gamesPlayed: number,
  gamesWon: number,
  totalMoves: number,
  avgMoveTime: number,         // Milliseconds
  lastPlayedAt: ISODate
}

// server_config collection (single document)
{
  _id: ObjectId,
  serverId: string,            // The Quortex Discord server ID
  allowSpectators: boolean,
  maxActiveGames: number,
  updatedAt: ISODate
}
```

**Indexes:**
```javascript
// games collection
db.games.createIndex({ gameId: 1 }, { unique: true });
db.games.createIndex({ phase: 1 });
db.games.createIndex({ lastMoveAt: 1 });

// moves collection
db.moves.createIndex({ gameId: 1, moveNumber: 1 });
db.moves.createIndex({ gameId: 1 });

// player_stats collection
db.player_stats.createIndex({ discordUserId: 1 }, { unique: true });
```

### 6.3 State Synchronization

**Concurrency Handling:**
- WebSocket message queue per game
- Lock game state during move processing
- Broadcast updates to all connected players
- MongoDB atomic operations for state updates

**Example Lock Implementation:**
```typescript
class GameStateManager {
  private locks: Map<string, Promise<void>> = new Map();
  private games: Map<string, DiscordGameState> = new Map();
  
  async withLock<T>(gameId: string, fn: () => Promise<T>): Promise<T> {
    // Wait for existing lock
    while (this.locks.has(gameId)) {
      await this.locks.get(gameId);
    }
    
    // Acquire lock
    let release: () => void;
    const lock = new Promise<void>(resolve => { release = resolve; });
    this.locks.set(gameId, lock);
    
    try {
      return await Promise.race([
        fn(),
        timeout(5000, 'Lock timeout')
      ]);
    } finally {
      this.locks.delete(gameId);
      release!();
    }
  }
  
  async placeTile(gameId: string, userId: string, position: HexPosition, rotation: Rotation) {
    return this.withLock(gameId, async () => {
      const game = await this.getGame(gameId);
      
      // Validate it's player's turn
      if (game.players[game.currentPlayerIndex].discordUserId !== userId) {
        throw new Error('Not your turn');
      }
      
      // Use existing game logic
      const move = { type: game.currentTile!, rotation, position };
      if (!isLegalMove(game.board, move, game.players, game.teams)) {
        throw new Error('Illegal move');
      }
      
      // Apply move
      game.board.set(`${position.row},${position.col}`, {
        type: game.currentTile!,
        rotation,
        position
      });
      
      // Update flows
      game.flows = calculateFlows(game.board, game.players);
      
      // Check victory
      const victory = checkVictory(game.board, game.flows, game.players, game.teams);
      if (victory.winner) {
        game.winner = victory.winner;
        game.winType = victory.winType;
        game.phase = 'finished';
      } else {
        // Next player
        game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
        game.currentTile = game.availableTiles.pop() || null;
      }
      
      game.lastMoveAt = new Date();
      
      // Save to MongoDB
      await this.saveGame(game);
      
      return game;
    });
  }
}
```

## 7. Client-Side Integration

### 7.1 No Server-Side Rendering Needed

Unlike a slash command approach, Discord Activities use the **full embedded web app**. All rendering happens client-side using the existing Canvas-based renderer.

**Advantages:**
- ✅ Reuse 100% of existing rendering code
- ✅ All animations work out of the box
- ✅ Touch and mouse input already implemented
- ✅ No image generation or upload overhead
- ✅ Real-time updates without polling

### 7.2 Minimal Code Changes to Existing App

The existing Vite app only needs:

1. **Discord SDK integration** (already shown in section 4.3)
2. **WebSocket client** for multiplayer sync
3. **Conditional initialization** (Discord vs standalone)

**WebSocket Client (`src/discord/websocket.ts`):**
```typescript
import { store } from '../redux/store';
import { setGameState, addPlayer, removePlayer } from '../redux/actions';

export class GameWebSocket {
  private ws: WebSocket;
  private reconnectAttempts = 0;
  
  constructor(private token: string) {
    this.connect();
  }
  
  private connect() {
    this.ws = new WebSocket('wss://your-server.com/ws');
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      // Send auth token
      this.send({ token: this.token });
    };
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.reconnect();
    };
  }
  
  private handleMessage(message: any) {
    switch (message.type) {
      case 'GAME_STATE':
        // Update Redux store with server state
        store.dispatch(setGameState(message.state));
        break;
        
      case 'PLAYER_UPDATE':
        message.players.forEach(p => {
          store.dispatch(addPlayer(p));
        });
        break;
        
      case 'ERROR':
        console.error('Server error:', message.message);
        break;
    }
  }
  
  private reconnect() {
    if (this.reconnectAttempts < 5) {
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect();
      }, 1000 * Math.pow(2, this.reconnectAttempts));
    }
  }
  
  send(message: any) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
  
  joinLobby(gameId: string | null, playerCount?: number) {
    this.send({ type: 'JOIN_LOBBY', gameId, playerCount });
  }
  
  selectEdge(gameId: string, edge: number) {
    this.send({ type: 'SELECT_EDGE', gameId, edge });
  }
  
  placeTile(gameId: string, position: HexPosition, rotation: Rotation) {
    this.send({ type: 'PLACE_TILE', gameId, position, rotation });
  }
  
  leaveGame(gameId: string) {
    this.send({ type: 'LEAVE_GAME', gameId });
  }
}
```

### 7.3 Redux Action Interception

When running in Discord Activity mode, Redux actions that modify game state should be sent to server instead of applied locally:

```typescript
// src/redux/discordMiddleware.ts
import { Middleware } from 'redux';
import { GameWebSocket } from '../discord/websocket';

let wsClient: GameWebSocket | null = null;

export function setWebSocketClient(client: GameWebSocket) {
  wsClient = client;
}

export const discordMiddleware: Middleware = store => next => action => {
  // If running in Discord Activity and have WebSocket
  if (wsClient && window.location.search.includes('frame_id')) {
    // Intercept game-modifying actions
    switch (action.type) {
      case 'PLACE_TILE':
        const state = store.getState();
        wsClient.placeTile(state.game.gameId, action.payload.position, action.payload.rotation);
        return; // Don't apply locally, wait for server broadcast
        
      case 'SELECT_EDGE':
        wsClient.selectEdge(state.game.gameId, action.payload.edge);
        return;
        
      // Let other actions through
      default:
        return next(action);
    }
  } else {
    // Standalone mode, apply locally
    return next(action);
  }
};
```

## 8. Deployment Architecture

### 8.1 Single Server Setup

**Server Requirements:**
- Linux box (Ubuntu 22.04 LTS recommended)
- 2 vCPU, 4GB RAM minimum
- 20GB SSD storage
- Public IP address with ports 443 (HTTPS) and 8080 (WebSocket)

**Software Stack:**
```
Linux Server
├── Node.js v20+ OR Bun v1.0+
├── MongoDB 7.0+
├── Nginx (reverse proxy)
├── PM2 (process manager)
└── Let's Encrypt (SSL certificates)
```

### 8.2 Directory Structure

```
/opt/quortex-discord/
├── backend/
│   ├── src/
│   │   ├── discord-bot.ts       # Discord bot process
│   │   ├── web-server.ts        # Express/Fastify server
│   │   ├── websocket.ts         # WebSocket server
│   │   ├── game-manager.ts      # Game state management
│   │   ├── auth.ts              # Discord authentication
│   │   └── db/
│   │       └── mongodb.ts       # MongoDB connection
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── (existing Vite app)
│   ├── dist/                    # Built static files
│   └── vite.config.ts
└── nginx/
    └── quortex.conf             # Nginx configuration
```

### 8.3 Deployment Steps

**1. Install Dependencies:**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (or Bun)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install MongoDB
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Install Nginx
sudo apt install -y nginx certbot python3-certbot-nginx

# Install PM2
sudo npm install -g pm2
```

**2. Clone and Build:**
```bash
cd /opt
sudo git clone https://github.com/your-username/quortextt.git quortex-discord
cd quortex-discord

# Build frontend
npm install
npm run build

# Setup backend
cd backend
npm install
npm run build
```

**3. Configure Environment:**
```bash
# /opt/quortex-discord/backend/.env
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_BOT_TOKEN=your_bot_token
QUORTEX_SERVER_ID=your_server_id
MONGODB_URI=mongodb://localhost:27017/quortex
NODE_ENV=production
PORT=3000
WS_PORT=8080
```

**4. Configure Nginx:**
```nginx
# /etc/nginx/sites-available/quortex
server {
    listen 80;
    server_name your-domain.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # Serve static Vite app
    location / {
        root /opt/quortex-discord/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # API endpoints
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # WebSocket
    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**5. Start Services:**
```bash
# Enable Nginx site
sudo ln -s /etc/nginx/sites-available/quortex /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Start backend with PM2
cd /opt/quortex-discord/backend
pm2 start dist/index.js --name quortex-discord
pm2 save
pm2 startup
```

### 8.4 Monitoring and Maintenance

**PM2 Commands:**
```bash
pm2 status              # Check status
pm2 logs quortex-discord  # View logs
pm2 restart quortex-discord  # Restart app
pm2 monit              # Real-time monitoring
```

**MongoDB Maintenance:**
```bash
# Backup database
mongodump --db quortex --out /backups/$(date +%Y%m%d)

# Monitor performance
mongosh
> use quortex
> db.stats()
> db.games.find({phase: "playing"}).count()
```

**Log Files:**
- PM2 logs: `~/.pm2/logs/`
- Nginx logs: `/var/log/nginx/`
- MongoDB logs: `/var/log/mongodb/mongod.log`

### 8.5 Cost Estimate

**Hardware/Hosting:**
- VPS (2 vCPU, 4GB RAM, 20GB SSD): **$10-20/month**
  - Hetzner Cloud CX21: €4.90/month (~$5.50)
  - DigitalOcean Droplet: $12/month
  - Linode Shared 4GB: $24/month

**Domain & SSL:**
- Domain name: **$10-15/year**
- SSL certificate: **Free** (Let's Encrypt)

**Total:** **$10-20/month** + ~$1/month for domain

**Capacity:**
- 10-20 concurrent games
- 50-100 active players
- Sufficient for dedicated Quortex Discord server


## 9. Development Roadmap

### 9.1 Implementation Phases

**Phase 1: Discord Activity Setup (Week 1)**
- [ ] Register Discord Application
- [ ] Enable Activities in Developer Portal
- [ ] Set up development server
- [ ] Configure OAuth2 scopes
- [ ] Test basic Activity embedding

**Phase 2: Backend Infrastructure (Weeks 2-3)**
- [ ] Set up MongoDB database
- [ ] Implement Discord authentication
- [ ] Create WebSocket server
- [ ] Implement game state manager with locking
- [ ] Add MongoDB persistence layer
- [ ] Test with mock clients

**Phase 3: Frontend Integration (Weeks 4-5)**
- [ ] Add Discord SDK to Vite app
- [ ] Implement WebSocket client
- [ ] Add Redux middleware for multiplayer sync
- [ ] Test authentication flow
- [ ] Test game state synchronization
- [ ] Handle edge cases (disconnection, reconnection)

**Phase 4: Multiplayer Testing (Week 6)**
- [ ] Test 2-player games end-to-end
- [ ] Test 3-6 player games
- [ ] Test team modes (4-6 players)
- [ ] Performance testing with multiple concurrent games
- [ ] Fix any synchronization bugs

**Phase 5: Deployment (Week 7)**
- [ ] Set up production Linux server
- [ ] Install and configure MongoDB
- [ ] Deploy backend with PM2
- [ ] Configure Nginx reverse proxy
- [ ] Set up SSL certificates
- [ ] Deploy to Discord Activity shelf

**Phase 6: Polish & Launch (Week 8)**
- [ ] Add spectator mode
- [ ] Implement game statistics
- [ ] Add error handling and recovery
- [ ] Create user documentation
- [ ] Beta test with Quortex Discord community
- [ ] Official launch

### 9.2 Future Enhancements

- **AI Opponents** - Integrate existing AI from web version
- **Game Replays** - Save and replay completed games
- **Tournaments** - Organized tournament brackets
- **Leaderboards** - Track wins, statistics
- **Mobile Support** - Optimize for Discord mobile app
- **Voice Integration** - Activity voice channel features
- **Custom Boards** - Different board sizes/shapes
- **Achievements** - Discord-style achievements system

## 10. Security and Privacy

### 10.1 Data Privacy

**Data Collected:**
- Discord user IDs (for game state)
- Discord usernames (for display)
- Game moves and timestamps
- Player statistics

**Data NOT Collected:**
- No messages outside the Activity
- No voice data
- No personal information beyond Discord username
- No tracking across servers (single-server only)

**Privacy Policy:**
- Clear documentation of data usage
- GDPR compliance
- Users can request data deletion
- Data retention: 90 days after last activity

### 10.2 Security Measures

**Authentication:**
- OAuth2 via Discord SDK
- Verify user is member of Quortex Discord server
- Session tokens with expiration
- WebSocket authentication required

**Game State Security:**
- Server-side move validation
- Prevent client-side cheating
- MongoDB injection prevention
- Rate limiting on WebSocket messages

**Infrastructure Security:**
- HTTPS only (Let's Encrypt SSL)
- Nginx security headers
- MongoDB authentication enabled
- Regular security updates

### 10.3 Rate Limiting

**Per User:**
- Max 10 WebSocket messages per second
- Max 3 concurrent games
- Cooldown between creating games (30 seconds)

**Per Server:**
- Max 20 active games (configurable)
- WebSocket connection limit
- Database query limits

## 11. Spectator Mode

### 11.1 Implementation

Spectators can view games in real-time through the embedded Activity:

**Spectator Features:**
- Read-only view of game board
- See all players and current turn
- View move history
- No interaction with game

**How to Spectate:**
1. Open Quortex Activity in Discord
2. Select "Spectate Game" from lobby
3. Choose game from active games list
4. View game in real-time

**WebSocket Messages:**
```typescript
// Join as spectator
{
  type: 'SPECTATE',
  gameId: string
}

// Spectators receive same GAME_STATE broadcasts
// But cannot send game-modifying actions
```

## 12. Success Metrics

### 12.1 Key Performance Indicators

**Adoption:**
- Active players per day
- Games created per day
- Game completion rate

**Engagement:**
- Average game duration
- Average moves per game
- Return player rate (weekly)

**Quality:**
- Error rate (< 1%)
- Average response time (< 500ms)
- Server uptime (> 99%)

**Target Goals (Month 1):**
- 20+ active players
- 50+ games completed
- 90%+ completion rate
- < 5 critical bugs

## 13. Testing Strategy

### 13.1 Development Testing

**Local Testing:**
```bash
# Terminal 1: Start MongoDB
mongod

# Terminal 2: Start backend
cd backend
npm run dev

# Terminal 3: Start Vite dev server
npm run dev

# Use Discord Developer Portal test servers
```

**Discord Test Server:**
- Create test Discord server
- Install Activity in test mode
- Test with multiple Discord accounts
- Verify authentication and multiplayer

### 13.2 Production Testing

- Gradual rollout to Quortex Discord server
- Monitor PM2 logs and MongoDB
- Track error rates and performance
- Gather user feedback
- Fix issues quickly

## 14. Troubleshooting

### 14.1 Common Issues

**Activity Won't Load:**
- Check Discord Application settings
- Verify Activity URL is correct and HTTPS
- Check server logs for errors
- Ensure SSL certificate is valid

**WebSocket Connection Fails:**
- Check firewall allows port 8080
- Verify Nginx WebSocket configuration
- Check WebSocket server is running
- Test with `wscat -c wss://your-domain.com/ws`

**Authentication Errors:**
- Verify Discord Client ID and Secret
- Check OAuth2 scopes are correct
- Ensure user is in Quortex Discord server
- Check session token expiration

**Game State Desync:**
- Check MongoDB connection
- Verify WebSocket broadcasts
- Check for race conditions in game manager
- Review locking implementation

### 14.2 Debugging Commands

```bash
# Check server status
pm2 status
pm2 logs quortex-discord --lines 100

# Check MongoDB
mongosh
> use quortex
> db.games.find({phase: "playing"}).pretty()

# Check Nginx
sudo nginx -t
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Check WebSocket connections
ss -tulpn | grep 8080

# Test WebSocket
wscat -c wss://your-domain.com/ws
```

## 15. Conclusion

This architecture provides a streamlined approach to integrating Quortex into Discord using Discord Activities and MongoDB:

**Key Benefits:**
- ✅ Reuses 100% of existing game UI and rendering
- ✅ MongoDB for flexible document storage
- ✅ Single Linux server deployment (simple, cost-effective)
- ✅ WebSocket for real-time multiplayer
- ✅ Dedicated Quortex Discord server (focused community)
- ✅ No slash commands complexity
- ✅ Native Discord experience via embedded Activity

**Total Cost:** ~$10-20/month for VPS + ~$1/month for domain

**Timeline:** 8 weeks from setup to launch

**Next Steps:**
1. Register Discord Application
2. Set up development server
3. Begin Phase 1 implementation
4. Iterate based on testing feedback

---

**Document Version:** 2.0 (Revised for MongoDB + Activity approach)  
**Last Updated:** 2024-11-12  
**Author:** Quortex Development Team  
**Status:** Revised Architecture
