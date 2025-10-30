// Unit tests for board utilities

import { describe, it, expect } from 'vitest';
import {
  positionToKey,
  keyToPosition,
  getAllBoardPositions,
  isValidPosition,
  getNeighborInDirection,
  getNeighbors,
  getDirection,
  getOppositeDirection,
  getEdgePositions,
  getOppositeEdge,
} from '../../src/game/board';
import { Direction } from '../../src/game/types';

describe('board utilities', () => {
  describe('positionToKey and keyToPosition', () => {
    it('should convert position to key', () => {
      expect(positionToKey({ row: 0, col: 0 })).toBe('0,0');
      expect(positionToKey({ row: -3, col: 2 })).toBe('-3,2');
      expect(positionToKey({ row: 3, col: -1 })).toBe('3,-1');
    });

    it('should convert key to position', () => {
      expect(keyToPosition('0,0')).toEqual({ row: 0, col: 0 });
      expect(keyToPosition('-3,2')).toEqual({ row: -3, col: 2 });
      expect(keyToPosition('3,-1')).toEqual({ row: 3, col: -1 });
    });

    it('should round-trip correctly', () => {
      const pos = { row: 2, col: -3 };
      expect(keyToPosition(positionToKey(pos))).toEqual(pos);
    });
  });

  describe('getAllBoardPositions', () => {
    it('should return exactly 37 positions', () => {
      const positions = getAllBoardPositions();
      expect(positions.length).toBe(37);
    });

    it('should include center position', () => {
      const positions = getAllBoardPositions();
      expect(positions).toContainEqual({ row: 0, col: 0 });
    });

    it('should include corner positions', () => {
      const positions = getAllBoardPositions();
      expect(positions).toContainEqual({ row: -3, col: 0 });
      expect(positions).toContainEqual({ row: 0, col: 3 });
      expect(positions).toContainEqual({ row: 3, col: 0 });
      expect(positions).toContainEqual({ row: 0, col: -3 });
    });

    it('should not include invalid positions', () => {
      const positions = getAllBoardPositions();
      expect(positions).not.toContainEqual({ row: -4, col: 0 });
      expect(positions).not.toContainEqual({ row: 0, col: 4 });
      expect(positions).not.toContainEqual({ row: -3, col: -3 });
    });
  });

  describe('isValidPosition', () => {
    it('should return true for center', () => {
      expect(isValidPosition({ row: 0, col: 0 })).toBe(true);
    });

    it('should return true for edge positions', () => {
      expect(isValidPosition({ row: -3, col: 0 })).toBe(true);
      expect(isValidPosition({ row: 0, col: 3 })).toBe(true);
      expect(isValidPosition({ row: 3, col: 0 })).toBe(true);
      expect(isValidPosition({ row: 0, col: -3 })).toBe(true);
    });

    it('should return false for out-of-bounds positions', () => {
      expect(isValidPosition({ row: -4, col: 0 })).toBe(false);
      expect(isValidPosition({ row: 0, col: 4 })).toBe(false);
      expect(isValidPosition({ row: 4, col: 0 })).toBe(false);
      expect(isValidPosition({ row: 0, col: -4 })).toBe(false);
    });

    it('should return false for positions outside diamond shape', () => {
      expect(isValidPosition({ row: -3, col: -3 })).toBe(false);
      expect(isValidPosition({ row: 3, col: 3 })).toBe(false);
      expect(isValidPosition({ row: -3, col: -1 })).toBe(false);
    });
  });

  describe('getNeighborInDirection', () => {
    it('should get neighbor in SouthWest direction', () => {
      const neighbor = getNeighborInDirection({ row: 0, col: 0 }, Direction.SouthWest);
      expect(neighbor).toEqual({ row: -1, col: 0 });
    });

    it('should get neighbor in East direction', () => {
      const neighbor = getNeighborInDirection({ row: 0, col: 0 }, Direction.East);
      expect(neighbor).toEqual({ row: 0, col: 1 });
    });

    it('should get neighbor in NorthWest direction', () => {
      const neighbor = getNeighborInDirection({ row: 0, col: 0 }, Direction.NorthWest);
      expect(neighbor).toEqual({ row: 1, col: -1 });
    });

    it('should work from non-center positions', () => {
      const neighbor = getNeighborInDirection({ row: 2, col: -1 }, Direction.West);
      expect(neighbor).toEqual({ row: 2, col: -2 });
    });
  });

  describe('getNeighbors', () => {
    it('should return 6 neighbors for center position', () => {
      const neighbors = getNeighbors({ row: 0, col: 0 });
      expect(neighbors.length).toBe(6);
    });

    it('should return fewer neighbors for edge positions', () => {
      const neighbors = getNeighbors({ row: -3, col: 0 });
      expect(neighbors.length).toBeLessThan(6);
    });

    it('should return only valid neighbors', () => {
      const neighbors = getNeighbors({ row: 0, col: 0 });
      neighbors.forEach((neighbor) => {
        expect(isValidPosition(neighbor)).toBe(true);
      });
    });

    it('should return 3 neighbors for corner position', () => {
      const neighbors = getNeighbors({ row: -3, col: 0 });
      expect(neighbors.length).toBe(3);
    });
  });

  describe('getDirection', () => {
    it('should return direction between adjacent positions', () => {
      expect(getDirection({ row: 0, col: 0 }, { row: 0, col: 1 })).toBe(Direction.East);
      expect(getDirection({ row: 0, col: 0 }, { row: 1, col: 0 })).toBe(Direction.NorthEast);
      expect(getDirection({ row: 0, col: 0 }, { row: 0, col: -1 })).toBe(Direction.West);
    });

    it('should return null for non-adjacent positions', () => {
      expect(getDirection({ row: 0, col: 0 }, { row: 2, col: 2 })).toBe(null);
      expect(getDirection({ row: 0, col: 0 }, { row: 3, col: 0 })).toBe(null);
    });

    it('should work in reverse', () => {
      expect(getDirection({ row: 0, col: 1 }, { row: 0, col: 0 })).toBe(Direction.West);
    });
  });

  describe('getOppositeDirection', () => {
    it('should return opposite directions correctly', () => {
      expect(getOppositeDirection(Direction.East)).toBe(Direction.West);
      expect(getOppositeDirection(Direction.West)).toBe(Direction.East);
      expect(getOppositeDirection(Direction.NorthEast)).toBe(Direction.SouthWest);
      expect(getOppositeDirection(Direction.SouthWest)).toBe(Direction.NorthEast);
      expect(getOppositeDirection(Direction.NorthWest)).toBe(Direction.SouthEast);
      expect(getOppositeDirection(Direction.SouthEast)).toBe(Direction.NorthWest);
    });
  });

  describe('getEdgePositions', () => {
    it('should return 4 positions for each edge', () => {
      for (let edge = 0; edge < 6; edge++) {
        const positions = getEdgePositions(edge);
        expect(positions.length).toBe(4);
      }
    });

    it('should return all valid positions', () => {
      for (let edge = 0; edge < 6; edge++) {
        const positions = getEdgePositions(edge);
        positions.forEach((pos) => {
          expect(isValidPosition(pos)).toBe(true);
        });
      }
    });

    it('should have no overlap between opposite edges', () => {
      for (let edge = 0; edge < 3; edge++) {
        const edge1Positions = getEdgePositions(edge);
        const edge2Positions = getEdgePositions(edge + 3);
        
        const edge1Keys = new Set(edge1Positions.map(positionToKey));
        const edge2Keys = new Set(edge2Positions.map(positionToKey));
        
        edge1Keys.forEach((key) => {
          expect(edge2Keys.has(key)).toBe(false);
        });
      }
    });
  });

  describe('getOppositeEdge', () => {
    it('should return correct opposite edges', () => {
      expect(getOppositeEdge(0)).toBe(3);
      expect(getOppositeEdge(1)).toBe(4);
      expect(getOppositeEdge(2)).toBe(5);
      expect(getOppositeEdge(3)).toBe(0);
      expect(getOppositeEdge(4)).toBe(1);
      expect(getOppositeEdge(5)).toBe(2);
    });

    it('should be reflexive', () => {
      for (let edge = 0; edge < 6; edge++) {
        expect(getOppositeEdge(getOppositeEdge(edge))).toBe(edge);
      }
    });
  });
});
