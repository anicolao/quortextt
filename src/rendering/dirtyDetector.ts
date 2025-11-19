// Dirty region detection from Redux state changes

import { RootState } from '../redux/types';
import { DirtyRect } from './dirtyRegion';
import { hexToPixel, HexLayout } from '../game/hexLayout';
import { keyToPosition } from '../game/board';

/**
 * Detects dirty regions by comparing Redux state changes
 */
export class DirtyDetector {
  private previousState: RootState | null = null;
  private layout: HexLayout | null = null;

  /**
   * Set the hex layout for calculating tile positions
   */
  setLayout(layout: HexLayout): void {
    this.layout = layout;
  }

  /**
   * Get dirty regions for active animations
   */
  private getAnimationDirtyRegions(state: RootState): DirtyRect[] {
    if (!this.layout) {
      // No layout available, mark full canvas dirty as fallback
      return [{ x: 0, y: 0, width: this.layout?.canvasWidth || 1920, height: this.layout?.canvasHeight || 1080 }];
    }

    const dirtyRects: DirtyRect[] = [];
    
    // Get flow preview data from window (set by flow animations)
    const flowPreviewData = (window as any).__FLOW_PREVIEW_DATA__ || {};
    
    // For each active flow animation segment, mark its tile area dirty
    for (const animName in flowPreviewData) {
      const segment = flowPreviewData[animName];
      if (segment && segment.position) {
        try {
          // Parse position key to get hex position
          const hexPos = keyToPosition(segment.position);
          const pixelPos = hexToPixel(hexPos, this.layout);
          
          // Create dirty rect around the hex tile
          // Use a margin to account for flow lines extending beyond tile
          const hexRadius = this.layout.size * 1.3; // Extra margin for flow connections
          const rect: DirtyRect = {
            x: Math.floor(pixelPos.x - hexRadius),
            y: Math.floor(pixelPos.y - hexRadius),
            width: Math.ceil(hexRadius * 2),
            height: Math.ceil(hexRadius * 2),
          };
          
          // Clamp to canvas bounds
          rect.x = Math.max(0, rect.x);
          rect.y = Math.max(0, rect.y);
          rect.width = Math.min(this.layout.canvasWidth - rect.x, rect.width);
          rect.height = Math.min(this.layout.canvasHeight - rect.y, rect.height);
          
          dirtyRects.push(rect);
        } catch (e) {
          // If position parsing fails, skip this segment
          console.warn('Failed to parse flow animation position:', segment.position, e);
        }
      }
    }
    
    // If we found animation dirty regions, return them
    // Otherwise, return empty array (animations may have just finished)
    return dirtyRects;
  }

  /**
   * Detect dirty regions by comparing current state with previous state
   * Returns array of dirty rectangles
   */
  detectDirtyRegions(
    currentState: RootState,
    canvasWidth: number,
    canvasHeight: number
  ): DirtyRect[] {
    // First render - everything is dirty
    if (!this.previousState) {
      this.previousState = currentState;
      return [{ x: 0, y: 0, width: canvasWidth, height: canvasHeight }];
    }

    const dirtyRects: DirtyRect[] = [];

    // Check for screen changes (full redraw)
    if (this.previousState.game.screen !== currentState.game.screen) {
      this.previousState = currentState;
      return [{ x: 0, y: 0, width: canvasWidth, height: canvasHeight }];
    }

    // Check for board changes - mark entire canvas dirty since tiles affect flows
    if (this.previousState.game.board !== currentState.game.board) {
      dirtyRects.push({ x: 0, y: 0, width: canvasWidth, height: canvasHeight });
    }

    // Check for flow changes - mark entire canvas dirty
    if (this.previousState.game.flows !== currentState.game.flows) {
      dirtyRects.push({ x: 0, y: 0, width: canvasWidth, height: canvasHeight });
    }

    // Check for selected position changes (preview tile) - mark entire canvas dirty
    if (this.previousState.ui.selectedPosition !== currentState.ui.selectedPosition) {
      dirtyRects.push({ x: 0, y: 0, width: canvasWidth, height: canvasHeight });
    }

    // Check for rotation changes - mark entire canvas dirty
    if (this.previousState.ui.currentRotation !== currentState.ui.currentRotation) {
      dirtyRects.push({ x: 0, y: 0, width: canvasWidth, height: canvasHeight });
    }

    // Check for hover changes - only mark dirty if hover actually changed, not on every frame
    // Skip marking dirty for hover changes - they don't typically change visual state
    // in this game (no visible hover effects)

    // Check for animation frame counter - get specific dirty regions for animations
    if (this.previousState.animation.frameCounter !== currentState.animation.frameCounter) {
      // Only mark dirty if animations are actually running
      if (currentState.animation.animations.length > 0) {
        // Get granular dirty regions for active animations
        const animDirtyRects = this.getAnimationDirtyRegions(currentState);
        dirtyRects.push(...animDirtyRects);
      }
      // Otherwise, don't mark dirty - idle animation frames should not trigger redraws
    }

    // Check for settings changes (debug overlays, etc.)
    if (this.previousState.ui.settings !== currentState.ui.settings) {
      // Settings changed - full redraw
      dirtyRects.push({ x: 0, y: 0, width: canvasWidth, height: canvasHeight });
    }

    // Check for dialog visibility changes
    if (
      this.previousState.ui.showHelp !== currentState.ui.showHelp ||
      this.previousState.ui.showMoveList !== currentState.ui.showMoveList
    ) {
      // Dialog visibility changed - full redraw
      dirtyRects.push({ x: 0, y: 0, width: canvasWidth, height: canvasHeight });
    }

    // Update previous state
    this.previousState = currentState;

    return dirtyRects;
  }

  /**
   * Reset detector state (e.g., when switching screens)
   */
  reset(): void {
    this.previousState = null;
  }

  /**
   * Get statistics for debugging
   */
  getStats() {
    return {
      hasBaseline: this.previousState !== null,
    };
  }
}
