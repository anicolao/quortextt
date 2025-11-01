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
  private ctx: CanvasRenderingContext2D;
  private layout: GameOverLayout | null = null;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  render(canvasWidth: number, canvasHeight: number, _gameState: GameState): GameOverLayout {
    // Clear canvas
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw title
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 48px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('Victory not implemented yet!', canvasWidth / 2, canvasHeight / 2 - 60);

    // Draw Play Again button
    const buttonWidth = 200;
    const buttonHeight = 60;
    const buttonX = (canvasWidth - buttonWidth) / 2;
    const buttonY = canvasHeight / 2 + 40;

    // Button background
    this.ctx.fillStyle = '#4CAF50';
    this.ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);

    // Button border
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);

    // Button text
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 24px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('Play Again', buttonX + buttonWidth / 2, buttonY + buttonHeight / 2);

    // Create layout for input handling
    this.layout = {
      playAgainButton: {
        x: buttonX,
        y: buttonY,
        width: buttonWidth,
        height: buttonHeight,
        text: 'Play Again',
      },
    };

    return this.layout;
  }

  getLayout(): GameOverLayout | null {
    return this.layout;
  }
}
