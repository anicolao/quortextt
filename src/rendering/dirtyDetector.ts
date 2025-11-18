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

    // Check for board changes
    if (this.previousState.game.board !== currentState.game.board) {
      // For now, mark entire canvas dirty
      // In later phases, we'll mark only affected tile regions
      dirtyRects.push({ x: 0, y: 0, width: canvasWidth, height: canvasHeight });
    }

    // Check for flow changes
    if (this.previousState.game.flows !== currentState.game.flows) {
      // For now, mark entire canvas dirty
      // In later phases, we'll mark only affected flow regions
      dirtyRects.push({ x: 0, y: 0, width: canvasWidth, height: canvasHeight });
    }

    // Check for selected position changes (preview tile)
    if (this.previousState.ui.selectedPosition !== currentState.ui.selectedPosition) {
      // For now, mark entire canvas dirty
      // In later phases, we'll mark only preview regions
      dirtyRects.push({ x: 0, y: 0, width: canvasWidth, height: canvasHeight });
    }

    // Check for rotation changes
    if (this.previousState.ui.currentRotation !== currentState.ui.currentRotation) {
      // For now, mark entire canvas dirty
      // In later phases, we'll mark only preview region
      dirtyRects.push({ x: 0, y: 0, width: canvasWidth, height: canvasHeight });
    }

    // Check for hover changes
    if (this.previousState.ui.hoveredElement !== currentState.ui.hoveredElement) {
      // For now, mark entire canvas dirty
      // In later phases, we'll mark only hovered element regions
      dirtyRects.push({ x: 0, y: 0, width: canvasWidth, height: canvasHeight });
    }

    // Check for animation changes
    if (this.previousState.animation.frameCounter !== currentState.animation.frameCounter) {
      // Animations are active - mark entire canvas dirty
      // In later phases, animations will register their own dirty regions
      dirtyRects.push({ x: 0, y: 0, width: canvasWidth, height: canvasHeight });
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
