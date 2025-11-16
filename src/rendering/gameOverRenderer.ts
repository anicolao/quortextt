// Game Over screen renderer

import { RootState } from '../redux/types';
import { drawCircularArrow } from './circularArrow';

export interface RematchButton {
  x: number;
  y: number;
  radius: number;
  corner: number;
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
  rematchButtons: RematchButton[];
}

export class GameOverRenderer {
  private layout: GameOverLayout | null = null;
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  render(canvasWidth: number, canvasHeight: number, state: RootState): GameOverLayout {
    // Don't clear canvas or draw modals - just let the gameplay renderer show the board
    // with the pulsing glow animation on the winning flow.
    
    // Draw rematch buttons in all four corners next to help buttons (only for non-spectators)
    const rematchButtons = this.renderRematchButtons(canvasWidth, canvasHeight, state);

    // Create layout with rematch buttons
    this.layout = {
      playAgainButton: {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        text: '',
      },
      rematchButtons,
    };

    return this.layout;
  }

  private renderRematchButtons(canvasWidth: number, canvasHeight: number, state: RootState): RematchButton[] {
    // Don't render rematch buttons for spectators
    if (state.ui.isSpectator) {
      return [];
    }
    
    // Render circular rematch buttons after move list buttons in each corner
    // Each button has a counter-clockwise circular arrow
    const cornerSize = 50;
    const margin = 10;
    const spacing = cornerSize * 0.15;
    const radius = cornerSize / 2;
    const tripleSpacing = (cornerSize + spacing) * 3; // Position after exit, help, and move list buttons

    const buttons = [
      { 
        // Edge 0 (bottom): after exit, help, and move list buttons
        x: margin + cornerSize / 2 + tripleSpacing, 
        y: canvasHeight - margin - cornerSize / 2,
        corner: 0,
        edge: 0, // Bottom edge
      },
      {
        // Edge 1 (right): after exit, help, and move list buttons
        x: canvasWidth - margin - cornerSize / 2,
        y: canvasHeight - margin - cornerSize / 2 - tripleSpacing,
        corner: 1,
        edge: 1, // Right edge
      },
      {
        // Edge 2 (top): after exit, help, and move list buttons
        x: canvasWidth - margin - cornerSize / 2 - tripleSpacing,
        y: margin + cornerSize / 2,
        corner: 2,
        edge: 2, // Top edge
      },
      {
        // Edge 3 (left): after exit, help, and move list buttons
        x: margin + cornerSize / 2,
        y: margin + cornerSize / 2 + tripleSpacing, 
        corner: 3,
        edge: 3, // Left edge
      },
    ];

    buttons.forEach((button) => {
      const centerX = button.x;
      const centerY = button.y;

      // Draw circle background
      this.ctx.fillStyle = "#4CAF50"; // Green for rematch
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      this.ctx.fill();

      // Draw border
      this.ctx.strokeStyle = "#ffffff";
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      // Calculate rotation for the arrow to face the edge
      // Edge 0 (bottom) = 0°, Edge 1 (right) = 270° (90° + 180°), 
      // Edge 2 (top) = 180°, Edge 3 (left) = 90° (270° + 180°)
      let rotation = button.edge * 90;
      if (button.edge === 1 || button.edge === 3) {
        rotation += 180;
      }

      this.ctx.save();
      this.ctx.translate(centerX, centerY);
      this.ctx.rotate((rotation * Math.PI) / 180);

      // Draw counter-clockwise circular arrow with bigger angles
      const arrowSize = cornerSize;
      const arrowRadius = arrowSize * 0.25;
      const startAngle = Math.PI * 0.0; // Start at 0° (bigger arc)
      const endAngle = Math.PI * 1.5; // End at 270° (bigger arc)

      drawCircularArrow(
        this.ctx,
        0,
        0,
        arrowRadius,
        startAngle,
        endAngle,
        false, // counter-clockwise
        arrowSize
      );

      this.ctx.restore();
    });

    return buttons.map(b => ({
      x: b.x,
      y: b.y,
      radius,
      corner: b.corner,
    }));
  }

  getLayout(): GameOverLayout | null {
    return this.layout;
  }
}
