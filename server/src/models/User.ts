// User model with persistent storage
// Uses stable OAuth provider IDs as primary keys for cross-device/session persistence

import { DataStorage } from '../storage/DataStorage.js';
import path from 'path';

export interface IUser {
  id: string; // Stable ID: googleId, discordId, or anon:uuid
  discordId?: string;
  googleId?: string;
  displayName: string;
  email?: string;
  avatar?: string;
  provider: 'discord' | 'google' | 'anonymous';
  
  // Profile fields
  alias: string;           // User-chosen display name
  claimCode: string;       // 6-letter code for account claiming
  isAnonymous: boolean;    // True for guest/anonymous users
  profileCompleted: boolean; // True if user has completed initial profile setup
  
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

/**
 * Generate a unique 6-letter claim code
 * Uses characters that are easy to distinguish (excludes I, L, O)
 */
function generateClaimCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // Exclude I, L, O for clarity
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Generate a unique claim code that doesn't already exist
 */
function generateUniqueClaimCode(): string {
  let attempts = 0;
  const maxAttempts = 100;
  
  while (attempts < maxAttempts) {
    const code = generateClaimCode();
    const existingUser = Array.from(userCache.values()).find(u => u.claimCode === code);
    if (!existingUser) {
      return code;
    }
    attempts++;
  }
  
  // If we somehow can't generate a unique code, add a timestamp suffix
  return generateClaimCode();
}

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

  static findByClaimCode(claimCode: string): IUser | undefined {
    return Array.from(userCache.values()).find(user => user.claimCode === claimCode);
  }

  static async create(userData: {
    id: string;
    discordId?: string;
    googleId?: string;
    displayName: string;
    email?: string;
    avatar?: string;
    provider: 'discord' | 'google' | 'anonymous';
    alias?: string;
    isAnonymous?: boolean;
  }): Promise<IUser> {
    const user: IUser = {
      id: userData.id,
      discordId: userData.discordId,
      googleId: userData.googleId,
      displayName: userData.displayName,
      email: userData.email,
      avatar: userData.avatar,
      provider: userData.provider,
      alias: userData.alias || userData.displayName,
      claimCode: generateUniqueClaimCode(),
      isAnonymous: userData.isAnonymous || false,
      profileCompleted: userData.isAnonymous ? true : false, // Anonymous users are auto-completed, OAuth users need setup
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

  /**
   * Merge stats from sourceUser into targetUser
   */
  static mergeStats(targetStats: IUser['stats'], sourceStats: IUser['stats']): IUser['stats'] {
    return {
      gamesPlayed: targetStats.gamesPlayed + sourceStats.gamesPlayed,
      gamesWon: targetStats.gamesWon + sourceStats.gamesWon,
      gamesLost: targetStats.gamesLost + sourceStats.gamesLost,
      winStreak: targetStats.winStreak, // Keep current streak
      bestWinStreak: Math.max(targetStats.bestWinStreak, sourceStats.bestWinStreak)
    };
  }

  /**
   * Claim an anonymous account by merging its stats into the target user
   */
  static async claimAccount(targetUserId: string, claimCode: string): Promise<{
    success: boolean;
    error?: string;
    mergedStats?: IUser['stats'];
  }> {
    const sourceUser = this.findByClaimCode(claimCode);
    
    if (!sourceUser) {
      return { success: false, error: 'Invalid claim code' };
    }

    if (!sourceUser.isAnonymous) {
      return { success: false, error: 'Cannot claim a non-anonymous account' };
    }

    if (sourceUser.id === targetUserId) {
      return { success: false, error: 'Cannot claim your own account' };
    }

    const targetUser = this.findById(targetUserId);
    if (!targetUser) {
      return { success: false, error: 'Target user not found' };
    }

    // Merge stats
    const mergedStats = this.mergeStats(targetUser.stats, sourceUser.stats);
    
    // Update target user with merged stats
    await this.update(targetUserId, { stats: mergedStats });

    // Delete the anonymous account
    await this.delete(sourceUser.id);

    return { success: true, mergedStats };
  }

  /**
   * Regenerate claim code for a user
   */
  static async regenerateClaimCode(userId: string): Promise<string | undefined> {
    const user = this.findById(userId);
    if (!user) return undefined;

    const newClaimCode = generateUniqueClaimCode();
    await this.update(userId, { claimCode: newClaimCode });
    return newClaimCode;
  }
}
