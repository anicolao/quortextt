// Dirty region tracking for optimized canvas rendering

/**
 * Represents a rectangular region that needs repainting
 */
export interface DirtyRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Tracks dirty regions on the canvas and provides optimizations
 * for merging overlapping/adjacent regions
 */
export class DirtyRegionTracker {
  private dirtyRects: DirtyRect[] = [];
  private fullRedrawNeeded: boolean = false;
  private canvasWidth: number;
  private canvasHeight: number;
  
  // Statistics for debugging
  private stats = {
    totalRegionsMarked: 0,
    totalRegionsMerged: 0,
    totalFullRedraws: 0,
  };

  constructor(canvasWidth: number, canvasHeight: number) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
  }

  /**
   * Mark a rectangular region as dirty
   */
  markDirty(rect: DirtyRect): void {
    if (this.fullRedrawNeeded) {
      return; // Already doing full redraw
    }

    // Expand slightly to avoid anti-aliasing artifacts
    const expandedRect = this.expandRect(rect, 2);
    
    this.dirtyRects.push(expandedRect);
    this.stats.totalRegionsMarked++;
  }

  /**
   * Mark the entire canvas for redraw
   */
  markFullRedraw(): void {
    this.fullRedrawNeeded = true;
    this.dirtyRects = [];
    this.stats.totalFullRedraws++;
  }

  /**
   * Get optimized list of dirty regions (merged, etc.)
   */
  getDirtyRegions(): DirtyRect[] {
    if (this.fullRedrawNeeded) {
      return [{
        x: 0,
        y: 0,
        width: this.canvasWidth,
        height: this.canvasHeight,
      }];
    }

    if (this.dirtyRects.length === 0) {
      return [];
    }

    // Merge overlapping and adjacent regions
    const merged = this.mergeRegions(this.dirtyRects);

    // Calculate total dirty area
    const totalDirtyArea = merged.reduce((sum, rect) => 
      sum + rect.width * rect.height, 0);
    const canvasArea = this.canvasWidth * this.canvasHeight;

    // If dirty area > 60% of canvas, fall back to full redraw
    if (totalDirtyArea > canvasArea * 0.6) {
      this.stats.totalFullRedraws++;
      return [{
        x: 0,
        y: 0,
        width: this.canvasWidth,
        height: this.canvasHeight,
      }];
    }

    // If too many regions, fall back to full redraw
    if (merged.length > 20) {
      this.stats.totalFullRedraws++;
      return [{
        x: 0,
        y: 0,
        width: this.canvasWidth,
        height: this.canvasHeight,
      }];
    }

    return merged;
  }

  /**
   * Check if full redraw is needed
   */
  isFullRedraw(): boolean {
    return this.fullRedrawNeeded;
  }

  /**
   * Clear all dirty regions
   */
  clear(): void {
    this.dirtyRects = [];
    this.fullRedrawNeeded = false;
  }

  /**
   * Get statistics for debugging
   */
  getStats() {
    return {
      ...this.stats,
      currentRegionCount: this.dirtyRects.length,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRegionsMarked: 0,
      totalRegionsMerged: 0,
      totalFullRedraws: 0,
    };
  }

  /**
   * Update canvas dimensions (e.g., on resize)
   */
  updateCanvasSize(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.markFullRedraw();
  }

  /**
   * Expand a rectangle by a margin (for anti-aliasing)
   */
  private expandRect(rect: DirtyRect, margin: number): DirtyRect {
    return {
      x: Math.max(0, rect.x - margin),
      y: Math.max(0, rect.y - margin),
      width: Math.min(this.canvasWidth - rect.x + margin, rect.width + margin * 2),
      height: Math.min(this.canvasHeight - rect.y + margin, rect.height + margin * 2),
    };
  }

  /**
   * Merge overlapping and adjacent rectangles
   */
  private mergeRegions(rects: DirtyRect[]): DirtyRect[] {
    if (rects.length <= 1) {
      return [...rects];
    }

    const merged: DirtyRect[] = [];
    const sorted = [...rects].sort((a, b) => a.x - b.x || a.y - b.y);

    let current = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i];

      // Check if rectangles overlap or are adjacent
      if (this.rectionsOverlapOrAdjacent(current, next)) {
        // Merge them
        current = this.mergeTwo(current, next);
        this.stats.totalRegionsMerged++;
      } else {
        // No overlap, add current to result and move to next
        merged.push(current);
        current = next;
      }
    }

    // Add the last rectangle
    merged.push(current);

    // If we merged some, try again (may enable further merges)
    if (merged.length < rects.length && merged.length > 1) {
      return this.mergeRegions(merged);
    }

    return merged;
  }

  /**
   * Check if two rectangles overlap or are adjacent
   */
  private rectionsOverlapOrAdjacent(a: DirtyRect, b: DirtyRect): boolean {
    // Allow small gap (5px) to merge nearby regions
    const gap = 5;
    
    const aRight = a.x + a.width;
    const aBottom = a.y + a.height;
    const bRight = b.x + b.width;
    const bBottom = b.y + b.height;

    // Check if they overlap or are close on both axes
    const xOverlap = !(aRight + gap < b.x || bRight + gap < a.x);
    const yOverlap = !(aBottom + gap < b.y || bBottom + gap < a.y);

    return xOverlap && yOverlap;
  }

  /**
   * Merge two rectangles into their bounding box
   */
  private mergeTwo(a: DirtyRect, b: DirtyRect): DirtyRect {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const right = Math.max(a.x + a.width, b.x + b.width);
    const bottom = Math.max(a.y + a.height, b.y + b.height);

    return {
      x,
      y,
      width: right - x,
      height: bottom - y,
    };
  }
}
