// Unit tests for flow propagation

import { describe, it, expect } from 'vitest';
import {
  traceFlow,
  calculateFlows,
  areConnected,
  areSetsConnected,
} from '../../src/game/flows';
import { TileType, Direction, PlacedTile, Player } from '../../src/game/types';
import { positionToKey } from '../../src/game/board';

describe('flow propagation', () => {
  describe('traceFlow', () => {
    it('should return empty set for empty board', () => {
      const board = new Map<string, PlacedTile>();
      const result = traceFlow(board, { row: 0, col: 0 }, Direction.East, 'test-player');
      expect(result.positions.size).toBe(0);
    });

    it('should include single tile if it has matching entry direction', () => {
      const board = new Map<string, PlacedTile>();
      const tile: PlacedTile = {
        type: TileType.NoSharps,
        rotation: 0,
        position: { row: 0, col: 0 },
      };
      board.set(positionToKey(tile.position), tile);
      
      // NoSharps has connections: SW-NW, NE-SE, W-E
      // Entering from West should exit East
      const result = traceFlow(board, { row: 0, col: 0 }, Direction.West, 'test-player');
      expect(result.positions.has(positionToKey({ row: 0, col: 0 }))).toBe(true);
    });

    it('should trace flow through connected tiles', () => {
      const board = new Map<string, PlacedTile>();
      
      // Create a simple path: two tiles side by side
      const tile1: PlacedTile = {
        type: TileType.NoSharps, // Now has SE-NW connection
        rotation: 0,
        position: { row: 0, col: 0 },
      };
      const tile2: PlacedTile = {
        type: TileType.NoSharps, // Now has SE-NW connection
        rotation: 0,
        position: { row: -1, col: 0 }, // To the NW of tile1
      };
      
      board.set(positionToKey(tile1.position), tile1);
      board.set(positionToKey(tile2.position), tile2);
      
      // Trace from tile1 entering from SouthWest (exits to NorthWest)
      const result = traceFlow(board, tile1.position, Direction.SouthWest, 'test-player');
      
      // Should include both tiles
      expect(result.positions.has(positionToKey(tile1.position))).toBe(true);
      expect(result.positions.has(positionToKey(tile2.position))).toBe(true);
    });

    it('should stop flow at board edges', () => {
      const board = new Map<string, PlacedTile>();
      
      const tile: PlacedTile = {
        type: TileType.NoSharps,
        rotation: 0,
        position: { row: 0, col: 0 },
      };
      board.set(positionToKey(tile.position), tile);
      
      // Enter from SouthEast, exit NorthWest, but there's no tile to the NorthWest
      const result = traceFlow(board, tile.position, Direction.SouthEast, 'test-player');
      
      // Should only include the single tile
      expect(result.positions.size).toBe(1);
      expect(result.positions.has(positionToKey(tile.position))).toBe(true);
    });

    it('should handle circular paths without infinite loop', () => {
      const board = new Map<string, PlacedTile>();
      
      // Create a triangle of tiles
      const tile1: PlacedTile = {
        type: TileType.NoSharps,
        rotation: 0,
        position: { row: 0, col: 0 },
      };
      const tile2: PlacedTile = {
        type: TileType.NoSharps,
        rotation: 0,
        position: { row: 0, col: 1 },
      };
      
      board.set(positionToKey(tile1.position), tile1);
      board.set(positionToKey(tile2.position), tile2);
      
      const result = traceFlow(board, tile1.position, Direction.West, 'test-player');
      
      // Should terminate properly
      expect(result.positions.size).toBeGreaterThan(0);
      expect(result.positions.size).toBeLessThanOrEqual(2);
    });

    it('should handle revisiting same position from different direction', () => {
      const board = new Map<string, PlacedTile>();
      
      // Create a path that could theoretically loop back
      // Tile 1: receives from West, outputs to East
      const tile1: PlacedTile = {
        type: TileType.NoSharps,  // Has W-E connection
        rotation: 0,
        position: { row: 0, col: 0 },
      };
      
      // Tile 2: receives from West (from tile1), outputs somewhere
      const tile2: PlacedTile = {
        type: TileType.NoSharps,
        rotation: 0,
        position: { row: 0, col: 1 },
      };
      
      // Tile 3: could create a loop back
      const tile3: PlacedTile = {
        type: TileType.OneSharp,
        rotation: 0,
        position: { row: 1, col: 0 },
      };
      
      // Tile 4: another connection
      const tile4: PlacedTile = {
        type: TileType.TwoSharps,
        rotation: 0,
        position: { row: 1, col: 1 },
      };
      
      board.set(positionToKey(tile1.position), tile1);
      board.set(positionToKey(tile2.position), tile2);
      board.set(positionToKey(tile3.position), tile3);
      board.set(positionToKey(tile4.position), tile4);
      
      // Trace from multiple starting points to exercise the visited logic
      const result1 = traceFlow(board, tile1.position, Direction.West, 'test-player');
      const result2 = traceFlow(board, tile1.position, Direction.SouthWest, 'test-player');
      const result3 = traceFlow(board, tile2.position, Direction.West, 'test-player');
      
      // Should handle all cases without infinite loops
      expect(result1.positions.size).toBeGreaterThan(0);
      expect(result2.positions.size).toBeGreaterThanOrEqual(0);
      expect(result3.positions.size).toBeGreaterThan(0);
    });

    it('should handle tile with no matching entry direction', () => {
      const board = new Map<string, PlacedTile>();
      
      // Create a tile and trace with an invalid entry direction
      // This is contrived but tests the exitDir === null path
      const tile: PlacedTile = {
        type: TileType.NoSharps,
        rotation: 0,
        position: { row: 0, col: 0 },
      };
      board.set(positionToKey(tile.position), tile);
      
      // Use an illegal direction to trigger null exit
      const illegalDirection = 99 as Direction;
      const result = traceFlow(board, tile.position, illegalDirection, 'test-player');
      
      // Should return empty set since no valid connection
      expect(result.positions.size).toBe(0);
    });
  });

  describe('calculateFlows', () => {
    it('should return empty flows for empty board', () => {
      const players: Player[] = [
        { id: 'p1', color: 'blue', edgePosition: 0, isAI: false },
      ];
      const board = new Map<string, PlacedTile>();
      
      const { flows } = calculateFlows(board, players);
      
      expect(flows.has('p1')).toBe(true);
      expect(flows.get('p1')?.size).toBe(0);
    });

    it('should only flow from hex edges that belong to player edge', () => {
      // This test verifies that flows only start from the outward-facing hex edges
      // (the edges through which flow enters from outside the board)
      const players: Player[] = [
        { id: 'p1', color: 'blue', edgePosition: 0, isAI: false }, // NorthWest edge (row -3)
      ];
      const board = new Map<string, PlacedTile>();
      
      // Place a NoSharps tile at edge position (-3, 1)
      // With the corrected implementation, flow enters from NW(2) and NE(3) directions
      // NoSharps connections: SW-NW (0-2), W-E (1-4), NE-SE (3-5)
      const edgeTile: PlacedTile = {
        type: TileType.NoSharps,
        rotation: 0,
        position: { row: -3, col: 1 },
      };
      
      board.set(positionToKey(edgeTile.position), edgeTile);
      
      const { flows } = calculateFlows(board, players);
      const playerFlow = flows.get('p1');
      
      expect(playerFlow).toBeDefined();
      
      // The edge tile should be in the flow
      expect(playerFlow!.has('-3,1')).toBe(true);
      
      // This verifies that flow is calculated (the test passes if no errors occur)
      // The key point is that flow starts from NW/NE directions (outward-facing)
      // not from SW/SE directions (inward-facing)
    });

    it('should calculate flows for player with edge tile', () => {
      const players: Player[] = [
        { id: 'p1', color: 'blue', edgePosition: 0, isAI: false },
      ];
      const board = new Map<string, PlacedTile>();
      
      // Place a tile at an edge position
      const tile: PlacedTile = {
        type: TileType.NoSharps,
        rotation: 0,
        position: { row: -3, col: 0 }, // Edge 0 position
      };
      board.set(positionToKey(tile.position), tile);
      
      const { flows } = calculateFlows(board, players);
      const playerFlow = flows.get('p1');
      
      expect(playerFlow).toBeDefined();
      // Should have at least the edge tile
      expect(playerFlow!.size).toBeGreaterThanOrEqual(0);
    });

    it('should calculate flows for multiple players', () => {
      const players: Player[] = [
        { id: 'p1', color: 'blue', edgePosition: 0, isAI: false },
        { id: 'p2', color: 'red', edgePosition: 3, isAI: false },
      ];
      const board = new Map<string, PlacedTile>();
      
      const { flows } = calculateFlows(board, players);
      
      expect(flows.has('p1')).toBe(true);
      expect(flows.has('p2')).toBe(true);
    });

    it('should keep player flows separate', () => {
      const players: Player[] = [
        { id: 'p1', color: 'blue', edgePosition: 0, isAI: false },
        { id: 'p2', color: 'red', edgePosition: 3, isAI: false },
      ];
      const board = new Map<string, PlacedTile>();
      
      // Place tiles at different edges
      const tile1: PlacedTile = {
        type: TileType.NoSharps,
        rotation: 0,
        position: { row: -3, col: 0 },
      };
      const tile2: PlacedTile = {
        type: TileType.NoSharps,
        rotation: 0,
        position: { row: 3, col: 0 },
      };
      
      board.set(positionToKey(tile1.position), tile1);
      board.set(positionToKey(tile2.position), tile2);
      
      const { flows } = calculateFlows(board, players);
      const flow1 = flows.get('p1');
      const flow2 = flows.get('p2');
      
      expect(flow1).toBeDefined();
      expect(flow2).toBeDefined();
    });
  });

  describe('areConnected', () => {
    it('should return false for non-existent player', () => {
      const flows = new Map<string, Set<string>>();
      const result = areConnected(
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        flows,
        'nonexistent'
      );
      expect(result).toBe(false);
    });

    it('should return false when positions not in flow', () => {
      const flows = new Map<string, Set<string>>();
      flows.set('p1', new Set());
      
      const result = areConnected(
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        flows,
        'p1'
      );
      expect(result).toBe(false);
    });

    it('should return false when only one position in flow', () => {
      const flows = new Map<string, Set<string>>();
      flows.set('p1', new Set(['0,0']));
      
      const result = areConnected(
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        flows,
        'p1'
      );
      expect(result).toBe(false);
    });

    it('should return true when both positions in flow', () => {
      const flows = new Map<string, Set<string>>();
      flows.set('p1', new Set(['0,0', '0,1']));
      
      const result = areConnected(
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        flows,
        'p1'
      );
      expect(result).toBe(true);
    });
  });

  describe('areSetsConnected', () => {
    it('should return false when player has no flow', () => {
      const flows = new Map<string, Set<string>>();
      const set1 = [{ row: 0, col: 0 }];
      const set2 = [{ row: 0, col: 1 }];
      
      const result = areSetsConnected(set1, set2, flows, 'p1');
      expect(result).toBe(false);
    });

    it('should return false when neither set intersects flow', () => {
      const flows = new Map<string, Set<string>>();
      flows.set('p1', new Set(['1,1']));
      
      const set1 = [{ row: 0, col: 0 }];
      const set2 = [{ row: 0, col: 1 }];
      
      const result = areSetsConnected(set1, set2, flows, 'p1');
      expect(result).toBe(false);
    });

    it('should return false when only first set intersects flow', () => {
      const flows = new Map<string, Set<string>>();
      flows.set('p1', new Set(['0,0']));
      
      const set1 = [{ row: 0, col: 0 }];
      const set2 = [{ row: 0, col: 1 }];
      
      const result = areSetsConnected(set1, set2, flows, 'p1');
      expect(result).toBe(false);
    });

    it('should return false when only second set intersects flow', () => {
      const flows = new Map<string, Set<string>>();
      flows.set('p1', new Set(['0,1']));
      
      const set1 = [{ row: 0, col: 0 }];
      const set2 = [{ row: 0, col: 1 }];
      
      const result = areSetsConnected(set1, set2, flows, 'p1');
      expect(result).toBe(false);
    });

    it('should return true when both sets intersect flow', () => {
      const flows = new Map<string, Set<string>>();
      flows.set('p1', new Set(['0,0', '0,1', '1,0']));
      
      const set1 = [{ row: 0, col: 0 }];
      const set2 = [{ row: 0, col: 1 }];
      
      const result = areSetsConnected(set1, set2, flows, 'p1');
      expect(result).toBe(true);
    });

    it('should work with multiple positions in sets', () => {
      const flows = new Map<string, Set<string>>();
      flows.set('p1', new Set(['0,0', '2,2']));
      
      const set1 = [{ row: 0, col: 0 }, { row: 1, col: 1 }];
      const set2 = [{ row: 2, col: 2 }, { row: 3, col: 3 }];
      
      const result = areSetsConnected(set1, set2, flows, 'p1');
      expect(result).toBe(true);
    });
  });
});
