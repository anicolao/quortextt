// Layer caching for static canvas content

/**
 * Manages off-screen canvas caches for static rendering layers
 */
export class LayerCache {
  private backgroundCanvas: HTMLCanvasElement | null = null;
  private boardCanvas: HTMLCanvasElement | null = null;
  private tilesCanvas: HTMLCanvasElement | null = null;
  
  private canvasWidth: number;
  private canvasHeight: number;
  
  // Statistics for debugging
  private stats = {
    backgroundHits: 0,
    backgroundMisses: 0,
    boardHits: 0,
    boardMisses: 0,
    tilesHits: 0,
    tilesMisses: 0,
  };

  constructor(canvasWidth: number, canvasHeight: number) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
  }

  /**
   * Get or create background layer canvas
   */
  getOrRenderBackground(renderFn: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
    if (this.backgroundCanvas) {
      this.stats.backgroundHits++;
      return this.backgroundCanvas;
    }

    this.stats.backgroundMisses++;
    this.backgroundCanvas = this.createCanvas();
    const ctx = this.backgroundCanvas.getContext('2d');
    if (ctx) {
      renderFn(ctx);
    }
    return this.backgroundCanvas;
  }

  /**
   * Get or create board layer canvas
   */
  getOrRenderBoard(renderFn: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
    if (this.boardCanvas) {
      this.stats.boardHits++;
      return this.boardCanvas;
    }

    this.stats.boardMisses++;
    this.boardCanvas = this.createCanvas();
    const ctx = this.boardCanvas.getContext('2d');
    if (ctx) {
      renderFn(ctx);
    }
    return this.boardCanvas;
  }

  /**
   * Get or create tiles layer canvas
   */
  getOrRenderTiles(renderFn: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
    if (this.tilesCanvas) {
      this.stats.tilesHits++;
      return this.tilesCanvas;
    }

    this.stats.tilesMisses++;
    this.tilesCanvas = this.createCanvas();
    const ctx = this.tilesCanvas.getContext('2d');
    if (ctx) {
      renderFn(ctx);
    }
    return this.tilesCanvas;
  }

  /**
   * Invalidate background layer cache
   */
  invalidateBackground(): void {
    this.backgroundCanvas = null;
  }

  /**
   * Invalidate board layer cache
   */
  invalidateBoard(): void {
    this.boardCanvas = null;
  }

  /**
   * Invalidate tiles layer cache
   */
  invalidateTiles(): void {
    this.tilesCanvas = null;
  }

  /**
   * Invalidate all caches
   */
  invalidateAll(): void {
    this.backgroundCanvas = null;
    this.boardCanvas = null;
    this.tilesCanvas = null;
  }

  /**
   * Get statistics for debugging
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      backgroundHits: 0,
      backgroundMisses: 0,
      boardHits: 0,
      boardMisses: 0,
      tilesHits: 0,
      tilesMisses: 0,
    };
  }

  /**
   * Update canvas dimensions (invalidates all caches)
   */
  updateCanvasSize(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.invalidateAll();
  }

  /**
   * Create a new off-screen canvas with current dimensions
   */
  private createCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.canvasWidth;
    canvas.height = this.canvasHeight;
    return canvas;
  }

  /**
   * Get estimated memory usage in MB
   */
  getMemoryUsage(): number {
    let count = 0;
    if (this.backgroundCanvas) count++;
    if (this.boardCanvas) count++;
    if (this.tilesCanvas) count++;
    
    // Each pixel = 4 bytes (RGBA)
    const bytesPerCanvas = this.canvasWidth * this.canvasHeight * 4;
    const totalBytes = bytesPerCanvas * count;
    return totalBytes / (1024 * 1024); // Convert to MB
  }
}
