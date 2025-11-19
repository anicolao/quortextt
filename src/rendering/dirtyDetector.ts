// Dirty region detection from Redux state changes

import { RootState } from '../redux/types';
import { DirtyRect } from './dirtyRegion';

/**
 * Detects dirty regions by comparing Redux state changes
 */
export class DirtyDetector {
  private previousState: RootState | null = null;

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

    // Check for animation frame counter - only mark dirty if there are actual animations
    if (this.previousState.animation.frameCounter !== currentState.animation.frameCounter) {
      // Only mark dirty if animations are actually running
      if (currentState.animation.animations.length > 0) {
        dirtyRects.push({ x: 0, y: 0, width: canvasWidth, height: canvasHeight });
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
