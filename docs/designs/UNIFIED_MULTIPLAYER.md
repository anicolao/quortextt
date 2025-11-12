# Unified Multiplayer Architecture for Quortex

## Executive Summary

This document provides a unified vision for multiplayer Quortex across all platforms: web, Discord, Facebook, iOS, and Android. The design prioritizes **maximum code sharing** by establishing a common core architecture that all platforms can leverage, with an **MVP web multiplayer implementation** serving as the foundation for all other platform deployments.

**Core Principle:** Build once, deploy everywhere—reuse the existing game core and create a single multiplayer backend that serves all platforms.

### Platform Coverage

This design integrates the following platform-specific implementations:

- **[Web Multiplayer](WEB_MULTIPLAYER.md)** - Primary platform, serves as MVP and foundation
- **[Discord Integration](DISCORD_DESIGN.md)** - Embedded web app as Discord Activity
- **[Facebook Integration](FACEBOOK_INTEGRATION.md)** - Facebook Instant Games integration
- **[iOS Application](IOS_DESIGN.md)** - Native Swift app with WebView hybrid approach
- **[Android Application](ANDROID_DESIGN.md)** - Native Kotlin app with WebView hybrid approach

### Key Architecture Decisions

1. **Single Backend** - One Node.js/TypeScript backend serves all platforms
2. **Shared Game Core** - 100% reuse of existing `src/game/` TypeScript logic
3. **WebSocket Protocol** - Common real-time communication across all platforms
4. **Hybrid Mobile** - Native shell + WebView for maximum web code reuse
5. **OAuth Federation** - Support multiple identity providers (Google, Apple, Facebook, Discord)

---

## 1. Unified Architecture Overview

### 1.1 Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Platform Layer                               │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────┐  ┌───────┐│
│  │    Web    │  │  Discord  │  │ Facebook  │  │  iOS  │  │Android││
│  │  Browser  │  │ Activity  │  │  Instant  │  │Native │  │Native ││
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └───┬───┘  └───┬───┘│
└────────┼──────────────┼──────────────┼────────────┼──────────┼─────┘
         │              │              │            │          │
         │   ┌──────────┴──────────────┴────────────┴──────────┘
         │   │
┌────────▼───▼────────────────────────────────────────────────────────┐
│                     Shared Client Layer                             │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │            Quortex Web Application (TypeScript)              │  │
│  │  • Canvas Rendering (src/rendering/)                         │  │
│  │  • Game Logic (src/game/) - 100% shared                      │  │
│  │  • Redux State Management (src/redux/)                       │  │
│  │  • Input Handling (src/input/)                               │  │
│  │  • WebSocket Client (multiplayer/)                           │  │
│  └──────────────────────────┬───────────────────────────────────┘  │
└─────────────────────────────┼──────────────────────────────────────┘
                              │
                    HTTPS + WebSocket
                              │
┌─────────────────────────────▼──────────────────────────────────────┐
│                    Unified Backend Service                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              Web Server (Node.js + Express)                  │  │
│  │  • Serves static Vite bundle (all platforms)                │  │
│  │  • REST API endpoints                                        │  │
│  │  • WebSocket server (Socket.IO)                             │  │
│  │  • Multi-provider authentication                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │           Game State Manager (TypeScript)                    │  │
│  │  • Reuses src/game/ logic server-side                       │  │
│  │  • Validates moves                                           │  │
│  │  • Manages active games                                      │  │
│  │  • Broadcasts state updates                                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              Authentication Service                          │  │
│  │  • Google OAuth (Web, Android)                               │  │
│  │  • Apple Sign In (iOS, Web)                                  │  │
│  │  • Facebook Login (Facebook, Web, Android)                   │  │
│  │  • Discord OAuth (Discord, Web)                              │  │
│  │  • JWT token issuance                                        │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬──────────────────────────────────────┘
                              │
┌─────────────────────────────▼──────────────────────────────────────┐
│                       Data Layer                                    │
│  ┌────────────────────┐              ┌────────────────────┐        │
│  │     MongoDB        │              │       Redis        │        │
│  │  • Users           │              │  • Sessions        │        │
│  │  • Games           │              │  • Real-time cache │        │
│  │  • Moves           │              │  • Pub/Sub         │        │
│  │  • Leaderboards    │              │  • Matchmaking Q   │        │
│  └────────────────────┘              └────────────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Code Reuse Strategy

| Component | Web | Discord | Facebook | iOS | Android | Reuse % |
|-----------|-----|---------|----------|-----|---------|---------|
| Game Logic (`src/game/`) | ✅ | ✅ | ✅ | ✅ | ✅ | **100%** |
| Rendering (`src/rendering/`) | ✅ | ✅ | ✅ | ✅ | ✅ | **100%** |
| Redux State (`src/redux/`) | ✅ | ✅ | ✅ | ✅ | ✅ | **100%** |
| UI Components | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | **60%** |
| Backend API | ✅ | ✅ | ✅ | ✅ | ✅ | **100%** |
| WebSocket Protocol | ✅ | ✅ | ✅ | ✅ | ✅ | **100%** |
| Authentication | ✅ | ✅ | ✅ | ✅ | ✅ | **100%** |
| **Overall Code Reuse** | | | | | | **~95%** |

**Legend:**
- ✅ = 100% reuse
- ⚠️ = Hybrid (native shell + WebView)

**Key Insight:** By using WebView-based hybrid approaches for iOS and Android, we achieve ~95% code reuse across all five platforms.

---

## 2. MVP Web Multiplayer: The Foundation

### 2.1 Why Web First?

The web multiplayer implementation serves as the foundation for all other platforms because:

1. **Fastest Time to Market** - No app store approval processes
2. **Universal Access** - Works on all devices with a browser
3. **Rapid Iteration** - Deploy updates instantly
4. **Proof of Concept** - Validate multiplayer experience before mobile investment
5. **Foundation for All Platforms** - Discord, Facebook, and mobile all embed the web version

### 2.2 MVP Feature Set

**Phase 1: Core Multiplayer (2-3 weeks)**

Essential features for the MVP:

- **Real-time 2-player games** - WebSocket-based instant gameplay
- **Basic matchmaking** - Quick match with random opponent
- **Simple authentication** - Google Sign-In only (add others later)
- **Game state persistence** - Save/resume games
- **Move validation** - Server-side verification
- **Reconnection** - Handle network interruptions gracefully

**Deferred to Post-MVP:**

- Turn-based async mode (add in Phase 2)
- 3-6 player games (add in Phase 2)
- Friend system (add in Phase 3)
- Leaderboards (add in Phase 3)
- Achievements (add in Phase 4)
- Spectator mode (add in Phase 4)

### 2.3 MVP Architecture

**Client-Side (Existing Vite App + Multiplayer Module):**

```typescript
// src/multiplayer/client.ts - New multiplayer module

import { io, Socket } from 'socket.io-client';
import { store } from '../redux/store';
import { gameActions } from '../redux/gameActions';

export class MultiplayerClient {
  private socket: Socket | null = null;
  private gameId: string | null = null;

  async connect(authToken: string): Promise<void> {
    this.socket = io(import.meta.env.VITE_SERVER_URL, {
      auth: { token: authToken }
    });

    this.socket.on('game:state', (state) => {
      store.dispatch(gameActions.syncState(state));
    });

    this.socket.on('game:move', (move) => {
      store.dispatch(gameActions.applyOpponentMove(move));
    });

    this.socket.on('game:over', (result) => {
      store.dispatch(gameActions.gameOver(result));
    });
  }

  async quickMatch(): Promise<string> {
    return new Promise((resolve) => {
      this.socket?.emit('matchmaking:quick', {}, (gameId: string) => {
        this.gameId = gameId;
        resolve(gameId);
      });
    });
  }

  async makeMove(position: HexPosition, rotation: number): Promise<void> {
    this.socket?.emit('game:move', {
      gameId: this.gameId,
      position,
      rotation
    });
  }
}
```

**Backend (New Node.js Service):**

```typescript
// backend/src/server.ts - Minimal backend for MVP

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import mongoose from 'mongoose';
import { GameStateManager } from './game/manager';
import { authRouter } from './routes/auth';

const app = express();
const httpServer = createServer(app);
const io = new SocketIO(httpServer, {
  cors: { origin: process.env.CLIENT_URL }
});

// Serve Vite build
app.use(express.static('../dist'));

// Auth endpoints
app.use('/api/auth', authRouter);

// WebSocket game logic
const gameManager = new GameStateManager();

io.on('connection', (socket) => {
  socket.on('matchmaking:quick', async (_, callback) => {
    const gameId = await gameManager.findOrCreateMatch(socket.userId);
    socket.join(gameId);
    callback(gameId);
  });

  socket.on('game:move', async ({ gameId, position, rotation }) => {
    const result = await gameManager.applyMove(
      gameId, socket.userId, position, rotation
    );
    io.to(gameId).emit('game:state', result.state);
    if (result.gameOver) {
      io.to(gameId).emit('game:over', result.winner);
    }
  });
});

httpServer.listen(3000);
```

**Database Schema (Minimal for MVP):**

```typescript
// backend/src/models/Game.ts

interface Game {
  _id: ObjectId;
  gameId: string;
  players: [
    { userId: string; playerIndex: 0 | 1; edge: number },
    { userId: string; playerIndex: 0 | 1; edge: number }
  ];
  currentPlayerIndex: 0 | 1;
  boardState: {
    tiles: Map<string, { type: TileType; rotation: number }>;
    currentTile: TileType | null;
    availableTiles: TileType[];
  };
  status: 'waiting' | 'active' | 'completed';
  winner?: { playerIndex: number; winType: 'flow' | 'constraint' };
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.4 MVP Implementation Timeline

**Week 1: Backend Foundation**
- Set up Node.js/Express server
- Implement Google OAuth authentication
- Set up MongoDB schemas
- Create WebSocket server structure

**Week 2: Game State Management**
- Port `src/game/` logic to run server-side
- Implement move validation
- Create matchmaking system
- Build state synchronization

**Week 3: Client Integration & Testing**
- Integrate multiplayer client with existing UI
- Add lobby and matchmaking UI
- End-to-end testing
- Deploy MVP to production

**Total: 3 weeks to production-ready MVP**

---

## 3. Platform-Specific Implementations

### 3.1 Discord Integration

**Approach:** Embedded Web Activity

Discord natively embeds the web application via iframe, requiring zero additional development beyond the MVP web multiplayer.

**Discord-Specific Features:**
- Discord OAuth for authentication
- Rich presence integration
- Voice channel awareness
- Server-specific game rooms

**Code Reuse:** **100%** - Uses identical web bundle

**Implementation Effort:** 1-2 weeks (mostly Discord SDK integration)

**Reference:** [DISCORD_DESIGN.md](DISCORD_DESIGN.md)

### 3.2 Facebook Instant Games

**Approach:** Hosted Web Application

Facebook Instant Games uses the same web bundle with Facebook SDK integration for social features.

**Facebook-Specific Features:**
- Facebook authentication
- Social sharing and invites
- Leaderboards integration
- In-app purchases (optional)

**Code Reuse:** **100%** - Uses identical web bundle with Facebook SDK wrapper

**Implementation Effort:** 2-3 weeks (Facebook SDK + submission process)

**Reference:** [FACEBOOK_INTEGRATION.md](FACEBOOK_INTEGRATION.md)

### 3.3 iOS Application

**Approach:** Native Swift Shell + WebView

A thin native Swift/SwiftUI application that embeds the web game in a WKWebView, providing native iOS features while reusing 100% of game code.

**Architecture:**
```
┌─────────────────────────────────────┐
│   Native iOS Shell (Swift)          │
│  • Authentication UI                │
│  • Game Center integration          │
│  • Push notifications               │
│  • Native navigation                │
│  └─────────────┬───────────────────┘
                 │
┌────────────────▼────────────────────┐
│   WKWebView Container               │
│  • Embeds web game                  │
│  • JavaScript bridge                │
│  • Full game reuse                  │
└─────────────────────────────────────┘
```

**Native Features:**
- Sign in with Apple
- Game Center leaderboards
- iCloud sync
- Native share sheet
- Push notifications (turn alerts)

**Code Reuse:** **~95%** - Web game + thin native shell

**Implementation Effort:** 8-12 weeks (native app + App Store submission)

**Reference:** [IOS_DESIGN.md](IOS_DESIGN.md)

### 3.4 Android Application

**Approach:** Native Kotlin Shell + WebView

Mirrors the iOS approach—native Android shell with embedded WebView for maximum code reuse.

**Architecture:**
```
┌─────────────────────────────────────┐
│  Native Android Shell (Kotlin)      │
│  • Authentication UI                │
│  • Google Play Games integration    │
│  • Push notifications               │
│  • Native navigation                │
│  └─────────────┬───────────────────┘
                 │
┌────────────────▼────────────────────┐
│   WebView Container                 │
│  • Embeds web game                  │
│  • JavaScript bridge                │
│  • Full game reuse                  │
└─────────────────────────────────────┘
```

**Native Features:**
- Google Sign-In
- Google Play Games Services
- Firebase notifications
- Native sharing
- Material Design chrome

**Code Reuse:** **~95%** - Web game + thin native shell

**Implementation Effort:** 8-12 weeks (native app + Play Store submission)

**Reference:** [ANDROID_DESIGN.md](ANDROID_DESIGN.md)

---

## 4. Unified Backend Service

### 4.1 Single Backend Architecture

All five platforms connect to a single Node.js backend service that provides:

1. **Authentication** - Multi-provider OAuth (Google, Apple, Facebook, Discord)
2. **Game State Management** - Authoritative server for all game logic
3. **Real-time Communication** - WebSocket connections for all platforms
4. **Data Persistence** - MongoDB for games, users, and history
5. **API Gateway** - RESTful API for game management

### 4.2 Authentication Flow (All Platforms)

```
┌──────────┐                          ┌──────────┐
│  Client  │                          │  Server  │
└────┬─────┘                          └────┬─────┘
     │                                      │
     │ 1. OAuth flow with provider          │
     │   (Google/Apple/Facebook/Discord)    │
     │◄─────────────────────────────────────┤
     │                                      │
     │ 2. Send provider token               │
     ├─────────────────────────────────────►│
     │                                      │
     │                    3. Verify token   │
     │                       with provider  │
     │                                      │
     │                 4. Create/get user   │
     │                      from MongoDB    │
     │                                      │
     │ 5. Return JWT session token          │
     │◄─────────────────────────────────────┤
     │                                      │
     │ 6. All requests use JWT              │
     ├─────────────────────────────────────►│
```

**Backend Implementation:**

```typescript
// backend/src/auth/unified.ts

import { OAuth2Client } from 'google-auth-library';
import { verifyAppleToken } from './apple';
import { verifyFacebookToken } from './facebook';
import { verifyDiscordToken } from './discord';

export async function authenticateUser(
  provider: 'google' | 'apple' | 'facebook' | 'discord',
  token: string
): Promise<{ userId: string; jwt: string }> {
  
  let userInfo: UserInfo;
  
  switch (provider) {
    case 'google':
      userInfo = await verifyGoogleToken(token);
      break;
    case 'apple':
      userInfo = await verifyAppleToken(token);
      break;
    case 'facebook':
      userInfo = await verifyFacebookToken(token);
      break;
    case 'discord':
      userInfo = await verifyDiscordToken(token);
      break;
  }
  
  // Find or create user
  const user = await User.findOneAndUpdate(
    { [`${provider}Id`]: userInfo.providerId },
    { 
      $set: {
        displayName: userInfo.name,
        email: userInfo.email,
        avatar: userInfo.picture,
        lastActive: new Date()
      },
      $setOnInsert: {
        createdAt: new Date(),
        stats: { gamesPlayed: 0, wins: 0 }
      }
    },
    { upsert: true, new: true }
  );
  
  // Issue JWT
  const jwt = signJWT({ userId: user._id });
  
  return { userId: user._id, jwt };
}
```

### 4.3 WebSocket Protocol (All Platforms)

All platforms use the same WebSocket protocol for real-time gameplay:

**Client → Server Events:**
```typescript
'matchmaking:quick'     // Find/create match
'matchmaking:private'   // Create private game
'game:join'            // Join specific game
'game:move'            // Submit move
'game:leave'           // Leave game
'game:resign'          // Forfeit game
```

**Server → Client Events:**
```typescript
'game:state'           // Full game state sync
'game:move'            // Opponent made move
'game:player-joined'   // Player joined game
'game:player-left'     // Player left game
'game:over'            // Game ended
'error'                // Error occurred
```

**Example Move Handling:**

```typescript
// backend/src/game/manager.ts

export class GameStateManager {
  async applyMove(
    gameId: string,
    userId: string,
    position: HexPosition,
    rotation: number
  ): Promise<GameUpdateResult> {
    
    const game = await Game.findOne({ gameId });
    
    // Validate turn
    if (game.players[game.currentPlayerIndex].userId !== userId) {
      throw new Error('Not your turn');
    }
    
    // Validate move using shared game core
    import { isLegalMove } from '../../src/game/legality';
    if (!isLegalMove(game.boardState, position, rotation, game.players)) {
      throw new Error('Illegal move');
    }
    
    // Apply move using shared game core
    import { applyTilePlacement } from '../../src/game/board';
    const newBoardState = applyTilePlacement(
      game.boardState, 
      position, 
      rotation
    );
    
    // Check victory using shared game core
    import { checkVictoryConditions } from '../../src/game/victory';
    const victoryResult = checkVictoryConditions(
      newBoardState, 
      game.players
    );
    
    // Update game
    game.boardState = newBoardState;
    game.currentPlayerIndex = (game.currentPlayerIndex + 1) % 2;
    
    if (victoryResult.winner !== null) {
      game.status = 'completed';
      game.winner = victoryResult;
    }
    
    await game.save();
    
    return {
      state: game,
      gameOver: victoryResult.winner !== null,
      winner: victoryResult
    };
  }
}
```

### 4.4 Technology Stack (Backend)

**Server Runtime:**
- **Primary:** Node.js 20+ LTS
- **Alternative:** Bun (faster performance)

**Web Framework:**
- **Primary:** Express.js (mature, well-documented)
- **Alternative:** Fastify (higher performance)

**Database:**
- **Primary:** MongoDB 7.0+ (flexible schema, good for game state)
- **Cache:** Redis 7.0+ (sessions, matchmaking queue)

**Real-time:**
- **Primary:** Socket.IO (battle-tested, reconnection handling)
- **Alternative:** ws + custom protocol

**Deployment:**
- **Development:** Docker Compose
- **Production:** Kubernetes or single VPS (DigitalOcean, Hetzner)

---

## 5. Shared Components & Patterns

### 5.1 Game Core Reuse Strategy

The existing `src/game/` directory contains all game logic in TypeScript. This code is **100% reusable** across:

1. **Client-side** - Browser, Discord, Facebook (directly)
2. **Server-side** - Backend validation (import as Node.js module)
3. **Mobile** - iOS/Android WebView (via web bundle)

**Key Shared Modules:**

```
src/game/
├── types.ts           # Shared type definitions
├── board.ts           # Board representation & operations
├── tiles.ts           # Tile types and rotations
├── legality.ts        # Move validation rules
├── flows.ts           # Flow propagation logic
├── victory.ts         # Win condition checking
├── bag.ts             # Tile bag management
└── ai.ts              # AI opponent (optional)
```

**Server-Side Usage:**

```typescript
// backend/src/game/validation.ts

// Import shared game core
import { isLegalMove } from '../../src/game/legality';
import { GameState, HexPosition } from '../../src/game/types';

export function validatePlayerMove(
  gameState: GameState,
  position: HexPosition,
  rotation: number
): boolean {
  // Use exact same validation logic as client
  return isLegalMove(gameState.board, position, rotation, gameState.players);
}
```

### 5.2 WebView Integration Pattern (iOS/Android)

Both iOS and Android use the same integration pattern:

**JavaScript Bridge (Client Side):**

```typescript
// src/platform/bridge.ts

interface NativeBridge {
  isNative(): boolean;
  getAuthToken(): Promise<string>;
  vibrate(duration: number): void;
  share(content: ShareContent): void;
  requestNotification(): Promise<boolean>;
}

// Auto-detect platform
export const bridge: NativeBridge = (() => {
  if (window.webkit?.messageHandlers?.nativeApp) {
    return new IOSBridge();
  } else if (window.Android) {
    return new AndroidBridge();
  } else {
    return new WebBridge();
  }
})();

class IOSBridge implements NativeBridge {
  isNative() { return true; }
  
  async getAuthToken(): Promise<string> {
    return new Promise((resolve) => {
      window.webkit.messageHandlers.nativeApp.postMessage({
        action: 'getAuthToken'
      });
      window.receiveAuthToken = (token) => resolve(token);
    });
  }
  
  vibrate(duration: number): void {
    window.webkit.messageHandlers.nativeApp.postMessage({
      action: 'vibrate',
      duration
    });
  }
}

class AndroidBridge implements NativeBridge {
  isNative() { return true; }
  
  async getAuthToken(): Promise<string> {
    return window.Android.getAuthToken();
  }
  
  vibrate(duration: number): void {
    window.Android.vibrate(duration);
  }
}

class WebBridge implements NativeBridge {
  isNative() { return false; }
  async getAuthToken(): Promise<string> { return ''; }
  vibrate(duration: number): void { 
    navigator.vibrate?.(duration);
  }
}
```

**Native Integration (iOS Example):**

```swift
// iOS: WebViewMessageHandler.swift

class WebViewMessageHandler: NSObject, WKScriptMessageHandler {
  func userContentController(
    _ userContentController: WKUserContentController,
    didReceive message: WKScriptMessage
  ) {
    guard let body = message.body as? [String: Any],
          let action = body["action"] as? String else { return }
    
    switch action {
    case "getAuthToken":
      let token = AuthService.shared.currentToken
      let script = "window.receiveAuthToken('\(token)');"
      message.webView?.evaluateJavaScript(script)
      
    case "vibrate":
      if let duration = body["duration"] as? Int {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
      }
      
    case "share":
      // Present native share sheet
      break
    }
  }
}
```

### 5.3 Authentication Abstraction

Each platform implements the same authentication interface:

```typescript
// src/auth/interface.ts

export interface AuthProvider {
  readonly name: 'google' | 'apple' | 'facebook' | 'discord';
  
  // Initiate OAuth flow
  login(): Promise<AuthResult>;
  
  // Exchange provider token for app JWT
  exchangeToken(providerToken: string): Promise<string>;
  
  // Logout
  logout(): Promise<void>;
  
  // Get current user
  getCurrentUser(): Promise<User | null>;
}

export interface AuthResult {
  providerToken: string;
  email?: string;
  name?: string;
  picture?: string;
}
```

**Platform-Specific Implementations:**

```typescript
// src/auth/providers/google.ts
export class GoogleAuthProvider implements AuthProvider {
  name = 'google' as const;
  
  async login(): Promise<AuthResult> {
    // Web: Use Google Sign-In JavaScript library
    // Android: Use Google Sign-In SDK via bridge
    // iOS: Use Sign in with Apple via bridge
  }
}

// src/auth/providers/discord.ts
export class DiscordAuthProvider implements AuthProvider {
  name = 'discord' as const;
  
  async login(): Promise<AuthResult> {
    // Discord Activity provides user automatically
  }
}
```

---

## 6. Implementation Roadmap

### 6.1 Overall Timeline

```
Month 1: MVP Web Multiplayer (Foundation)
Month 2: Discord + Facebook Integration
Month 3-4: iOS Native App
Month 4-5: Android Native App
Month 6: Polish, Testing, Marketing
```

### 6.2 Detailed Phases

#### Phase 1: MVP Web Multiplayer (Weeks 1-3) 🎯 **PRIORITY**

**Goal:** Production-ready web multiplayer serving as foundation for all platforms

**Week 1: Backend Infrastructure**
- [ ] Set up Node.js/Express server
- [ ] Implement MongoDB schemas
- [ ] Create authentication endpoints (Google only)
- [ ] Set up WebSocket server with Socket.IO
- [ ] Deploy to staging environment

**Week 2: Game State Management**
- [ ] Create GameStateManager class
- [ ] Implement move validation using `src/game/`
- [ ] Build matchmaking system (quick match)
- [ ] Add game persistence
- [ ] Implement reconnection logic

**Week 3: Client Integration**
- [ ] Create multiplayer client module
- [ ] Build lobby and matchmaking UI
- [ ] Integrate with existing game rendering
- [ ] Add network status indicators
- [ ] End-to-end testing
- [ ] Deploy to production

**Deliverable:** Fully functional 2-player web multiplayer

#### Phase 2: Platform Expansion (Weeks 4-8)

**Week 4-5: Discord Integration**
- [ ] Register Discord application
- [ ] Integrate Discord SDK
- [ ] Implement Discord OAuth
- [ ] Add Discord-specific features (rich presence)
- [ ] Test in Discord client
- [ ] Submit for Discord verification

**Week 6-8: Facebook Instant Games**
- [ ] Register Facebook app
- [ ] Integrate Facebook Instant Games SDK
- [ ] Implement Facebook authentication
- [ ] Add social features (invite, share)
- [ ] Create submission assets
- [ ] Submit for Facebook review
- [ ] Soft launch

**Deliverable:** Quortex live on Discord and Facebook

#### Phase 3: iOS Application (Weeks 9-16)

**Week 9-10: iOS Foundation**
- [ ] Set up Xcode project
- [ ] Create SwiftUI app structure
- [ ] Implement WKWebView container
- [ ] Build JavaScript bridge
- [ ] Set up Sign in with Apple

**Week 11-12: Native Features**
- [ ] Integrate Game Center
- [ ] Implement push notifications
- [ ] Add iCloud sync
- [ ] Build native navigation
- [ ] Create settings screen

**Week 13-14: Integration & Testing**
- [ ] Complete WebView integration
- [ ] Test on multiple devices
- [ ] Performance optimization
- [ ] TestFlight beta testing
- [ ] Fix critical bugs

**Week 15-16: App Store Launch**
- [ ] Create App Store assets
- [ ] Write descriptions
- [ ] Submit for review
- [ ] Address review feedback
- [ ] Launch on App Store

**Deliverable:** Quortex live on iOS App Store

#### Phase 4: Android Application (Weeks 17-24)

**Week 17-18: Android Foundation**
- [ ] Set up Android Studio project
- [ ] Create Kotlin app structure
- [ ] Implement WebView container
- [ ] Build JavaScript bridge
- [ ] Set up Google Sign-In

**Week 19-20: Native Features**
- [ ] Integrate Google Play Games
- [ ] Implement Firebase notifications
- [ ] Add Material Design UI
- [ ] Build native navigation
- [ ] Create settings screen

**Week 21-22: Integration & Testing**
- [ ] Complete WebView integration
- [ ] Test on multiple devices
- [ ] Performance optimization
- [ ] Internal testing
- [ ] Fix critical bugs

**Week 23-24: Play Store Launch**
- [ ] Create Play Store assets
- [ ] Write descriptions
- [ ] Submit for review
- [ ] Address review feedback
- [ ] Launch on Play Store

**Deliverable:** Quortex live on Google Play

#### Phase 5: Post-Launch Enhancement (Ongoing)

**Month 6+: Advanced Features**
- [ ] 3-6 player games
- [ ] Turn-based async mode
- [ ] Friend system
- [ ] Leaderboards
- [ ] Achievements
- [ ] Tournaments
- [ ] Spectator mode
- [ ] AI opponents
- [ ] Replay system

### 6.3 Dependency Chart

```
MVP Web ──────┬────────────┬─────────────┬──────────────┐
              │            │             │              │
              ▼            ▼             ▼              ▼
          Discord      Facebook       iOS           Android
                                       │              │
                                       │              │
                                       ▼              ▼
                                   App Store    Play Store
```

**Critical Path:** MVP Web Multiplayer must be completed before any platform-specific work begins.

---

## 7. Cost & Resource Estimates

### 7.1 Development Costs

| Phase | Duration | Developer Time | Cost Estimate |
|-------|----------|----------------|---------------|
| MVP Web Multiplayer | 3 weeks | 120 hours | $12,000 - $18,000 |
| Discord Integration | 2 weeks | 80 hours | $8,000 - $12,000 |
| Facebook Integration | 3 weeks | 120 hours | $12,000 - $18,000 |
| iOS Application | 8 weeks | 320 hours | $32,000 - $48,000 |
| Android Application | 8 weeks | 320 hours | $32,000 - $48,000 |
| **Total** | **24 weeks** | **960 hours** | **$96,000 - $144,000** |

**Assumptions:**
- Senior developer rate: $100-150/hour
- Part-time work (20 hours/week)
- Minimal design work (reuse existing)

### 7.2 Infrastructure Costs

**Monthly Operating Costs:**

| Service | Small Scale (<1K users) | Medium Scale (10K users) | Large Scale (100K users) |
|---------|-------------------------|--------------------------|--------------------------|
| Server Hosting | $20-60 | $100-300 | $500-1,000 |
| MongoDB | $0-25 | $60-150 | $300-600 |
| Redis | Included | $30-60 | $100-200 |
| CDN | $5-15 | $20-50 | $100-300 |
| Monitoring | $0-30 | $30-60 | $100-200 |
| **Total** | **$25-130** | **$240-620** | **$1,100-2,300** |

**One-Time Costs:**
- Apple Developer Program: $99/year
- Google Play Developer: $25 (one-time)
- Domain & SSL: $10-15/year
- **Total:** ~$134 first year, $109/year after

### 7.3 Revenue Potential

**Estimated Monthly Revenue (at 10K DAU):**

| Revenue Source | Conservative | Optimistic |
|----------------|--------------|------------|
| Web Ads | $200 | $600 |
| Discord/Facebook Ads | $150 | $400 |
| iOS In-App Purchases | $300 | $1,000 |
| Android In-App Purchases | $200 | $800 |
| Subscriptions | $400 | $1,500 |
| **Total** | **$1,250** | **$4,300** |

**Break-Even Analysis:**
- Infrastructure costs: ~$500/month (medium scale)
- Break-even: ~5,000 DAU
- Profitable at: 10,000+ DAU

---

## 8. Risk Mitigation

### 8.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| WebSocket connection instability | Medium | High | Implement robust reconnection logic with exponential backoff |
| Mobile WebView performance issues | Medium | Medium | Optimize rendering, use hardware acceleration, minimize JS bundle |
| Cross-platform auth complexity | High | Medium | Use battle-tested OAuth libraries, thorough testing |
| Backend scaling challenges | Medium | High | Start with proven stack (Node.js + MongoDB), plan for horizontal scaling |
| Game state desync | Low | High | Authoritative server, checksums, periodic full state sync |

### 8.2 Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Low user acquisition | Medium | High | Launch web first (no barrier), leverage social sharing, cross-promote |
| App store rejections | Medium | Medium | Follow guidelines strictly, prepare test accounts, have contingency |
| Competitor launches similar game | Low | Medium | Move fast, focus on UX quality, build community |
| Monetization underperforms | Medium | Medium | A/B test pricing, offer fair free tier, add value to premium |

### 8.3 Timeline Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| MVP takes longer than estimated | Medium | High | Keep scope minimal, defer non-essential features |
| Platform submission delays | High | Medium | Submit early, prepare thorough documentation |
| Scope creep | High | High | Strict adherence to MVP feature set, resist feature additions |
| Key developer unavailability | Low | High | Document thoroughly, modular architecture |

---

## 9. Success Metrics

### 9.1 Key Performance Indicators

**Engagement Metrics:**
- Daily Active Users (DAU)
- Monthly Active Users (MAU)
- DAU/MAU ratio (target: >20%)
- Average session length (target: >15 minutes)
- Games per user per day (target: >2)

**Retention Metrics:**
- Day 1 retention (target: >40%)
- Day 7 retention (target: >20%)
- Day 30 retention (target: >10%)

**Multiplayer Metrics:**
- Average matchmaking time (target: <30 seconds)
- Game completion rate (target: >80%)
- Reconnection success rate (target: >95%)
- Average moves per game (track for balance)

**Cross-Platform Metrics:**
- Platform distribution (Web vs Discord vs Facebook vs iOS vs Android)
- Cross-platform play rate
- Preferred platform per user

**Technical Metrics:**
- API response time p95 (target: <200ms)
- WebSocket latency p95 (target: <100ms)
- Crash-free rate (target: >99.5%)
- Uptime (target: >99.9%)

### 9.2 Launch Milestones

| Milestone | Target Date | Success Criteria |
|-----------|-------------|------------------|
| MVP Web Launch | Week 3 | 100 active users, >80% game completion rate |
| Discord Launch | Week 8 | 500 Discord users, >5 concurrent games |
| Facebook Launch | Week 8 | 1,000 Facebook users, 4.0+ rating |
| iOS Launch | Week 16 | 5,000 downloads first month, 4.5+ App Store rating |
| Android Launch | Week 24 | 10,000 downloads first month, 4.3+ Play Store rating |
| Profitability | Month 12 | Revenue > costs, 50K+ MAU |

---

## 10. Conclusion

This unified multiplayer architecture for Quortex maximizes code reuse (~95%) across five platforms by:

1. **Building a solid MVP web multiplayer foundation** that serves as the base for all platforms
2. **Leveraging web technologies everywhere** - Discord, Facebook, and mobile WebViews all use the same game bundle
3. **Implementing a single authoritative backend** that serves all platforms with identical APIs
4. **Using hybrid native apps for mobile** that wrap the web game with thin native shells

### Key Advantages

✅ **Rapid Time to Market** - MVP in 3 weeks, all platforms in 6 months
✅ **Minimal Development Cost** - ~$100K total vs $400K+ for fully native
✅ **Consistent Experience** - Identical gameplay across all platforms
✅ **Simplified Maintenance** - Bug fixes once, deploy everywhere
✅ **Easy Feature Addition** - New features automatically available on all platforms

### Recommended Next Steps

1. **Immediate (Week 0):**
   - Set up development environment
   - Choose backend hosting (DigitalOcean/AWS)
   - Register OAuth apps (Google, Discord, Facebook, Apple)

2. **Week 1-3: MVP Development** 🎯
   - Build backend infrastructure
   - Implement WebSocket multiplayer
   - Create lobby & matchmaking UI
   - Deploy to production

3. **Week 4-8: Platform Expansion**
   - Discord integration
   - Facebook Instant Games
   - Cross-platform testing

4. **Week 9-24: Mobile Apps**
   - iOS development & launch
   - Android development & launch
   - App store optimization

5. **Ongoing: Growth & Enhancement**
   - Monitor metrics
   - Iterate based on feedback
   - Add advanced features
   - Scale infrastructure

### Final Recommendation

**Start with the MVP web multiplayer.** This provides:
- Immediate user validation
- Foundation for all other platforms
- Fastest path to revenue
- Lowest risk investment

Once the MVP proves the multiplayer experience is solid, expand to Discord and Facebook (quick wins), then invest in native mobile apps for maximum reach.

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-12  
**Status:** Design Specification  
**Next Review:** After MVP launch

## Related Documents

- [Web Multiplayer Design](WEB_MULTIPLAYER.md) - MVP implementation details
- [Discord Integration Design](DISCORD_DESIGN.md) - Discord Activity architecture
- [Facebook Integration Design](FACEBOOK_INTEGRATION.md) - Instant Games integration
- [iOS Application Design](IOS_DESIGN.md) - Native iOS app architecture
- [Android Application Design](ANDROID_DESIGN.md) - Native Android app architecture
- [Game Rules](../RULES.md) - Complete game rules and mechanics
- [UI Design](UI_DESIGN.md) - Visual design specifications
