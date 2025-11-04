// Lobby renderer for the redesigned edge-based lobby

import { ConfigPlayer } from "../redux/types";
import {
  LobbyLayout,
  EdgeButton,
  StartButton,
  ExitButton,
  SettingsButton,
  PlayerListEntry,
  calculateLobbyLayout,
} from "./lobbyLayout";

export class LobbyRenderer {
  private ctx: CanvasRenderingContext2D;
  private layout: LobbyLayout | null = null;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  render(
    canvasWidth: number,
    canvasHeight: number,
    players: ConfigPlayer[],
    showSettings: boolean = false,
    settings?: import("../redux/types").GameSettings,
  ): LobbyLayout {
    this.layout = calculateLobbyLayout(canvasWidth, canvasHeight, players);

    // Clear canvas
    this.ctx.fillStyle = "#1a1a2e";
    this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Render all elements
    this.renderEdgeButtons(this.layout.edgeButtons);
    this.renderStartButton(this.layout.startButton);
    this.renderSettingsButton(this.layout.settingsButton);
    this.renderExitButtons(this.layout.exitButtons);
    this.renderPlayerLists(this.layout.playerLists, canvasWidth, canvasHeight);

    // Render settings dialog if open
    if (showSettings && settings) {
      this.renderSettingsDialog(canvasWidth, canvasHeight, settings);
    }

    return this.layout;
  }

  getLayout(): LobbyLayout | null {
    return this.layout;
  }

  private renderEdgeButtons(buttons: EdgeButton[]): void {
    buttons.forEach((button) => {
      this.ctx.save();

      // Draw button background
      this.ctx.fillStyle = button.color;
      this.ctx.fillRect(button.x, button.y, button.size, button.size);

      // Draw border
      this.ctx.strokeStyle = "#ffffff";
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(button.x, button.y, button.size, button.size);

      // Draw + symbol
      const centerX = button.x + button.size / 2;
      const centerY = button.y + button.size / 2;
      const plusSize = button.size * 0.4;

      this.ctx.save();
      this.ctx.translate(centerX, centerY);
      this.ctx.rotate((button.rotation * Math.PI) / 180);

      this.ctx.strokeStyle = "#ffffff";
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
    this.ctx.fillStyle = button.enabled ? "#4CAF50" : "#555555";
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    this.ctx.fill();

    // Draw border
    this.ctx.strokeStyle = "#ffffff";
    this.ctx.lineWidth = 3;
    this.ctx.stroke();

    // Draw play triangle
    const triangleSize = radius * 0.5;
    this.ctx.fillStyle = button.enabled ? "#ffffff" : "#999999";
    this.ctx.beginPath();
    this.ctx.moveTo(centerX - triangleSize * 0.3, centerY - triangleSize * 0.6);
    this.ctx.lineTo(centerX - triangleSize * 0.3, centerY + triangleSize * 0.6);
    this.ctx.lineTo(centerX + triangleSize * 0.7, centerY);
    this.ctx.closePath();
    this.ctx.fill();
  }

  private renderSettingsButton(button: SettingsButton): void {
    const centerX = button.x + button.size / 2;
    const centerY = button.y + button.size / 2;
    const radius = button.size / 2;

    // Draw circle
    this.ctx.fillStyle = "#757575";
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    this.ctx.fill();

    // Draw border
    this.ctx.strokeStyle = "#ffffff";
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Draw gear icon
    const gearRadius = radius * 0.35;
    const innerRadius = radius * 0.2;
    const numTeeth = 8;
    const toothDepth = radius * 0.15;

    this.ctx.fillStyle = "#ffffff";
    this.ctx.beginPath();
    
    for (let i = 0; i < numTeeth * 2; i++) {
      const angle = (i * Math.PI) / numTeeth;
      const r = i % 2 === 0 ? gearRadius + toothDepth : gearRadius;
      const x = centerX + r * Math.cos(angle);
      const y = centerY + r * Math.sin(angle);
      
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.closePath();
    this.ctx.fill();

    // Draw inner circle (hole)
    this.ctx.fillStyle = "#757575";
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
    this.ctx.fill();
  }

  private renderExitButtons(buttons: ExitButton[]): void {
    buttons.forEach((button) => {
      const centerX = button.x;
      const centerY = button.y;
      const radius = button.size / 2;

      // Draw circle background
      this.ctx.fillStyle = "#d32f2f";
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      this.ctx.fill();

      // Draw border
      this.ctx.strokeStyle = "#ffffff";
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      // Draw X symbol
      const xSize = radius * 0.6;
      this.ctx.strokeStyle = "#ffffff";
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.moveTo(centerX - xSize, centerY - xSize);
      this.ctx.lineTo(centerX + xSize, centerY + xSize);
      this.ctx.moveTo(centerX + xSize, centerY - xSize);
      this.ctx.lineTo(centerX - xSize, centerY + xSize);
      this.ctx.stroke();
    });
  }

  private renderPlayerLists(
    lists: PlayerListEntry[][],
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    // Render player lists at all 4 edges
    lists.forEach((list) => {
      list.forEach((entry, playerIndex) => {
        this.renderPlayerEntry(entry, playerIndex, canvasWidth, canvasHeight);
      });
    });
  }

  private renderPlayerEntry(
    entry: PlayerListEntry,
    index: number,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    this.ctx.save();

    // Calculate screen center
    const screenCenterX = canvasWidth / 2;
    const screenCenterY = canvasHeight / 2;

    // Calculate entry center position (as laid out for bottom edge)
    const entryCenterX = entry.x + entry.width / 2;
    const entryCenterY = entry.y + entry.height / 2;

    // Step 1: Translate to screen center
    this.ctx.translate(screenCenterX, screenCenterY);

    // Step 2: Rotate around screen center based on edge
    this.ctx.rotate((entry.rotation * Math.PI) / 180);

    // Step 3: Translate to position relative to center (in bottom-edge coordinates)
    // These offsets are from screen center in the bottom-edge layout
    const xOffset = entryCenterX - screenCenterX;
    const yOffset = entryCenterY - screenCenterY;
    this.ctx.translate(xOffset, yOffset);

    // Step 4: After rotation, adjust position to maintain consistent distance from + buttons
    // For left/right edges (perpendicular to screen orientation), adjust based on aspect ratio
    // to maintain proper spacing from + buttons in both landscape and portrait modes
    if (entry.rotation === 90 || entry.rotation === 270) {
      const minDim = Math.min(canvasWidth, canvasHeight);
      const maxDim = Math.max(canvasWidth, canvasHeight);
      const edgeAdjustment = (maxDim - minDim) / 2;

      const isPortrait = canvasHeight > canvasWidth;

      // Move labels away from center in the y-direction (after rotation)
      // This positions them correctly relative to the + buttons on left/right edges
      if (!isPortrait) {
        this.ctx.translate(0, edgeAdjustment);
      } else {
        this.ctx.translate(0, -edgeAdjustment);
      }
    }
    // Note: Top/bottom edges (0° and 180°) don't need adjustment as they're already
    // positioned correctly by the rotation around screen center

    // Now draw the entry upright (no additional rotation needed)
    // All coordinates are relative to entry center

    // Draw entry background
    this.ctx.fillStyle = "#2a2a3e";
    this.ctx.fillRect(
      -entry.width / 2,
      -entry.height / 2,
      entry.width,
      entry.height,
    );

    // Draw border
    this.ctx.strokeStyle = "#555555";
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(
      -entry.width / 2,
      -entry.height / 2,
      entry.width,
      entry.height,
    );

    // Draw color indicator
    const colorSize = entry.height * 0.6;
    const colorX = -entry.width / 2 + 10;
    const colorY = -(colorSize / 2);

    this.ctx.fillStyle = entry.player.color;
    this.ctx.fillRect(colorX, colorY, colorSize, colorSize);
    this.ctx.strokeStyle = "#ffffff";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(colorX, colorY, colorSize, colorSize);

    // Draw player number
    this.ctx.fillStyle = "#ffffff";
    this.ctx.font = `${entry.height * 0.4}px sans-serif`;
    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(`P${index + 1}`, colorX + colorSize + 10, 0);

    // Draw remove button
    const removeBtn = entry.removeButton;
    const removeBtnX = entry.width / 2 - removeBtn.size - 5;
    const removeBtnY = -(removeBtn.size / 2);

    this.ctx.fillStyle = "#d32f2f";
    this.ctx.fillRect(removeBtnX, removeBtnY, removeBtn.size, removeBtn.size);
    this.ctx.strokeStyle = "#ffffff";
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(removeBtnX, removeBtnY, removeBtn.size, removeBtn.size);

    // Draw X on remove button
    const xSize = removeBtn.size * 0.3;
    const xCenterX = removeBtnX + removeBtn.size / 2;
    const xCenterY = removeBtnY + removeBtn.size / 2;
    this.ctx.strokeStyle = "#ffffff";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(xCenterX - xSize, xCenterY - xSize);
    this.ctx.lineTo(xCenterX + xSize, xCenterY + xSize);
    this.ctx.moveTo(xCenterX + xSize, xCenterY - xSize);
    this.ctx.lineTo(xCenterX - xSize, xCenterY + xSize);
    this.ctx.stroke();

    this.ctx.restore();
  }

  private renderSettingsDialog(
    canvasWidth: number,
    canvasHeight: number,
    settings: import("../redux/types").GameSettings,
  ): void {
    // Semi-transparent overlay
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Dialog box
    const dialogWidth = Math.min(500, canvasWidth * 0.8);
    const dialogHeight = Math.min(600, canvasHeight * 0.8);
    const dialogX = (canvasWidth - dialogWidth) / 2;
    const dialogY = (canvasHeight - dialogHeight) / 2;

    // Dialog background
    this.ctx.fillStyle = "#2a2a3e";
    this.ctx.fillRect(dialogX, dialogY, dialogWidth, dialogHeight);
    this.ctx.strokeStyle = "#555555";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(dialogX, dialogY, dialogWidth, dialogHeight);

    // Title
    this.ctx.fillStyle = "#ffffff";
    this.ctx.font = "bold 24px sans-serif";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "top";
    this.ctx.fillText("Settings", canvasWidth / 2, dialogY + 20);

    // Settings content
    const contentX = dialogX + 30;
    let contentY = dialogY + 70;
    const lineHeight = 50;

    this.ctx.font = "18px sans-serif";
    this.ctx.textAlign = "left";

    // Board Radius
    this.ctx.fillText(
      `Board Radius: ${settings.boardRadius}`,
      contentX,
      contentY,
    );
    contentY += lineHeight;

    // Supermove
    this.ctx.fillText(
      `Supermove: ${settings.supermove ? "ON" : "OFF"}`,
      contentX,
      contentY,
    );
    contentY += lineHeight;

    // Debug section
    contentY += 10;
    this.ctx.font = "bold 20px sans-serif";
    this.ctx.fillText("Debug Options", contentX, contentY);
    contentY += lineHeight;

    this.ctx.font = "18px sans-serif";
    this.ctx.fillText(
      `Show Edge Labels: ${settings.debugShowEdgeLabels ? "ON" : "OFF"}`,
      contentX,
      contentY,
    );
    contentY += lineHeight;

    this.ctx.fillText(
      `Show Victory Edges: ${settings.debugShowVictoryEdges ? "ON" : "OFF"}`,
      contentX,
      contentY,
    );
    contentY += lineHeight;

    this.ctx.fillText(
      `Legality Test: ${settings.debugLegalityTest ? "ON" : "OFF"}`,
      contentX,
      contentY,
    );
    contentY += lineHeight;

    this.ctx.fillText(
      `Animation Slowdown: ${settings.debugAnimationSlowdown}x`,
      contentX,
      contentY,
    );
    contentY += lineHeight;

    // Close button
    const closeButtonWidth = 100;
    const closeButtonHeight = 40;
    const closeButtonX = canvasWidth / 2 - closeButtonWidth / 2;
    const closeButtonY = dialogY + dialogHeight - 60;

    this.ctx.fillStyle = "#555555";
    this.ctx.fillRect(
      closeButtonX,
      closeButtonY,
      closeButtonWidth,
      closeButtonHeight,
    );
    this.ctx.strokeStyle = "#ffffff";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(
      closeButtonX,
      closeButtonY,
      closeButtonWidth,
      closeButtonHeight,
    );

    this.ctx.fillStyle = "#ffffff";
    this.ctx.font = "18px sans-serif";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(
      "Close",
      closeButtonX + closeButtonWidth / 2,
      closeButtonY + closeButtonHeight / 2,
    );
  }
}
