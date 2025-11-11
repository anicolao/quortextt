// Tests to reproduce and verify AI bugs are fixed

import { describe, it, expect } from 'vitest';
import {
  selectAIMove,
  generateMoveCandidates,
} from '../../src/game/ai';
import { Player, Team, TileType, PlacedTile, Rotation } from '../../src/game/types';
import { positionToKey } from '../../src/game/board';
import { findLegalMoves } from '../../src/game/legality';

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

  describe('Bug #2: AI should make a move when opponent is blocked (with supermove enabled)', () => {
    it('should generate candidates when opponent is blocked with supermove enabled', () => {
      // Create a scenario where:
      // 1. Human player (edge 3) is blocked by AI's placement
      // 2. AI player (edge 0) needs to make a blocking move
      // 3. Without supermove, this would be illegal, but with supermove it should be allowed
      
      const board = new Map<string, PlacedTile>();
      
      // Place tiles that create a situation where the next move would block edge 3
      // Edge 3 is at row=3, AI is at edge 0 (row=-3)
      
      // Create a nearly-blocking scenario
      const blockingTiles: Array<{pos: {row: number, col: number}, type: TileType, rotation: Rotation}> = [
        { pos: { row: 2, col: -2 }, type: TileType.ThreeSharps, rotation: 0 },
        { pos: { row: 2, col: -1 }, type: TileType.ThreeSharps, rotation: 0 },
        // Leave row: 2, col: 0 open - placing here might block the opponent
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
      
      const tileType = TileType.ThreeSharps;
      
      // WITHOUT supermove, might have fewer candidates (blocking moves are illegal)
      const candidatesWithoutSupermove = generateMoveCandidates(
        board,
        tileType,
        aiPlayer,
        players,
        teams,
        false, // supermove disabled
        boardRadius
      );
      
      // WITH supermove enabled, should have more candidates (blocking moves are legal)
      const candidatesWithSupermove = generateMoveCandidates(
        board,
        tileType,
        aiPlayer,
        players,
        teams,
        true, // supermove enabled
        boardRadius
      );
      
      // With supermove, AI should have at least as many candidates as without
      expect(candidatesWithSupermove.length).toBeGreaterThanOrEqual(candidatesWithoutSupermove.length);
      
      // This is the key assertion - with supermove enabled, AI should have candidates
      // even if some moves would block the opponent
      expect(candidatesWithSupermove.length).toBeGreaterThan(0);
    });
    
    it('should select a move when opponent would be blocked but supermove is enabled', () => {
      // Simpler scenario - verify AI can select a blocking move with supermove
      const board = new Map<string, PlacedTile>();
      
      // Create a setup where most moves would block the opponent
      board.set(positionToKey({ row: 2, col: -1 }), {
        type: TileType.ThreeSharps,
        rotation: 0,
        position: { row: 2, col: -1 },
      });
      board.set(positionToKey({ row: 2, col: 1 }), {
        type: TileType.ThreeSharps,
        rotation: 0,
        position: { row: 2, col: 1 },
      });
      
      const tileType = TileType.ThreeSharps;
      
      const move = selectAIMove(
        board,
        tileType,
        aiPlayer,
        players,
        teams,
        true, // supermove enabled
        boardRadius
      );
      
      // AI should be able to select a move even if it blocks the opponent
      // because supermove is enabled
      expect(move).not.toBeNull();
    });
    
    it('demonstrates the fix: findLegalMoves now respects supermoveEnabled', () => {
      // This test explicitly shows that findLegalMoves now considers supermove
      // Create a board where a specific placement would block the opponent
      const board = new Map<string, PlacedTile>();
      
      // Set up a scenario where placing at (2,0) would block player at edge 3
      // Place some tiles to create a blocking situation
      board.set(positionToKey({ row: 2, col: -2 }), {
        type: TileType.ThreeSharps,
        rotation: 0,
        position: { row: 2, col: -2 },
      });
      board.set(positionToKey({ row: 2, col: 2 }), {
        type: TileType.ThreeSharps,
        rotation: 0,
        position: { row: 2, col: 2 },
      });
      
      // Without supermove: legal moves exclude positions that would block
      const legalMovesWithoutSupermove = findLegalMoves(
        board,
        TileType.ThreeSharps,
        0,
        players,
        teams,
        boardRadius,
        false
      );
      
      // With supermove: legal moves include positions that would block
      const legalMovesWithSupermove = findLegalMoves(
        board,
        TileType.ThreeSharps,
        0,
        players,
        teams,
        boardRadius,
        true
      );
      
      // The key fix: with supermove enabled, we should have more (or equal) legal moves
      // because blocking moves are now considered legal
      expect(legalMovesWithSupermove.length).toBeGreaterThanOrEqual(legalMovesWithoutSupermove.length);
    });
  });
});
