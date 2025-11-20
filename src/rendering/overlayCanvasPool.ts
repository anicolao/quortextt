/**
 * Overlay Canvas Pool
 * 
 * Manages a pool of reusable overlay canvases for dirty region rendering.
 * On Pi 5, canvas GPU operations scale with canvas pixel dimensions, so rendering
 * to small overlay canvases positioned over dirty regions provides true O(dirty region)
 * performance instead of O(full canvas).
 */

import { DirtyRect } from './dirtyRegion';

export interface OverlayCanvas {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  inUse: boolean;
}

export class OverlayCanvasPool {
  private pool: OverlayCanvas[] = [];
  private container: HTMLElement;
  private maxPoolSize = 10; // Limit pool size to avoid memory issues

  constructor(container: HTMLElement) {
    this.container = container;
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

    // Size and position the canvas to match the dirty region
    this.positionOverlay(overlay, region);

    // Make visible
    overlay.canvas.style.opacity = '1';

    // Clear the canvas
    overlay.ctx.clearRect(0, 0, overlay.canvas.width, overlay.canvas.height);

    return overlay;
  }

  /**
   * Release an overlay canvas back to the pool
   */
  release(overlay: OverlayCanvas): void {
    overlay.inUse = false;
    // Hide the canvas
    overlay.canvas.style.opacity = '0';
  }

  /**
   * Hide all overlay canvases (used when doing full repaint)
   */
  hideAll(): void {
    this.pool.forEach(overlay => {
      overlay.canvas.style.opacity = '0';
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

    // Style the canvas
    canvas.style.position = 'absolute';
    canvas.style.pointerEvents = 'none'; // Don't intercept mouse events
    canvas.style.opacity = '0'; // Hidden by default
    canvas.style.zIndex = '10'; // Above main canvas
    canvas.style.imageRendering = 'auto';

    // Add to container
    this.container.appendChild(canvas);

    return { canvas, ctx, inUse: false };
  }

  /**
   * Position and size an overlay canvas to match a dirty region
   */
  private positionOverlay(overlay: OverlayCanvas, region: DirtyRect): void {
    const { canvas } = overlay;

    // Set canvas size (physical pixels)
    canvas.width = region.width;
    canvas.height = region.height;

    // Position using CSS
    canvas.style.left = `${region.x}px`;
    canvas.style.top = `${region.y}px`;
    canvas.style.width = `${region.width}px`;
    canvas.style.height = `${region.height}px`;
  }

  /**
   * Clean up all overlay canvases (call on component unmount)
   */
  destroy(): void {
    this.pool.forEach(overlay => {
      this.container.removeChild(overlay.canvas);
    });
    this.pool = [];
  }
}
