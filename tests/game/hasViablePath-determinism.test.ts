// Test to verify hasViablePath is deterministic
import { describe, it, expect } from 'vitest';
import { hasViablePath } from '../../src/game/legality';
import { PlacedTile, Player, TileType } from '../../src/game/types';
import { positionToKey } from '../../src/game/board';

describe('hasViablePath determinism', () => {
  it('should return identical results when called multiple times with same input', () => {
    // Create a simple board state
    const board = new Map<string, PlacedTile>();
    
    // Place a few tiles to create a non-trivial path
    board.set(positionToKey({ row: -3, col: 0 }), { type: TileType.NoSharps, rotation: 0 });
    board.set(positionToKey({ row: -2, col: 0 }), { type: TileType.OneSharp, rotation: 1 });
    board.set(positionToKey({ row: -1, col: 0 }), { type: TileType.TwoSharps, rotation: 2 });
    
    const player: Player = {
      id: 'p1',
      color: '#0173B2',
      edgePosition: 0,
      hasWon: false,
    };
    
    const targetEdge = 3;
    
    // Call hasViablePath 10 times and collect results
    const results: any[] = [];
    for (let i = 0; i < 10; i++) {
      const result = hasViablePath(board, player, targetEdge, true, true, 3);
      results.push(result);
    }
    
    // Verify all results are identical
    const first = results[0];
    for (let i = 1; i < results.length; i++) {
      expect(results[i].hasPath).toBe(first.hasPath);
      expect(results[i].pathToTarget).toEqual(first.pathToTarget);
      expect(results[i].visitedPositions.size).toBe(first.visitedPositions.size);
      expect(results[i].pathEdges).toEqual(first.pathEdges);
    }
  });

  it('should return same path score when simulating generator scoring', () => {
    // Simulate what the generator does - create a board, add a tile, score the path
    const board = new Map<string, PlacedTile>();
    
    // Initial board state after 2 moves (simplified version of actual game state)
    board.set(positionToKey({ row: -3, col: 0 }), { type: TileType.NoSharps, rotation: 1 });
    board.set(positionToKey({ row: 2, col: -3 }), { type: TileType.OneSharp, rotation: 2 });
    
    const player: Player = {
      id: 'p1',
      color: '#0173B2',
      edgePosition: 0,
      hasWon: false,
    };
    
    const targetEdge = 3;
    
    // Simulate placing a tile at (-2, 0) and scoring it
    const testPosition = { row: -2, col: 0 };
    const testTile = { type: TileType.TwoSharps, rotation: 1 };
    
    // Run this simulation 10 times
    const scores: number[] = [];
    for (let i = 0; i < 10; i++) {
      const simulatedBoard = new Map(board);
      simulatedBoard.set(positionToKey(testPosition), testTile);
      
      const result = hasViablePath(simulatedBoard, player, targetEdge, true, true, 3);
      
      if (typeof result === 'boolean') {
        throw new Error('Expected debug info but got boolean');
      }
      
      // Score based on pathToTarget (same logic as generator)
      let score = 0;
      if (result.hasPath && result.pathToTarget) {
        for (const pos of result.pathToTarget) {
          const key = positionToKey(pos);
          if (simulatedBoard.has(key)) {
            score += 1;
          } else {
            score -= 2;
          }
        }
      }
      
      scores.push(score);
    }
    
    // All scores should be identical
    const firstScore = scores[0];
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBe(firstScore);
    }
  });
});
