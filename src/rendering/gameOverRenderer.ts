// Game Over screen renderer

import { GameState } from '../redux/types';

export interface PlayAgainButton {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}

export interface GameOverLayout {
  playAgainButton: PlayAgainButton;
}

export class GameOverRenderer {
  private layout: GameOverLayout | null = null;

  constructor(_ctx: CanvasRenderingContext2D) {
    // Context not needed since we don't render anything
  }

  render(_canvasWidth: number, _canvasHeight: number, _gameState: GameState): GameOverLayout {
    // Don't clear canvas or draw modals - just let the gameplay renderer show the board
    // with the pulsing glow animation on the winning flow.
    // Players can use the existing 'x' buttons in corners to exit.

    // Create empty layout (no buttons needed, using existing exit buttons)
    this.layout = {
      playAgainButton: {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        text: '',
      },
    };

    return this.layout;
  }

  getLayout(): GameOverLayout | null {
    return this.layout;
  }
}
