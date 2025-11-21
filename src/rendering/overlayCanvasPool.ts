/**
 * Overlay Canvas Pool
 * 
 * Manages a pool of reusable off-screen canvases for dirty region rendering.
 * On Pi 5, canvas GPU operations scale with canvas pixel dimensions, so rendering
 * to small overlay canvases positioned over dirty regions provides true O(dirty region)
 * performance instead of O(full canvas).
 *
 * Note: These canvases are NOT added to the DOM. They serve as off-screen buffers
 * which are then blitted to the main canvas. Adding them to the DOM caused
 * performance issues due to layout/compositing overhead.
 */

import { DirtyRect } from './dirtyRegion';

export interface OverlayCanvas {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  inUse: boolean;
}

export class OverlayCanvasPool {
  private pool: OverlayCanvas[] = [];
  private maxPoolSize = 10; // Limit pool size to avoid memory issues

  constructor() {
    // No container needed as we use off-screen canvases
  }

  /**
   * Get an overlay canvas from the pool, or create a new one if needed
   */
  acquire(region: DirtyRect): OverlayCanvas {
    // Try to find an unused canvas in the pool
    let overlay = this.pool.find(o => !o.inUse);

    if (!overlay) {
      // Create a new overlay canvas if pool not exhausted
      if (this.pool.length < this.maxPoolSize) {
        overlay = this.createOverlayCanvas();
        this.pool.push(overlay);
      } else {
        // Pool exhausted, reuse the first one (shouldn't happen with reasonable region counts)
        overlay = this.pool[0];
        console.warn('Overlay canvas pool exhausted, reusing canvas');
      }
    }

    // Mark as in use
    overlay.inUse = true;

    // Set canvas size (physical pixels)
    // Setting width/height clears the canvas content and resets context state
    overlay.canvas.width = region.width;
    overlay.canvas.height = region.height;

    return overlay;
  }

  /**
   * Release an overlay canvas back to the pool
   */
  release(overlay: OverlayCanvas): void {
    overlay.inUse = false;
  }

  /**
   * Reset all overlay canvases (used when doing full repaint)
   */
  hideAll(): void {
    this.pool.forEach(overlay => {
      overlay.inUse = false;
    });
  }

  /**
   * Create a new overlay canvas element
   */
  private createOverlayCanvas(): OverlayCanvas {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: true });

    if (!ctx) {
      throw new Error('Failed to get 2D context for overlay canvas');
    }

    // We don't style the canvas or add it to DOM anymore

    return { canvas, ctx, inUse: false };
  }

  /**
   * Clean up all overlay canvases (call on component unmount)
   */
  destroy(): void {
    this.pool = [];
  }
}
