// User model with persistent storage
// Uses stable OAuth provider IDs as primary keys for cross-device/session persistence

import { DataStorage } from '../storage/DataStorage.js';
import path from 'path';

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
}
