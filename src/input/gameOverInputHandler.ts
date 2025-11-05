// Input handling for game-over screen

import { store } from '../redux/store';
import { resetGame } from '../redux/actions';
import { GameOverLayout } from '../rendering/gameOverRenderer';

export class GameOverInputHandler {
  handleClick(x: number, y: number, layout: GameOverLayout | null, canvasWidth?: number, canvasHeight?: number): void {
    // Check for exit button clicks in corners (same as gameplay screen)
    if (canvasWidth !== undefined && canvasHeight !== undefined) {
      if (this.checkExitButtons(x, y, canvasWidth, canvasHeight)) {
        return;
      }
    }

    if (!layout) return;

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
}
