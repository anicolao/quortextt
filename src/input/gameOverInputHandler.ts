// Input handling for game-over screen

import { store } from '../redux/store';
import { resetGame } from '../redux/actions';
import { GameOverLayout } from '../rendering/gameOverRenderer';

export class GameOverInputHandler {
  handleClick(x: number, y: number, layout: GameOverLayout | null): void {
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
}
