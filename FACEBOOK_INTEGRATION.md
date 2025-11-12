# Facebook Integration Design Document

## Overview

This document outlines the comprehensive design for integrating Quortex as a playable Facebook game. The integration leverages Facebook's gaming platform to enable social multiplayer experiences, viral growth, and potential monetization while maintaining the core gameplay experience of the web-based implementation.

## Executive Summary

**Target Platforms:**
- Facebook Instant Games (primary)
- Facebook Gaming (desktop/web)
- Messenger Platform (chat-based play)

**Key Features:**
- Social multiplayer with Facebook friends
- Asynchronous turn-based gameplay
- Real-time multiplayer sessions
- Facebook Login integration
- Social sharing and invites
- Leaderboards and achievements
- In-game monetization options

**Recommended Approach:** Facebook Instant Games with WebSocket-based multiplayer backend

---

## 1. Facebook Gaming Platform Options

### 1.1 Facebook Instant Games (Primary Recommendation)

**Overview:**
Facebook Instant Games is a platform for HTML5 games that load instantly and can be played on Facebook, Messenger, and Facebook Gaming. Games are built with standard web technologies and distributed through Facebook's infrastructure.

**Technical Requirements:**
- HTML5 game (canvas-based) ✅ Already implemented
- Max initial bundle size: 5 MB ✅ Current build ~40 KB
- Responsive design for mobile and desktop ✅ Already supported
- Facebook SDK integration (JavaScript)
- HTTPS hosting required ✅ Supported via GitHub Pages/CDN

**Key Capabilities:**
- Cross-platform (mobile web, desktop web, Messenger)
- Instant loading with no installation
- Built-in social features (share, invite, challenges)
- Context API for group play
- Payments API for in-game purchases
- Ads API for monetization
- Leaderboards and achievements
- Cloud save functionality

**Perfect Fit for Quortex:**
- Existing canvas-based rendering works as-is
- Touch-first design matches mobile gameplay
- Small bundle size well under limits
- Turn-based gameplay suits platform

### 1.2 Facebook Gaming (Cloud Gaming)

**Overview:**
Facebook Gaming allows streaming of games directly on Facebook. Better suited for larger, graphics-intensive games requiring persistent servers.

**Technical Requirements:**
- Game server infrastructure
- Streaming protocol integration
- Higher development complexity

**Why Not Recommended:**
- Overkill for a lightweight board game
- Requires server infrastructure for streaming
- Instant Games better suited for turn-based gameplay

### 1.3 Messenger Platform

**Overview:**
Games integrated directly into Messenger conversations. Uses Instant Games technology but with chat-focused distribution.

**Capabilities:**
- Play within chat threads
- Asynchronous turn notifications
- Thread-based leaderboards
- Social context embedded

**Recommendation:**
- Include as secondary platform alongside Instant Games
- Same codebase, different distribution channel
- Enhanced by asynchronous multiplayer

---

## 2. Technical Architecture

### 2.1 Overall System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Facebook Platform                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Facebook   │  │  Messenger   │  │   Gaming     │      │
│  │   Newsfeed   │  │   Platform   │  │   Tab        │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                    ┌───────▼────────┐                        │
│                    │ Facebook SDK   │                        │
│                    │  (FBInstant)   │                        │
│                    └───────┬────────┘                        │
└────────────────────────────┼─────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Quortex Game   │
                    │  (TypeScript +  │
                    │   Canvas)       │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
     ┌────────▼────────┐         ┌─────────▼──────────┐
     │  Game Backend   │         │   CDN Hosting      │
     │  (Multiplayer)  │         │  (Static Assets)   │
     │                 │         │                    │
     │  - WebSocket    │         │  - Game Bundle     │
     │  - REST API     │         │  - Assets          │
     │  - Database     │         │  - HTTPS           │
     └─────────────────┘         └────────────────────┘
              │
     ┌────────▼────────┐
     │   Data Layer    │
     │                 │
     │  - User Data    │
     │  - Game State   │
     │  - Leaderboards │
     │  - Analytics    │
     └─────────────────┘
```

### 2.2 Frontend Integration (Facebook SDK)

**Facebook Instant Games SDK:**

```typescript
// src/facebook/fbInstant.ts

export interface FacebookSDK {
  // Initialization
  initializeAsync(): Promise<void>;
  startGameAsync(): Promise<void>;
  
  // Player data
  player: {
    getID(): string;
    getName(): string;
    getPhoto(): string;
    getDataAsync(keys: string[]): Promise<any>;
    setDataAsync(data: object): Promise<void>;
  };
  
  // Context (group/thread)
  context: {
    getID(): string;
    getType(): 'SOLO' | 'THREAD' | 'GROUP';
    getPlayersAsync(): Promise<Array<{
      id: string;
      name: string;
      photo: string;
    }>>;
    switchAsync(contextId: string): Promise<void>;
    createAsync(playerId: string): Promise<void>;
  };
  
  // Sharing
  shareAsync(payload: SharePayload): Promise<void>;
  updateAsync(payload: UpdatePayload): Promise<void>;
  
  // Leaderboards
  getLeaderboardAsync(name: string): Promise<Leaderboard>;
  
  // Payments
  payments: {
    purchaseAsync(config: PurchaseConfig): Promise<Purchase>;
    getCatalogAsync(): Promise<Product[]>;
  };
  
  // Ads
  getInterstitialAdAsync(placementID: string): Promise<AdInstance>;
  getRewardedVideoAsync(placementID: string): Promise<AdInstance>;
}

// Facebook SDK wrapper for type safety
export class QuortexFacebookSDK {
  private fbInstant: FacebookSDK;
  private initialized: boolean = false;
  
  async initialize(): Promise<void> {
    if (typeof FBInstant === 'undefined') {
      throw new Error('Facebook SDK not loaded');
    }
    
    await FBInstant.initializeAsync();
    this.fbInstant = FBInstant;
    this.initialized = true;
    
    // Load game assets while showing loading screen
    await this.loadGameAssets();
    
    // Signal game is ready to start
    await FBInstant.startGameAsync();
  }
  
  async loadGameAssets(): Promise<void> {
    // Show loading progress
    const totalAssets = 10; // Approximate asset count
    let loadedAssets = 0;
    
    // Update loading progress
    FBInstant.setLoadingProgress(loadedAssets / totalAssets * 100);
    
    // Load game (already loaded via bundle, but can preload additional assets)
    loadedAssets = totalAssets;
    FBInstant.setLoadingProgress(100);
  }
  
  getPlayerID(): string {
    return this.fbInstant.player.getID();
  }
  
  getPlayerName(): string {
    return this.fbInstant.player.getName();
  }
  
  getPlayerPhoto(): string {
    return this.fbInstant.player.getPhoto();
  }
  
  async saveGameState(state: any): Promise<void> {
    await this.fbInstant.player.setDataAsync({
      gameState: JSON.stringify(state),
      lastPlayed: Date.now(),
    });
  }
  
  async loadGameState(): Promise<any> {
    const data = await this.fbInstant.player.getDataAsync(['gameState']);
    return data.gameState ? JSON.parse(data.gameState) : null;
  }
  
  async inviteFriends(message: string): Promise<void> {
    await this.fbInstant.context.createAsync();
    await this.fbInstant.shareAsync({
      intent: 'INVITE',
      image: await this.generateInviteImage(),
      text: message,
      data: { action: 'invite' },
    });
  }
  
  async shareScore(score: number, message: string): Promise<void> {
    await this.fbInstant.shareAsync({
      intent: 'SHARE',
      image: await this.generateScoreImage(score),
      text: message,
      data: { action: 'share_score', score },
    });
  }
  
  async updateThreadState(currentPlayer: string, turn: number): Promise<void> {
    await this.fbInstant.updateAsync({
      action: 'CUSTOM',
      cta: 'Play Now',
      image: await this.generateGameStateImage(),
      text: {
        default: `${currentPlayer}'s turn - Move ${turn}`,
      },
      template: 'play_turn',
      data: { turn, currentPlayer },
      strategy: 'IMMEDIATE',
      notification: 'PUSH',
    });
  }
  
  private async generateInviteImage(): Promise<string> {
    // Generate base64 image showing game board
    // Use existing canvas rendering
    return 'data:image/png;base64,...';
  }
  
  private async generateScoreImage(score: number): Promise<string> {
    // Generate celebration image with score
    return 'data:image/png;base64,...';
  }
  
  private async generateGameStateImage(): Promise<string> {
    // Generate current game state image
    return 'data:image/png;base64,...';
  }
}
```

### 2.3 Backend Architecture (Multiplayer)

**Technology Stack:**
- **Server Framework:** Node.js + Express + Socket.IO
- **Database:** PostgreSQL (game state, user data) + Redis (real-time sessions)
- **Hosting:** AWS, Google Cloud, or DigitalOcean
- **Authentication:** Facebook OAuth tokens

**Backend Services:**

```typescript
// Backend API Structure

// 1. Authentication Service
POST   /api/auth/facebook          // Verify Facebook token, create/get user
GET    /api/auth/me                // Get current user profile

// 2. Game Management
POST   /api/games                  // Create new game
GET    /api/games/:id              // Get game state
POST   /api/games/:id/join         // Join existing game
POST   /api/games/:id/move         // Submit move
GET    /api/games/:id/history      // Get move history
DELETE /api/games/:id              // Delete/forfeit game

// 3. Matchmaking
POST   /api/matchmaking/quick      // Quick match with random opponent
POST   /api/matchmaking/friends    // Match with Facebook friends
GET    /api/matchmaking/pending    // Get pending game invitations

// 4. Leaderboards
GET    /api/leaderboards/global    // Global leaderboard
GET    /api/leaderboards/friends   // Friends leaderboard
POST   /api/leaderboards/score     // Submit score

// 5. Social Features
GET    /api/friends                // Get Facebook friends playing
POST   /api/invites                // Send game invite
GET    /api/invites/pending        // Get pending invites

// 6. WebSocket Events (Socket.IO)
// Client -> Server
'join_game'        // Join game room
'make_move'        // Submit move
'request_rematch'  // Request rematch
'leave_game'       // Leave game

// Server -> Client
'game_state'       // Updated game state
'player_joined'    // Player joined game
'player_left'      // Player left game
'move_made'        // Opponent made move
'game_over'        // Game ended
'rematch_request'  // Opponent wants rematch
```

**Database Schema:**

```sql
-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  facebook_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  photo_url VARCHAR(500),
  total_games INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP DEFAULT NOW()
);

-- Games table
CREATE TABLE games (
  id SERIAL PRIMARY KEY,
  context_id VARCHAR(255),  -- Facebook thread/group ID
  game_type VARCHAR(50),    -- 'realtime' or 'async'
  player_count INTEGER,
  current_turn INTEGER DEFAULT 0,
  status VARCHAR(50),       -- 'waiting', 'active', 'completed'
  winner_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Game players (many-to-many)
CREATE TABLE game_players (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  player_index INTEGER,    -- 0-5 position in game
  color VARCHAR(50),
  edge_position INTEGER,   -- 0-5 board edge
  joined_at TIMESTAMP DEFAULT NOW()
);

-- Game state (current board state)
CREATE TABLE game_states (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  board_state JSONB NOT NULL,  -- Serialized board tiles
  current_tile VARCHAR(50),
  available_tiles JSONB,
  flows JSONB,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Move history
CREATE TABLE moves (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  move_number INTEGER,
  tile_type VARCHAR(50),
  position JSONB,          -- {row, col}
  rotation INTEGER,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Leaderboards
CREATE TABLE leaderboard_entries (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  score INTEGER NOT NULL,
  rank INTEGER,
  period VARCHAR(50),      -- 'daily', 'weekly', 'all_time'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Achievements
CREATE TABLE achievements (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  icon_url VARCHAR(500),
  points INTEGER DEFAULT 0
);

CREATE TABLE user_achievements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  achievement_id INTEGER REFERENCES achievements(id),
  unlocked_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- Indexes for performance
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_context ON games(context_id);
CREATE INDEX idx_game_players_game ON game_players(game_id);
CREATE INDEX idx_game_players_user ON game_players(user_id);
CREATE INDEX idx_moves_game ON moves(game_id);
CREATE INDEX idx_leaderboard_score ON leaderboard_entries(score DESC);
```

### 2.4 Real-Time Multiplayer Implementation

```typescript
// src/multiplayer/realtimeGame.ts

import { io, Socket } from 'socket.io-client';
import { GameState } from '../redux/types';

export class RealtimeGameSession {
  private socket: Socket;
  private gameId: string;
  private playerId: string;
  
  constructor(serverUrl: string) {
    this.socket = io(serverUrl, {
      auth: {
        fbToken: this.getFacebookToken(),
      },
    });
    
    this.setupEventHandlers();
  }
  
  private setupEventHandlers(): void {
    this.socket.on('connect', () => {
      console.log('Connected to game server');
    });
    
    this.socket.on('game_state', (state: GameState) => {
      // Dispatch Redux action to update game state
      store.dispatch({ type: 'SYNC_GAME_STATE', payload: state });
    });
    
    this.socket.on('player_joined', (player) => {
      store.dispatch({ type: 'PLAYER_JOINED', payload: player });
    });
    
    this.socket.on('move_made', (move) => {
      store.dispatch({ type: 'OPPONENT_MOVE', payload: move });
    });
    
    this.socket.on('game_over', (result) => {
      store.dispatch({ type: 'GAME_OVER', payload: result });
    });
    
    this.socket.on('disconnect', () => {
      console.log('Disconnected from game server');
    });
  }
  
  async createGame(playerCount: number): Promise<string> {
    return new Promise((resolve) => {
      this.socket.emit('create_game', { playerCount }, (gameId: string) => {
        this.gameId = gameId;
        resolve(gameId);
      });
    });
  }
  
  async joinGame(gameId: string): Promise<void> {
    this.gameId = gameId;
    this.socket.emit('join_game', { gameId });
  }
  
  async makeMove(position: HexPosition, rotation: number): Promise<void> {
    this.socket.emit('make_move', {
      gameId: this.gameId,
      position,
      rotation,
    });
  }
  
  disconnect(): void {
    this.socket.disconnect();
  }
  
  private getFacebookToken(): string {
    // Get Facebook authentication token
    return FBInstant.player.getSignedPlayerInfoAsync()
      .then(result => result.getSignature());
  }
}
```

### 2.5 Asynchronous Turn-Based Implementation

```typescript
// src/multiplayer/asyncGame.ts

export class AsyncGameSession {
  private gameId: string;
  private apiUrl: string;
  
  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }
  
  async createGame(friendIds: string[]): Promise<string> {
    const response = await fetch(`${this.apiUrl}/games`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        type: 'async',
        invitedPlayers: friendIds,
      }),
    });
    
    const data = await response.json();
    this.gameId = data.gameId;
    
    // Send Facebook notification to invited players
    await FBInstant.updateAsync({
      action: 'CUSTOM',
      cta: 'Join Game',
      text: {
        default: `${FBInstant.player.getName()} invited you to play Quortex!`,
      },
      template: 'game_invite',
      data: { gameId: this.gameId },
      strategy: 'IMMEDIATE',
      notification: 'PUSH',
    });
    
    return this.gameId;
  }
  
  async submitMove(position: HexPosition, rotation: number): Promise<void> {
    const response = await fetch(`${this.apiUrl}/games/${this.gameId}/move`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ position, rotation }),
    });
    
    const data = await response.json();
    
    // Notify next player via Facebook
    if (data.nextPlayer) {
      await FBInstant.updateAsync({
        action: 'CUSTOM',
        cta: 'Your Turn',
        text: {
          default: `It's your turn in Quortex!`,
        },
        template: 'play_turn',
        data: { gameId: this.gameId },
        strategy: 'IMMEDIATE',
        notification: 'PUSH',
      });
    }
  }
  
  async getGameState(): Promise<GameState> {
    const response = await fetch(`${this.apiUrl}/games/${this.gameId}`, {
      headers: this.getHeaders(),
    });
    return response.json();
  }
  
  async pollForUpdates(): Promise<GameState | null> {
    // Poll for game state changes
    const response = await fetch(
      `${this.apiUrl}/games/${this.gameId}?since=${this.lastUpdate}`,
      { headers: this.getHeaders() }
    );
    
    if (response.status === 304) {
      // No changes
      return null;
    }
    
    return response.json();
  }
  
  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getFacebookToken()}`,
    };
  }
  
  private getFacebookToken(): string {
    // Implementation from Facebook SDK
    return '';
  }
}
```

---

## 3. Social Features Integration

### 3.1 Friend Invitations

**User Flow:**
1. Player taps "Invite Friends" button in lobby
2. Facebook friend picker appears
3. Player selects friends to invite
4. Custom invite message sent via Facebook
5. Friends receive notification with game link
6. Tapping link opens Quortex in Facebook

**Implementation:**

```typescript
// src/social/invites.ts

export async function inviteFriendsToGame(gameId: string): Promise<void> {
  const payload = {
    intent: 'INVITE',
    image: await generateInviteImage(),
    text: 'Join me for a game of Quortex!',
    data: { 
      action: 'invite',
      gameId: gameId,
    },
  };
  
  await FBInstant.shareAsync(payload);
}

async function generateInviteImage(): Promise<string> {
  // Create canvas with game preview
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630; // Facebook recommended size
  
  const ctx = canvas.getContext('2d')!;
  
  // Render game board preview
  // ... (use existing rendering code)
  
  // Add text overlay
  ctx.font = 'bold 48px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('Join me in Quortex!', 600, 315);
  
  return canvas.toDataURL('image/png');
}
```

### 3.2 Social Sharing

**Share Triggers:**
- Victory achieved
- New high score
- Achievement unlocked
- Interesting game moment

**Implementation:**

```typescript
// src/social/sharing.ts

export async function shareVictory(
  winType: 'flow' | 'constraint',
  opponentCount: number
): Promise<void> {
  const messages = {
    flow: `I just completed my flow in Quortex!`,
    constraint: `I won by constraining my opponents in Quortex!`,
  };
  
  await FBInstant.shareAsync({
    intent: 'SHARE',
    image: await generateVictoryImage(winType),
    text: messages[winType],
    data: {
      action: 'share_victory',
      winType,
      opponentCount,
    },
  });
}

export async function shareAchievement(
  achievementName: string,
  achievementIcon: string
): Promise<void> {
  await FBInstant.shareAsync({
    intent: 'SHARE',
    image: await generateAchievementImage(achievementName, achievementIcon),
    text: `I just unlocked the "${achievementName}" achievement in Quortex!`,
    data: {
      action: 'share_achievement',
      achievement: achievementName,
    },
  });
}
```

### 3.3 Leaderboards

**Leaderboard Types:**
- **Global:** All players worldwide
- **Friends:** Facebook friends only
- **Contextual:** Players in the same thread/group

**Metrics:**
- Total wins
- Win percentage
- Longest winning streak
- Games completed
- Average moves to victory

**Implementation:**

```typescript
// src/social/leaderboards.ts

export class LeaderboardManager {
  async submitScore(wins: number): Promise<void> {
    const leaderboard = await FBInstant.getLeaderboardAsync('wins_global');
    await leaderboard.setScoreAsync(wins);
  }
  
  async getGlobalLeaderboard(): Promise<LeaderboardEntry[]> {
    const leaderboard = await FBInstant.getLeaderboardAsync('wins_global');
    const entries = await leaderboard.getEntriesAsync(10, 0);
    
    return entries.map(entry => ({
      rank: entry.getRank(),
      score: entry.getScore(),
      playerName: entry.getPlayer().getName(),
      playerPhoto: entry.getPlayer().getPhoto(),
    }));
  }
  
  async getFriendsLeaderboard(): Promise<LeaderboardEntry[]> {
    const leaderboard = await FBInstant.getLeaderboardAsync('wins_friends');
    const entries = await leaderboard.getConnectedPlayerEntriesAsync(10, 0);
    
    return entries.map(entry => ({
      rank: entry.getRank(),
      score: entry.getScore(),
      playerName: entry.getPlayer().getName(),
      playerPhoto: entry.getPlayer().getPhoto(),
    }));
  }
  
  async getPlayerRank(): Promise<number> {
    const leaderboard = await FBInstant.getLeaderboardAsync('wins_global');
    const entry = await leaderboard.getPlayerEntryAsync();
    return entry?.getRank() ?? -1;
  }
}
```

### 3.4 Achievements System

**Achievement Examples:**
- **First Victory:** Win your first game
- **Perfect Flow:** Win with minimum moves
- **Comeback King:** Win after being near defeat
- **Social Butterfly:** Play with 10 different friends
- **Century Club:** Complete 100 games
- **Winning Streak:** Win 5 games in a row
- **Master Strategist:** Win using constraint victory 10 times

**Implementation:**

```typescript
// src/social/achievements.ts

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (stats: PlayerStats) => boolean;
}

const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_victory',
    name: 'First Victory',
    description: 'Win your first game',
    icon: '🏆',
    condition: (stats) => stats.wins >= 1,
  },
  {
    id: 'perfect_flow',
    name: 'Perfect Flow',
    description: 'Win a game in under 20 moves',
    icon: '✨',
    condition: (stats) => stats.fastestWin <= 20,
  },
  {
    id: 'winning_streak',
    name: 'Winning Streak',
    description: 'Win 5 games in a row',
    icon: '🔥',
    condition: (stats) => stats.currentStreak >= 5,
  },
  // ... more achievements
];

export class AchievementManager {
  async checkAndUnlockAchievements(stats: PlayerStats): Promise<Achievement[]> {
    const unlockedAchievements: Achievement[] = [];
    
    for (const achievement of ACHIEVEMENTS) {
      const hasUnlocked = await this.hasUnlocked(achievement.id);
      
      if (!hasUnlocked && achievement.condition(stats)) {
        await this.unlockAchievement(achievement);
        unlockedAchievements.push(achievement);
      }
    }
    
    return unlockedAchievements;
  }
  
  private async hasUnlocked(achievementId: string): Promise<boolean> {
    const data = await FBInstant.player.getDataAsync([`achievement_${achievementId}`]);
    return data[`achievement_${achievementId}`] === true;
  }
  
  private async unlockAchievement(achievement: Achievement): Promise<void> {
    // Save to player data
    await FBInstant.player.setDataAsync({
      [`achievement_${achievement.id}`]: true,
    });
    
    // Show notification
    this.showAchievementNotification(achievement);
    
    // Share to Facebook (optional)
    await shareAchievement(achievement.name, achievement.icon);
  }
  
  private showAchievementNotification(achievement: Achievement): void {
    // Display in-game notification
    // Use existing UI framework
  }
}
```

---

## 4. Monetization Strategy

### 4.1 In-App Purchases (IAP)

**Product Catalog:**

1. **Cosmetic Items:**
   - Custom tile skins (themes)
   - Board backgrounds
   - Victory animations
   - Player avatars borders

2. **Gameplay Enhancements:**
   - Undo move (consumable)
   - Hint system (consumable)
   - Tournament entry fees
   - Premium matchmaking

3. **Subscription Tiers:**
   - **Quortex Plus ($2.99/month):**
     - Ad-free experience
     - Exclusive tile themes
     - Priority matchmaking
     - Cloud save unlimited games
   
   - **Quortex Pro ($4.99/month):**
     - All Plus features
     - Advanced statistics
     - Replay system
     - Custom tournaments

**Implementation:**

```typescript
// src/monetization/purchases.ts

export interface Product {
  productID: string;
  title: string;
  description: string;
  price: string;
  priceCurrencyCode: string;
}

export class PurchaseManager {
  async getCatalog(): Promise<Product[]> {
    return await FBInstant.payments.getCatalogAsync();
  }
  
  async purchaseProduct(productID: string): Promise<void> {
    const purchase = await FBInstant.payments.purchaseAsync({
      productID,
      developerPayload: JSON.stringify({
        timestamp: Date.now(),
        playerID: FBInstant.player.getID(),
      }),
    });
    
    // Verify purchase on backend
    await this.verifyPurchase(purchase);
    
    // Grant item to player
    await this.grantPurchase(purchase);
  }
  
  private async verifyPurchase(purchase: any): Promise<void> {
    const response = await fetch('/api/payments/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        purchaseToken: purchase.purchaseToken,
        productID: purchase.productID,
        signedRequest: purchase.signedRequest,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Purchase verification failed');
    }
  }
  
  private async grantPurchase(purchase: any): Promise<void> {
    // Grant item based on productID
    switch (purchase.productID) {
      case 'tile_theme_neon':
        await this.unlockTileTheme('neon');
        break;
      case 'undo_move_5':
        await this.addConsumable('undo_move', 5);
        break;
      // ... handle other products
    }
  }
  
  private async unlockTileTheme(themeId: string): Promise<void> {
    const data = await FBInstant.player.getDataAsync(['unlocked_themes']);
    const unlockedThemes = data.unlocked_themes || [];
    
    if (!unlockedThemes.includes(themeId)) {
      unlockedThemes.push(themeId);
      await FBInstant.player.setDataAsync({
        unlocked_themes: unlockedThemes,
      });
    }
  }
  
  private async addConsumable(itemId: string, quantity: number): Promise<void> {
    const data = await FBInstant.player.getDataAsync([itemId]);
    const current = data[itemId] || 0;
    
    await FBInstant.player.setDataAsync({
      [itemId]: current + quantity,
    });
  }
}
```

### 4.2 Advertising Integration

**Ad Placement Strategy:**

1. **Interstitial Ads:**
   - Between games (not during gameplay)
   - Maximum frequency: 1 per 5 minutes
   - Shown after game completion

2. **Rewarded Video Ads:**
   - Optional: Watch to earn undo moves
   - Optional: Watch to earn hints
   - Optional: Double victory rewards

**Implementation:**

```typescript
// src/monetization/ads.ts

export class AdManager {
  private interstitialAd: any = null;
  private rewardedVideoAd: any = null;
  private lastAdTime: number = 0;
  private readonly AD_COOLDOWN = 5 * 60 * 1000; // 5 minutes
  
  async loadInterstitialAd(): Promise<void> {
    try {
      this.interstitialAd = await FBInstant.getInterstitialAdAsync(
        'PLACEMENT_ID_INTERSTITIAL'
      );
      await this.interstitialAd.loadAsync();
    } catch (error) {
      console.error('Failed to load interstitial ad:', error);
    }
  }
  
  async showInterstitialAd(): Promise<boolean> {
    // Check cooldown
    if (Date.now() - this.lastAdTime < this.AD_COOLDOWN) {
      return false;
    }
    
    if (!this.interstitialAd) {
      await this.loadInterstitialAd();
    }
    
    try {
      await this.interstitialAd.showAsync();
      this.lastAdTime = Date.now();
      
      // Preload next ad
      await this.loadInterstitialAd();
      
      return true;
    } catch (error) {
      console.error('Failed to show interstitial ad:', error);
      return false;
    }
  }
  
  async loadRewardedVideoAd(): Promise<void> {
    try {
      this.rewardedVideoAd = await FBInstant.getRewardedVideoAsync(
        'PLACEMENT_ID_REWARDED'
      );
      await this.rewardedVideoAd.loadAsync();
    } catch (error) {
      console.error('Failed to load rewarded video ad:', error);
    }
  }
  
  async showRewardedVideoAd(rewardType: string): Promise<boolean> {
    if (!this.rewardedVideoAd) {
      await this.loadRewardedVideoAd();
    }
    
    try {
      await this.rewardedVideoAd.showAsync();
      
      // Grant reward
      await this.grantReward(rewardType);
      
      // Preload next ad
      await this.loadRewardedVideoAd();
      
      return true;
    } catch (error) {
      console.error('Failed to show rewarded video ad:', error);
      return false;
    }
  }
  
  private async grantReward(rewardType: string): Promise<void> {
    switch (rewardType) {
      case 'undo_move':
        // Grant 1 undo move
        const purchaseManager = new PurchaseManager();
        await purchaseManager.addConsumable('undo_move', 1);
        break;
      case 'hint':
        // Grant 1 hint
        await purchaseManager.addConsumable('hint', 1);
        break;
      // ... handle other rewards
    }
  }
}
```

**Revenue Estimates (Hypothetical):**

Assumptions:
- 10,000 daily active users
- 50% complete at least 1 game per day
- eCPM: $5 for interstitial, $10 for rewarded video

Interstitial Ads:
- 5,000 games/day × 0.8 ad fill rate × $5 eCPM = ~$20/day = $600/month

Rewarded Video Ads:
- 1,000 views/day × 0.9 ad fill rate × $10 eCPM = ~$9/day = $270/month

IAP (conservative):
- 0.5% conversion rate × 10,000 DAU = 50 paying users
- Average purchase: $2.99
- Monthly: 50 × $2.99 = ~$150/month

**Total Estimated Revenue: ~$1,020/month at 10K DAU**

---

## 5. Implementation Phases

### Phase 1: Facebook SDK Integration (Week 1-2)

**Goals:**
- Integrate Facebook Instant Games SDK
- Implement basic authentication
- Set up loading screen

**Tasks:**
- [ ] Add Facebook SDK to index.html
- [ ] Create FacebookSDK wrapper class
- [ ] Implement initializeAsync flow
- [ ] Add loading progress bar
- [ ] Test on Facebook Instant Games simulator
- [ ] Submit for Facebook review (staging)

**Deliverables:**
- Game loads in Facebook Instant Games
- Player authentication working
- Basic loading screen

### Phase 2: Social Features (Week 3-4)

**Goals:**
- Implement friend invitations
- Add social sharing
- Create leaderboards

**Tasks:**
- [ ] Implement friend picker integration
- [ ] Create share image generation
- [ ] Build leaderboard UI
- [ ] Implement leaderboard API calls
- [ ] Add achievement system
- [ ] Test social features

**Deliverables:**
- Players can invite friends
- Victory sharing works
- Leaderboards functional

### Phase 3: Backend Infrastructure (Week 5-7)

**Goals:**
- Build multiplayer backend
- Implement game state synchronization
- Set up database

**Tasks:**
- [ ] Set up Node.js server
- [ ] Implement Socket.IO for real-time play
- [ ] Create REST API endpoints
- [ ] Set up PostgreSQL database
- [ ] Implement Redis for sessions
- [ ] Deploy to cloud hosting
- [ ] Load testing and optimization

**Deliverables:**
- Backend server operational
- Database schema deployed
- API endpoints functional

### Phase 4: Multiplayer Gameplay (Week 8-10)

**Goals:**
- Implement real-time multiplayer
- Add asynchronous turn-based mode
- Matchmaking system

**Tasks:**
- [ ] Build real-time game session
- [ ] Implement async game session
- [ ] Create matchmaking system
- [ ] Add game state synchronization
- [ ] Implement turn notifications
- [ ] Test multiplayer edge cases

**Deliverables:**
- Real-time multiplayer working
- Async multiplayer working
- Matchmaking functional

### Phase 5: Monetization (Week 11-12)

**Goals:**
- Integrate payments
- Add advertising
- Create product catalog

**Tasks:**
- [ ] Implement IAP integration
- [ ] Create purchasable items
- [ ] Integrate interstitial ads
- [ ] Integrate rewarded video ads
- [ ] Set up payment verification backend
- [ ] Test purchase flow

**Deliverables:**
- IAP working
- Ads displaying correctly
- Revenue tracking active

### Phase 6: Polish & Launch (Week 13-14)

**Goals:**
- Final testing
- Facebook review submission
- Launch preparation

**Tasks:**
- [ ] Comprehensive testing on all platforms
- [ ] Performance optimization
- [ ] Create app store assets
- [ ] Write Facebook app description
- [ ] Submit for Facebook review
- [ ] Soft launch testing
- [ ] Full launch

**Deliverables:**
- Game approved by Facebook
- Live on Facebook Gaming
- Marketing materials ready

---

## 6. Testing Strategy

### 6.1 Facebook Instant Games Simulator

**Setup:**
```bash
npm install -g facebook-instant-games-cli

# Start local server
fbinstant-cli serve

# Open in browser
# https://www.facebook.com/embed/instantgames/YOUR_APP_ID/player
```

**Testing Checklist:**
- [ ] Game loads correctly
- [ ] SDK initialization completes
- [ ] Player data retrieval works
- [ ] Context API functional
- [ ] Share dialog appears
- [ ] Leaderboards display
- [ ] Payments flow works (sandbox mode)
- [ ] Ads display (test mode)

### 6.2 Platform Testing

**Devices:**
- iOS Safari (iPhone 12+)
- Android Chrome (Samsung Galaxy S21+)
- Desktop Chrome
- Desktop Firefox
- Desktop Safari

**Facebook Surfaces:**
- Facebook mobile app
- Facebook desktop web
- Messenger mobile app
- Messenger desktop
- Facebook Gaming

**Test Scenarios:**
- [ ] Load game from newsfeed link
- [ ] Load game from Messenger thread
- [ ] Load game from Facebook Gaming
- [ ] Invite friend and join game
- [ ] Complete full multiplayer game
- [ ] Share victory
- [ ] Make in-app purchase
- [ ] Watch rewarded video ad

### 6.3 Performance Testing

**Metrics:**
- Initial load time: < 3 seconds
- Time to interactive: < 5 seconds
- Frame rate: 60 FPS during gameplay
- Memory usage: < 100 MB
- Network latency: < 200ms for moves

**Tools:**
- Chrome DevTools Performance tab
- Facebook SDK performance metrics
- Custom analytics tracking

---

## 7. Facebook Submission Requirements

### 7.1 App Configuration

**fbapp-config.json:**
```json
{
  "instant_games": {
    "platform_version": "RICH_GAMEPLAY",
    "navigation_menu_version": "NAV_FLOATING",
    "orientation": "LANDSCAPE",
    "game_type": "TURN_BASED",
    "custom_update_templates": [
      {
        "id": "game_invite",
        "image": "https://your-cdn.com/templates/invite.png",
        "call_to_action": "Join Game"
      },
      {
        "id": "play_turn",
        "image": "https://your-cdn.com/templates/turn.png",
        "call_to_action": "Play Now"
      }
    ]
  }
}
```

### 7.2 Required Assets

**Icon & Screenshots:**
- App icon: 1024x1024 PNG
- Cover image: 1200x630 PNG (for sharing)
- Screenshots: 5-10 images (1920x1080 or 1080x1920)
- Gameplay video: 30-60 seconds MP4

**Metadata:**
- App name: "Quortex"
- Short description: "Strategic tile-placement game for 2-6 players"
- Long description: [Full game description]
- Category: Puzzle, Strategy
- Age rating: Everyone
- Privacy policy URL
- Terms of service URL

### 7.3 Review Process

**Timeline:**
- Submission: Day 0
- Initial review: 1-3 days
- Feedback/revisions: 1-7 days
- Approval: 1-2 days
- Total: ~1-2 weeks

**Common Rejection Reasons:**
- Poor performance (slow loading)
- Broken functionality
- Misleading metadata
- Policy violations
- Incomplete integration

**Tips for Approval:**
- Test thoroughly before submission
- Provide clear instructions for reviewers
- Include test accounts if needed
- Follow all platform policies
- Optimize loading time

---

## 8. Analytics & Monitoring

### 8.1 Key Metrics to Track

**Engagement:**
- Daily Active Users (DAU)
- Monthly Active Users (MAU)
- DAU/MAU ratio (stickiness)
- Average session length
- Sessions per user per day
- Retention (Day 1, Day 7, Day 30)

**Gameplay:**
- Games started
- Games completed
- Average game duration
- Win rates by player count
- Most popular game modes
- Rematch rate

**Social:**
- Invites sent per user
- Invite acceptance rate
- Games with friends vs. strangers
- Shares per user
- Leaderboard engagement

**Monetization:**
- Ad impressions
- Ad click-through rate
- Ad revenue per user
- Purchase conversion rate
- Average revenue per user (ARPU)
- Lifetime value (LTV)

### 8.2 Analytics Implementation

```typescript
// src/analytics/tracker.ts

export class AnalyticsTracker {
  private fbAnalytics: any;
  
  constructor() {
    this.fbAnalytics = FBInstant.analytics;
  }
  
  logGameStart(playerCount: number, gameMode: string): void {
    this.fbAnalytics.logEvent('game_start', {
      player_count: playerCount,
      game_mode: gameMode,
    });
  }
  
  logGameComplete(
    duration: number,
    moves: number,
    winType: string
  ): void {
    this.fbAnalytics.logEvent('game_complete', {
      duration_seconds: duration,
      total_moves: moves,
      win_type: winType,
    });
  }
  
  logPurchase(productID: string, price: number): void {
    this.fbAnalytics.logEvent('purchase', {
      product_id: productID,
      price_usd: price,
    });
  }
  
  logAdView(adType: string, revenue: number): void {
    this.fbAnalytics.logEvent('ad_view', {
      ad_type: adType,
      revenue_usd: revenue,
    });
  }
  
  logSocialAction(actionType: string): void {
    this.fbAnalytics.logEvent('social_action', {
      action_type: actionType, // 'invite', 'share', 'challenge'
    });
  }
}
```

### 8.3 Monitoring Tools

**Facebook Analytics:**
- Built-in analytics dashboard
- Real-time player counts
- Retention cohorts
- Revenue tracking

**Custom Backend Monitoring:**
- Server health (CPU, memory, disk)
- API response times
- Database query performance
- WebSocket connection counts
- Error rates

**Third-Party Tools (Optional):**
- Google Analytics
- Mixpanel
- Amplitude
- Sentry (error tracking)

---

## 9. Future Enhancements

### 9.1 Advanced Features

**Tournaments:**
- Weekly/monthly tournaments
- Entry fees (virtual or real currency)
- Prize pools
- Bracket system
- Live leaderboard updates

**Clans/Teams:**
- Create or join clans
- Clan-based leaderboards
- Clan chat
- Team tournaments
- Clan achievements

**AI Opponents:**
- Practice mode against AI
- Difficulty levels (easy, medium, hard)
- AI personality variations
- Training challenges

**Replay System:**
- Save and replay games
- Share replays
- Comment on replays
- Slow-motion replay
- Move-by-move analysis

### 9.2 Cross-Platform Expansion

**Facebook Gaming Video:**
- Stream gameplay
- Spectator mode
- Live chat integration
- Donations/tips

**Instagram Integration:**
- Share victories to Instagram Stories
- Instagram Instant Games
- Cross-promotion

**WhatsApp Games:**
- Play via WhatsApp
- Group chat integration
- Turn notifications

### 9.3 Localization

**Priority Languages:**
1. English (primary)
2. Spanish
3. Portuguese
4. French
5. German
6. Japanese
7. Korean
8. Chinese (Simplified)

**Localization Tasks:**
- UI text translation
- Tutorial translation
- App store descriptions
- Social sharing messages
- Cultural adaptation of graphics

---

## 10. Conclusion

Integrating Quortex as a Facebook game provides significant opportunities for growth through social features, viral mechanics, and monetization. The Facebook Instant Games platform is an ideal fit for the game's:

- Lightweight, canvas-based architecture
- Turn-based gameplay mechanics
- Social, multiplayer nature
- Mobile-first design

**Key Success Factors:**
1. **Seamless social integration** - Easy to invite friends and share victories
2. **Low friction** - Instant loading, no installation required
3. **Engaging multiplayer** - Both real-time and asynchronous options
4. **Balanced monetization** - Ads and IAP that enhance rather than hinder experience
5. **Community building** - Leaderboards, achievements, and tournaments

**Recommended Next Steps:**
1. Set up Facebook Developer account
2. Create Instant Games app
3. Integrate Facebook SDK (Phase 1)
4. Build multiplayer backend (Phase 3)
5. Implement social features (Phase 2)
6. Add monetization (Phase 5)
7. Submit for Facebook review
8. Soft launch and iterate
9. Full launch with marketing push

With proper execution, Quortex can achieve strong engagement and viral growth on the Facebook platform while creating new revenue streams through advertising and in-app purchases.

---

## Appendix A: API Reference

### Facebook Instant Games SDK

**Core APIs:**
- `FBInstant.initializeAsync()` - Initialize SDK
- `FBInstant.startGameAsync()` - Start game
- `FBInstant.setLoadingProgress(percentage)` - Update loading
- `FBInstant.player` - Player information
- `FBInstant.context` - Game context (thread/group)
- `FBInstant.shareAsync(payload)` - Share dialog
- `FBInstant.updateAsync(payload)` - Update thread
- `FBInstant.getLeaderboardAsync(name)` - Leaderboards
- `FBInstant.payments` - In-app purchases
- `FBInstant.getInterstitialAdAsync(id)` - Ads

**Documentation:**
- https://developers.facebook.com/docs/games/instant-games

---

## Appendix B: Cost Estimates

### Development Costs

**Phase 1-2 (SDK & Social):** 2-4 weeks
- Developer time: $5,000 - $8,000

**Phase 3-4 (Backend & Multiplayer):** 5-7 weeks  
- Developer time: $12,000 - $18,000
- Infrastructure: $50 - $200/month

**Phase 5-6 (Monetization & Launch):** 2-3 weeks
- Developer time: $4,000 - $6,000
- App store assets: $500 - $1,000

**Total Development:** $21,500 - $33,200

### Ongoing Costs

**Monthly:**
- Server hosting: $50 - $300
- Database: $25 - $150
- CDN: $10 - $50
- Monitoring: $0 - $50
- Total: $85 - $550/month

**Scaling (at 100K DAU):**
- Server hosting: $500 - $1,000
- Database: $200 - $500
- CDN: $50 - $150
- Total: $750 - $1,650/month

---

*Last Updated: 2025-11-12*
*Document Version: 1.0*
