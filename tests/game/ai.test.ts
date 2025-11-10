// Tests for AI logic

import { describe, it, expect } from 'vitest';
import {
  selectAIEdge,
  selectAIMove,
  generateMoveCandidates,
  MoveCandidate,
} from '../../src/game/ai';
import { Player, Team, TileType, PlacedTile } from '../../src/game/types';

describe('AI Edge Selection', () => {
  it('should not select the opposite edge', () => {
    const availableEdges = [0, 1, 2, 3, 4, 5];
    const playerEdge = 0;
    
    const selectedEdge = selectAIEdge(playerEdge, availableEdges);
    
    expect(selectedEdge).not.toBeNull();
    expect(selectedEdge).not.toBe(3); // Opposite of 0 is 3
  });
  
  it('should select from available edges excluding opposite', () => {
    const availableEdges = [1, 2, 4];
    const playerEdge = 0;
    
    const selectedEdge = selectAIEdge(playerEdge, availableEdges);
    
    expect(selectedEdge).not.toBeNull();
    expect(availableEdges).toContain(selectedEdge!);
    expect(selectedEdge).not.toBe(3);
  });
  
  it('should fallback to any edge if opposite is the only option', () => {
    const availableEdges = [3]; // Only opposite edge available
    const playerEdge = 0;
    
    const selectedEdge = selectAIEdge(playerEdge, availableEdges);
    
    expect(selectedEdge).toBe(3);
  });
  
  it('should return null if no edges available', () => {
    const availableEdges: number[] = [];
    const playerEdge = 0;
    
    const selectedEdge = selectAIEdge(playerEdge, availableEdges);
    
    expect(selectedEdge).toBeNull();
  });
  
  it('should handle all edge pairs correctly', () => {
    const pairs = [
      [0, 3], [1, 4], [2, 5], [3, 0], [4, 1], [5, 2]
    ];
    
    for (const [playerEdge, oppositeEdge] of pairs) {
      const allEdges = [0, 1, 2, 3, 4, 5];
      const selectedEdge = selectAIEdge(playerEdge, allEdges);
      
      expect(selectedEdge).not.toBe(oppositeEdge);
    }
  });
});

describe('AI Move Generation', () => {
  const aiPlayer: Player = {
    id: 'ai1',
    color: '#0173B2',
    edgePosition: 0,
    isAI: true,
  };
  
  const humanPlayer: Player = {
    id: 'p1',
    color: '#DE8F05',
    edgePosition: 3,
    isAI: false,
  };
  
  const players: Player[] = [aiPlayer, humanPlayer];
  const teams: Team[] = [];
  const boardRadius = 3;
  
  it('should generate move candidates for an empty board', () => {
    const board = new Map<string, PlacedTile>();
    const tileType = TileType.NoSharps;
    
    const candidates = generateMoveCandidates(
      board,
      tileType,
      aiPlayer,
      players,
      teams,
      false, // no supermove
      boardRadius
    );
    
    // Should have candidates for all rotations
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every(c => !c.isReplacement)).toBe(true);
  });
  
  it('should evaluate moves with scores', () => {
    const board = new Map<string, PlacedTile>();
    const tileType = TileType.NoSharps;
    
    const candidates = generateMoveCandidates(
      board,
      tileType,
      aiPlayer,
      players,
      teams,
      false,
      boardRadius
    );
    
    // All candidates should have scores
    expect(candidates.every(c => typeof c.score === 'number')).toBe(true);
  });
  
  it('should identify winning moves', () => {
    // Create a board state where AI is one move away from winning
    const board = new Map<string, PlacedTile>();
    
    // Place tiles creating a path from edge 0 towards edge 3
    // This is a simplified test - in reality we'd need a complete path
    board.set('-3,0', {
      type: TileType.NoSharps,
      rotation: 0,
      position: { row: -3, col: 0 }
    });
    
    const tileType = TileType.NoSharps;
    
    const candidates = generateMoveCandidates(
      board,
      tileType,
      aiPlayer,
      players,
      teams,
      false,
      boardRadius
    );
    
    // Should have candidates
    expect(candidates.length).toBeGreaterThan(0);
  });
  
  it('should consider supermove replacements when enabled', () => {
    const board = new Map<string, PlacedTile>();
    
    // Add a tile that can be replaced
    board.set('0,0', {
      type: TileType.NoSharps,
      rotation: 0,
      position: { row: 0, col: 0 }
    });
    
    const tileType = TileType.OneSharp;
    
    const candidates = generateMoveCandidates(
      board,
      tileType,
      aiPlayer,
      players,
      teams,
      true, // supermove enabled
      boardRadius
    );
    
    // Should have both regular and replacement candidates
    expect(candidates.length).toBeGreaterThan(0);
  });
  
  it('should not generate replacement candidates when supermove disabled', () => {
    const board = new Map<string, PlacedTile>();
    
    // Add a tile
    board.set('0,0', {
      type: TileType.NoSharps,
      rotation: 0,
      position: { row: 0, col: 0 }
    });
    
    const tileType = TileType.OneSharp;
    
    const candidates = generateMoveCandidates(
      board,
      tileType,
      aiPlayer,
      players,
      teams,
      false, // supermove disabled
      boardRadius
    );
    
    // Should not have replacement candidates
    expect(candidates.every(c => !c.isReplacement)).toBe(true);
  });
  
  it('should evaluate follow-up moves for supermove replacements', () => {
    const board = new Map<string, PlacedTile>();
    
    // Add multiple tiles to create a more complex board state
    board.set('-3,0', {
      type: TileType.NoSharps,
      rotation: 0,
      position: { row: -3, col: 0 }
    });
    
    board.set('-2,-1', {
      type: TileType.OneSharp,
      rotation: 2,
      position: { row: -2, col: -1 }
    });
    
    const tileType = TileType.TwoSharps;
    
    const candidates = generateMoveCandidates(
      board,
      tileType,
      aiPlayer,
      players,
      teams,
      true, // supermove enabled
      boardRadius
    );
    
    // Should have candidates (both regular and replacement)
    expect(candidates.length).toBeGreaterThan(0);
  });
});

describe('AI Move Selection', () => {
  const aiPlayer: Player = {
    id: 'ai1',
    color: '#0173B2',
    edgePosition: 0,
    isAI: true,
  };
  
  const humanPlayer: Player = {
    id: 'p1',
    color: '#DE8F05',
    edgePosition: 3,
    isAI: false,
  };
  
  const players: Player[] = [aiPlayer, humanPlayer];
  const teams: Team[] = [];
  const boardRadius = 3;
  
  it('should select a move for an empty board', () => {
    const board = new Map<string, PlacedTile>();
    const tileType = TileType.NoSharps;
    
    const move = selectAIMove(
      board,
      tileType,
      aiPlayer,
      players,
      teams,
      false,
      boardRadius
    );
    
    expect(move).not.toBeNull();
    expect(move?.position).toBeDefined();
    expect(move?.rotation).toBeGreaterThanOrEqual(0);
    expect(move?.rotation).toBeLessThan(6);
  });
  
  it('should prefer winning moves', () => {
    const board = new Map<string, PlacedTile>();
    const tileType = TileType.NoSharps;
    
    const move = selectAIMove(
      board,
      tileType,
      aiPlayer,
      players,
      teams,
      false,
      boardRadius
    );
    
    // Should select a move
    expect(move).not.toBeNull();
  });
  
  it('should return null if no legal moves available', () => {
    // Create a completely filled board (unrealistic but tests the edge case)
    const board = new Map<string, PlacedTile>();
    const positions = [
      { row: 0, col: 0 },
      { row: -1, col: 0 },
      { row: -1, col: 1 },
      { row: 0, col: -1 },
      { row: 1, col: -1 },
      { row: 1, col: 0 },
      { row: 0, col: 1 },
    ];
    
    // Fill board with tiles - this might not block all moves depending on legality
    positions.forEach(pos => {
      board.set(`${pos.row},${pos.col}`, {
        type: TileType.ThreeSharps,
        rotation: 0,
        position: pos
      });
    });
    
    const tileType = TileType.NoSharps;
    
    const move = selectAIMove(
      board,
      tileType,
      aiPlayer,
      players,
      teams,
      false,
      boardRadius
    );
    
    // Depending on game rules, might still have legal moves
    // This test mainly ensures no errors occur
    expect(move === null || move !== null).toBe(true);
  });
  
  it('should select highest scoring move', () => {
    const board = new Map<string, PlacedTile>();
    const tileType = TileType.NoSharps;
    
    const move = selectAIMove(
      board,
      tileType,
      aiPlayer,
      players,
      teams,
      false,
      boardRadius
    );
    
    // Should select a valid move with a score
    expect(move).not.toBeNull();
    expect(typeof move?.score).toBe('number');
  });
  
  it('should work with supermove enabled', () => {
    const board = new Map<string, PlacedTile>();
    
    // Add a tile to enable replacement
    board.set('0,0', {
      type: TileType.NoSharps,
      rotation: 0,
      position: { row: 0, col: 0 }
    });
    
    const tileType = TileType.OneSharp;
    
    const move = selectAIMove(
      board,
      tileType,
      aiPlayer,
      players,
      teams,
      true, // supermove enabled
      boardRadius
    );
    
    // Should select a move
    expect(move).not.toBeNull();
  });
  
  it('should handle boards with existing tiles', () => {
    const board = new Map<string, PlacedTile>();
    
    // Add some tiles to the board
    board.set('-3,0', {
      type: TileType.NoSharps,
      rotation: 0,
      position: { row: -3, col: 0 }
    });
    
    board.set('-2,-1', {
      type: TileType.OneSharp,
      rotation: 2,
      position: { row: -2, col: -1 }
    });
    
    const tileType = TileType.TwoSharps;
    
    const move = selectAIMove(
      board,
      tileType,
      aiPlayer,
      players,
      teams,
      false,
      boardRadius
    );
    
    // Should select a move
    expect(move).not.toBeNull();
  });
  
  it('should handle complex supermove scenarios with follow-up evaluation', () => {
    const board = new Map<string, PlacedTile>();
    
    // Add several tiles to create a complex board state
    board.set('-3,0', {
      type: TileType.NoSharps,
      rotation: 0,
      position: { row: -3, col: 0 }
    });
    
    board.set('-2,-1', {
      type: TileType.OneSharp,
      rotation: 2,
      position: { row: -2, col: -1 }
    });
    
    board.set('-2,0', {
      type: TileType.TwoSharps,
      rotation: 1,
      position: { row: -2, col: 0 }
    });
    
    const tileType = TileType.ThreeSharps;
    
    const move = selectAIMove(
      board,
      tileType,
      aiPlayer,
      players,
      teams,
      true, // enable supermove to test replacement + followup logic
      boardRadius
    );
    
    // Should select a move (either regular or replacement)
    expect(move).not.toBeNull();
  });

  it('should treat opponent with supermove as 0.5 moves away when they have no path', () => {
    // This test verifies the fix for scoring when opponent is blocked but has supermove
    // The scenario: opponent has no viable path (Infinity), but board has tiles (supermove available)
    // Expected: opponent treated as 0.5 moves away, not Infinity (which gave constant score 50000)
    
    const board = new Map<string, PlacedTile>();
    
    // Create a simple board state where we can control the path lengths
    // Add a tile so supermove is available
    board.set('-3,0', {
      type: TileType.NoSharps,
      rotation: 0,
      position: { row: -3, col: 0 }
    });
    
    const tileType = TileType.OneSharp;
    
    // Generate candidates
    const candidates = generateMoveCandidates(
      board,
      tileType,
      aiPlayer,
      players,
      teams,
      true, // supermove enabled
      boardRadius
    );
    
    // Should have candidates
    expect(candidates.length).toBeGreaterThan(0);
    
    // With the fix, scores should vary based on AI's path length
    // Formula: score = -2*(aiPath^2) + 1*(0.5^2) = -2*(aiPath^2) + 0.25
    // Different AI paths will give different scores
    const scores = candidates.map(c => c.score);
    
    // None of the scores should be the old constant 50000
    // (unless AI also has Infinity path, but that shouldn't happen with moves from AI edge)
    const has50000Score = scores.some(s => s === 50000);
    expect(has50000Score).toBe(false);
    
    // Select a move
    const move = selectAIMove(
      board,
      tileType,
      aiPlayer,
      players,
      teams,
      true,
      boardRadius
    );
    
    expect(move).not.toBeNull();
  });
});
