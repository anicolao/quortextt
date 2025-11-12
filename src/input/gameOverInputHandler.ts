// Input handling for game-over screen

import { store } from '../redux/store';
import { resetGame, rematchGame, showHelp, hideHelp, showMoveList, hideMoveList } from '../redux/actions';
import { GameOverLayout } from '../rendering/gameOverRenderer';

export class GameOverInputHandler {
  handleClick(x: number, y: number, layout: GameOverLayout | null, canvasWidth?: number, canvasHeight?: number): void {
    const state = store.getState();
    
    // If help dialog is open, close it on any click
    if (state.ui.showHelp) {
      store.dispatch(hideHelp());
      return;
    }

    // If move list dialog is open, close it on any click
    if (state.ui.showMoveList) {
      store.dispatch(hideMoveList());
      return;
    }

    // Check for exit button clicks in corners (same as gameplay screen)
    if (canvasWidth !== undefined && canvasHeight !== undefined) {
      if (this.checkExitButtons(x, y, canvasWidth, canvasHeight)) {
        return;
      }
      
      // Check for help button clicks
      if (this.checkHelpButtons(x, y, canvasWidth, canvasHeight)) {
        return;
      }
      
      // Check for move list button clicks
      if (this.checkMoveListButtons(x, y, canvasWidth, canvasHeight)) {
        return;
      }
    }

    if (!layout) return;

    // Check if click is on any of the rematch buttons (circular buttons)
    for (const button of layout.rematchButtons) {
      const distance = Math.sqrt(
        Math.pow(x - button.x, 2) + Math.pow(y - button.y, 2)
      );
      if (distance <= button.radius) {
        // Rematch button clicked - start a rematch with the same players
        store.dispatch(rematchGame());
        return;
      }
    }

    const button = layout.playAgainButton;

    // Check if click is on the Play Again button
    if (
      x >= button.x &&
      x <= button.x + button.width &&
      y >= button.y &&
      y <= button.y + button.height
    ) {
      // Reset the game to configuration screen
      store.dispatch(resetGame());
    }
  }

  private checkExitButtons(
    x: number,
    y: number,
    canvasWidth: number,
    canvasHeight: number
  ): boolean {
    const cornerSize = 50;
    const margin = 10;

    const corners = [
      { x: margin, y: margin, width: cornerSize, height: cornerSize },
      {
        x: canvasWidth - margin - cornerSize,
        y: margin,
        width: cornerSize,
        height: cornerSize,
      },
      {
        x: canvasWidth - margin - cornerSize,
        y: canvasHeight - margin - cornerSize,
        width: cornerSize,
        height: cornerSize,
      },
      {
        x: margin,
        y: canvasHeight - margin - cornerSize,
        width: cornerSize,
        height: cornerSize,
      },
    ];

    for (const corner of corners) {
      if (
        x >= corner.x &&
        x <= corner.x + corner.width &&
        y >= corner.y &&
        y <= corner.y + corner.height
      ) {
        // Exit button clicked - reset game completely and return to lobby
        store.dispatch(resetGame());
        return true;
      }
    }

    return false;
  }

  private checkHelpButtons(
    x: number,
    y: number,
    canvasWidth: number,
    canvasHeight: number
  ): boolean {
    const cornerSize = 50;
    const margin = 10;
    const spacing = cornerSize * 0.15;

    const helpButtons = [
      { 
        // Edge 0 (bottom): bottom-left, next to exit
        centerX: margin + cornerSize / 2 + cornerSize + spacing, 
        centerY: canvasHeight - margin - cornerSize / 2,
        corner: 0,
      },
      {
        // Edge 1 (right): bottom-right, next to exit
        centerX: canvasWidth - margin - cornerSize / 2,
        centerY: canvasHeight - margin - cornerSize / 2 - cornerSize - spacing,
        corner: 1,
      },
      {
        // Edge 2 (top): top-right, next to exit
        centerX: canvasWidth - margin - cornerSize / 2 - cornerSize - spacing,
        centerY: margin + cornerSize / 2,
        corner: 2,
      },
      {
        // Edge 3 (left): top-left, next to exit
        centerX: margin + cornerSize / 2,
        centerY: margin + cornerSize / 2 + cornerSize + spacing,
        corner: 3,
      },
    ];

    const radius = cornerSize / 2;

    for (const button of helpButtons) {
      const dist = Math.sqrt(
        Math.pow(x - button.centerX, 2) + Math.pow(y - button.centerY, 2)
      );
      if (dist <= radius) {
        // Help button clicked
        store.dispatch(showHelp(button.corner as 0 | 1 | 2 | 3));
        return true;
      }
    }

    return false;
  }

  private checkMoveListButtons(
    x: number,
    y: number,
    canvasWidth: number,
    canvasHeight: number
  ): boolean {
    const cornerSize = 50;
    const margin = 10;
    const spacing = cornerSize * 0.15;
    const doubleSpacing = 2 * (cornerSize + spacing);

    const moveListButtons = [
      { 
        // Edge 0 (bottom): positioned after exit and help buttons
        centerX: margin + cornerSize / 2 + doubleSpacing, 
        centerY: canvasHeight - margin - cornerSize / 2,
        corner: 0,
      },
      {
        // Edge 1 (right): positioned after exit and help buttons
        centerX: canvasWidth - margin - cornerSize / 2,
        centerY: canvasHeight - margin - cornerSize / 2 - doubleSpacing,
        corner: 1,
      },
      {
        // Edge 2 (top): positioned after exit and help buttons
        centerX: canvasWidth - margin - cornerSize / 2 - doubleSpacing,
        centerY: margin + cornerSize / 2,
        corner: 2,
      },
      {
        // Edge 3 (left): positioned after exit and help buttons
        centerX: margin + cornerSize / 2,
        centerY: margin + cornerSize / 2 + doubleSpacing,
        corner: 3,
      },
    ];

    const radius = cornerSize / 2;

    for (const button of moveListButtons) {
      const dist = Math.sqrt(
        Math.pow(x - button.centerX, 2) + Math.pow(y - button.centerY, 2)
      );
      if (dist <= radius) {
        // Move list button clicked
        store.dispatch(showMoveList(button.corner as 0 | 1 | 2 | 3));
        return true;
      }
    }

    return false;
  }
}
