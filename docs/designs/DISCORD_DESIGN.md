# Discord Integration Architecture for Quortex

## 1. Executive Summary

This document outlines a comprehensive architecture for integrating Quortex (Flows) as a Discord Application, enabling players to play matches directly within Discord servers through interactive messages, slash commands, and embedded game views.

**Key Features:**
- Play complete Quortex games within Discord channels
- Support for 2-6 players per game (individual and team modes)
- Interactive tile placement using Discord's message components
- Real-time game state visualization using Discord embeds and images
- Turn-based gameplay with Discord notifications
- Persistent game state across Discord restarts
- Spectator mode for other server members

**Related Documents:**
- [RULES.md](../RULES.md) - Complete game rules
- [DESIGN_DOC.md](DESIGN_DOC.md) - Core game implementation architecture
- [UI_DESIGN.md](UI_DESIGN.md) - Visual design specifications

## 2. Discord Platform Overview

### 2.1 Discord Application Types

Discord offers several integration approaches:

1. **Discord Bot** - Automated user that can respond to commands and events
2. **Slash Commands** - First-class command interface with autocomplete
3. **Message Components** - Interactive buttons and select menus
4. **Embeds** - Rich formatted messages with images and fields
5. **Activities (Beta)** - Embedded web applications using iframe

**Recommended Approach:** Hybrid Bot + Slash Commands + Message Components

### 2.2 Technology Stack

- **Discord Bot Framework:** discord.js (Node.js) or discord.py (Python)
- **Backend:** Node.js/TypeScript (matches existing codebase)
- **Database:** PostgreSQL or MongoDB (game state persistence)
- **Image Generation:** Canvas API or Sharp (board visualization)
- **Hosting:** Cloud platform (AWS, Google Cloud, Heroku, Railway)
- **Game Logic:** Reuse existing TypeScript game core from `/src/game/`

## 3. Architecture Overview

### 3.1 System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      Discord Platform                        │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │   Users    │  │   Channels   │  │  Message Events  │    │
│  └────────────┘  └──────────────┘  └──────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ Discord API (Gateway + REST)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Discord Bot Backend                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Command Handler                         │   │
│  │  • /quortex new       • /quortex join               │   │
│  │  • /quortex move      • /quortex status             │   │
│  │  • /quortex leave     • /quortex help               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Interaction Handler                     │   │
│  │  • Button clicks      • Select menus                │   │
│  │  • Modal submissions  • Autocomplete                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Game State Manager                      │   │
│  │  • Active games map   • Player sessions             │   │
│  │  • Turn management    • Game lifecycle              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Rendering Engine                        │   │
│  │  • Board image generation (Canvas)                  │   │
│  │  • Tile visualization                               │   │
│  │  • Flow path rendering                              │   │
│  │  • Embed formatting                                 │   │
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

## 4. Command Interface Design

### 4.1 Slash Commands

#### `/quortex new [players]`
Create a new game lobby.

**Parameters:**
- `players` (integer, 2-6, optional): Number of players (default: 2)

**Response:** Embed with:
- Game ID
- Creator
- Player count
- Status: "Waiting for players"
- Join button

**Example:**
```
🎮 Quortex Game #1234
Creator: @alice
Players: 1/3

Waiting for players to join...

[Join Game] [Cancel]
```

#### `/quortex join [game-id]`
Join an existing game lobby.

**Parameters:**
- `game-id` (string, optional): Game ID (defaults to most recent in channel)

**Response:** Updates lobby embed, adds player to list

#### `/quortex leave [game-id]`
Leave a game lobby or resign from active game.

**Parameters:**
- `game-id` (string, optional): Game ID

**Response:** Removes player from game, potentially ends game

#### `/quortex move`
Take a turn in your active game (alternative to buttons).

**Response:** Opens a modal with:
- Tile rotation selector
- Position selector (autocomplete)
- Confirm/Cancel

#### `/quortex status [game-id]`
View current game state.

**Parameters:**
- `game-id` (string, optional): Game ID

**Response:** Embed showing:
- Current player
- Board image
- Player list and edges
- Turn count
- Move history (last 5)

#### `/quortex help [topic]`
Display help information.

**Parameters:**
- `topic` (string, optional): Specific help topic

**Topics:**
- `rules` - Basic game rules
- `commands` - Command reference
- `controls` - How to play via Discord
- `tips` - Strategy tips

#### `/quortex settings [option] [value]`
Configure bot behavior (admin only).

**Options:**
- `channel` - Set default game channel
- `notifications` - Turn notification style (mention/reply/silent)
- `spectators` - Allow/disallow spectators
- `timeout` - Turn timeout duration (minutes)

### 4.2 Message Components

#### Lobby Phase Components

**Join Game Button:**
- Label: "Join Game"
- Style: Primary (blue)
- Action: Add user to player list

**Start Game Button:**
- Label: "Start Game"
- Style: Success (green)
- Disabled until: Minimum players reached
- Action: Begin seating phase

**Cancel Game Button:**
- Label: "Cancel"
- Style: Danger (red)
- Action: Delete game

#### Seating Phase Components

**Edge Selection:**
- Component: Select menu
- Options: Available edges (0-5, colored)
- Label: "Choose your edge"
- Action: Assign player to edge

#### Gameplay Phase Components

**Rotation Buttons:**
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

## 5. Game State Management

### 5.1 State Structure

```typescript
interface DiscordGameState {
  // Discord-specific metadata
  gameId: string;              // Unique game identifier
  serverId: string;            // Discord server (guild) ID
  channelId: string;           // Channel where game is played
  creatorId: string;           // Discord user ID of creator
  messageId: string;           // ID of main game message
  
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
  turnTimeoutMinutes: number;
  notifyOnTurn: boolean;
  allowSpectators: boolean;
  
  // Timestamps
  createdAt: number;
  startedAt: number | null;
  lastMoveAt: number;
  expiresAt: number | null;
}

interface DiscordPlayer extends Player {
  discordUserId: string;       // Discord user ID
  discordUsername: string;     // Discord username (for display)
  isBot: boolean;              // AI player flag
  hasTimedOut: boolean;        // Turn timeout flag
}

interface DiscordMove extends Move {
  discordUserId: string;
  duration: number;            // Seconds taken for move
}

// Temporary interaction state (not persisted)
interface PlayerInteractionState {
  userId: string;
  gameId: string;
  currentRotation: Rotation;
  selectedPosition: HexPosition | null;
  lastInteractionTime: number;
}
```

### 5.2 State Persistence

**Database Schema (PostgreSQL):**

```sql
-- Games table
CREATE TABLE games (
  game_id VARCHAR(32) PRIMARY KEY,
  server_id VARCHAR(32) NOT NULL,
  channel_id VARCHAR(32) NOT NULL,
  creator_id VARCHAR(32) NOT NULL,
  message_id VARCHAR(32),
  phase VARCHAR(20) NOT NULL,
  game_state JSONB NOT NULL,        -- Serialized game state
  created_at TIMESTAMP NOT NULL,
  started_at TIMESTAMP,
  last_move_at TIMESTAMP,
  expires_at TIMESTAMP,
  INDEX idx_server_channel (server_id, channel_id),
  INDEX idx_expires_at (expires_at)
);

-- Players in games
CREATE TABLE game_players (
  game_id VARCHAR(32) NOT NULL,
  discord_user_id VARCHAR(32) NOT NULL,
  player_index INTEGER NOT NULL,
  edge_position INTEGER,
  is_ai BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMP NOT NULL,
  PRIMARY KEY (game_id, discord_user_id),
  FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
);

-- Move history
CREATE TABLE moves (
  move_id SERIAL PRIMARY KEY,
  game_id VARCHAR(32) NOT NULL,
  discord_user_id VARCHAR(32) NOT NULL,
  move_number INTEGER NOT NULL,
  tile_type INTEGER NOT NULL,
  tile_rotation INTEGER NOT NULL,
  position_row INTEGER NOT NULL,
  position_col INTEGER NOT NULL,
  duration INTEGER,                 -- Seconds
  created_at TIMESTAMP NOT NULL,
  FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE,
  INDEX idx_game_moves (game_id, move_number)
);

-- Server settings
CREATE TABLE server_settings (
  server_id VARCHAR(32) PRIMARY KEY,
  default_channel_id VARCHAR(32),
  turn_timeout_minutes INTEGER DEFAULT 30,
  notify_on_turn BOOLEAN DEFAULT TRUE,
  allow_spectators BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP NOT NULL
);

-- Statistics
CREATE TABLE player_stats (
  discord_user_id VARCHAR(32) PRIMARY KEY,
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  total_moves INTEGER DEFAULT 0,
  avg_move_time FLOAT DEFAULT 0,
  last_played_at TIMESTAMP
);
```

**Caching Strategy:**
- Keep active games in memory (Redis or in-process Map)
- Persist to database on each move
- Load from database on bot restart
- Clean up expired games (older than 24 hours of inactivity)

### 5.3 State Synchronization

**Concurrency Handling:**
- Use message interaction IDs to prevent duplicate actions
- Lock game state during move processing
- Queue interactions if move in progress
- Timeout locks after 5 seconds

**Example Lock Implementation:**
```typescript
class GameStateManager {
  private locks: Map<string, Promise<void>> = new Map();
  
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
}
```

## 6. Rendering and Visualization

### 6.1 Board Image Generation

**Approach:** Server-side rendering using Canvas API

**Image Specifications:**
- Format: PNG
- Size: 800x800 pixels (fits Discord embed limit)
- Background: Light gray (table surface)
- Board: Hexagonal grid with colored edges
- Tiles: Rendered with Bézier curve flow paths
- Flows: Color-coded paths in player colors
- Current tile: Highlighted preview at selected position

**Canvas Rendering Stack:**
```typescript
class DiscordBoardRenderer {
  private canvas: Canvas;
  private ctx: CanvasRenderingContext2D;
  
  // Reuse layout calculations from existing codebase
  private layout: HexLayout;
  
  constructor(boardRadius: number = 3) {
    this.canvas = createCanvas(800, 800);
    this.ctx = this.canvas.getContext('2d');
    this.layout = calculateLayout(this.canvas.width, this.canvas.height, boardRadius);
  }
  
  // Render complete board state
  async renderBoard(
    board: Map<string, PlacedTile>,
    flows: Map<string, Set<string>>,
    players: Player[],
    currentTile?: { type: TileType; rotation: Rotation; position: HexPosition }
  ): Promise<Buffer> {
    // Clear canvas
    this.ctx.fillStyle = '#F0F0F0';
    this.ctx.fillRect(0, 0, 800, 800);
    
    // Draw board outline with colored edges
    this.drawBoardOutline(players);
    
    // Draw hex grid
    this.drawHexGrid();
    
    // Draw placed tiles
    for (const [posKey, tile] of board) {
      this.drawTile(tile);
    }
    
    // Draw flows
    this.drawFlows(flows, players);
    
    // Draw current tile preview (if provided)
    if (currentTile) {
      this.drawTilePreview(currentTile);
    }
    
    // Return PNG buffer
    return this.canvas.toBuffer('image/png');
  }
  
  private drawBoardOutline(players: Player[]): void {
    // Reuse logic from existing rendering/layout.ts
  }
  
  private drawTile(tile: PlacedTile): void {
    // Reuse logic from existing rendering/gameplayRenderer.ts
  }
  
  private drawFlows(flows: Map<string, Set<string>>, players: Player[]): void {
    // Reuse logic from existing rendering/gameplayRenderer.ts
  }
}
```

**Optimization:**
- Cache static elements (board outline, grid)
- Only re-render on game state changes
- Use image compression
- Consider storing images in CDN for repeated views

### 6.2 Embed Design

**Game Lobby Embed:**
```javascript
{
  title: "🎮 Quortex Game #1234",
  description: "Waiting for players to join...",
  color: 0x5865F2,  // Discord blurple
  fields: [
    { name: "Creator", value: "@alice", inline: true },
    { name: "Players", value: "2/3", inline: true },
    { name: "Status", value: "⏳ In Lobby", inline: true }
  ],
  footer: { text: "Use /quortex join to join this game" },
  timestamp: new Date()
}
```

**Active Game Embed:**
```javascript
{
  title: "🎮 Quortex Game #1234",
  description: "⏱️ **@bob's Turn**\nDraw Tile: Type 2 (Rink)",
  color: 0x57F287,  // Green
  image: { url: "https://cdn.example.com/game-1234-board.png" },
  fields: [
    { 
      name: "Players", 
      value: "🟥 @alice (Edge 0)\n🟦 @bob (Edge 3)\n🟩 @charlie (Edge 5)",
      inline: true 
    },
    { 
      name: "Game Info", 
      value: "Turn: 8\nTiles Left: 32",
      inline: true 
    }
  ],
  footer: { text: "Select rotation and position, then click ✓ Place Tile" },
  timestamp: new Date()
}
```

**Victory Embed:**
```javascript
{
  title: "🏆 Game Over - @alice Wins!",
  description: "Victory Type: Flow Completion\nWinning path connected Edge 0 to Edge 3",
  color: 0xFFD700,  // Gold
  image: { url: "https://cdn.example.com/game-1234-final.png" },
  fields: [
    { name: "Total Turns", value: "15", inline: true },
    { name: "Duration", value: "22 minutes", inline: true },
    { name: "Winning Player", value: "@alice 🟥", inline: true }
  ],
  thumbnail: { url: "https://cdn.example.com/trophy.png" },
  footer: { text: "Use /quortex new to start another game" }
}
```

### 6.3 Tile Preview Images

Generate small tile preview images (200x200) showing:
- Tile type (corner count)
- Current rotation
- Flow paths highlighted

These can be included in embeds to help players visualize their current tile.

## 7. Turn Management and Notifications

### 7.1 Turn Notification Strategies

**Option 1: Mention (Default)**
```
🔔 @bob, it's your turn!
```
- Sends a notification to the player
- Good for active games
- Can be overwhelming for slow games

**Option 2: Reply to Player's Last Message**
```
@bob It's your turn!
```
- Less intrusive than full mention
- Maintains conversation flow
- Good for casual games

**Option 3: Silent Update**
```
⏱️ bob's Turn
```
- No notification
- Player must check channel
- Good for asynchronous games

**Configuration:** Set via `/quortex settings notifications`

### 7.2 Turn Timeout Handling

**Timeout Flow:**
1. Player has configurable time limit (default: 30 minutes)
2. After 15 minutes: Warning message
   ```
   ⚠️ @bob, you have 15 minutes left for your turn!
   ```
3. After 30 minutes: Auto-skip or forfeit
   - **Auto-skip:** AI makes random legal move
   - **Forfeit:** Player leaves game, team/player loses
4. Configuration via `/quortex settings timeout`

**Grace Period:**
- First timeout: Warning only
- Second timeout: Skip turn
- Third timeout: Forfeit game

### 7.3 Turn History Tracking

Store last 10 moves in game state, display in status embed:
```
📜 Recent Moves:
8. @bob placed Type 2 at (0, 2) - 45s
7. @alice placed Type 1 at (-1, 1) - 1m 12s
6. @charlie placed Type 0 at (1, -1) - 2m 3s
```

## 8. Spectator Mode

### 8.1 Spectator Features

**Join as Spectator:**
- Command: `/quortex spectate [game-id]`
- Permissions: Configurable (all/friends/none)
- Subscribe to game updates in DMs

**Spectator Updates:**
- Receive board image after each move
- No interaction buttons
- Can unsubscribe anytime

**Spectator Embed:**
```javascript
{
  title: "👁 Spectating Game #1234",
  description: "@bob just played Type 2 at (0, 2)",
  image: { url: "https://cdn.example.com/game-1234-board.png" },
  footer: { text: "React with ❌ to stop spectating" }
}
```

### 8.2 Public Game Channels

Servers can designate "game channels" where:
- All moves are posted publicly
- Anyone can spectate by default
- Thread per game (Discord threads feature)

## 9. AI Opponent Integration

### 9.1 AI Player Setup

**Adding AI to Game:**
```
/quortex new 3 ai:1
```
- Creates 3-player game with 1 AI
- AI fills remaining slot
- AI difficulty: Easy (default) or Medium

**AI Behavior:**
- Takes turn automatically after 2-5 second delay (feels natural)
- Uses existing AI logic from `/src/ai/` (when implemented)
- Shows "🤖 AI-Bot is thinking..." during turn

### 9.2 AI Implementation

Reuse planned AI from DESIGN_DOC.md Phase 6:
- Easy AI: One-move lookahead, simple heuristics
- Medium AI: Alpha-beta search, better evaluation

Adapt for Discord context:
```typescript
class DiscordAIPlayer {
  async takeTurn(
    gameState: DiscordGameState,
    difficulty: 'easy' | 'medium'
  ): Promise<{ position: HexPosition; rotation: Rotation }> {
    // Show "thinking" message
    await this.showThinkingMessage(gameState);
    
    // Calculate move (with artificial delay)
    const move = difficulty === 'easy' 
      ? await this.easyAI.findBestMove(gameState)
      : await this.mediumAI.findBestMove(gameState);
    
    // Add realistic delay (2-5 seconds)
    await sleep(2000 + Math.random() * 3000);
    
    return move;
  }
}
```

## 10. Discord Activity Integration (Future)

### 10.1 Embedded Web View

Discord Activities allow embedded iframe applications:

**Benefits:**
- Full web UI (reuse existing rendering code)
- Touch and mouse interaction
- Real-time updates
- Better visual experience

**Architecture:**
```
Discord Client
  └─> Embedded iframe
       └─> Vite app (existing codebase)
            ├─> src/rendering/
            ├─> src/input/
            ├─> src/game/
            └─> WebSocket connection to bot backend
```

**Communication Flow:**
1. Discord Activity SDK provides authentication
2. WebSocket connects to bot backend
3. Game state synced bidirectionally
4. Moves validated server-side
5. UI updates in real-time

**Implementation Considerations:**
- Requires Discord Developer approval for Activities
- More complex deployment (web app + bot)
- Better UX for active players
- Fallback to message components for mobile

### 10.2 Hybrid Approach

Support both modes:
1. **Message Components:** Default, works everywhere
2. **Embedded Activity:** Opt-in for desktop users

Players choose via `/quortex settings mode`:
- `messages` - Classic message-based interface
- `activity` - Embedded web view (if available)
- `auto` - Activity on desktop, messages on mobile

## 11. Security and Privacy

### 11.1 Data Privacy

**Data Collected:**
- Discord user IDs (for game state)
- Server IDs (for multi-server support)
- Game moves and timestamps
- Player statistics

**Data NOT Collected:**
- Messages outside game commands
- Personal information beyond Discord username
- Voice or video data

**Privacy Policy:**
- Clear documentation of data usage
- GDPR compliance
- User can request data deletion via `/quortex privacy delete`
- Data retention: 90 days after last activity

### 11.2 Security Measures

**Input Validation:**
- Validate all Discord interactions
- Verify interaction tokens
- Sanitize user inputs
- Rate limiting on commands

**Game State Validation:**
- Server-side move legality checking
- Prevent client-side manipulation
- Validate Discord user permissions
- Prevent unauthorized game modifications

**API Security:**
- Discord bot token in environment variables
- Database credentials secured
- HTTPS for all external communications
- Regular security audits

### 11.3 Abuse Prevention

**Rate Limiting:**
- Max 10 commands per user per minute
- Max 5 game creations per server per hour
- Cooldown between games (30 seconds)

**Spam Prevention:**
- Limit concurrent games per user (3)
- Limit concurrent games per channel (2)
- Auto-cleanup inactive games (24 hours)

**Moderation:**
- Server admins can use `/quortex admin ban` to ban abusive users
- Global ban list for severe violations
- Report mechanism for inappropriate behavior

## 12. Deployment Architecture

### 12.1 Hosting Options

**Option A: Single Server (Small Scale)**
```
VPS/Cloud Instance (e.g., Railway, Heroku)
  ├─> Discord Bot (Node.js)
  ├─> Database (PostgreSQL)
  └─> File Storage (local or S3)
```
- Cost: $10-20/month
- Supports: 100-500 concurrent games
- Good for: Single/few servers

**Option B: Microservices (Medium Scale)**
```
Load Balancer
  ├─> Bot Service 1 (Node.js)
  ├─> Bot Service 2 (Node.js)
  └─> Bot Service N (Node.js)
       │
       ├─> Shared Database (PostgreSQL cluster)
       ├─> Redis (game state cache)
       └─> CDN (S3 + CloudFront for images)
```
- Cost: $50-200/month
- Supports: 1000+ concurrent games
- Good for: Multiple large servers

**Option C: Serverless (Large Scale)**
```
AWS Lambda / Google Cloud Functions
  ├─> Interaction Handler (Lambda)
  ├─> Move Processor (Lambda)
  └─> Image Renderer (Lambda)
       │
       ├─> DynamoDB / Firestore (game state)
       ├─> Redis (ElastiCache) (cache)
       └─> S3 + CloudFront (images)
```
- Cost: Pay-per-use ($0 at low scale, $100+ at high scale)
- Supports: 10,000+ concurrent games
- Good for: Large public bot

### 12.2 Deployment Pipeline

**CI/CD with GitHub Actions:**

```yaml
# .github/workflows/deploy.yml
name: Deploy Discord Bot

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Railway
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
        run: |
          npm install -g @railway/cli
          railway up
```

**Environment Configuration:**
```bash
# .env (not committed)
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379
S3_BUCKET=quortex-images
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
NODE_ENV=production
LOG_LEVEL=info
```

### 12.3 Monitoring and Logging

**Metrics to Track:**
- Active games count
- Commands per minute
- Average response time
- Error rate
- Database query performance
- Image generation time

**Tools:**
- **Logging:** Winston or Pino (structured logs)
- **Monitoring:** Prometheus + Grafana
- **Error Tracking:** Sentry
- **Uptime:** UptimeRobot or Pingdom

**Example Metrics Dashboard:**
```
Quortex Discord Bot - Live Metrics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Active Games: 47
Players Online: 112
Commands/min: 23
Avg Response: 142ms
Error Rate: 0.02%
Uptime: 99.97%
```

## 13. Development Roadmap

### Phase 1: Core Bot Infrastructure (Weeks 1-2)
- [ ] Set up Discord bot project structure
- [ ] Implement slash command registration
- [ ] Create basic command handler framework
- [ ] Set up database schema and connections
- [ ] Implement game state manager (in-memory)
- [ ] Add basic logging and error handling

### Phase 2: Game Logic Integration (Weeks 3-4)
- [ ] Extract game core from existing codebase
- [ ] Adapt types for Discord context
- [ ] Implement game state serialization/deserialization
- [ ] Port flow calculation logic
- [ ] Port legality checking logic
- [ ] Port victory condition checking
- [ ] Write integration tests

### Phase 3: Basic Gameplay (Weeks 5-6)
- [ ] Implement `/quortex new` command
- [ ] Implement lobby system with join/leave
- [ ] Implement seating phase
- [ ] Implement turn management
- [ ] Create basic message components (buttons/selects)
- [ ] Add move execution logic
- [ ] Test 2-player games end-to-end

### Phase 4: Rendering System (Weeks 7-8)
- [ ] Set up Canvas rendering for board
- [ ] Implement hex layout calculations
- [ ] Render placed tiles
- [ ] Render flow paths
- [ ] Generate PNG images
- [ ] Upload to CDN or Discord CDN
- [ ] Create embed templates
- [ ] Optimize image generation performance

### Phase 5: Extended Features (Weeks 9-10)
- [ ] Support 3-6 player games
- [ ] Implement team mode (4-6 players)
- [ ] Add turn timeout handling
- [ ] Add move history display
- [ ] Implement `/quortex status` command
- [ ] Add game statistics tracking
- [ ] Create help system

### Phase 6: Polish and Testing (Weeks 11-12)
- [ ] Comprehensive testing (all player counts)
- [ ] Performance optimization
- [ ] Error handling improvements
- [ ] User experience refinements
- [ ] Documentation completion
- [ ] Beta testing with real users

### Phase 7: Advanced Features (Future)
- [ ] AI opponent integration
- [ ] Spectator mode
- [ ] Leaderboards
- [ ] Advanced statistics
- [ ] Discord Activity (embedded web view)
- [ ] Tournament mode
- [ ] Replay system

## 14. Cost Estimation

### Development Costs
- **Developer Time:** 12 weeks × 20 hours/week = 240 hours
- **At $50/hour:** $12,000 (professional)
- **At $0/hour:** Free (open source / personal project)

### Hosting Costs (Monthly)

**Small Scale (1-10 servers, <100 games/day):**
- Railway/Heroku Hobby: $5-10
- PostgreSQL: Included
- Total: **$5-10/month**

**Medium Scale (10-100 servers, <1000 games/day):**
- Cloud VM (2 vCPU, 4GB RAM): $20-40
- Managed PostgreSQL: $15-25
- Redis Cache: $10-15
- S3 + CloudFront: $5-10
- Total: **$50-90/month**

**Large Scale (100+ servers, 10,000+ games/day):**
- Kubernetes cluster: $100-200
- Database cluster: $50-100
- Redis cluster: $30-50
- CDN + Storage: $20-40
- Total: **$200-390/month**

### Free Tier Options
Many cloud providers offer free tiers:
- **Railway:** $5 credit/month (free tier)
- **Heroku:** Free dyno (limited hours)
- **Google Cloud:** $300 credit (90 days)
- **AWS:** Free tier (12 months)
- **Render:** Free tier (slower startup)

**Recommendation:** Start with Railway or Render free tier for testing.

## 15. Alternative Approaches

### 15.1 Discord Bot vs. Web Integration

**Bot Approach (Recommended):**
- ✅ Native Discord experience
- ✅ No external website needed
- ✅ Lower barrier to entry
- ❌ Limited UI flexibility
- ❌ Image generation overhead

**Web Link Approach:**
- ✅ Full UI/UX control (reuse existing web app)
- ✅ Better visuals
- ❌ Requires leaving Discord
- ❌ Higher friction for users
- ❌ State synchronization complexity

**Hybrid Approach (Best of Both):**
- Bot for game management
- Web link for detailed view
- Discord Activity for embedded gameplay (future)

### 15.2 Command vs. Natural Language

**Slash Commands (Recommended):**
- ✅ Clear, structured interface
- ✅ Built-in autocomplete
- ✅ No command prefix confusion
- ✅ Better Discord integration

**Natural Language:**
- Example: "create a 3 player game"
- ✅ More conversational
- ❌ Parsing complexity
- ❌ Ambiguity issues
- ❌ Harder to discover features

**Recommendation:** Stick with slash commands for clarity.

### 15.3 Persistent vs. Ephemeral Messages

**Persistent Game Messages (Recommended):**
- ✅ Scrollable game history
- ✅ Players can review past moves
- ❌ Clutters channel

**Ephemeral Messages:**
- ✅ Clean channel
- ❌ Can't review history
- ❌ Lost if Discord restarts

**Recommendation:** Persistent for main game, ephemeral for help/errors.

## 16. Open Questions and Decisions

### 16.1 Technical Decisions

**Q: Should we use discord.js (TypeScript) or discord.py (Python)?**
- **A:** discord.js (TypeScript) - matches existing codebase, easier code reuse

**Q: SQL (PostgreSQL) or NoSQL (MongoDB) for database?**
- **A:** PostgreSQL - better for relational data (games, players, moves), ACID transactions

**Q: Host images on Discord CDN or external CDN (S3)?**
- **A:** Discord CDN for simplicity initially, migrate to S3 if scale requires

**Q: Should AI opponents be synchronous or queued?**
- **A:** Synchronous with artificial delay (2-5s) for natural feel

### 16.2 Product Decisions

**Q: Allow multiple concurrent games per player?**
- **A:** Yes, limit to 3 concurrent games per player

**Q: Support private/DM games?**
- **A:** Yes, but require all players in same server for easier coordination

**Q: Show player statistics publicly?**
- **A:** Yes, but allow opt-out via privacy settings

**Q: Support custom board sizes?**
- **A:** No, stick with standard 37-hex board for consistency

### 16.3 UX Decisions

**Q: How to handle network/Discord outages?**
- **A:** Persist game state in database, resume when bot reconnects

**Q: Allow players to undo moves?**
- **A:** No, moves are final (per game rules)

**Q: Support game saving/loading?**
- **A:** Yes, games auto-save, can resume after bot restart

**Q: How to visualize legal moves in static image?**
- **A:** Overlay green dots on legal hex positions in board image

## 17. Migration and Backward Compatibility

### 17.1 Versioning Strategy

**Bot Version:** Semantic versioning (MAJOR.MINOR.PATCH)
- **MAJOR:** Breaking changes to game format or commands
- **MINOR:** New features, backward compatible
- **PATCH:** Bug fixes

**Game State Version:** Include version field in database
```typescript
interface DiscordGameState {
  stateVersion: string;  // e.g., "1.0.0"
  // ... rest of state
}
```

**Migration Path:**
- Detect old version games on load
- Apply migration transforms
- Save with new version
- Deprecate old versions after 30 days

### 17.2 Feature Flags

Enable gradual rollout of new features:
```typescript
const FEATURES = {
  AI_OPPONENTS: process.env.ENABLE_AI === 'true',
  SPECTATOR_MODE: process.env.ENABLE_SPECTATOR === 'true',
  DISCORD_ACTIVITY: process.env.ENABLE_ACTIVITY === 'true',
  TOURNAMENTS: process.env.ENABLE_TOURNAMENTS === 'true',
};
```

Configure per server or globally via environment variables.

## 18. Success Metrics

### 18.1 Key Performance Indicators (KPIs)

**Adoption Metrics:**
- Total servers using bot
- Daily active users (DAU)
- Games created per day
- Game completion rate (finished / started)

**Engagement Metrics:**
- Average game duration
- Average moves per game
- Return user rate (weekly)
- Commands per user per day

**Quality Metrics:**
- Error rate (< 1%)
- Average response time (< 500ms)
- Bot uptime (> 99.5%)
- User satisfaction (survey)

**Growth Metrics:**
- Week-over-week user growth
- Server retention rate (30 days)
- Referral rate (invites per user)

### 18.2 Success Criteria

**Launch Goals (Month 1):**
- ✅ Bot stable for 99%+ uptime
- ✅ 10+ servers actively using
- ✅ 50+ games completed
- ✅ < 5 critical bugs reported

**Growth Goals (Month 3):**
- ✅ 100+ servers
- ✅ 1000+ games completed
- ✅ 500+ daily active users
- ✅ 75%+ game completion rate

**Maturity Goals (Month 6):**
- ✅ 500+ servers
- ✅ 10,000+ games completed
- ✅ 2000+ daily active users
- ✅ AI opponents functional
- ✅ Community-contributed features

## 19. Community and Support

### 19.1 Support Channels

**In-Discord Support:**
- `/quortex help` - Built-in help system
- Support server - Dedicated Discord for bot support
- FAQ channel - Common questions and answers

**External Resources:**
- GitHub repository - Open source code
- Documentation site - Comprehensive guides
- Issue tracker - Bug reports and feature requests
- Reddit/Forum - Community discussions

### 19.2 Contribution Guidelines

**Open Source Model:**
- MIT or GPL-3.0 license (match existing project)
- Accept pull requests for features
- Community-driven development
- Maintain CONTRIBUTING.md guide

**Feature Requests:**
- Users can suggest via GitHub Issues
- Voting system for prioritization
- Monthly review of top requests
- Transparent roadmap

### 19.3 Moderation and Community Management

**Support Team:**
- Bot owner/creator
- 2-3 volunteer moderators
- Community contributors

**Community Guidelines:**
- Respectful communication
- No cheating or exploitation
- No spam or advertising
- Follow Discord Terms of Service

## 20. Conclusion and Next Steps

### 20.1 Summary

This architecture provides a comprehensive plan for integrating Quortex into Discord as a fully-featured Discord Application. The design leverages:

1. **Existing Game Logic:** Reuse battle-tested code from the web implementation
2. **Discord-Native UX:** Slash commands and message components for intuitive gameplay
3. **Scalable Architecture:** Start simple, grow with demand
4. **Rich Visualization:** Server-side rendering for beautiful board images
5. **Multiplayer Support:** Full 2-6 player games with team modes
6. **Future-Proof Design:** Extensible for AI, activities, and advanced features

### 20.2 Recommended First Steps

1. **Prototype (Week 1):**
   - Create basic Discord bot
   - Implement `/quortex new` and join/leave
   - Manual game state (no database yet)
   - Static board image (no rendering yet)

2. **MVP (Weeks 2-4):**
   - Database integration
   - Basic rendering (simple board image)
   - Complete 2-player game flow
   - Deploy to test server

3. **Beta (Weeks 5-8):**
   - Full rendering system
   - 3-6 player support
   - Refine UX based on feedback
   - Public beta on 5-10 servers

4. **Launch (Weeks 9-12):**
   - Polish and bug fixes
   - Performance optimization
   - Documentation completion
   - Public announcement

### 20.3 Long-Term Vision

The Discord bot can become:
- **Primary Platform:** Many users prefer Discord over standalone web
- **Community Hub:** Tournaments, leaderboards, events
- **Social Experience:** Play with friends where they already are
- **Gateway:** Introduces new players to Quortex through easy access

**Future Integrations:**
- Discord Activity for embedded full gameplay
- Voice channel integration for voice chat during games
- Server boosting rewards (custom themes, AI priority)
- Integration with web version (shared accounts, statistics)

---

## Appendix A: Example Game Flow

**Complete game from start to finish:**

```
1. Alice: /quortex new 3
   Bot: [Lobby Embed] "Game #1234 created. 1/3 players."
        [Join Game] button

2. Bob clicks [Join Game]
   Bot: Updates embed "2/3 players"

3. Charlie clicks [Join Game]
   Bot: Updates embed "3/3 players - Ready to start!"
        Enables [Start Game] button

4. Alice clicks [Start Game]
   Bot: "Seating Phase - Choose your edges"
        Alice: [Select Menu: Edge 0-5]
        Bob: [Select Menu: Available edges]
        Charlie: [Select Menu: Available edges]

5. All players select edges
   Bot: "Game starting! @Alice's turn"
        [Board Image: Empty board with colored edges]
        "Drew: Type 2 (Rink)"
        [Rotate CCW] [Rotate CW]
        [Position: Select Menu with legal moves]
        [✓ Place Tile] [✗ Cancel]

6. Alice selects rotation: 3, position: (0, 0)
   Alice clicks [✓ Place Tile]
   Bot: [Updated Board Image with tile at (0,0)]
        "@Bob's turn"
        "Drew: Type 1 (Kimono)"
        [Same controls]

7-14. Players continue taking turns...

15. Bob places tile that completes his flow
    Bot: [Final Board Image with winning flow highlighted]
         "🏆 @Bob Wins! Victory: Flow Completion"
         [Game Stats]
         [Play Again] button
```

## Appendix B: Code Examples

### Example: Slash Command Handler

```typescript
// src/commands/new.ts
import { SlashCommandBuilder } from 'discord.js';
import { GameStateManager } from '../game/manager';

export const data = new SlashCommandBuilder()
  .setName('quortex')
  .setDescription('Quortex game commands')
  .addSubcommand(subcommand =>
    subcommand
      .setName('new')
      .setDescription('Create a new game')
      .addIntegerOption(option =>
        option
          .setName('players')
          .setDescription('Number of players (2-6)')
          .setRequired(false)
          .setMinValue(2)
          .setMaxValue(6)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const playerCount = interaction.options.getInteger('players') ?? 2;
  
  // Create game
  const gameId = await GameStateManager.createGame({
    serverId: interaction.guildId!,
    channelId: interaction.channelId,
    creatorId: interaction.user.id,
    maxPlayers: playerCount,
  });
  
  // Create lobby embed
  const embed = createLobbyEmbed(gameId, interaction.user, playerCount);
  const row = createLobbyButtons(gameId);
  
  await interaction.reply({ embeds: [embed], components: [row] });
}
```

### Example: Button Interaction Handler

```typescript
// src/interactions/buttons.ts
import { ButtonInteraction } from 'discord.js';
import { GameStateManager } from '../game/manager';

export async function handleButton(interaction: ButtonInteraction) {
  const [action, gameId, ...params] = interaction.customId.split(':');
  
  switch (action) {
    case 'join':
      await handleJoinGame(interaction, gameId);
      break;
    case 'start':
      await handleStartGame(interaction, gameId);
      break;
    case 'confirm':
      await handleConfirmMove(interaction, gameId);
      break;
    case 'cancel':
      await handleCancelMove(interaction, gameId);
      break;
  }
}

async function handleConfirmMove(
  interaction: ButtonInteraction,
  gameId: string
) {
  const game = await GameStateManager.getGame(gameId);
  const interactionState = await GameStateManager.getInteractionState(
    interaction.user.id,
    gameId
  );
  
  if (!interactionState.selectedPosition) {
    await interaction.reply({
      content: 'Please select a position first!',
      ephemeral: true
    });
    return;
  }
  
  // Execute move
  const newState = await GameStateManager.executeMove(gameId, {
    userId: interaction.user.id,
    position: interactionState.selectedPosition,
    rotation: interactionState.currentRotation,
  });
  
  // Render new board
  const boardImage = await renderBoard(newState);
  
  // Check victory
  const victory = checkVictory(newState);
  
  if (victory) {
    // Game over
    const embed = createVictoryEmbed(newState, victory);
    await interaction.update({ embeds: [embed], components: [] });
  } else {
    // Next turn
    const embed = createTurnEmbed(newState);
    const row = createTurnButtons(gameId);
    await interaction.update({ embeds: [embed], components: [row] });
  }
}
```

### Example: Board Rendering

```typescript
// src/rendering/board.ts
import { createCanvas } from 'canvas';
import { PlacedTile, HexPosition, Player } from '../game/types';

export async function renderBoard(
  board: Map<string, PlacedTile>,
  flows: Map<string, Set<string>>,
  players: Player[]
): Promise<Buffer> {
  const canvas = createCanvas(800, 800);
  const ctx = canvas.getContext('2d');
  
  // Background
  ctx.fillStyle = '#F0F0F0';
  ctx.fillRect(0, 0, 800, 800);
  
  // Draw hex grid
  drawHexGrid(ctx);
  
  // Draw board outline with player edges
  drawBoardOutline(ctx, players);
  
  // Draw placed tiles
  for (const [key, tile] of board) {
    drawTile(ctx, tile);
  }
  
  // Draw flows
  for (const [playerId, positions] of flows) {
    const player = players.find(p => p.id === playerId);
    if (player) {
      drawFlow(ctx, positions, player.color);
    }
  }
  
  return canvas.toBuffer('image/png');
}
```

## Appendix C: Database Queries

### Example Queries

```sql
-- Get active games in a server
SELECT g.*, COUNT(gp.discord_user_id) as player_count
FROM games g
LEFT JOIN game_players gp ON g.game_id = gp.game_id
WHERE g.server_id = $1 
  AND g.phase IN ('lobby', 'seating', 'playing')
GROUP BY g.game_id
ORDER BY g.created_at DESC;

-- Get player statistics
SELECT 
  discord_user_id,
  games_played,
  games_won,
  ROUND((games_won::float / NULLIF(games_played, 0) * 100), 2) as win_rate,
  total_moves,
  ROUND(avg_move_time, 1) as avg_move_seconds
FROM player_stats
WHERE discord_user_id = $1;

-- Get recent moves for a game
SELECT m.*, p.discord_username
FROM moves m
JOIN game_players gp ON m.game_id = gp.game_id 
  AND m.discord_user_id = gp.discord_user_id
WHERE m.game_id = $1
ORDER BY m.move_number DESC
LIMIT 10;

-- Cleanup expired games
DELETE FROM games
WHERE expires_at < NOW()
  AND phase != 'finished';
```

---

**Document Version:** 1.0  
**Last Updated:** 2024-11-12  
**Author:** Quortex Development Team  
**Status:** Proposed Architecture
