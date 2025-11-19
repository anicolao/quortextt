// Unit tests for dirty region tracking
import { describe, it, expect, beforeEach } from 'vitest';
import { DirtyRegionTracker } from '../../src/rendering/dirtyRegion';

describe('DirtyRegionTracker', () => {
  let tracker: DirtyRegionTracker;

  beforeEach(() => {
    tracker = new DirtyRegionTracker(1920, 1080);
  });

  describe('Basic functionality', () => {
    it('should start with no dirty regions', () => {
      const regions = tracker.getDirtyRegions();
      expect(regions).toHaveLength(0);
    });

    it('should track a single dirty region', () => {
      tracker.markDirty({ x: 100, y: 100, width: 50, height: 50 });
      const regions = tracker.getDirtyRegions();
      expect(regions).toHaveLength(1);
      expect(regions[0]).toMatchObject({
        x: expect.any(Number),
        y: expect.any(Number),
        width: expect.any(Number),
        height: expect.any(Number),
      });
    });

    it('should merge overlapping regions', () => {
      tracker.markDirty({ x: 100, y: 100, width: 50, height: 50 });
      tracker.markDirty({ x: 120, y: 120, width: 50, height: 50 });
      const regions = tracker.getDirtyRegions();
      expect(regions.length).toBeLessThanOrEqual(1);
    });

    it('should clear all dirty regions', () => {
      tracker.markDirty({ x: 100, y: 100, width: 50, height: 50 });
      tracker.clear();
      const regions = tracker.getDirtyRegions();
      expect(regions).toHaveLength(0);
    });

    it('should mark full redraw', () => {
      tracker.markFullRedraw();
      expect(tracker.isFullRedraw()).toBe(true);
      const regions = tracker.getDirtyRegions();
      expect(regions).toHaveLength(1);
      expect(regions[0]).toEqual({
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
      });
    });
  });

  describe('Optimization behavior', () => {
    it('should fall back to full redraw when dirty area > 60%', () => {
      // Mark a large region covering > 60% of canvas
      tracker.markDirty({ x: 0, y: 0, width: 1920, height: 700 });
      const regions = tracker.getDirtyRegions();
      expect(regions).toHaveLength(1);
      expect(regions[0]).toEqual({
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
      });
    });

    it('should fall back to full redraw when > 20 regions', () => {
      // Mark 25 separate regions
      for (let i = 0; i < 25; i++) {
        tracker.markDirty({ x: i * 100, y: i * 40, width: 10, height: 10 });
      }
      const regions = tracker.getDirtyRegions();
      expect(regions).toHaveLength(1);
      expect(regions[0]).toEqual({
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
      });
    });

    it('should expand regions for anti-aliasing', () => {
      tracker.markDirty({ x: 100, y: 100, width: 50, height: 50 });
      const regions = tracker.getDirtyRegions();
      expect(regions[0].x).toBeLessThan(100);
      expect(regions[0].y).toBeLessThan(100);
      expect(regions[0].width).toBeGreaterThan(50);
      expect(regions[0].height).toBeGreaterThan(50);
    });
  });

  describe('Canvas resize', () => {
    it('should update canvas size and mark full redraw', () => {
      tracker.updateCanvasSize(800, 600);
      expect(tracker.isFullRedraw()).toBe(true);
      const regions = tracker.getDirtyRegions();
      expect(regions[0]).toEqual({
        x: 0,
        y: 0,
        width: 800,
        height: 600,
      });
    });
  });

  describe('Statistics', () => {
    it('should track statistics', () => {
      tracker.markDirty({ x: 100, y: 100, width: 50, height: 50 });
      tracker.markDirty({ x: 120, y: 120, width: 50, height: 50 });
      const stats = tracker.getStats();
      expect(stats.totalRegionsMarked).toBe(2);
      expect(stats.totalRegionsMerged).toBeGreaterThanOrEqual(0);
    });

    it('should reset statistics', () => {
      tracker.markDirty({ x: 100, y: 100, width: 50, height: 50 });
      tracker.resetStats();
      const stats = tracker.getStats();
      expect(stats.totalRegionsMarked).toBe(0);
      expect(stats.totalRegionsMerged).toBe(0);
      expect(stats.totalFullRedraws).toBe(0);
    });
  });
});
