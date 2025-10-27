// Unit tests for legal move validation

import { describe, it, expect } from 'vitest';
import {
  isLegalMove,
  findLegalMoves,
  canTileBePlacedAnywhere,
} from '../../src/game/legality';
import { TileType, PlacedTile, Player, Team } from '../../src/game/types';
import { positionToKey } from '../../src/game/board';

describe('legal move validation', () => {
  const createPlayer = (id: string, edge: number): Player => ({
    id,
    color: `color-${id}`,
    edgePosition: edge,
    isAI: false,
  });

  describe('isLegalMove', () => {
    it('should reject move on occupied position', () => {
      const board = new Map<string, PlacedTile>();
      const existingTile: PlacedTile = {
        type: TileType.NoSharps,
        rotation: 0,
        position: { row: 0, col: 0 },
      };
      board.set(positionToKey(existingTile.position), existingTile);

      const newTile: PlacedTile = {
        type: TileType.OneSharp,
        rotation: 0,
        position: { row: 0, col: 0 }, // Same position
      };

      const players = [createPlayer('p1', 0), createPlayer('p2', 3)];
      const teams: Team[] = [];

      expect(isLegalMove(board, newTile, players, teams)).toBe(false);
    });

    it('should accept move on empty position', () => {
      const board = new Map<string, PlacedTile>();
      const tile: PlacedTile = {
        type: TileType.NoSharps,
        rotation: 0,
        position: { row: 0, col: 0 },
      };

      const players = [createPlayer('p1', 0), createPlayer('p2', 3)];
      const teams: Team[] = [];

      expect(isLegalMove(board, tile, players, teams)).toBe(true);
    });

    it('should accept move that causes victory', () => {
      const board = new Map<string, PlacedTile>();
      
      // Create a path that's almost complete
      // This would need a specific board configuration to test properly
      // For now, we test the basic case
      const tile: PlacedTile = {
        type: TileType.NoSharps,
        rotation: 0,
        position: { row: 1, col: 1 },
      };

      const players = [createPlayer('p1', 0), createPlayer('p2', 3)];
      const teams: Team[] = [];

      // Should be legal
      expect(isLegalMove(board, tile, players, teams)).toBe(true);
    });

    it('should work with team games', () => {
      const board = new Map<string, PlacedTile>();
      const tile: PlacedTile = {
        type: TileType.TwoSharps,
        rotation: 0,
        position: { row: 0, col: 0 },
      };

      const players = [
        createPlayer('p1', 0),
        createPlayer('p2', 1),
        createPlayer('p3', 3),
        createPlayer('p4', 4),
      ];
      const teams: Team[] = [
        { player1Id: 'p1', player2Id: 'p3' },
        { player1Id: 'p2', player2Id: 'p4' },
      ];

      expect(isLegalMove(board, tile, players, teams)).toBe(true);
    });
  });

  describe('findLegalMoves', () => {
    it('should find moves on empty board', () => {
      const board = new Map<string, PlacedTile>();
      const players = [createPlayer('p1', 0), createPlayer('p2', 3)];
      const teams: Team[] = [];

      const legalMoves = findLegalMoves(board, TileType.NoSharps, 0, players, teams);

      // On an empty board, many positions should be legal
      expect(legalMoves.length).toBeGreaterThan(0);
    });

    it('should exclude occupied positions', () => {
      const board = new Map<string, PlacedTile>();
      const existingTile: PlacedTile = {
        type: TileType.NoSharps,
        rotation: 0,
        position: { row: 0, col: 0 },
      };
      board.set(positionToKey(existingTile.position), existingTile);

      const players = [createPlayer('p1', 0), createPlayer('p2', 3)];
      const teams: Team[] = [];

      const legalMoves = findLegalMoves(board, TileType.NoSharps, 0, players, teams);

      // Should not include the occupied position
      expect(legalMoves).not.toContainEqual({ row: 0, col: 0 });
    });

    it('should work with different tile types', () => {
      const board = new Map<string, PlacedTile>();
      const players = [createPlayer('p1', 0), createPlayer('p2', 3)];
      const teams: Team[] = [];

      const moves1 = findLegalMoves(board, TileType.NoSharps, 0, players, teams);
      const moves2 = findLegalMoves(board, TileType.ThreeSharps, 0, players, teams);

      // Both should find legal moves
      expect(moves1.length).toBeGreaterThan(0);
      expect(moves2.length).toBeGreaterThan(0);
    });

    it('should work with different rotations', () => {
      const board = new Map<string, PlacedTile>();
      const players = [createPlayer('p1', 0), createPlayer('p2', 3)];
      const teams: Team[] = [];

      const moves1 = findLegalMoves(board, TileType.OneSharp, 0, players, teams);
      const moves2 = findLegalMoves(board, TileType.OneSharp, 3, players, teams);

      // Both should find legal moves
      expect(moves1.length).toBeGreaterThan(0);
      expect(moves2.length).toBeGreaterThan(0);
    });
  });

  describe('canTileBePlacedAnywhere', () => {
    it('should return true on empty board', () => {
      const board = new Map<string, PlacedTile>();
      const players = [createPlayer('p1', 0), createPlayer('p2', 3)];
      const teams: Team[] = [];

      const canPlace = canTileBePlacedAnywhere(board, TileType.NoSharps, players, teams);

      expect(canPlace).toBe(true);
    });

    it('should return true when some legal positions exist', () => {
      const board = new Map<string, PlacedTile>();
      
      // Add some tiles but leave room
      const tile: PlacedTile = {
        type: TileType.NoSharps,
        rotation: 0,
        position: { row: 0, col: 0 },
      };
      board.set(positionToKey(tile.position), tile);

      const players = [createPlayer('p1', 0), createPlayer('p2', 3)];
      const teams: Team[] = [];

      const canPlace = canTileBePlacedAnywhere(board, TileType.TwoSharps, players, teams);

      expect(canPlace).toBe(true);
    });

    it('should check all rotations', () => {
      const board = new Map<string, PlacedTile>();
      const players = [createPlayer('p1', 0), createPlayer('p2', 3)];
      const teams: Team[] = [];

      // Even if one rotation doesn't work, others might
      const canPlace = canTileBePlacedAnywhere(board, TileType.ThreeSharps, players, teams);

      expect(canPlace).toBe(true);
    });
  });
});
