// Tests for game notation system

import { describe, it, expect } from 'vitest';
import {
  positionToNotation,
  rotationToOrientation,
  tileTypeToNotation,
  formatMoveNotation,
  formatMoveHistory,
  formatGameRecord,
  getPlayerNumber,
} from '../../src/game/notation';
import { TileType, Rotation } from '../../src/game/types';
import { Move } from '../../src/redux/types';

describe('Game Notation', () => {
  describe('positionToNotation', () => {
    it('should convert position to notation for player on edge 0', () => {
      // This repo uses axial coordinates from -radius to +radius
      // For player on edge 0 with radius=3:
      // Row -3 (A row) has columns 0-3, counting right to left
      // Col 3 is position 1, col 2 is position 2, col 1 is position 3, col 0 is position 4
      expect(positionToNotation({ row: -3, col: 3 }, 0, 3)).toBe('A1');
      expect(positionToNotation({ row: -3, col: 1 }, 0, 3)).toBe('A3');
      expect(positionToNotation({ row: -3, col: 0 }, 0, 3)).toBe('A4');
      // Row 0 (D row) has columns -3 to 3, counting right to left
      // Col 3 is position 1, col 0 is position 4, col -3 is position 7
      expect(positionToNotation({ row: 0, col: 3 }, 0, 3)).toBe('D1');
      expect(positionToNotation({ row: 0, col: 0 }, 0, 3)).toBe('D4');
      expect(positionToNotation({ row: 0, col: -3 }, 0, 3)).toBe('D7');
      // Row 3 (G row) has columns -3 to 0, counting right to left
      // Col 0 is position 1, col -3 is position 4
      expect(positionToNotation({ row: 3, col: 0 }, 0, 3)).toBe('G1');
      expect(positionToNotation({ row: 3, col: -3 }, 0, 3)).toBe('G4');
    });

    it('should convert center position correctly', () => {
      // Center of the board in axial coordinates is (0,0)
      // For row 0, columns range from -3 to 3, with col 0 being the 4th column
      expect(positionToNotation({ row: 0, col: 0 }, 0, 3)).toBe('D4');
    });
  });

  describe('rotationToOrientation', () => {
    it('should convert rotation 0 to S for edge 0', () => {
      expect(rotationToOrientation(0, 0)).toBe('S');
    });

    it('should convert rotation 1 to SW for edge 0', () => {
      expect(rotationToOrientation(1, 0)).toBe('SW');
    });

    it('should convert rotation 3 to N for edge 0', () => {
      expect(rotationToOrientation(3, 0)).toBe('N');
    });

    it('should adjust for player perspective', () => {
      // For edge 1, rotation 0 should appear as SE from their perspective
      expect(rotationToOrientation(0, 1)).toBe('SE');
    });

    it('should handle rotation 5 correctly for different edges', () => {
      // Rotation 5 should be SE for edge 0 and SW for edge 4
      expect(rotationToOrientation(5, 0)).toBe('SE');
      expect(rotationToOrientation(5, 4)).toBe('SW');
    });

    it('should handle rotation 0 on edge 4 correctly', () => {
      // Rotation 0 on edge 4 should be NW
      expect(rotationToOrientation(0, 4)).toBe('NW');
    });

    it('should handle rotation 2 on edge 0 correctly', () => {
      // Rotation 2 on edge 0 should be NW
      expect(rotationToOrientation(2, 0)).toBe('NW');
    });
    
    it('should handle all rotations on all edges correctly (systematic test)', () => {
      // Validated from 6-player e2e test with all edges
      expect(rotationToOrientation(0, 0)).toBe('S');   // Edge 0
      expect(rotationToOrientation(0, 1)).toBe('SE');  // Edge 1
      expect(rotationToOrientation(0, 2)).toBe('NE');  // Edge 2
      expect(rotationToOrientation(0, 3)).toBe('N');   // Edge 3
      expect(rotationToOrientation(0, 4)).toBe('NW');  // Edge 4
      expect(rotationToOrientation(0, 5)).toBe('SW');  // Edge 5
    });
  });

  describe('tileTypeToNotation', () => {
    it('should convert tile types to notation', () => {
      expect(tileTypeToNotation(TileType.NoSharps)).toBe('T0');
      expect(tileTypeToNotation(TileType.OneSharp)).toBe('T1');
      expect(tileTypeToNotation(TileType.TwoSharps)).toBe('T2');
      expect(tileTypeToNotation(TileType.ThreeSharps)).toBe('T3');
    });
  });

  describe('formatMoveNotation', () => {
    it('should format a complete move in notation', () => {
      const move: Move = {
        playerId: 'p1',
        tile: {
          type: TileType.NoSharps,
          rotation: 0 as Rotation,
          position: { row: -3, col: 3 },  // Rightmost position on edge 0 = A1
        },
        timestamp: Date.now(),
      };

      const notation = formatMoveNotation(move, 1, 0, 3);
      expect(notation).toBe('P1A1T0S');
    });

    it('should handle different tiles and rotations', () => {
      const move: Move = {
        playerId: 'p2',
        tile: {
          type: TileType.ThreeSharps,
          rotation: 3 as Rotation,
          position: { row: 0, col: 0 },
        },
        timestamp: Date.now(),
      };

      const notation = formatMoveNotation(move, 2, 1, 3);
      // For player 2 on edge 1, rotation 3 from edge 0 perspective
      expect(notation).toContain('P2');
      expect(notation).toContain('T3');
    });
  });

  describe('getPlayerNumber', () => {
    it('should return 1-based player number', () => {
      const playerIds = ['p1', 'p2', 'p3'];
      expect(getPlayerNumber('p1', playerIds)).toBe(1);
      expect(getPlayerNumber('p2', playerIds)).toBe(2);
      expect(getPlayerNumber('p3', playerIds)).toBe(3);
    });
  });

  describe('formatMoveHistory', () => {
    it('should format a list of moves', () => {
      const players = [
        { id: 'p1', edgePosition: 0 },
        { id: 'p2', edgePosition: 1 },
      ];

      const moves: Move[] = [
        {
          playerId: 'p1',
          tile: {
            type: TileType.NoSharps,
            rotation: 0 as Rotation,
            position: { row: -3, col: 3 },
          },
          timestamp: 1,
        },
        {
          playerId: 'p2',
          tile: {
            type: TileType.OneSharp,
            rotation: 1 as Rotation,
            position: { row: 0, col: 0 },
          },
          timestamp: 2,
        },
      ];

      const notations = formatMoveHistory(moves, players, 3);
      expect(notations).toHaveLength(2);
      expect(notations[0]).toContain('P1');
      expect(notations[0]).toContain('T0');
      expect(notations[1]).toContain('P2');
      expect(notations[1]).toContain('T1');
    });

    it('should handle empty move list', () => {
      const players = [{ id: 'p1', edgePosition: 0 }];
      const moves: Move[] = [];
      const notations = formatMoveHistory(moves, players, 3);
      expect(notations).toEqual([]);
    });

    it('should return empty string for invalid player ID', () => {
      const players = [{ id: 'p1', edgePosition: 0 }];
      const moves: Move[] = [
        {
          playerId: 'p_unknown',  // Invalid player
          tile: {
            type: TileType.NoSharps,
            rotation: 0 as Rotation,
            position: { row: -3, col: 3 },
          },
          timestamp: 1,
        },
      ];
      const notations = formatMoveHistory(moves, players, 3);
      expect(notations).toEqual(['']);
    });
  });

  describe('formatGameRecord', () => {
    it('should format complete game record with move numbers', () => {
      const players = [
        { id: 'p1', edgePosition: 0, color: '#0173B2' },
        { id: 'p2', edgePosition: 1, color: '#DE8F05' },
      ];

      const moves: Move[] = [
        {
          playerId: 'p1',
          tile: {
            type: TileType.NoSharps,
            rotation: 0 as Rotation,
            position: { row: -3, col: 3 },
          },
          timestamp: 1,
        },
      ];

      const record = formatGameRecord(moves, players, 3);
      expect(record).toContain('Game: 2-player');
      expect(record).toContain('1.');
      expect(record).toContain('P1');
    });
  });
});
