import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameStorage, GameAction } from '../storage/GameStorage.js';
import fs from 'fs/promises';
import path from 'path';

describe('GameStorage', () => {
  const testDataDir = './test-data/games';
  let storage: GameStorage;

  beforeEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }
    
    storage = new GameStorage(testDataDir);
    await storage.initialize();
  });

  afterEach(async () => {
    await storage.shutdown();
    // Clean up test directory
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }
  });

  describe('createGame', () => {
    it('should create a new game', async () => {
      const gameId = 'test-game-1';
      const name = 'Test Game';
      const hostId = 'host-1';
      const maxPlayers = 4;

      await storage.createGame(gameId, name, hostId, maxPlayers);

      const state = await storage.getGameState(gameId);
      expect(state).toBeDefined();
      expect(state?.gameId).toBe(gameId);
      expect(state?.name).toBe(name);
      expect(state?.hostId).toBe(hostId);
      expect(state?.maxPlayers).toBe(maxPlayers);
      expect(state?.status).toBe('waiting');
      expect(state?.players).toEqual([]);
    });

    it('should create action file on disk', async () => {
      const gameId = 'test-game-2';
      await storage.createGame(gameId, 'Test Game', 'host-1', 4);

      const filename = path.join(testDataDir, `game-${gameId}.actions.jsonl`);
      const exists = await storage.gameExists(gameId);
      expect(exists).toBe(true);
    });
  });

  describe('appendAction', () => {
    it('should append actions to the log', async () => {
      const gameId = 'test-game-3';
      await storage.createGame(gameId, 'Test Game', 'host-1', 4);

      const joinAction: GameAction = {
        type: 'JOIN_GAME',
        payload: {
          player: {
            id: 'player-1',
            username: 'Alice',
            socketId: 'socket-1',
            connected: true
          }
        },
        playerId: 'player-1',
        timestamp: Date.now(),
        sequence: 1
      };

      await storage.appendAction(gameId, joinAction);
      await storage.flushAll(); // Ensure data is written to disk

      const actions = await storage.readActions(gameId);
      expect(actions.length).toBe(2); // CREATE_GAME + JOIN_GAME
      expect(actions[1].type).toBe('JOIN_GAME');
      expect(actions[1].payload.player.username).toBe('Alice');
    });

    it('should update cache immediately', async () => {
      const gameId = 'test-game-4';
      await storage.createGame(gameId, 'Test Game', 'host-1', 4);

      const joinAction: GameAction = {
        type: 'JOIN_GAME',
        payload: {
          player: {
            id: 'player-1',
            username: 'Bob',
            socketId: 'socket-1',
            connected: true
          }
        },
        playerId: 'player-1',
        timestamp: Date.now(),
        sequence: 1
      };

      await storage.appendAction(gameId, joinAction);

      // Should be cached
      const state = await storage.getGameState(gameId);
      expect(state?.players.length).toBe(1);
      expect(state?.players[0].username).toBe('Bob');
    });
  });

  describe('getGameState', () => {
    it('should reconstruct state from actions', async () => {
      const gameId = 'test-game-5';
      await storage.createGame(gameId, 'Test Game', 'host-1', 4);

      // Add several players
      for (let i = 1; i <= 3; i++) {
        const joinAction: GameAction = {
          type: 'JOIN_GAME',
          payload: {
            player: {
              id: `player-${i}`,
              username: `Player ${i}`,
              socketId: `socket-${i}`,
              connected: true
            }
          },
          playerId: `player-${i}`,
          timestamp: Date.now(),
          sequence: i
        };
        await storage.appendAction(gameId, joinAction);
      }

      // Start the game
      const startAction: GameAction = {
        type: 'START_GAME',
        payload: {},
        playerId: 'host-1',
        timestamp: Date.now(),
        sequence: 4
      };
      await storage.appendAction(gameId, startAction);

      const state = await storage.getGameState(gameId);
      expect(state?.players.length).toBe(3);
      expect(state?.status).toBe('playing');
    });

    it('should return null for non-existent game', async () => {
      const state = await storage.getGameState('non-existent-game');
      expect(state).toBeNull();
    });

    it('should use cache for repeated reads', async () => {
      const gameId = 'test-game-6';
      await storage.createGame(gameId, 'Test Game', 'host-1', 4);

      // First read - should load from disk
      const state1 = await storage.getGameState(gameId);
      
      // Second read - should use cache
      const state2 = await storage.getGameState(gameId);
      
      expect(state1).toEqual(state2);
    });
  });

  describe('listGames', () => {
    it('should list all game IDs', async () => {
      await storage.createGame('game-1', 'Game 1', 'host-1', 4);
      await storage.createGame('game-2', 'Game 2', 'host-2', 4);
      await storage.createGame('game-3', 'Game 3', 'host-3', 4);

      const gameIds = await storage.listGames();
      expect(gameIds).toContain('game-1');
      expect(gameIds).toContain('game-2');
      expect(gameIds).toContain('game-3');
      expect(gameIds.length).toBe(3);
    });

    it('should return empty array for no games', async () => {
      const gameIds = await storage.listGames();
      expect(gameIds).toEqual([]);
    });
  });

  describe('shutdown', () => {
    it('should flush pending writes on shutdown', async () => {
      const gameId = 'test-game-7';
      await storage.createGame(gameId, 'Test Game', 'host-1', 4);

      // Add action that might be buffered
      const action: GameAction = {
        type: 'JOIN_GAME',
        payload: {
          player: {
            id: 'player-1',
            username: 'Alice',
            socketId: 'socket-1',
            connected: true
          }
        },
        playerId: 'player-1',
        timestamp: Date.now(),
        sequence: 1
      };
      await storage.appendAction(gameId, action);

      // Shutdown to flush
      await storage.shutdown();

      // Create new storage instance and verify data was persisted
      const newStorage = new GameStorage(testDataDir);
      await newStorage.initialize();
      
      const actions = await newStorage.readActions(gameId);
      expect(actions.length).toBeGreaterThanOrEqual(2);
      
      await newStorage.shutdown();
    });
  });

  describe('clearCache', () => {
    it('should clear cache for specific game', async () => {
      const gameId = 'test-game-8';
      await storage.createGame(gameId, 'Test Game', 'host-1', 4);

      // Load to cache
      await storage.getGameState(gameId);

      // Clear cache
      storage.clearCache(gameId);

      // Should still be able to read from disk
      const state = await storage.getGameState(gameId);
      expect(state).toBeDefined();
      expect(state?.gameId).toBe(gameId);
    });
  });

  describe('gameExists', () => {
    it('should return true for existing games', async () => {
      const gameId = 'test-game-9';
      await storage.createGame(gameId, 'Test Game', 'host-1', 4);

      const exists = await storage.gameExists(gameId);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent games', async () => {
      const exists = await storage.gameExists('non-existent');
      expect(exists).toBe(false);
    });
  });

  describe('action application', () => {
    it('should handle LEAVE_GAME action', async () => {
      const gameId = 'test-game-10';
      await storage.createGame(gameId, 'Test Game', 'host-1', 4);

      // Join
      const joinAction: GameAction = {
        type: 'JOIN_GAME',
        payload: {
          player: {
            id: 'player-1',
            username: 'Alice',
            socketId: 'socket-1',
            connected: true
          }
        },
        playerId: 'player-1',
        timestamp: Date.now(),
        sequence: 1
      };
      await storage.appendAction(gameId, joinAction);

      // Leave
      const leaveAction: GameAction = {
        type: 'LEAVE_GAME',
        payload: { playerId: 'player-1' },
        playerId: 'player-1',
        timestamp: Date.now(),
        sequence: 2
      };
      await storage.appendAction(gameId, leaveAction);

      const state = await storage.getGameState(gameId);
      expect(state?.players.length).toBe(0);
    });

    it('should handle PLAYER_DISCONNECT action', async () => {
      const gameId = 'test-game-11';
      await storage.createGame(gameId, 'Test Game', 'host-1', 4);

      // Join
      const joinAction: GameAction = {
        type: 'JOIN_GAME',
        payload: {
          player: {
            id: 'player-1',
            username: 'Alice',
            socketId: 'socket-1',
            connected: true
          }
        },
        playerId: 'player-1',
        timestamp: Date.now(),
        sequence: 1
      };
      await storage.appendAction(gameId, joinAction);

      // Disconnect
      const disconnectAction: GameAction = {
        type: 'PLAYER_DISCONNECT',
        payload: { playerId: 'player-1' },
        playerId: 'player-1',
        timestamp: Date.now(),
        sequence: 2
      };
      await storage.appendAction(gameId, disconnectAction);

      const state = await storage.getGameState(gameId);
      expect(state?.players.length).toBe(1);
      expect(state?.players[0].connected).toBe(false);
    });

    it('should not add duplicate players', async () => {
      const gameId = 'test-game-12';
      await storage.createGame(gameId, 'Test Game', 'host-1', 4);

      const player = {
        id: 'player-1',
        username: 'Alice',
        socketId: 'socket-1',
        connected: true
      };

      // Join twice
      for (let i = 0; i < 2; i++) {
        const joinAction: GameAction = {
          type: 'JOIN_GAME',
          payload: { player },
          playerId: 'player-1',
          timestamp: Date.now(),
          sequence: i + 1
        };
        await storage.appendAction(gameId, joinAction);
      }

      const state = await storage.getGameState(gameId);
      expect(state?.players.length).toBe(1);
    });
  });
});
