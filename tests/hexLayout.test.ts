// Tests for hexLayout utilities

import { describe, it, expect } from 'vitest';
import { calculateBoardRadiusMultiplier, calculateCanvasSizeMultiplier } from '../src/rendering/hexLayout';

describe('HexLayout Utilities', () => {
  describe('calculateBoardRadiusMultiplier', () => {
    it('should calculate correct multiplier for default board size (3)', () => {
      const result = calculateBoardRadiusMultiplier(3);
      expect(result).toBe(7.2);
    });

    it('should calculate correct multiplier for board size 2', () => {
      const result = calculateBoardRadiusMultiplier(2);
      expect(result).toBe(5.2); // 2 * 2 + 1.2
    });

    it('should calculate correct multiplier for board size 4', () => {
      const result = calculateBoardRadiusMultiplier(4);
      expect(result).toBe(9.2); // 4 * 2 + 1.2
    });

    it('should calculate correct multiplier for board size 5', () => {
      const result = calculateBoardRadiusMultiplier(5);
      expect(result).toBe(11.2); // 5 * 2 + 1.2
    });

    it('should calculate correct multiplier for board size 1', () => {
      const result = calculateBoardRadiusMultiplier(1);
      expect(result).toBe(3.2); // 1 * 2 + 1.2
    });
  });

  describe('calculateCanvasSizeMultiplier', () => {
    it('should calculate correct multiplier for default board size (3)', () => {
      const result = calculateCanvasSizeMultiplier(3);
      expect(result).toBe(17); // ((3 * 2 + 2) * 2 + 1)
    });

    it('should calculate correct multiplier for board size 2', () => {
      const result = calculateCanvasSizeMultiplier(2);
      expect(result).toBe(13); // ((2 * 2 + 2) * 2 + 1)
    });

    it('should calculate correct multiplier for board size 4', () => {
      const result = calculateCanvasSizeMultiplier(4);
      expect(result).toBe(21); // ((4 * 2 + 2) * 2 + 1)
    });

    it('should calculate correct multiplier for board size 5', () => {
      const result = calculateCanvasSizeMultiplier(5);
      expect(result).toBe(25); // ((5 * 2 + 2) * 2 + 1)
    });

    it('should calculate correct multiplier for board size 1', () => {
      const result = calculateCanvasSizeMultiplier(1);
      expect(result).toBe(9); // ((1 * 2 + 2) * 2 + 1)
    });
  });
});
