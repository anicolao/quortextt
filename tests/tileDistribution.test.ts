// Unit tests for tile distribution calculation based on board radius

import { describe, it, expect } from 'vitest';
import { calculateHexCount, calculateTileDistribution } from '../src/redux/gameReducer';

describe('Tile Distribution', () => {
  describe('calculateHexCount', () => {
    it('should calculate correct hex count for radius 1', () => {
      // 1 + 3*1*(1+1) = 1 + 6 = 7
      expect(calculateHexCount(1)).toBe(7);
    });

    it('should calculate correct hex count for radius 2', () => {
      // 1 + 3*2*(2+1) = 1 + 18 = 19
      expect(calculateHexCount(2)).toBe(19);
    });

    it('should calculate correct hex count for radius 3', () => {
      // 1 + 3*3*(3+1) = 1 + 36 = 37
      expect(calculateHexCount(3)).toBe(37);
    });

    it('should calculate correct hex count for radius 4', () => {
      // 1 + 3*4*(4+1) = 1 + 60 = 61
      expect(calculateHexCount(4)).toBe(61);
    });

    it('should calculate correct hex count for radius 5', () => {
      // 1 + 3*5*(5+1) = 1 + 90 = 91
      expect(calculateHexCount(5)).toBe(91);
    });
  });

  describe('calculateTileDistribution', () => {
    it('should calculate correct distribution for radius 1 (7 hexes -> 8 tiles)', () => {
      const distribution = calculateTileDistribution(1);
      expect(distribution).toEqual([2, 2, 2, 2]);
      expect(distribution.reduce((a, b) => a + b, 0)).toBe(8);
    });

    it('should calculate correct distribution for radius 2 (19 hexes -> 20 tiles)', () => {
      const distribution = calculateTileDistribution(2);
      expect(distribution).toEqual([5, 5, 5, 5]);
      expect(distribution.reduce((a, b) => a + b, 0)).toBe(20);
    });

    it('should calculate correct distribution for radius 3 (37 hexes -> 40 tiles)', () => {
      const distribution = calculateTileDistribution(3);
      expect(distribution).toEqual([10, 10, 10, 10]);
      expect(distribution.reduce((a, b) => a + b, 0)).toBe(40);
    });

    it('should calculate correct distribution for radius 4 (61 hexes -> 64 tiles)', () => {
      const distribution = calculateTileDistribution(4);
      expect(distribution).toEqual([16, 16, 16, 16]);
      expect(distribution.reduce((a, b) => a + b, 0)).toBe(64);
    });

    it('should calculate correct distribution for radius 5 (91 hexes -> 92 tiles)', () => {
      const distribution = calculateTileDistribution(5);
      expect(distribution).toEqual([23, 23, 23, 23]);
      expect(distribution.reduce((a, b) => a + b, 0)).toBe(92);
    });

    it('should always produce a total tile count that is multiple of 4', () => {
      for (let radius = 1; radius <= 10; radius++) {
        const distribution = calculateTileDistribution(radius);
        const totalTiles = distribution.reduce((a, b) => a + b, 0);
        expect(totalTiles % 4).toBe(0);
      }
    });

    it('should always have equal number of each tile type', () => {
      for (let radius = 1; radius <= 10; radius++) {
        const [noSharps, oneSharp, twoSharps, threeSharps] = calculateTileDistribution(radius);
        expect(noSharps).toBe(oneSharp);
        expect(oneSharp).toBe(twoSharps);
        expect(twoSharps).toBe(threeSharps);
      }
    });

    it('should produce tile count >= hex count', () => {
      for (let radius = 1; radius <= 10; radius++) {
        const hexCount = calculateHexCount(radius);
        const distribution = calculateTileDistribution(radius);
        const totalTiles = distribution.reduce((a, b) => a + b, 0);
        expect(totalTiles).toBeGreaterThanOrEqual(hexCount);
      }
    });

    it('should not exceed hex count by more than 3 tiles', () => {
      for (let radius = 1; radius <= 10; radius++) {
        const hexCount = calculateHexCount(radius);
        const distribution = calculateTileDistribution(radius);
        const totalTiles = distribution.reduce((a, b) => a + b, 0);
        expect(totalTiles - hexCount).toBeLessThanOrEqual(3);
      }
    });
  });
});
