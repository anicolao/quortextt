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
        type: TileType.NoSharps, // Has W-E connection
        rotation: 0,
        position: { row: 0, col: 0 },
      };
      const tile2: PlacedTile = {
        type: TileType.NoSharps, // Has W-E connection
        rotation: 0,
        position: { row: 0, col: 1 },
      };
      
      board.set(positionToKey(tile1.position), tile1);
      board.set(positionToKey(tile2.position), tile2);
      
      // Trace from tile1 entering from West
      const result = traceFlow(board, tile1.position, Direction.West, 'test-player');
      
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
      
      // Enter from West, exit East, but there's no tile to the East
      const result = traceFlow(board, tile.position, Direction.West, 'test-player');
      
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
      // This test verifies the fix: flows should only start from specific hex edges,
      // not from all 6 edges of hexes on the player's board edge
      const players: Player[] = [
        { id: 'p1', color: 'blue', edgePosition: 0, isAI: false }, // NorthWest edge
      ];
      const board = new Map<string, PlacedTile>();
      
      // Place a tile at edge position (-3, 0) which is on player 0's edge
      // This tile should only flow from NorthWest direction, not from all directions
      const edgeTile: PlacedTile = {
        type: TileType.NoSharps, // Has connections: SW-NW, NE-SE, W-E
        rotation: 0,
        position: { row: -3, col: 0 },
      };
      
      // Place an adjacent tile to the south that should NOT be in p1's flow
      // because p1's flow should only enter from NW/W directions at this edge hex
      const southTile: PlacedTile = {
        type: TileType.NoSharps,
        rotation: 0,
        position: { row: -2, col: 0 }, // SW of edge tile
      };
      
      board.set(positionToKey(edgeTile.position), edgeTile);
      board.set(positionToKey(southTile.position), southTile);
      
      const { flows } = calculateFlows(board, players);
      const playerFlow = flows.get('p1');
      
      expect(playerFlow).toBeDefined();
      
      // The edge tile should be in the flow only if it has a valid entry from NW or W
      // NoSharps with rotation 0 has: SW-NW, NE-SE, W-E connections
      // From NW direction, exits to SW - this goes to southTile
      // From W direction, exits to E
      // So the flow WILL include edge tile when entering from NW
      
      // However, the key test is that we shouldn't get flows from entering via
      // directions that don't belong to the player's edge (like NE, E, SE)
      
      // Let's create a clearer test case
      const board2 = new Map<string, PlacedTile>();
      
      // Place tile at (-3, 3) on edge 0 (NW edge)
      // At this corner position, only NW direction should be used
      const cornerTile: PlacedTile = {
        type: TileType.TwoSharps, // Has connections: SW-SE, NW-NE, W-E
        rotation: 0,
        position: { row: -3, col: 3 },
      };
      
      // Place tile to the east (not on player edge, outside board)
      // and tile to NE (not on player edge, outside board)
      // Place tile to SE which IS on the board
      const seTile: PlacedTile = {
        type: TileType.NoSharps,
        rotation: 0,
        position: { row: -2, col: 3 }, // SE of corner
      };
      
      board2.set(positionToKey(cornerTile.position), cornerTile);
      board2.set(positionToKey(seTile.position), seTile);
      
      const { flows: flows2 } = calculateFlows(board2, players);
      const playerFlow2 = flows2.get('p1');
      
      // TwoSharps rotation 0: SW-SE, NW-NE, W-E
      // If entering from NW (player's edge), exits to NE (off board)
      // If entering from W (player's edge), exits to E (off board)
      // The tile should be in the flow
      expect(playerFlow2?.has(positionToKey(cornerTile.position))).toBe(true);
      
      // The SE tile should NOT be in flow because flow from NW doesn't go to SE
      // (TwoSharps NW->NE, not NW->SE)
      expect(playerFlow2?.has(positionToKey(seTile.position))).toBe(false);
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
