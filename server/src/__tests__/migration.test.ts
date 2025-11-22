import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { checkMigrationNeeded, migrateUsersToRatings } from '../rating/migration.js';
import { UserStore } from '../models/User.js';

describe('Rating Migration', () => {
  // Save original getAll method
  let originalGetAll: typeof UserStore.getAll;
  let originalUpdate: typeof UserStore.update;

  beforeEach(() => {
    originalGetAll = UserStore.getAll;
    originalUpdate = UserStore.update;
  });

  afterEach(() => {
    // Restore original methods
    UserStore.getAll = originalGetAll;
    UserStore.update = originalUpdate;
  });

  describe('checkMigrationNeeded', () => {
    it('should handle null users gracefully', () => {
      // This simulates the scenario where a deleted user (tombstone) is present in storage
      // which can happen when DataStorage loads entries with data: null (deleted users)
      const mockUsers = [
        {
          id: 'user1',
          displayName: 'User 1',
          ratings: {
            twoPlayer: { rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 5, lastUpdated: new Date() },
            threePlayer: { rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0, lastUpdated: new Date() },
            fourPlayer: { rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0, lastUpdated: new Date() },
            fivePlayer: { rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0, lastUpdated: new Date() },
            sixPlayer: { rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0, lastUpdated: new Date() },
          },
        },
        null, // Deleted user (tombstone entry from DataStorage)
        {
          id: 'user3',
          displayName: 'User 3',
          ratings: {
            twoPlayer: { rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0, lastUpdated: new Date() },
            threePlayer: { rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0, lastUpdated: new Date() },
            fourPlayer: { rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0, lastUpdated: new Date() },
            fivePlayer: { rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0, lastUpdated: new Date() },
            sixPlayer: { rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0, lastUpdated: new Date() },
          },
        },
      ];

      // Mock UserStore.getAll to return our test data including null
      UserStore.getAll = () => mockUsers as any;

      // Should not throw and should return false (no migration needed)
      expect(checkMigrationNeeded()).toBe(false);
    });

    it('should return false when all users have ratings', () => {
      const mockUsers = [
        {
          id: 'user1',
          displayName: 'User 1',
          ratings: {
            twoPlayer: { rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0, lastUpdated: new Date() },
            threePlayer: { rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0, lastUpdated: new Date() },
            fourPlayer: { rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0, lastUpdated: new Date() },
            fivePlayer: { rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0, lastUpdated: new Date() },
            sixPlayer: { rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0, lastUpdated: new Date() },
          },
        },
      ];

      UserStore.getAll = () => mockUsers as any;

      expect(checkMigrationNeeded()).toBe(false);
    });

    it('should return true when at least one user is missing ratings', () => {
      const mockUsers = [
        {
          id: 'user1',
          displayName: 'User 1',
          ratings: {
            twoPlayer: { rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0, lastUpdated: new Date() },
            threePlayer: { rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0, lastUpdated: new Date() },
            fourPlayer: { rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0, lastUpdated: new Date() },
            fivePlayer: { rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0, lastUpdated: new Date() },
            sixPlayer: { rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0, lastUpdated: new Date() },
          },
        },
        {
          id: 'user2',
          displayName: 'User 2',
          // Missing ratings field - this is an old user
        },
      ];

      UserStore.getAll = () => mockUsers as any;

      expect(checkMigrationNeeded()).toBe(true);
    });

    it('should return true when null users and users missing ratings are present', () => {
      const mockUsers = [
        {
          id: 'user1',
          displayName: 'User 1',
          ratings: {
            twoPlayer: { rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0, lastUpdated: new Date() },
            threePlayer: { rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0, lastUpdated: new Date() },
            fourPlayer: { rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0, lastUpdated: new Date() },
            fivePlayer: { rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0, lastUpdated: new Date() },
            sixPlayer: { rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0, lastUpdated: new Date() },
          },
        },
        null, // Deleted user (tombstone entry)
        {
          id: 'user3',
          displayName: 'User 3',
          // Missing ratings - needs migration
        },
      ];

      UserStore.getAll = () => mockUsers as any;

      expect(checkMigrationNeeded()).toBe(true);
    });
  });

  describe('migrateUsersToRatings', () => {
    it('should skip null users gracefully', async () => {
      const mockUsers = [
        {
          id: 'user1',
          displayName: 'User 1',
          // Missing ratings - needs migration
        },
        null, // Deleted user (tombstone entry)
        {
          id: 'user3',
          displayName: 'User 3',
          ratings: {
            twoPlayer: { rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0, lastUpdated: new Date() },
            threePlayer: { rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0, lastUpdated: new Date() },
            fourPlayer: { rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0, lastUpdated: new Date() },
            fivePlayer: { rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0, lastUpdated: new Date() },
            sixPlayer: { rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0, lastUpdated: new Date() },
          },
        },
      ];

      // Mock UserStore methods
      UserStore.getAll = () => mockUsers as any;
      const updateMock = vi.fn().mockResolvedValue(undefined);
      UserStore.update = updateMock;

      // Should complete without throwing
      await migrateUsersToRatings();

      // Should only update user1 (not the null user or user3 who has ratings)
      expect(updateMock).toHaveBeenCalledTimes(1);
      expect(updateMock).toHaveBeenCalledWith('user1', expect.objectContaining({
        id: 'user1',
        displayName: 'User 1',
        ratings: expect.any(Object),
        ratingHistory: []
      }));
    });
  });
});
