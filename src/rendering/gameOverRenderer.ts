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

  render(canvasWidth: number, canvasHeight: number, gameState: GameState): GameOverLayout {
    // Clear canvas
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Determine winner information
    const { winner, winType, players, teams } = gameState;
    let winnerText = 'Victory not implemented yet!';
    
    if (winner) {
      // Check if winner is a team
      const team = teams.find(t => 
        `${t.player1Id}-${t.player2Id}` === winner || 
        t.player1Id === winner || 
        t.player2Id === winner
      );
      
      if (team) {
        // Team victory
        const player1 = players.find(p => p.id === team.player1Id);
        const player2 = players.find(p => p.id === team.player2Id);
        if (player1 && player2) {
          winnerText = `Team Victory!`;
        }
      } else {
        // Individual player victory
        const winningPlayer = players.find(p => p.id === winner);
        if (winningPlayer) {
          winnerText = `Player Victory!`;
        }
      }
    }

    // Draw title
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 48px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(winnerText, canvasWidth / 2, canvasHeight / 2 - 100);
    
    // Draw winner details
    if (winner) {
      const team = teams.find(t => 
        `${t.player1Id}-${t.player2Id}` === winner || 
        t.player1Id === winner || 
        t.player2Id === winner
      );
      
      if (team) {
        const player1 = players.find(p => p.id === team.player1Id);
        const player2 = players.find(p => p.id === team.player2Id);
        if (player1 && player2) {
          // Draw colored squares for team members
          const squareSize = 30;
          const spacing = 10;
          const totalWidth = squareSize * 2 + spacing;
          const startX = canvasWidth / 2 - totalWidth / 2;
          const y = canvasHeight / 2 - 40;
          
          // Player 1 square
          this.ctx.fillStyle = player1.color;
          this.ctx.fillRect(startX, y, squareSize, squareSize);
          this.ctx.strokeStyle = '#ffffff';
          this.ctx.lineWidth = 2;
          this.ctx.strokeRect(startX, y, squareSize, squareSize);
          
          // Player 2 square
          this.ctx.fillStyle = player2.color;
          this.ctx.fillRect(startX + squareSize + spacing, y, squareSize, squareSize);
          this.ctx.strokeStyle = '#ffffff';
          this.ctx.lineWidth = 2;
          this.ctx.strokeRect(startX + squareSize + spacing, y, squareSize, squareSize);
        }
      } else {
        const winningPlayer = players.find(p => p.id === winner);
        if (winningPlayer) {
          // Draw colored square for individual winner
          const squareSize = 40;
          const x = canvasWidth / 2 - squareSize / 2;
          const y = canvasHeight / 2 - 50;
          
          this.ctx.fillStyle = winningPlayer.color;
          this.ctx.fillRect(x, y, squareSize, squareSize);
          this.ctx.strokeStyle = '#ffffff';
          this.ctx.lineWidth = 2;
          this.ctx.strokeRect(x, y, squareSize, squareSize);
        }
      }
      
      // Draw win type
      if (winType) {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '20px Arial';
        this.ctx.fillText(
          `Victory by ${winType}`, 
          canvasWidth / 2, 
          canvasHeight / 2 + 10
        );
      }
    }

    // Draw Play Again button
    const buttonWidth = 200;
    const buttonHeight = 60;
    const buttonX = (canvasWidth - buttonWidth) / 2;
    const buttonY = canvasHeight / 2 + 80;

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
