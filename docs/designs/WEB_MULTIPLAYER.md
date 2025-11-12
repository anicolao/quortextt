# Web Multiplayer Design Document

## Overview

This document outlines the architecture and implementation plan for adding a multiplayer experience to Quortex backed by a lightweight server infrastructure. The system will support real-time and asynchronous gameplay with user authentication via multiple identity providers.

## Executive Summary

**Key Features:**
- Multiplayer gameplay (2-6 players)
- Real-time and turn-based modes
- Multiple authentication providers (Facebook, Discord, Apple, Google)
- Lightweight Node.js backend
- MongoDB data storage
- WebSocket-based real-time communication
- RESTful API for game management

**Technology Stack:**
- **Backend:** Node.js + Express.js
- **Real-time:** Socket.IO
- **Database:** MongoDB
- **Authentication:** Passport.js with OAuth 2.0
- **Hosting:** Docker containers (AWS/GCP/DigitalOcean)
- **CDN:** CloudFlare or similar for static assets

---

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client (Browser)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Game UI     │  │  WebSocket   │  │   REST API   │  │
│  │  (Canvas)    │  │  Client      │  │   Client     │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
└─────────┼──────────────────┼──────────────────┼─────────┘
          │                  │                  │
          │         ┌────────▼──────────────────▼────────┐
          │         │      Load Balancer / CDN           │
          │         └────────┬──────────────────┬────────┘
          │                  │                  │
┌─────────▼──────────────────▼──────────────────▼─────────┐
│                   Application Server                     │
│  ┌──────────────────────────────────────────────────┐   │
│  │            Node.js + Express.js                  │   │
│  ├──────────────────────────────────────────────────┤   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │   │
│  │  │ Socket.IO│  │  REST    │  │    Auth      │   │   │
│  │  │ Server   │  │  Routes  │  │ Middleware   │   │   │
│  │  └────┬─────┘  └────┬─────┘  └──────┬───────┘   │   │
│  └───────┼─────────────┼────────────────┼───────────┘   │
│          │             │                │               │
│  ┌───────▼─────────────▼────────────────▼───────────┐   │
│  │          Business Logic Layer                    │   │
│  │  - Game Management   - Matchmaking               │   │
│  │  - Player Sessions   - Leaderboards              │   │
│  └───────┬──────────────────────────────────────────┘   │
└──────────┼──────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────┐
│                   Data Layer                             │
│  ┌──────────────┐         ┌──────────────┐              │
│  │   MongoDB    │         │    Redis     │              │
│  │              │         │              │              │
│  │ - Users      │         │ - Sessions   │              │
│  │ - Games      │         │ - Cache      │              │
│  │ - Moves      │         │ - Pub/Sub    │              │
│  └──────────────┘         └──────────────┘              │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Component Responsibilities

**Client (Browser):**
- Render game state on HTML5 Canvas
- Handle user input and interactions
- Maintain WebSocket connection for real-time updates
- Make REST API calls for game management
- Handle OAuth authentication flows

**Application Server:**
- Process game logic and validate moves
- Manage WebSocket connections and broadcast updates
- Handle authentication and session management
- Provide REST API for game operations
- Implement matchmaking algorithms

**Data Layer:**
- **MongoDB:** Persistent storage for users, games, and move history
- **Redis:** Session management, caching, and real-time pub/sub

---

## 2. Authentication System

### 2.1 Supported Identity Providers

The system will support four OAuth 2.0 providers:

1. **Facebook Login**
2. **Discord OAuth**
3. **Apple Sign In**
4. **Google Sign-In**

### 2.2 Authentication Flow

```
┌──────────┐                                    ┌──────────┐
│  Client  │                                    │  Server  │
└────┬─────┘                                    └────┬─────┘
     │                                                │
     │ 1. Click "Login with [Provider]"               │
     ├───────────────────────────────────────────────>│
     │                                                │
     │ 2. Redirect to OAuth provider                  │
     │<───────────────────────────────────────────────┤
     │                                                │
┌────▼─────────────┐                                  │
│ OAuth Provider   │                                  │
│ (FB/Discord/etc) │                                  │
└────┬─────────────┘                                  │
     │                                                │
     │ 3. User authorizes                             │
     │                                                │
     │ 4. Callback with auth code                     │
     ├───────────────────────────────────────────────>│
     │                                                │
     │                                5. Exchange code│
     │                                   for token    │
     │                                                │
     │                              6. Fetch user info│
     │                                                │
     │                         7. Create/update user  │
     │                            in database         │
     │                                                │
     │ 8. Return JWT session token                    │
     │<───────────────────────────────────────────────┤
     │                                                │
     │ 9. Store JWT in localStorage                   │
     │                                                │
     │ 10. All subsequent requests include JWT        │
     ├───────────────────────────────────────────────>│
     │                                                │
```

### 2.3 Passport.js Configuration

**Installation:**
```bash
npm install passport passport-facebook passport-google-oauth20 \
  passport-apple passport-discord jsonwebtoken express-session
```

**Implementation:**
```typescript
// src/server/auth/passport-config.ts

import passport from 'passport';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as DiscordStrategy } from 'passport-discord';
import AppleStrategy from 'passport-apple';
import { User } from '../models/User';

// Facebook Strategy
passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID!,
    clientSecret: process.env.FACEBOOK_APP_SECRET!,
    callbackURL: `${process.env.BASE_URL}/auth/facebook/callback`,
    profileFields: ['id', 'displayName', 'photos', 'email']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ facebookId: profile.id });
      
      if (!user) {
        user = await User.create({
          facebookId: profile.id,
          displayName: profile.displayName,
          email: profile.emails?.[0]?.value,
          avatar: profile.photos?.[0]?.value,
          provider: 'facebook'
        });
      }
      
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));

// Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: `${process.env.BASE_URL}/auth/google/callback`
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ googleId: profile.id });
      
      if (!user) {
        user = await User.create({
          googleId: profile.id,
          displayName: profile.displayName,
          email: profile.emails?.[0]?.value,
          avatar: profile.photos?.[0]?.value,
          provider: 'google'
        });
      }
      
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));

// Discord Strategy
passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID!,
    clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    callbackURL: `${process.env.BASE_URL}/auth/discord/callback`,
    scope: ['identify', 'email']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ discordId: profile.id });
      
      if (!user) {
        user = await User.create({
          discordId: profile.id,
          displayName: profile.username,
          email: profile.email,
          avatar: profile.avatar 
            ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
            : null,
          provider: 'discord'
        });
      }
      
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));

// Apple Strategy
passport.use(new AppleStrategy({
    clientID: process.env.APPLE_CLIENT_ID!,
    teamID: process.env.APPLE_TEAM_ID!,
    callbackURL: `${process.env.BASE_URL}/auth/apple/callback`,
    keyID: process.env.APPLE_KEY_ID!,
    privateKeyString: process.env.APPLE_PRIVATE_KEY!
  },
  async (accessToken, refreshToken, idToken, profile, done) => {
    try {
      let user = await User.findOne({ appleId: profile.id });
      
      if (!user) {
        user = await User.create({
          appleId: profile.id,
          displayName: profile.name?.firstName 
            ? `${profile.name.firstName} ${profile.name.lastName}` 
            : 'Apple User',
          email: profile.email,
          provider: 'apple'
        });
      }
      
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));

export default passport;
```

### 2.4 Authentication Routes

```typescript
// src/server/routes/auth.ts

import express from 'express';
import passport from '../auth/passport-config';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Facebook routes
router.get('/auth/facebook', 
  passport.authenticate('facebook', { scope: ['email'] })
);

router.get('/auth/facebook/callback',
  passport.authenticate('facebook', { session: false }),
  (req, res) => {
    const token = jwt.sign(
      { userId: req.user._id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
    res.redirect(`${process.env.CLIENT_URL}?token=${token}`);
  }
);

// Google routes
router.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/auth/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    const token = jwt.sign(
      { userId: req.user._id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
    res.redirect(`${process.env.CLIENT_URL}?token=${token}`);
  }
);

// Discord routes
router.get('/auth/discord',
  passport.authenticate('discord')
);

router.get('/auth/discord/callback',
  passport.authenticate('discord', { session: false }),
  (req, res) => {
    const token = jwt.sign(
      { userId: req.user._id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
    res.redirect(`${process.env.CLIENT_URL}?token=${token}`);
  }
);

// Apple routes
router.get('/auth/apple',
  passport.authenticate('apple')
);

router.post('/auth/apple/callback',
  passport.authenticate('apple', { session: false }),
  (req, res) => {
    const token = jwt.sign(
      { userId: req.user._id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
    res.redirect(`${process.env.CLIENT_URL}?token=${token}`);
  }
);

// Get current user
router.get('/auth/me', authenticateJWT, async (req, res) => {
  const user = await User.findById(req.user.userId).select('-__v');
  res.json(user);
});

// Logout
router.post('/auth/logout', (req, res) => {
  res.json({ success: true });
});

export default router;
```

### 2.5 JWT Middleware

```typescript
// src/server/middleware/auth.ts

import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
  };
}

export const authenticateJWT = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
    };
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};
```

---

## 3. Database Schema (MongoDB)

### 3.1 Collections Overview

The MongoDB database will contain the following collections:
- `users` - User accounts and profiles
- `games` - Game instances and metadata
- `moves` - Move history for each game
- `sessions` - Active game sessions (supplemented by Redis)
- `leaderboards` - Player rankings and statistics

### 3.2 User Schema

```typescript
// src/server/models/User.ts

import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  // OAuth provider IDs
  facebookId?: string;
  googleId?: string;
  discordId?: string;
  appleId?: string;
  
  // Profile information
  displayName: string;
  email?: string;
  avatar?: string;
  provider: 'facebook' | 'google' | 'discord' | 'apple';
  
  // Game statistics
  stats: {
    gamesPlayed: number;
    gamesWon: number;
    gamesLost: number;
    winStreak: number;
    bestWinStreak: number;
  };
  
  // Settings
  settings: {
    notifications: boolean;
    soundEnabled: boolean;
    theme: string;
  };
  
  // Metadata
  createdAt: Date;
  lastActive: Date;
}

const UserSchema = new Schema<IUser>({
  facebookId: { type: String, unique: true, sparse: true },
  googleId: { type: String, unique: true, sparse: true },
  discordId: { type: String, unique: true, sparse: true },
  appleId: { type: String, unique: true, sparse: true },
  
  displayName: { type: String, required: true },
  email: { type: String, sparse: true },
  avatar: { type: String },
  provider: { 
    type: String, 
    enum: ['facebook', 'google', 'discord', 'apple'],
    required: true 
  },
  
  stats: {
    gamesPlayed: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    gamesLost: { type: Number, default: 0 },
    winStreak: { type: Number, default: 0 },
    bestWinStreak: { type: Number, default: 0 }
  },
  
  settings: {
    notifications: { type: Boolean, default: true },
    soundEnabled: { type: Boolean, default: true },
    theme: { type: String, default: 'default' }
  },
  
  createdAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now }
});

// Indexes
UserSchema.index({ facebookId: 1 });
UserSchema.index({ googleId: 1 });
UserSchema.index({ discordId: 1 });
UserSchema.index({ appleId: 1 });
UserSchema.index({ 'stats.gamesWon': -1 }); // For leaderboards

export const User = mongoose.model<IUser>('User', UserSchema);
```

### 3.3 Game Schema

```typescript
// src/server/models/Game.ts

import mongoose, { Schema, Document } from 'mongoose';

export interface IGame extends Document {
  // Game configuration
  gameId: string;
  playerCount: number;
  boardRadius: number;
  
  // Players
  players: Array<{
    userId: mongoose.Types.ObjectId;
    playerIndex: number;
    color: string;
    edge: number;
    connected: boolean;
    isAI: boolean;
  }>;
  
  // Game state
  status: 'waiting' | 'active' | 'completed' | 'abandoned';
  currentTurn: number;
  currentPlayerIndex: number;
  
  // Board state (serialized)
  boardState: {
    tiles: Map<string, any>; // Hex position to tile mapping
    availableTiles: Array<string>;
    currentTile?: string;
  };
  
  // Game mode
  mode: 'realtime' | 'async';
  timeControl?: {
    type: 'blitz' | 'standard' | 'unlimited';
    timePerMove?: number; // seconds
    totalTime?: number; // seconds per player
  };
  
  // Results
  winner?: {
    playerIndex: number;
    userId: mongoose.Types.ObjectId;
    winType: 'flow' | 'constraint';
  };
  
  // Metadata
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  lastMoveAt?: Date;
}

const GameSchema = new Schema<IGame>({
  gameId: { type: String, required: true, unique: true },
  playerCount: { type: Number, required: true, min: 2, max: 6 },
  boardRadius: { type: Number, default: 5 },
  
  players: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    playerIndex: { type: Number, required: true },
    color: { type: String, required: true },
    edge: { type: Number, required: true },
    connected: { type: Boolean, default: true },
    isAI: { type: Boolean, default: false }
  }],
  
  status: {
    type: String,
    enum: ['waiting', 'active', 'completed', 'abandoned'],
    default: 'waiting'
  },
  currentTurn: { type: Number, default: 0 },
  currentPlayerIndex: { type: Number, default: 0 },
  
  boardState: {
    tiles: { type: Map, of: Schema.Types.Mixed },
    availableTiles: [{ type: String }],
    currentTile: { type: String }
  },
  
  mode: {
    type: String,
    enum: ['realtime', 'async'],
    default: 'realtime'
  },
  timeControl: {
    type: {
      type: String,
      enum: ['blitz', 'standard', 'unlimited']
    },
    timePerMove: { type: Number },
    totalTime: { type: Number }
  },
  
  winner: {
    playerIndex: { type: Number },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    winType: { type: String, enum: ['flow', 'constraint'] }
  },
  
  createdAt: { type: Date, default: Date.now },
  startedAt: { type: Date },
  completedAt: { type: Date },
  lastMoveAt: { type: Date }
});

// Indexes
GameSchema.index({ gameId: 1 });
GameSchema.index({ status: 1 });
GameSchema.index({ 'players.userId': 1 });
GameSchema.index({ mode: 1, status: 1 });
GameSchema.index({ createdAt: -1 });

export const Game = mongoose.model<IGame>('Game', GameSchema);
```

### 3.4 Move Schema

```typescript
// src/server/models/Move.ts

import mongoose, { Schema, Document } from 'mongoose';

export interface IMove extends Document {
  gameId: string;
  moveNumber: number;
  playerIndex: number;
  userId: mongoose.Types.ObjectId;
  
  // Move details
  tile: {
    type: string;
    position: {
      row: number;
      col: number;
    };
    rotation: number;
  };
  
  // Move type
  action: 'place' | 'supermove' | 'pass';
  
  // Timing
  timeSpent: number; // milliseconds
  timestamp: Date;
}

const MoveSchema = new Schema<IMove>({
  gameId: { type: String, required: true, index: true },
  moveNumber: { type: Number, required: true },
  playerIndex: { type: Number, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  
  tile: {
    type: { type: String, required: true },
    position: {
      row: { type: Number, required: true },
      col: { type: Number, required: true }
    },
    rotation: { type: Number, required: true }
  },
  
  action: {
    type: String,
    enum: ['place', 'supermove', 'pass'],
    default: 'place'
  },
  
  timeSpent: { type: Number },
  timestamp: { type: Date, default: Date.now }
});

// Compound index for move history queries
MoveSchema.index({ gameId: 1, moveNumber: 1 });

export const Move = mongoose.model<IMove>('Move', MoveSchema);
```

### 3.5 Leaderboard Schema

```typescript
// src/server/models/Leaderboard.ts

import mongoose, { Schema, Document } from 'mongoose';

export interface ILeaderboardEntry extends Document {
  userId: mongoose.Types.ObjectId;
  period: 'daily' | 'weekly' | 'monthly' | 'alltime';
  
  stats: {
    wins: number;
    losses: number;
    winRate: number;
    avgMovesToWin: number;
    fastestWin: number; // moves
    longestStreak: number;
  };
  
  rank: number;
  score: number; // Calculated ranking score
  
  periodStart: Date;
  periodEnd?: Date;
  updatedAt: Date;
}

const LeaderboardSchema = new Schema<ILeaderboardEntry>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  period: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'alltime'],
    required: true
  },
  
  stats: {
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 },
    avgMovesToWin: { type: Number, default: 0 },
    fastestWin: { type: Number, default: 999 },
    longestStreak: { type: Number, default: 0 }
  },
  
  rank: { type: Number },
  score: { type: Number, default: 0 },
  
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date },
  updatedAt: { type: Date, default: Date.now }
});

// Compound index for leaderboard queries
LeaderboardSchema.index({ period: 1, score: -1 });
LeaderboardSchema.index({ userId: 1, period: 1 }, { unique: true });

export const Leaderboard = mongoose.model<ILeaderboardEntry>(
  'Leaderboard',
  LeaderboardSchema
);
```

---

## 4. REST API Endpoints

### 4.1 Authentication Endpoints

```
POST   /auth/facebook                 # Initiate Facebook OAuth
GET    /auth/facebook/callback        # Facebook OAuth callback
POST   /auth/google                   # Initiate Google OAuth
GET    /auth/google/callback          # Google OAuth callback
POST   /auth/discord                  # Initiate Discord OAuth
GET    /auth/discord/callback         # Discord OAuth callback
POST   /auth/apple                    # Initiate Apple Sign In
POST   /auth/apple/callback           # Apple Sign In callback
GET    /auth/me                       # Get current user
POST   /auth/logout                   # Logout user
```

### 4.2 Game Management Endpoints

```typescript
// Game CRUD operations

POST   /api/games
// Create a new game
// Body: { playerCount: number, mode: 'realtime' | 'async', boardRadius?: number }
// Response: { gameId: string, game: IGame }

GET    /api/games/:gameId
// Get game details
// Response: { game: IGame, moves: IMove[] }

POST   /api/games/:gameId/join
// Join an existing game
// Response: { game: IGame, playerIndex: number }

POST   /api/games/:gameId/leave
// Leave a game
// Response: { success: boolean }

DELETE /api/games/:gameId
// Delete/abandon a game (creator only)
// Response: { success: boolean }
```

### 4.3 Gameplay Endpoints

```typescript
POST   /api/games/:gameId/move
// Submit a move
// Body: { 
//   position: { row: number, col: number },
//   rotation: number,
//   action: 'place' | 'supermove'
// }
// Response: { success: boolean, gameState: IGame }

GET    /api/games/:gameId/moves
// Get move history
// Query: ?limit=50&offset=0
// Response: { moves: IMove[], total: number }

POST   /api/games/:gameId/resign
// Resign from game
// Response: { success: boolean, winner: {...} }
```

### 4.4 Matchmaking Endpoints

```typescript
POST   /api/matchmaking/quick
// Quick match with random players
// Body: { playerCount?: number, mode?: 'realtime' | 'async' }
// Response: { gameId: string, estimatedWait?: number }

POST   /api/matchmaking/invite
// Invite specific users
// Body: { userIds: string[], mode: 'realtime' | 'async' }
// Response: { gameId: string, invites: [...] }

GET    /api/matchmaking/queue
// Check matchmaking queue status
// Response: { position: number, estimatedWait: number }

DELETE /api/matchmaking/queue
// Leave matchmaking queue
// Response: { success: boolean }
```

### 4.5 User & Social Endpoints

```typescript
GET    /api/users/:userId
// Get user profile
// Response: { user: IUser }

PUT    /api/users/me
// Update current user settings
// Body: { settings: {...}, displayName?: string }
// Response: { user: IUser }

GET    /api/users/me/games
// Get user's game history
// Query: ?status=completed&limit=20&offset=0
// Response: { games: IGame[], total: number }

GET    /api/users/:userId/stats
// Get user statistics
// Response: { stats: {...} }
```

### 4.6 Leaderboard Endpoints

```typescript
GET    /api/leaderboard
// Get global leaderboard
// Query: ?period=weekly&limit=100&offset=0
// Response: { entries: ILeaderboardEntry[], total: number }

GET    /api/leaderboard/me
// Get current user's leaderboard position
// Query: ?period=weekly
// Response: { entry: ILeaderboardEntry, rank: number }
```

---

## 5. Real-Time Communication (WebSocket)

### 5.1 Socket.IO Implementation

```typescript
// src/server/socket/gameSocket.ts

import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { Game } from '../models/Game';
import { Move } from '../models/Move';

export function initializeSocket(httpServer: HttpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL,
      credentials: true
    }
  });

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId: string;
      };
      socket.data.userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.data.userId}`);

    // Join game room
    socket.on('join_game', async (gameId: string) => {
      try {
        const game = await Game.findOne({ gameId });
        
        if (!game) {
          socket.emit('error', { message: 'Game not found' });
          return;
        }

        // Verify user is in the game
        const isPlayer = game.players.some(
          p => p.userId.toString() === socket.data.userId
        );

        if (!isPlayer) {
          socket.emit('error', { message: 'Not authorized' });
          return;
        }

        socket.join(gameId);
        
        // Mark player as connected
        await Game.updateOne(
          { gameId, 'players.userId': socket.data.userId },
          { $set: { 'players.$.connected': true } }
        );

        // Send current game state
        socket.emit('game_state', game);
        
        // Notify other players
        socket.to(gameId).emit('player_connected', {
          userId: socket.data.userId
        });
        
      } catch (error) {
        socket.emit('error', { message: 'Failed to join game' });
      }
    });

    // Handle move submission
    socket.on('make_move', async (data) => {
      const { gameId, position, rotation, action } = data;
      
      try {
        const game = await Game.findOne({ gameId });
        
        if (!game || game.status !== 'active') {
          socket.emit('error', { message: 'Invalid game state' });
          return;
        }

        // Verify it's the player's turn
        const currentPlayer = game.players[game.currentPlayerIndex];
        if (currentPlayer.userId.toString() !== socket.data.userId) {
          socket.emit('error', { message: 'Not your turn' });
          return;
        }

        // Validate and process move (use existing game logic)
        // This would integrate with the existing src/game/ logic
        const moveValid = validateMove(game, position, rotation);
        
        if (!moveValid) {
          socket.emit('error', { message: 'Invalid move' });
          return;
        }

        // Save move to database
        const move = await Move.create({
          gameId,
          moveNumber: game.currentTurn,
          playerIndex: game.currentPlayerIndex,
          userId: socket.data.userId,
          tile: {
            type: game.boardState.currentTile,
            position,
            rotation
          },
          action,
          timestamp: new Date()
        });

        // Update game state
        const updatedGame = await updateGameState(game, position, rotation);
        
        // Broadcast move to all players in the game
        io.to(gameId).emit('move_made', {
          move,
          gameState: updatedGame
        });

        // Check for game over
        if (updatedGame.status === 'completed') {
          io.to(gameId).emit('game_over', {
            winner: updatedGame.winner,
            finalState: updatedGame
          });
        }
        
      } catch (error) {
        socket.emit('error', { message: 'Failed to process move' });
      }
    });

    // Handle player requesting rematch
    socket.on('request_rematch', async (gameId: string) => {
      socket.to(gameId).emit('rematch_requested', {
        userId: socket.data.userId
      });
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.data.userId}`);
      
      // Mark player as disconnected in all their active games
      await Game.updateMany(
        { 
          'players.userId': socket.data.userId,
          status: 'active'
        },
        { $set: { 'players.$.connected': false } }
      );
    });
  });

  return io;
}

// Helper functions (integrate with existing game logic)
function validateMove(game: any, position: any, rotation: number): boolean {
  // Use existing validation logic from src/game/legality.ts
  return true; // Placeholder
}

async function updateGameState(game: any, position: any, rotation: number) {
  // Use existing game logic from src/game/
  // Update board state, check for victory, advance turn, etc.
  return game; // Placeholder
}
```

### 5.2 Client-Side Socket Integration

```typescript
// src/client/multiplayer/socketClient.ts

import { io, Socket } from 'socket.io-client';
import { store } from '../redux/store';
import { gameActions } from '../redux/actions';

export class MultiplayerSocket {
  private socket: Socket | null = null;
  private gameId: string | null = null;

  connect(token: string): void {
    this.socket = io(process.env.SERVER_URL!, {
      auth: { token }
    });

    this.socket.on('connect', () => {
      console.log('Connected to game server');
    });

    this.socket.on('game_state', (gameState) => {
      store.dispatch(gameActions.syncGameState(gameState));
    });

    this.socket.on('player_connected', (data) => {
      console.log('Player connected:', data.userId);
      // Update UI to show player is online
    });

    this.socket.on('move_made', (data) => {
      store.dispatch(gameActions.applyOpponentMove(data.move));
    });

    this.socket.on('game_over', (data) => {
      store.dispatch(gameActions.gameOver(data.winner));
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error.message);
      // Show error to user
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from game server');
    });
  }

  joinGame(gameId: string): void {
    this.gameId = gameId;
    this.socket?.emit('join_game', gameId);
  }

  makeMove(position: { row: number; col: number }, rotation: number): void {
    if (!this.gameId) return;
    
    this.socket?.emit('make_move', {
      gameId: this.gameId,
      position,
      rotation,
      action: 'place'
    });
  }

  requestRematch(): void {
    if (!this.gameId) return;
    this.socket?.emit('request_rematch', this.gameId);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.gameId = null;
  }
}
```

---

## 6. Server Implementation

### 6.1 Main Server Setup

```typescript
// src/server/index.ts

import express from 'express';
import http from 'http';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import passport from './auth/passport-config';
import authRoutes from './routes/auth';
import gameRoutes from './routes/games';
import userRoutes from './routes/users';
import leaderboardRoutes from './routes/leaderboard';
import { initializeSocket } from './socket/gameSocket';

dotenv.config();

const app = express();
const httpServer = http.createServer(app);

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));
app.use(express.json());
app.use(passport.initialize());

// Routes
app.use('/auth', authRoutes);
app.use('/api', gameRoutes);
app.use('/api', userRoutes);
app.use('/api', leaderboardRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Initialize WebSocket
const io = initializeSocket(httpServer);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI!)
  .then(() => {
    console.log('Connected to MongoDB');
    
    // Start server
    const PORT = process.env.PORT || 3000;
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  httpServer.close(() => {
    mongoose.connection.close();
    process.exit(0);
  });
});
```

### 6.2 Environment Variables

```bash
# .env.example

# Server
NODE_ENV=development
PORT=3000
BASE_URL=http://localhost:3000
CLIENT_URL=http://localhost:5173

# Database
MONGODB_URI=mongodb://localhost:27017/quortex
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this

# Facebook OAuth
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Discord OAuth
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret

# Apple Sign In
APPLE_CLIENT_ID=your-apple-client-id
APPLE_TEAM_ID=your-apple-team-id
APPLE_KEY_ID=your-apple-key-id
APPLE_PRIVATE_KEY=your-apple-private-key
```

---

## 7. Deployment Architecture

### 7.1 Docker Configuration

```dockerfile
# Dockerfile

FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Production image
FROM node:18-alpine

WORKDIR /app

# Copy built app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

EXPOSE 3000

CMD ["node", "dist/server/index.js"]
```

```yaml
# docker-compose.yml

version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/quortex
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongo
      - redis
    restart: unless-stopped

  mongo:
    image: mongo:6
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  mongo-data:
  redis-data:
```

### 7.2 Cloud Deployment Options

**Option 1: AWS**
- **Compute:** EC2 or ECS (Docker containers)
- **Database:** MongoDB Atlas or DocumentDB
- **Cache:** ElastiCache (Redis)
- **Load Balancer:** Application Load Balancer
- **CDN:** CloudFront
- **Estimated Cost:** $50-150/month for small scale

**Option 2: Google Cloud Platform**
- **Compute:** Cloud Run or GKE
- **Database:** MongoDB Atlas
- **Cache:** Cloud Memorystore
- **Load Balancer:** Cloud Load Balancing
- **CDN:** Cloud CDN
- **Estimated Cost:** $40-120/month for small scale

**Option 3: DigitalOcean (Recommended for MVP)**
- **Compute:** App Platform or Droplets
- **Database:** MongoDB Atlas (free tier)
- **Cache:** Redis on Droplet
- **Load Balancer:** DigitalOcean Load Balancer
- **CDN:** DigitalOcean Spaces + CDN
- **Estimated Cost:** $20-60/month for small scale

### 7.3 Scaling Considerations

**Horizontal Scaling:**
- Use Redis for session sharing across multiple app instances
- Implement sticky sessions for WebSocket connections
- Use MongoDB replica sets for database redundancy

**Vertical Scaling:**
- Monitor CPU and memory usage
- Scale up instance sizes as needed
- Optimize database queries and indexes

**CDN Strategy:**
- Serve static assets (client bundle) from CDN
- Cache game state images
- Use edge locations for lower latency

---

## 8. Security Considerations

### 8.1 Authentication Security

- **OAuth Token Validation:** Always verify tokens server-side
- **JWT Best Practices:** 
  - Short expiration times (7 days max)
  - Refresh token rotation
  - Secure storage (httpOnly cookies or secure localStorage)
- **Rate Limiting:** Prevent brute force attacks on auth endpoints
- **HTTPS Only:** Enforce HTTPS in production

### 8.2 API Security

```typescript
// Rate limiting middleware
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', apiLimiter);

// Stricter limits for sensitive endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5
});

app.use('/auth/', authLimiter);
```

### 8.3 Game State Validation

- **Server-Side Validation:** All moves must be validated server-side
- **Anti-Cheat:** Validate move timing and sequence
- **State Integrity:** Use checksums to detect tampering
- **Replay Protection:** Prevent replay attacks with nonces

### 8.4 Data Privacy

- **GDPR Compliance:** Allow users to export and delete their data
- **Data Minimization:** Only collect necessary user information
- **Encryption:** Encrypt sensitive data at rest and in transit
- **Audit Logs:** Track access to sensitive user data

---

## 9. Testing Strategy

### 9.1 Unit Tests

```typescript
// Example: Test user authentication
describe('User Authentication', () => {
  it('should create a new user on first Facebook login', async () => {
    // Mock Facebook profile
    const fbProfile = {
      id: 'fb123',
      displayName: 'Test User',
      emails: [{ value: 'test@example.com' }]
    };
    
    const user = await createOrUpdateUser(fbProfile, 'facebook');
    
    expect(user.facebookId).toBe('fb123');
    expect(user.displayName).toBe('Test User');
  });
});

// Example: Test move validation
describe('Move Validation', () => {
  it('should reject invalid tile placement', async () => {
    const game = await Game.findOne({ gameId: 'test123' });
    const invalidPosition = { row: 99, col: 99 };
    
    const isValid = validateMove(game, invalidPosition, 0);
    
    expect(isValid).toBe(false);
  });
});
```

### 9.2 Integration Tests

```typescript
// Test WebSocket connection and game flow
describe('Real-time Game Flow', () => {
  it('should broadcast moves to all connected players', async () => {
    const socket1 = connectSocket(user1Token);
    const socket2 = connectSocket(user2Token);
    
    socket1.emit('join_game', gameId);
    socket2.emit('join_game', gameId);
    
    const movePromise = new Promise(resolve => {
      socket2.on('move_made', resolve);
    });
    
    socket1.emit('make_move', {
      gameId,
      position: { row: 0, col: 0 },
      rotation: 0
    });
    
    const move = await movePromise;
    expect(move).toBeDefined();
  });
});
```

### 9.3 Load Testing

Use tools like Artillery or k6 to test:
- Concurrent WebSocket connections
- API throughput
- Database performance under load
- Memory leaks

```yaml
# artillery-config.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
      name: Warm up
    - duration: 300
      arrivalRate: 50
      name: Sustained load
scenarios:
  - name: Create and join game
    flow:
      - post:
          url: '/api/games'
          json:
            playerCount: 2
            mode: 'realtime'
      - think: 2
      - post:
          url: '/api/games/{{ gameId }}/join'
```

---

## 10. Monitoring & Analytics

### 10.1 Application Monitoring

```typescript
// Health metrics endpoint
app.get('/metrics', async (req, res) => {
  const metrics = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    activeGames: await Game.countDocuments({ status: 'active' }),
    activeUsers: await getActiveUserCount(), // From Redis
    averageResponseTime: getAverageResponseTime(),
    errorRate: getErrorRate()
  };
  
  res.json(metrics);
});
```

**Recommended Tools:**
- **Application Performance:** New Relic or Datadog
- **Error Tracking:** Sentry
- **Logging:** Winston + CloudWatch or Loggly
- **Uptime Monitoring:** Pingdom or UptimeRobot

### 10.2 Game Analytics

Track key metrics:
- **Engagement:** DAU, MAU, session length
- **Gameplay:** Average game duration, moves per game
- **Retention:** Day 1, Day 7, Day 30 retention
- **Social:** Invites sent, multiplayer vs AI games
- **Technical:** Error rates, latency, disconnections

---

## 11. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] Set up Node.js project structure
- [ ] Configure MongoDB and Mongoose models
- [ ] Implement authentication with all 4 providers
- [ ] Create basic REST API endpoints
- [ ] Set up JWT middleware

### Phase 2: Core Multiplayer (Weeks 3-4)
- [ ] Implement WebSocket server with Socket.IO
- [ ] Create game room management
- [ ] Add real-time move broadcasting
- [ ] Integrate with existing game logic
- [ ] Test real-time gameplay

### Phase 3: Matchmaking (Week 5)
- [ ] Implement quick match system
- [ ] Add invite friends functionality
- [ ] Create game lobby system
- [ ] Add player presence tracking

### Phase 4: Persistence (Week 6)
- [ ] Complete database integration
- [ ] Add move history recording
- [ ] Implement game state saving/loading
- [ ] Create leaderboard system

### Phase 5: Polish & Deploy (Weeks 7-8)
- [ ] Add error handling and logging
- [ ] Implement rate limiting
- [ ] Set up monitoring and analytics
- [ ] Write comprehensive tests
- [ ] Deploy to production
- [ ] Load testing and optimization

---

## 12. Cost Estimates

### Development Costs
- **Backend Development:** 6-8 weeks @ $80-120/hr = $19,200-$38,400
- **Testing & QA:** 1-2 weeks @ $60-90/hr = $2,400-$7,200
- **Total Development:** $21,600-$45,600

### Monthly Operating Costs (Small Scale: <1000 users)
- **Hosting:** $20-60/month (DigitalOcean or similar)
- **MongoDB Atlas:** $0-25/month (Free tier or M10)
- **Redis:** Included in hosting
- **CDN:** $5-15/month
- **Monitoring:** $0-30/month
- **SSL Certificate:** $0 (Let's Encrypt)
- **Total:** $25-130/month

### Monthly Operating Costs (Medium Scale: 10,000 users)
- **Hosting:** $100-300/month
- **MongoDB Atlas:** $60-150/month
- **Redis:** $30-60/month
- **CDN:** $20-50/month
- **Monitoring:** $30-60/month
- **Total:** $240-620/month

---

## 13. Future Enhancements

### 13.1 Advanced Features
- **AI Opponents:** Integrate with existing AI logic for practice games
- **Tournaments:** Bracket-based competitive play
- **Spectator Mode:** Watch live games
- **Game Replay:** Review past games move-by-move
- **Chat System:** In-game text chat with moderation

### 13.2 Mobile Apps
- **React Native:** Build native iOS/Android apps
- **Progressive Web App:** Installable web app
- **Push Notifications:** Move notifications on mobile

### 13.3 Additional Platforms
- **Steam Integration:** Desktop client
- **Twitch Integration:** Streaming and extensions
- **Tournament Platforms:** Integration with Challonge, etc.

---

## Conclusion

This document provides a comprehensive blueprint for implementing a web-based multiplayer system for Quortex. The architecture is designed to be:

- **Scalable:** Horizontal scaling with load balancers
- **Secure:** OAuth 2.0, JWT, rate limiting, server-side validation
- **Maintainable:** Clear separation of concerns, TypeScript
- **Cost-Effective:** Start small and scale as needed
- **Feature-Rich:** Real-time and async modes, multiple auth providers

The recommended approach is to start with Phase 1-2 for an MVP, then iterate based on user feedback and adoption metrics.

---

*Document Version: 1.0*
*Last Updated: 2025-11-12*
*Author: GitHub Copilot*
