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
    it('should fail when null users are present in the user array', () => {
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

      // This should throw the error: "Cannot read properties of null (reading 'ratings')"
      // Reproduces the production error from the problem statement
      expect(() => checkMigrationNeeded()).toThrow("Cannot read properties of null (reading 'ratings')");
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
  });

  describe('migrateUsersToRatings', () => {
    it('should fail when null users are present', async () => {
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
      UserStore.update = async () => undefined as any;

      // This should throw the error when it tries to check user.ratings
      // Reproduces the production error from the problem statement
      await expect(migrateUsersToRatings()).rejects.toThrow("Cannot read properties of null (reading 'ratings')");
    });
  });
});
