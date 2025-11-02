// Game Over screen renderer

import { GameState } from '../redux/types';
import { victoryAnimationState } from '../animation/victoryAnimations';

export interface VictoryButton {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  rotation: number; // 0, 90, 180, or 270 degrees
}

export interface PlayAgainButton extends VictoryButton {}

export interface GameOverLayout {
  playAgainButton: PlayAgainButton;
  newGameButtons: VictoryButton[];
  viewBoardButtons: VictoryButton[];
}

export class GameOverRenderer {
  private ctx: CanvasRenderingContext2D;
  private layout: GameOverLayout | null = null;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  render(canvasWidth: number, canvasHeight: number, gameState: GameState): GameOverLayout {
    // Don't clear canvas - let the gameplay renderer show the board underneath
    // This allows the winning flow to be visible during the victory animation

    // Get animation state
    const modalOpacity = victoryAnimationState.modalOpacity;

    // Determine winner information
    const { winner, players, teams } = gameState;
    let winnerColors: string[] = [];
    
    if (winner) {
      // Check if winner is a team
      const team = teams.find(t => 
        `team-${t.player1Id}-${t.player2Id}` === winner || 
        t.player1Id === winner || 
        t.player2Id === winner
      );
      
      if (team) {
        // Team victory
        const player1 = players.find(p => p.id === team.player1Id);
        const player2 = players.find(p => p.id === team.player2Id);
        if (player1 && player2) {
          winnerColors = [player1.color, player2.color];
        }
      } else {
        // Individual player victory
        const winningPlayer = players.find(p => p.id === winner);
        if (winningPlayer) {
          winnerColors = [winningPlayer.color];
        }
      }
    }

    // Define modal dimensions
    const modalWidth = 250;
    const modalHeight = 200;
    const padding = 20;

    // Draw victory modals in all 4 corners
    // Rotations: 0° (bottom), 90° (right), 180° (top), 270° (left)
    const corners = [
      { x: canvasWidth / 2, y: canvasHeight - padding, rotation: 0 },     // Bottom
      { x: canvasWidth - padding, y: canvasHeight / 2, rotation: 90 },    // Right
      { x: canvasWidth / 2, y: padding, rotation: 180 },                   // Top
      { x: padding, y: canvasHeight / 2, rotation: 270 },                  // Left
    ];

    const newGameButtons: VictoryButton[] = [];
    const viewBoardButtons: VictoryButton[] = [];

    corners.forEach((corner) => {
      this.ctx.save();
      this.ctx.translate(corner.x, corner.y);
      this.ctx.rotate((corner.rotation * Math.PI) / 180);

      // Draw modal with animated opacity
      this.ctx.globalAlpha = modalOpacity;

      // Semi-transparent background
      this.ctx.fillStyle = '#000000';
      this.ctx.globalAlpha = modalOpacity * 0.6;
      this.ctx.fillRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight);

      // Border
      this.ctx.globalAlpha = modalOpacity;
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight);

      // Draw victory icon/indicator (trophy/star symbol)
      this.ctx.fillStyle = '#FFD700'; // Gold color
      this.ctx.font = 'bold 48px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('★', 0, -modalHeight / 2 + 50);

      // Draw winner color indicator(s)
      const squareSize = 30;
      const totalWidth = winnerColors.length * squareSize + (winnerColors.length - 1) * 10;
      let startX = -totalWidth / 2;

      winnerColors.forEach((color) => {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(startX, -modalHeight / 2 + 90, squareSize, squareSize);
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(startX, -modalHeight / 2 + 90, squareSize, squareSize);
        startX += squareSize + 10;
      });

      // Draw buttons
      const buttonWidth = 100;
      const buttonHeight = 40;
      const buttonSpacing = 10;

      // "New Game" button (left)
      const newGameX = -buttonWidth - buttonSpacing / 2;
      const buttonY = modalHeight / 2 - buttonHeight - 20;

      this.ctx.fillStyle = '#4CAF50';
      this.ctx.fillRect(newGameX, buttonY, buttonWidth, buttonHeight);
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(newGameX, buttonY, buttonWidth, buttonHeight);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 16px Arial';
      this.ctx.fillText('New Game', newGameX + buttonWidth / 2, buttonY + buttonHeight / 2);

      // "View Board" button (right)
      const viewBoardX = buttonSpacing / 2;

      this.ctx.fillStyle = '#2196F3';
      this.ctx.fillRect(viewBoardX, buttonY, buttonWidth, buttonHeight);
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(viewBoardX, buttonY, buttonWidth, buttonHeight);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillText('View Board', viewBoardX + buttonWidth / 2, buttonY + buttonHeight / 2);

      this.ctx.restore();

      // Store button positions in world coordinates for input handling
      // Transform button coordinates back to world space
      const cos = Math.cos((corner.rotation * Math.PI) / 180);
      const sin = Math.sin((corner.rotation * Math.PI) / 180);

      // New Game button
      const ngLocalX = newGameX + buttonWidth / 2;
      const ngLocalY = buttonY + buttonHeight / 2;
      newGameButtons.push({
        x: corner.x + ngLocalX * cos - ngLocalY * sin,
        y: corner.y + ngLocalX * sin + ngLocalY * cos,
        width: buttonWidth,
        height: buttonHeight,
        text: 'New Game',
        rotation: corner.rotation,
      });

      // View Board button
      const vbLocalX = viewBoardX + buttonWidth / 2;
      const vbLocalY = buttonY + buttonHeight / 2;
      viewBoardButtons.push({
        x: corner.x + vbLocalX * cos - vbLocalY * sin,
        y: corner.y + vbLocalX * sin + vbLocalY * cos,
        width: buttonWidth,
        height: buttonHeight,
        text: 'View Board',
        rotation: corner.rotation,
      });
    });

    // Create layout for input handling
    // Use the bottom modal's "New Game" button as the primary play again button
    this.layout = {
      playAgainButton: newGameButtons[0],
      newGameButtons,
      viewBoardButtons,
    };

    return this.layout;
  }

  getLayout(): GameOverLayout | null {
    return this.layout;
  }
}
