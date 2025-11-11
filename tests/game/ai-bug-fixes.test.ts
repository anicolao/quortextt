// Tests to reproduce and verify AI bugs are fixed

import { describe, it, expect } from 'vitest';
import {
  selectAIMove,
  generateMoveCandidates,
} from '../../src/game/ai';
import { Player, Team, TileType, PlacedTile, Rotation } from '../../src/game/types';
import { positionToKey } from '../../src/game/board';

describe('AI Bug Fixes', () => {
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

  describe('Bug #1: AI should make a move on the very first move of the game', () => {
    it('should generate candidates for an empty board (first move)', () => {
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
      
      // Should have candidates even on empty board
      expect(candidates.length).toBeGreaterThan(0);
      
      // All candidates should be valid positions
      for (const candidate of candidates) {
        expect(candidate.position).toBeDefined();
        expect(candidate.rotation).toBeGreaterThanOrEqual(0);
        expect(candidate.rotation).toBeLessThan(6);
      }
    });
    
    it('should select a move on empty board (first move)', () => {
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
  });

  describe('Bug #2: AI should make a move when opponent is blocked', () => {
    it('should generate candidates when opponent is blocked but AI has legal moves elsewhere', () => {
      // Create a scenario where:
      // 1. Human player (edge 3) is blocked
      // 2. AI player (edge 0) has legal moves, but not adjacent to existing flows
      
      const board = new Map<string, PlacedTile>();
      
      // Place tiles that block the human player at edge 3
      // Edge 3 positions are at row=3, col=[-3,-2,-1,0,1,2,3]
      // Let's block them by placing tiles that don't allow flow
      
      // Create a wall that blocks edge 3
      const blockingTiles: Array<{pos: {row: number, col: number}, type: TileType, rotation: Rotation}> = [
        { pos: { row: 2, col: -2 }, type: TileType.ThreeSharps, rotation: 0 },
        { pos: { row: 2, col: -1 }, type: TileType.ThreeSharps, rotation: 0 },
        { pos: { row: 2, col: 0 }, type: TileType.ThreeSharps, rotation: 0 },
        { pos: { row: 2, col: 1 }, type: TileType.ThreeSharps, rotation: 0 },
        { pos: { row: 2, col: 2 }, type: TileType.ThreeSharps, rotation: 0 },
      ];
      
      for (const tile of blockingTiles) {
        board.set(positionToKey(tile.pos), {
          type: tile.type,
          rotation: tile.rotation,
          position: tile.pos,
        });
      }
      
      // The AI at edge 0 should still be able to place tiles
      // even if they're not adjacent to the blocking wall
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
      
      // AI should have candidates even though opponent is blocked
      // and some legal moves might not be adjacent to existing tiles
      expect(candidates.length).toBeGreaterThan(0);
    });
    
    it('should select a move when opponent is blocked', () => {
      // Similar scenario but simpler - just verify AI can select a move
      const board = new Map<string, PlacedTile>();
      
      // Place a few tiles that block one player
      board.set(positionToKey({ row: 2, col: 0 }), {
        type: TileType.ThreeSharps,
        rotation: 0,
        position: { row: 2, col: 0 },
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
      
      // AI should be able to select a move
      expect(move).not.toBeNull();
    });
  });
});
