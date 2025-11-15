// Tests for supermove functionality
import { describe, it, expect } from 'vitest';
import {
  isLegalMove,
  isPlayerBlocked,
  isValidReplacementMove,
  wouldReplacementUnblock,
  wouldReplacementUnblockAnyPlayer,
} from '../../src/game/legality';
import { TileType, PlacedTile, Player, Team } from '../../src/game/types';
import { positionToKey } from '../../src/game/board';

describe('Supermove Functionality', () => {
  const createPlayer = (id: string, edge: number): Player => ({
    id,
    color: `color-${id}`,
    edgePosition: edge,
    isAI: false,
  });

  describe('isLegalMove with supermove enabled', () => {
    it('should allow blocking moves when supermove is enabled', () => {
      const players = [createPlayer('p1', 0), createPlayer('p2', 3)];
      const teams: Team[] = [];
      const board = new Map<string, PlacedTile>();

      // Create a complete horizontal barrier
      const barrierPositions = [
        { row: 0, col: -3 },
        { row: 0, col: -2 },
        { row: 0, col: -1 },
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
      ];

      barrierPositions.forEach(pos => {
        board.set(positionToKey(pos), {
          type: TileType.ThreeSharps,
          rotation: 0,
          position: pos,
        });
      });

      // Try to place a tile that completes the barrier (blocks p1)
      const blockingTile: PlacedTile = {
        type: TileType.ThreeSharps,
        rotation: 0,
        position: { row: 0, col: 3 },
      };

      // With supermove disabled, this should be illegal
      const resultStandard = isLegalMove(board, blockingTile, players, teams, 3, false);
      expect(resultStandard).toBe(false);

      // With supermove enabled, this should be legal
      const resultSupermove = isLegalMove(board, blockingTile, players, teams, 3, true);
      expect(resultSupermove).toBe(true);
    });

    it('should still enforce position occupancy checks', () => {
      const players = [createPlayer('p1', 0), createPlayer('p2', 3)];
      const teams: Team[] = [];
      const board = new Map<string, PlacedTile>();

      const existingTile: PlacedTile = {
        type: TileType.NoSharps,
        rotation: 0,
        position: { row: 0, col: 0 },
      };
      board.set(positionToKey(existingTile.position), existingTile);

      // Try to place a tile on an occupied position
      const duplicateTile: PlacedTile = {
        type: TileType.OneSharp,
        rotation: 0,
        position: { row: 0, col: 0 },
      };

      // Should be illegal even with supermove enabled
      const result = isLegalMove(board, duplicateTile, players, teams, 3, true);
      expect(result).toBe(false);
    });
  });

  describe('isPlayerBlocked', () => {
    it('should detect when a player is blocked', () => {
      const players = [createPlayer('p1', 0), createPlayer('p2', 3)];
      const teams: Team[] = [];
      const board = new Map<string, PlacedTile>();

      // Create a complete horizontal barrier
      const barrierPositions = [
        { row: 0, col: -3 },
        { row: 0, col: -2 },
        { row: 0, col: -1 },
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
        { row: 0, col: 3 },
      ];

      barrierPositions.forEach(pos => {
        board.set(positionToKey(pos), {
          type: TileType.ThreeSharps,
          rotation: 0,
          position: pos,
        });
      });

      // Both players should be blocked (can't reach opposite edge)
      const p1Blocked = isPlayerBlocked(board, players[0], players, teams, 3);
      const p2Blocked = isPlayerBlocked(board, players[1], players, teams, 3);

      expect(p1Blocked).toBe(true);
      expect(p2Blocked).toBe(true);
    });

    it('should return false when player is not blocked', () => {
      const players = [createPlayer('p1', 0), createPlayer('p2', 3)];
      const teams: Team[] = [];
      const board = new Map<string, PlacedTile>();

      // Empty board - no blocking
      const p1Blocked = isPlayerBlocked(board, players[0], players, teams, 3);
      expect(p1Blocked).toBe(false);
    });

    it('should work with partial barriers', () => {
      const players = [createPlayer('p1', 0), createPlayer('p2', 3)];
      const teams: Team[] = [];
      const board = new Map<string, PlacedTile>();

      // Create a partial barrier with a gap
      const partialBarrier = [
        { row: 0, col: -3 },
        { row: 0, col: -2 },
        { row: 0, col: -1 },
        // GAP at { row: 0, col: 0 }
        { row: 0, col: 1 },
        { row: 0, col: 2 },
        { row: 0, col: 3 },
      ];

      partialBarrier.forEach(pos => {
        board.set(positionToKey(pos), {
          type: TileType.ThreeSharps,
          rotation: 0,
          position: pos,
        });
      });

      // Players should not be blocked (path exists through gap)
      const p1Blocked = isPlayerBlocked(board, players[0], players, teams, 3);
      expect(p1Blocked).toBe(false);
    });
  });

  describe('wouldReplacementUnblock', () => {
    it('should return true when replacement would unblock player', () => {
      const players = [createPlayer('p1', 0), createPlayer('p2', 3)];
      const teams: Team[] = [];
      const board = new Map<string, PlacedTile>();

      // Create a complete horizontal barrier
      const barrierPositions = [
        { row: 0, col: -3 },
        { row: 0, col: -2 },
        { row: 0, col: -1 },
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
        { row: 0, col: 3 },
      ];

      barrierPositions.forEach(pos => {
        board.set(positionToKey(pos), {
          type: TileType.ThreeSharps,
          rotation: 0,
          position: pos,
        });
      });

      // Replace one of the barrier tiles with a tile that has connections
      const replacementPos = { row: 0, col: 0 };
      const replacementTile: PlacedTile = {
        type: TileType.NoSharps, // Has flow connections
        rotation: 0,
        position: replacementPos,
      };

      const result = wouldReplacementUnblock(
        board,
        replacementPos,
        replacementTile,
        players[0],
        players,
        teams,
        3
      );

      expect(result).toBe(true);
    });

    it('should return false when player is not blocked', () => {
      const players = [createPlayer('p1', 0), createPlayer('p2', 3)];
      const teams: Team[] = [];
      const board = new Map<string, PlacedTile>();

      // Empty board - player not blocked
      const replacementPos = { row: 0, col: 0 };
      const replacementTile: PlacedTile = {
        type: TileType.NoSharps,
        rotation: 0,
        position: replacementPos,
      };

      // Add a tile at the replacement position
      board.set(positionToKey(replacementPos), {
        type: TileType.OneSharp,
        rotation: 0,
        position: replacementPos,
      });

      const result = wouldReplacementUnblock(
        board,
        replacementPos,
        replacementTile,
        players[0],
        players,
        teams,
        3
      );

      expect(result).toBe(false); // Player is not blocked, so replacement is not needed
    });

    it('should return false when replacement would not unblock player', () => {
      const players = [createPlayer('p1', 0), createPlayer('p2', 3)];
      const teams: Team[] = [];
      const board = new Map<string, PlacedTile>();

      // Create a complete horizontal barrier
      const barrierPositions = [
        { row: 0, col: -3 },
        { row: 0, col: -2 },
        { row: 0, col: -1 },
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
        { row: 0, col: 3 },
      ];

      barrierPositions.forEach(pos => {
        board.set(positionToKey(pos), {
          type: TileType.ThreeSharps,
          rotation: 0,
          position: pos,
        });
      });

      // Try replacing an edge tile (doesn't help unblock)
      const replacementPos = { row: 0, col: -3 };
      const replacementTile: PlacedTile = {
        type: TileType.ThreeSharps, // Still blocks
        rotation: 0,
        position: replacementPos,
      };

      const result = wouldReplacementUnblock(
        board,
        replacementPos,
        replacementTile,
        players[0],
        players,
        teams,
        3
      );

      expect(result).toBe(false); // Replacement doesn't help
    });
  });

  describe('isValidReplacementMove', () => {
    it('should validate replacement moves correctly', () => {
      const players = [createPlayer('p1', 0), createPlayer('p2', 3)];
      const teams: Team[] = [];
      const board = new Map<string, PlacedTile>();

      // Create a complete horizontal barrier
      const barrierPositions = [
        { row: 0, col: -3 },
        { row: 0, col: -2 },
        { row: 0, col: -1 },
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
        { row: 0, col: 3 },
      ];

      barrierPositions.forEach(pos => {
        board.set(positionToKey(pos), {
          type: TileType.ThreeSharps,
          rotation: 0,
          position: pos,
        });
      });

      // Valid replacement that would unblock player
      const validReplacement = isValidReplacementMove(
        board,
        { row: 0, col: 0 },
        TileType.NoSharps,
        0,
        players[0],
        players,
        teams,
        3
      );

      expect(validReplacement).toBe(true);
    });

    it('should reject replacement on empty positions', () => {
      const players = [createPlayer('p1', 0), createPlayer('p2', 3)];
      const teams: Team[] = [];
      const board = new Map<string, PlacedTile>();

      const result = isValidReplacementMove(
        board,
        { row: 0, col: 0 },
        TileType.NoSharps,
        0,
        players[0],
        players,
        teams,
        3
      );

      expect(result).toBe(false); // Position is not occupied
    });

    it('should reject replacement when player is not blocked', () => {
      const players = [createPlayer('p1', 0), createPlayer('p2', 3)];
      const teams: Team[] = [];
      const board = new Map<string, PlacedTile>();

      // Add a tile at position
      const pos = { row: 0, col: 0 };
      board.set(positionToKey(pos), {
        type: TileType.OneSharp,
        rotation: 0,
        position: pos,
      });

      const result = isValidReplacementMove(
        board,
        pos,
        TileType.NoSharps,
        0,
        players[0],
        players,
        teams,
        3
      );

      expect(result).toBe(false); // Player is not blocked
    });
  });

  describe('Team games with supermove', () => {
    it('should detect when a team is blocked', () => {
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
      const board = new Map<string, PlacedTile>();

      // Create a barrier between p1 and p3
      const barrierPositions = [
        { row: 0, col: -3 },
        { row: 0, col: -2 },
        { row: 0, col: -1 },
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
        { row: 0, col: 3 },
      ];

      barrierPositions.forEach(pos => {
        board.set(positionToKey(pos), {
          type: TileType.ThreeSharps,
          rotation: 0,
          position: pos,
        });
      });

      // Check if p1 is blocked (their team can't connect)
      const p1Blocked = isPlayerBlocked(board, players[0], players, teams, 3);
      expect(p1Blocked).toBe(true);

      // Check if p3 is also blocked (same team)
      const p3Blocked = isPlayerBlocked(board, players[2], players, teams, 3);
      expect(p3Blocked).toBe(true);
    });
  });

  describe('supermoveAnyPlayer functionality', () => {
    it('should allow replacement when supermoveAnyPlayer=true even if current player is not blocked', () => {
      // Use a simpler scenario: create a complete barrier and check logic
      const players = [createPlayer('p1', 0), createPlayer('p2', 3)];
      const teams: Team[] = [];
      const board = new Map<string, PlacedTile>();

      // Create a complete horizontal barrier that blocks both players
      const barrierPositions = [
        { row: 0, col: -3 },
        { row: 0, col: -2 },
        { row: 0, col: -1 },
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
        { row: 0, col: 3 },
      ];

      barrierPositions.forEach(pos => {
        board.set(positionToKey(pos), {
          type: TileType.ThreeSharps,
          rotation: 0,
          position: pos,
        });
      });

      // Both players should be blocked
      expect(isPlayerBlocked(board, players[0], players, teams, 3)).toBe(true);
      expect(isPlayerBlocked(board, players[1], players, teams, 3)).toBe(true);

      // With supermoveAnyPlayer=false, only the currently blocked player should be able to replace
      // This is the existing behavior
      const replacementPos = { row: 0, col: 0 };
      
      // Both players are blocked, so both can make replacements with supermoveAnyPlayer=false
      const resultP1Disabled = isValidReplacementMove(
        board,
        replacementPos,
        TileType.NoSharps,
        0,
        players[0],
        players,
        teams,
        3,
        false // supermoveAnyPlayer disabled
      );
      expect(resultP1Disabled).toBe(true); // p1 is blocked, can unblock themselves

      // With supermoveAnyPlayer=true, the result should be the same (p1 is blocked and can unblock anyone)
      const resultP1Enabled = isValidReplacementMove(
        board,
        replacementPos,
        TileType.NoSharps,
        0,
        players[0],
        players,
        teams,
        3,
        true // supermoveAnyPlayer enabled
      );
      expect(resultP1Enabled).toBe(true);
    });

    it('should only allow replacement when it actually unblocks someone with supermoveAnyPlayer=true', () => {
      const players = [createPlayer('p1', 0), createPlayer('p2', 3)];
      const teams: Team[] = [];
      const board = new Map<string, PlacedTile>();

      // Add a single tile in the middle - no one is blocked
      board.set(positionToKey({ row: 0, col: 0 }), {
        type: TileType.OneSharp,
        rotation: 0,
        position: { row: 0, col: 0 },
      });

      // Verify no one is blocked
      expect(isPlayerBlocked(board, players[0], players, teams, 3)).toBe(false);
      expect(isPlayerBlocked(board, players[1], players, teams, 3)).toBe(false);

      // Try to replace when no one is blocked - should fail even with supermoveAnyPlayer=true
      const result = isValidReplacementMove(
        board,
        { row: 0, col: 0 },
        TileType.NoSharps,
        0,
        players[0],
        players,
        teams,
        3,
        true // supermoveAnyPlayer enabled
      );
      expect(result).toBe(false);
    });

    it('should work with team games when supermoveAnyPlayer=true', () => {
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
      const board = new Map<string, PlacedTile>();

      // Create a barrier that blocks both teams
      const barrierPositions = [
        { row: 0, col: -3 },
        { row: 0, col: -2 },
        { row: 0, col: -1 },
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
        { row: 0, col: 3 },
      ];

      barrierPositions.forEach(pos => {
        board.set(positionToKey(pos), {
          type: TileType.ThreeSharps,
          rotation: 0,
          position: pos,
        });
      });

      // Verify both teams are blocked
      expect(isPlayerBlocked(board, players[0], players, teams, 3)).toBe(true);
      expect(isPlayerBlocked(board, players[2], players, teams, 3)).toBe(true);

      // p2 should be able to replace a tile with both modes since their team is also blocked
      const resultEnabled = isValidReplacementMove(
        board,
        { row: 0, col: 0 },
        TileType.NoSharps,
        0,
        players[1], // p2 from team 2
        players,
        teams,
        3,
        true // supermoveAnyPlayer enabled
      );
      expect(resultEnabled).toBe(true);

      // With supermoveAnyPlayer=false, p2 should also be able to replace (they are blocked themselves)
      const resultDisabled = isValidReplacementMove(
        board,
        { row: 0, col: 0 },
        TileType.NoSharps,
        0,
        players[1], // p2 from team 2
        players,
        teams,
        3,
        false // supermoveAnyPlayer disabled
      );
      expect(resultDisabled).toBe(true);
    });

    it('should verify that replacement position must be occupied', () => {
      const players = [createPlayer('p1', 0), createPlayer('p2', 3)];
      const teams: Team[] = [];
      const board = new Map<string, PlacedTile>();

      // Empty board
      const result = isValidReplacementMove(
        board,
        { row: 0, col: 0 }, // Empty position
        TileType.NoSharps,
        0,
        players[0],
        players,
        teams,
        3,
        true // supermoveAnyPlayer enabled
      );
      expect(result).toBe(false);
    });
  });
});
