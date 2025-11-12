// Game Over screen renderer

import { GameState } from '../redux/types';

export interface RematchButton {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}

export interface PlayAgainButton {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}

export interface GameOverLayout {
  playAgainButton: PlayAgainButton;
  rematchButton: RematchButton;
}

export class GameOverRenderer {
  private layout: GameOverLayout | null = null;
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  render(canvasWidth: number, canvasHeight: number, _gameState: GameState): GameOverLayout {
    // Don't clear canvas or draw modals - just let the gameplay renderer show the board
    // with the pulsing glow animation on the winning flow.
    
    // Draw rematch button in the center bottom of the screen
    const buttonWidth = 200;
    const buttonHeight = 60;
    const buttonX = (canvasWidth - buttonWidth) / 2;
    const buttonY = canvasHeight - buttonHeight - 80; // 80px from bottom
    
    this.renderRematchButton(buttonX, buttonY, buttonWidth, buttonHeight);

    // Create layout with rematch button
    this.layout = {
      playAgainButton: {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        text: '',
      },
      rematchButton: {
        x: buttonX,
        y: buttonY,
        width: buttonWidth,
        height: buttonHeight,
        text: 'Rematch',
      },
    };

    return this.layout;
  }

  private renderRematchButton(x: number, y: number, width: number, height: number): void {
    const ctx = this.ctx;
    
    // Draw button background with rounded corners
    const radius = 10;
    ctx.fillStyle = '#4CAF50'; // Green background
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
    
    // Draw border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Draw text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Rematch', x + width / 2, y + height / 2);
  }

  getLayout(): GameOverLayout | null {
    return this.layout;
  }
}
