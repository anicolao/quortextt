// Unit tests for tile utilities

import { describe, it, expect } from 'vitest';
import {
  TILE_FLOWS,
  getFlowConnections,
  getFlowExit,
  areDirectionsConnected,
  createTileDeck,
  shuffleDeck,
} from '../../src/game/tiles';
import { rotateDirection } from '../../src/game/board';
import { TileType, Direction, PlacedTile } from '../../src/game/types';

describe('tile utilities', () => {
  describe('TILE_FLOWS', () => {
    it('should have 3 flow connections for each tile type', () => {
      expect(TILE_FLOWS[TileType.NoSharps].length).toBe(3);
      expect(TILE_FLOWS[TileType.OneSharp].length).toBe(3);
      expect(TILE_FLOWS[TileType.TwoSharps].length).toBe(3);
      expect(TILE_FLOWS[TileType.ThreeSharps].length).toBe(3);
    });

    it('should have valid direction pairs', () => {
      Object.values(TILE_FLOWS).forEach((flows) => {
        flows.forEach(([dir1, dir2]) => {
          expect(dir1).toBeGreaterThanOrEqual(0);
          expect(dir1).toBeLessThan(6);
          expect(dir2).toBeGreaterThanOrEqual(0);
          expect(dir2).toBeLessThan(6);
          expect(dir1).not.toBe(dir2);
        });
      });
    });
  });

  describe('rotateDirection', () => {
    it('should not change direction with rotation 0', () => {
      expect(rotateDirection(Direction.East, 0)).toBe(Direction.East);
      expect(rotateDirection(Direction.West, 0)).toBe(Direction.West);
    });

    it('should rotate direction clockwise', () => {
      expect(rotateDirection(Direction.SouthWest, 1)).toBe(Direction.SouthEast);
      expect(rotateDirection(Direction.West, 1)).toBe(Direction.SouthWest);
      expect(rotateDirection(Direction.East, 2)).toBe(Direction.NorthWest);
    });

    it('should wrap around after full rotation', () => {
      expect(rotateDirection(Direction.East, 6)).toBe(Direction.East);
      expect(rotateDirection(Direction.NorthEast, 6)).toBe(Direction.NorthEast);
    });

    it('should handle multiple rotations', () => {
      expect(rotateDirection(Direction.SouthWest, 3)).toBe(Direction.NorthEast);
      expect(rotateDirection(Direction.NorthWest, 4)).toBe(Direction.East);
    });
  });

  describe('getFlowConnections', () => {
    it('should return unmodified flows for rotation 0', () => {
      const flows = getFlowConnections(TileType.NoSharps, 0);
      expect(flows).toEqual(TILE_FLOWS[TileType.NoSharps]);
    });

    it('should rotate all connections', () => {
      const flows = getFlowConnections(TileType.OneSharp, 1);
      expect(flows.length).toBe(3);
      
      // Each connection should be rotated by ADDING rotation (tile rotates clockwise)
      const originalFlows = TILE_FLOWS[TileType.OneSharp];
      flows.forEach((flow, i) => {
        expect(flow[0]).toBe((originalFlows[i][0] + 1) % 6);
        expect(flow[1]).toBe((originalFlows[i][1] + 1) % 6);
      });
    });

    it('should produce different flows for each rotation', () => {
      const flows0 = getFlowConnections(TileType.TwoSharps, 0);
      const flows1 = getFlowConnections(TileType.TwoSharps, 1);
      const flows2 = getFlowConnections(TileType.TwoSharps, 2);
      
      expect(flows0).not.toEqual(flows1);
      expect(flows1).not.toEqual(flows2);
      expect(flows0).not.toEqual(flows2);
    });
  });

  describe('getFlowExit', () => {
    it('should return exit direction for valid entry', () => {
      const tile: PlacedTile = {
        type: TileType.NoSharps,
        rotation: 0,
        position: { row: 0, col: 0 },
      };
      
      // NoSharps (rotation 0) has: SW-NW, W-E, NE-SE
      expect(getFlowExit(tile, Direction.SouthWest)).toBe(Direction.NorthWest);
      expect(getFlowExit(tile, Direction.NorthWest)).toBe(Direction.SouthWest);
      expect(getFlowExit(tile, Direction.West)).toBe(Direction.East);
      expect(getFlowExit(tile, Direction.East)).toBe(Direction.West);
    });

    it('should return null for invalid entry direction', () => {
      const tile: PlacedTile = {
        type: TileType.TwoSharps,
        rotation: 0,
        position: { row: 0, col: 0 },
      };
      
      // Test the null return path by passing an illegal direction value
      // This is a contrived test but exercises the defensive null return
      const illegalDirection = 99 as Direction; // Invalid direction
      
      expect(getFlowExit(tile, illegalDirection)).toBe(null);
    });

    it('should work with rotated tiles', () => {
      const tile: PlacedTile = {
        type: TileType.OneSharp,
        rotation: 2,
        position: { row: 0, col: 0 },
      };
      
      const connections = getFlowConnections(tile.type, tile.rotation);
      const [dir1, dir2] = connections[0];
      
      expect(getFlowExit(tile, dir1)).toBe(dir2);
      expect(getFlowExit(tile, dir2)).toBe(dir1);
    });
  });

  describe('areDirectionsConnected', () => {
    it('should return true for connected directions', () => {
      const tile: PlacedTile = {
        type: TileType.NoSharps,
        rotation: 0,
        position: { row: 0, col: 0 },
      };
      
      // NoSharps (rotation 0) has: SW-NW, W-E, NE-SE
      expect(areDirectionsConnected(tile, Direction.SouthWest, Direction.NorthWest)).toBe(true);
      expect(areDirectionsConnected(tile, Direction.NorthWest, Direction.SouthWest)).toBe(true);
      expect(areDirectionsConnected(tile, Direction.West, Direction.East)).toBe(true);
    });

    it('should return false for non-connected directions', () => {
      const tile: PlacedTile = {
        type: TileType.NoSharps,
        rotation: 0,
        position: { row: 0, col: 0 },
      };
      
      expect(areDirectionsConnected(tile, Direction.East, Direction.NorthWest)).toBe(false);
      expect(areDirectionsConnected(tile, Direction.SouthEast, Direction.West)).toBe(false);
    });

    it('should work with rotated tiles', () => {
      const tile: PlacedTile = {
        type: TileType.TwoSharps,
        rotation: 3,
        position: { row: 0, col: 0 },
      };
      
      const connections = getFlowConnections(tile.type, tile.rotation);
      const [dir1, dir2] = connections[0];
      
      expect(areDirectionsConnected(tile, dir1, dir2)).toBe(true);
    });
  });

  describe('createTileDeck', () => {
    it('should create deck with 40 tiles', () => {
      const deck = createTileDeck();
      expect(deck.length).toBe(40);
    });

    it('should have 10 tiles of each type', () => {
      const deck = createTileDeck();
      
      const noSharps = deck.filter((t) => t === TileType.NoSharps).length;
      const oneSharp = deck.filter((t) => t === TileType.OneSharp).length;
      const twoSharps = deck.filter((t) => t === TileType.TwoSharps).length;
      const threeSharps = deck.filter((t) => t === TileType.ThreeSharps).length;
      
      expect(noSharps).toBe(10);
      expect(oneSharp).toBe(10);
      expect(twoSharps).toBe(10);
      expect(threeSharps).toBe(10);
    });
  });

  describe('shuffleDeck', () => {
    it('should preserve deck size', () => {
      const deck = createTileDeck();
      const shuffled = shuffleDeck(deck);
      expect(shuffled.length).toBe(deck.length);
    });

    it('should preserve tile counts', () => {
      const deck = createTileDeck();
      const shuffled = shuffleDeck(deck);
      
      const originalCounts = {
        [TileType.NoSharps]: deck.filter((t) => t === TileType.NoSharps).length,
        [TileType.OneSharp]: deck.filter((t) => t === TileType.OneSharp).length,
        [TileType.TwoSharps]: deck.filter((t) => t === TileType.TwoSharps).length,
        [TileType.ThreeSharps]: deck.filter((t) => t === TileType.ThreeSharps).length,
      };
      
      const shuffledCounts = {
        [TileType.NoSharps]: shuffled.filter((t) => t === TileType.NoSharps).length,
        [TileType.OneSharp]: shuffled.filter((t) => t === TileType.OneSharp).length,
        [TileType.TwoSharps]: shuffled.filter((t) => t === TileType.TwoSharps).length,
        [TileType.ThreeSharps]: shuffled.filter((t) => t === TileType.ThreeSharps).length,
      };
      
      expect(shuffledCounts).toEqual(originalCounts);
    });

    it('should produce different order with random shuffle', () => {
      const deck = createTileDeck();
      const shuffled1 = shuffleDeck(deck);
      const shuffled2 = shuffleDeck(deck);
      
      // Very unlikely to be the same
      const same = shuffled1.every((tile, i) => tile === shuffled2[i]);
      expect(same).toBe(false);
    });

    it('should produce same order with same seed', () => {
      const deck = createTileDeck();
      const shuffled1 = shuffleDeck(deck, 12345);
      const shuffled2 = shuffleDeck(deck, 12345);
      
      expect(shuffled1).toEqual(shuffled2);
    });

    it('should produce different order with different seeds', () => {
      const deck = createTileDeck();
      const shuffled1 = shuffleDeck(deck, 12345);
      const shuffled2 = shuffleDeck(deck, 54321);
      
      expect(shuffled1).not.toEqual(shuffled2);
    });
  });
});
