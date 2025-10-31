// Lobby renderer for the redesigned edge-based lobby

import { ConfigPlayer } from '../redux/types';
import {
  LobbyLayout,
  EdgeButton,
  StartButton,
  ExitButton,
  PlayerListEntry,
  calculateLobbyLayout,
} from './lobbyLayout';

export class LobbyRenderer {
  private ctx: CanvasRenderingContext2D;
  private layout: LobbyLayout | null = null;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  render(canvasWidth: number, canvasHeight: number, players: ConfigPlayer[]): LobbyLayout {
    this.layout = calculateLobbyLayout(canvasWidth, canvasHeight, players);

    // Clear canvas
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Render all elements
    this.renderEdgeButtons(this.layout.edgeButtons);
    this.renderStartButton(this.layout.startButton);
    this.renderExitButtons(this.layout.exitButtons);
    this.renderPlayerLists(this.layout.playerLists);

    return this.layout;
  }

  getLayout(): LobbyLayout | null {
    return this.layout;
  }

  private renderEdgeButtons(buttons: EdgeButton[]): void {
    buttons.forEach(button => {
      this.ctx.save();

      // Draw button background
      this.ctx.fillStyle = button.color;
      this.ctx.fillRect(button.x, button.y, button.size, button.size);

      // Draw border
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(button.x, button.y, button.size, button.size);

      // Draw + symbol
      const centerX = button.x + button.size / 2;
      const centerY = button.y + button.size / 2;
      const plusSize = button.size * 0.4;

      this.ctx.save();
      this.ctx.translate(centerX, centerY);
      this.ctx.rotate((button.rotation * Math.PI) / 180);

      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 4;
      this.ctx.beginPath();
      // Horizontal line
      this.ctx.moveTo(-plusSize / 2, 0);
      this.ctx.lineTo(plusSize / 2, 0);
      // Vertical line
      this.ctx.moveTo(0, -plusSize / 2);
      this.ctx.lineTo(0, plusSize / 2);
      this.ctx.stroke();

      this.ctx.restore();
      this.ctx.restore();
    });
  }

  private renderStartButton(button: StartButton): void {
    const centerX = button.x + button.size / 2;
    const centerY = button.y + button.size / 2;
    const radius = button.size / 2;

    // Draw circle
    this.ctx.fillStyle = button.enabled ? '#4CAF50' : '#555555';
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    this.ctx.fill();

    // Draw border
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 3;
    this.ctx.stroke();

    // Draw play triangle
    const triangleSize = radius * 0.5;
    this.ctx.fillStyle = button.enabled ? '#ffffff' : '#999999';
    this.ctx.beginPath();
    this.ctx.moveTo(centerX - triangleSize * 0.3, centerY - triangleSize * 0.6);
    this.ctx.lineTo(centerX - triangleSize * 0.3, centerY + triangleSize * 0.6);
    this.ctx.lineTo(centerX + triangleSize * 0.7, centerY);
    this.ctx.closePath();
    this.ctx.fill();
  }

  private renderExitButtons(buttons: ExitButton[]): void {
    buttons.forEach(button => {
      const centerX = button.x;
      const centerY = button.y;
      const radius = button.size / 2;

      // Draw circle background
      this.ctx.fillStyle = '#d32f2f';
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      this.ctx.fill();

      // Draw border
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      // Draw X symbol
      const xSize = radius * 0.6;
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.moveTo(centerX - xSize, centerY - xSize);
      this.ctx.lineTo(centerX + xSize, centerY + xSize);
      this.ctx.moveTo(centerX + xSize, centerY - xSize);
      this.ctx.lineTo(centerX - xSize, centerY + xSize);
      this.ctx.stroke();
    });
  }

  private renderPlayerLists(lists: PlayerListEntry[][]): void {
    // Render player lists at all 4 edges
    lists.forEach((list) => {
      list.forEach((entry, playerIndex) => {
        this.renderPlayerEntry(entry, playerIndex);
      });
    });
  }

  private renderPlayerEntry(entry: PlayerListEntry, index: number): void {
    this.ctx.save();

    // Translate to center of entry and apply rotation
    const centerX = entry.x + entry.width / 2;
    const centerY = entry.y + entry.height / 2;
    this.ctx.translate(centerX, centerY);
    this.ctx.rotate((entry.rotation * Math.PI) / 180);

    // Draw entry background (relative to center)
    this.ctx.fillStyle = '#2a2a3e';
    this.ctx.fillRect(-entry.width / 2, -entry.height / 2, entry.width, entry.height);

    // Draw border
    this.ctx.strokeStyle = '#555555';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(-entry.width / 2, -entry.height / 2, entry.width, entry.height);

    // Draw color indicator
    const colorSize = entry.height * 0.6;
    const colorX = -entry.width / 2 + 10;
    const colorY = -(colorSize / 2);

    this.ctx.fillStyle = entry.player.color;
    this.ctx.fillRect(colorX, colorY, colorSize, colorSize);
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(colorX, colorY, colorSize, colorSize);

    // Draw player number
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = `${entry.height * 0.4}px sans-serif`;
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(
      `P${index + 1}`,
      colorX + colorSize + 10,
      0
    );

    // Draw remove button
    const removeBtn = entry.removeButton;
    const removeBtnX = entry.width / 2 - removeBtn.size - 5;
    const removeBtnY = -(removeBtn.size / 2);
    
    this.ctx.fillStyle = '#d32f2f';
    this.ctx.fillRect(removeBtnX, removeBtnY, removeBtn.size, removeBtn.size);
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(removeBtnX, removeBtnY, removeBtn.size, removeBtn.size);

    // Draw X on remove button
    const xSize = removeBtn.size * 0.3;
    const xCenterX = removeBtnX + removeBtn.size / 2;
    const xCenterY = removeBtnY + removeBtn.size / 2;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(xCenterX - xSize, xCenterY - xSize);
    this.ctx.lineTo(xCenterX + xSize, xCenterY + xSize);
    this.ctx.moveTo(xCenterX + xSize, xCenterY - xSize);
    this.ctx.lineTo(xCenterX - xSize, xCenterY + xSize);
    this.ctx.stroke();

    this.ctx.restore();
  }
}
