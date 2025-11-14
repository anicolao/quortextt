// User model with persistent storage
// Uses stable OAuth provider IDs as primary keys for cross-device/session persistence

import { DataStorage } from '../storage/DataStorage.js';
import path from 'path';
import { GlickoRating, createDefaultRating } from '../rating/glicko2.js';

export interface PlayerRatings {
  twoPlayer: GlickoRating;
  threePlayer: GlickoRating;
  fourPlayer: GlickoRating;
  fivePlayer: GlickoRating;
  sixPlayer: GlickoRating;
}

export interface RatingHistoryEntry {
  gameId: string;
  playerCount: number;
  oldRating: number;
  newRating: number;
  oldRD: number;
  newRD: number;
  timestamp: Date;
}

export interface IUser {
  id: string; // Stable ID: googleId or discordId
  discordId?: string;
  googleId?: string;
  displayName: string;
  email?: string;
  avatar?: string;
  provider: 'discord' | 'google';
  stats: {
    gamesPlayed: number;
    gamesWon: number;
    gamesLost: number;
    winStreak: number;
    bestWinStreak: number;
  };
  settings: {
    notifications: boolean;
    soundEnabled: boolean;
    theme: string;
  };
  ratings: PlayerRatings;
  ratingHistory: RatingHistoryEntry[];
  createdAt: Date;
  lastActive: Date;
}

// Persistent user storage
const userStorage = new DataStorage(path.join(process.cwd(), 'data', 'users'), 'users.jsonl');

// In-memory cache for performance
const userCache = new Map<string, IUser>();

export class UserStore {
  static async init(): Promise<void> {
    // Initialize storage (creates directory and loads from file)
    await userStorage.initialize();
    
    // Load all users into cache
    const allUsersMap = await userStorage.getAll();
    for (const [id, userData] of allUsersMap.entries()) {
      userCache.set(id, userData as IUser);
    }
    console.log(`✓ Loaded ${userCache.size} users from storage`);
  }

  static findByDiscordId(discordId: string): IUser | undefined {
    return Array.from(userCache.values()).find(user => user.discordId === discordId);
  }

  static findByGoogleId(googleId: string): IUser | undefined {
    return Array.from(userCache.values()).find(user => user.googleId === googleId);
  }

  static findById(id: string): IUser | undefined {
    return userCache.get(id);
  }

  static async create(userData: {
    id: string;
    discordId?: string;
    googleId?: string;
    displayName: string;
    email?: string;
    avatar?: string;
    provider: 'discord' | 'google';
  }): Promise<IUser> {
    const user: IUser = {
      id: userData.id,
      discordId: userData.discordId,
      googleId: userData.googleId,
      displayName: userData.displayName,
      email: userData.email,
      avatar: userData.avatar,
      provider: userData.provider,
      stats: {
        gamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0,
        winStreak: 0,
        bestWinStreak: 0
      },
      settings: {
        notifications: true,
        soundEnabled: true,
        theme: 'default'
      },
      ratings: {
        twoPlayer: createDefaultRating(),
        threePlayer: createDefaultRating(),
        fourPlayer: createDefaultRating(),
        fivePlayer: createDefaultRating(),
        sixPlayer: createDefaultRating()
      },
      ratingHistory: [],
      createdAt: new Date(),
      lastActive: new Date()
    };

    // Save to storage and cache
    await userStorage.set(user.id, user);
    userCache.set(user.id, user);
    return user;
  }

  static async update(id: string, updates: Partial<IUser>): Promise<IUser | undefined> {
    const user = userCache.get(id);
    if (!user) return undefined;

    const updatedUser = { ...user, ...updates, lastActive: new Date() };
    
    // Update storage and cache
    await userStorage.set(id, updatedUser);
    userCache.set(id, updatedUser);
    return updatedUser;
  }

  static async delete(id: string): Promise<boolean> {
    await userStorage.delete(id);
    return userCache.delete(id);
  }

  static getAll(): IUser[] {
    return Array.from(userCache.values());
  }

  /**
   * Update a user's rating for a specific player count
   */
  static async updateRating(
    userId: string,
    playerCount: 2 | 3 | 4 | 5 | 6,
    newRating: GlickoRating,
    gameId: string
  ): Promise<IUser | undefined> {
    const user = userCache.get(userId);
    if (!user) return undefined;

    // Get the rating field name based on player count
    const ratingField = playerCount === 2 ? 'twoPlayer' :
                        playerCount === 3 ? 'threePlayer' :
                        playerCount === 4 ? 'fourPlayer' :
                        playerCount === 5 ? 'fivePlayer' : 'sixPlayer';

    const oldRating = user.ratings[ratingField];

    // Create history entry
    const historyEntry: RatingHistoryEntry = {
      gameId,
      playerCount,
      oldRating: oldRating.rating,
      newRating: newRating.rating,
      oldRD: oldRating.rd,
      newRD: newRating.rd,
      timestamp: new Date()
    };

    // Update the user with new rating
    const updatedUser = {
      ...user,
      ratings: {
        ...user.ratings,
        [ratingField]: newRating
      },
      ratingHistory: [...user.ratingHistory, historyEntry],
      lastActive: new Date()
    };

    // Update storage and cache
    await userStorage.set(userId, updatedUser);
    userCache.set(userId, updatedUser);
    return updatedUser;
  }

  /**
   * Get a user's rating for a specific player count
   */
  static getRating(userId: string, playerCount: 2 | 3 | 4 | 5 | 6): GlickoRating | undefined {
    const user = userCache.get(userId);
    if (!user) return undefined;

    const ratingField = playerCount === 2 ? 'twoPlayer' :
                        playerCount === 3 ? 'threePlayer' :
                        playerCount === 4 ? 'fourPlayer' :
                        playerCount === 5 ? 'fivePlayer' : 'sixPlayer';

    return user.ratings[ratingField];
  }
}
