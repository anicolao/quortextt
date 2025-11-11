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
import { calculateTileCountsFromRatio } from "../redux/gameReducer";
import { TileType } from "../game/types";
import { getFlowConnections } from "../game/tiles";
import { getEdgeMidpoint, getPerpendicularVector, getHexVertex } from "./hexLayout";

// Tile rendering constants (matching gameplayRenderer)
const TILE_BG = "#2a2a2a";
const TILE_BORDER = "#444444";

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
    showHelp: boolean = false,
    helpCorner: number | null = null,
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
    this.renderHelpButtons(this.layout.helpButtons);
    this.renderPlayerLists(this.layout.playerLists, canvasWidth, canvasHeight);

    // Render settings dialog if open
    if (showSettings && settings) {
      this.layout.settingsDialog = this.renderSettingsDialog(canvasWidth, canvasHeight, settings);
    } else {
      this.layout.settingsDialog = null;
    }

    // Render help dialog if open
    if (showHelp && helpCorner !== null) {
      this.renderHelpDialog(canvasWidth, canvasHeight, helpCorner);
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

  private renderHelpButtons(buttons: import("./lobbyLayout").HelpButton[]): void {
    buttons.forEach((button) => {
      const centerX = button.x;
      const centerY = button.y;
      const radius = button.size / 2;

      // Draw circle background
      this.ctx.fillStyle = "#2196F3"; // Blue for help
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      this.ctx.fill();

      // Draw border
      this.ctx.strokeStyle = "#ffffff";
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      // Draw ? symbol
      this.ctx.fillStyle = "#ffffff";
      this.ctx.font = `bold ${radius * 1.2}px sans-serif`;
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText("?", centerX, centerY);
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
  ): import("./lobbyLayout").SettingsDialogLayout {
    const controls: import("./lobbyLayout").SettingsControl[] = [];

    // Semi-transparent overlay
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Dialog box
    const dialogWidth = Math.min(500, canvasWidth * 0.8);
    const dialogHeight = Math.min(795, canvasHeight * 0.9); // Increased from 750 to accommodate Single Supermove line
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
    const lineHeight = 45;
    const checkboxSize = 25;
    const buttonHeight = 30;

    this.ctx.font = "18px sans-serif";
    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "middle";
    this.ctx.fillStyle = "#ffffff"; // White text for all labels

    // Board Radius
    this.ctx.fillText("Board Radius:", contentX, contentY + buttonHeight / 2);
    const radiusX = contentX + 200;
    this.renderNumberControl(radiusX, contentY, settings.boardRadius, 1, 4);
    controls.push({
      type: 'number',
      x: radiusX - 25,
      y: contentY,
      width: 30,
      height: buttonHeight,
      settingKey: 'boardRadius',
      label: '-',
    });
    controls.push({
      type: 'number',
      x: radiusX + 40,
      y: contentY,
      width: 30,
      height: buttonHeight,
      settingKey: 'boardRadius',
      label: '+',
    });
    contentY += lineHeight;

    // Supermove
    this.renderCheckbox(contentX + dialogWidth - 80, contentY, checkboxSize, settings.supermove);
    this.ctx.fillStyle = "#ffffff"; // Reset to white after checkbox
    this.ctx.textAlign = "left"; // Ensure left alignment
    this.ctx.fillText("Supermove", contentX, contentY + checkboxSize / 2);
    controls.push({
      type: 'checkbox',
      x: contentX + dialogWidth - 80,
      y: contentY,
      width: checkboxSize,
      height: checkboxSize,
      settingKey: 'supermove',
    });
    contentY += lineHeight;

    // Single Supermove (always shown, but greyed out when supermove is disabled)
    const singleSupermoveDisabled = !settings.supermove;
    this.renderCheckbox(contentX + dialogWidth - 80, contentY, checkboxSize, settings.singleSupermove, singleSupermoveDisabled);
    this.ctx.fillStyle = singleSupermoveDisabled ? "#666666" : "#ffffff"; // Grey text when disabled
    this.ctx.textAlign = "left"; // Ensure left alignment
    this.ctx.fillText("Single Supermove", contentX, contentY + checkboxSize / 2);
    if (!singleSupermoveDisabled) {
      controls.push({
        type: 'checkbox',
        x: contentX + dialogWidth - 80,
        y: contentY,
        width: checkboxSize,
        height: checkboxSize,
        settingKey: 'singleSupermove',
      });
    }
    contentY += lineHeight;

    // Tile Distribution section
    contentY += 10;
    this.ctx.font = "bold 20px sans-serif";
    this.ctx.fillStyle = "#ffffff"; // Ensure white text
    this.ctx.textAlign = "left"; // Ensure left alignment
    this.ctx.fillText("Tile Distribution:", contentX, contentY);
    contentY += lineHeight + 5;

    this.ctx.font = "18px sans-serif";

    // Render tile previews and controls in horizontal row
    const tileTypes = [0, 1, 2, 3]; // TileType enum values
    const tileSize = 30; // Small hexagon size
    const controlSpacing = 110; // Space for each control set (increased for better spacing)
    const startX = contentX;

    for (let i = 0; i < tileTypes.length; i++) {
      const x = startX + i * controlSpacing;
      const tileY = contentY;

      // Render small tile preview - centered above the control
      // Control spans from (x-25) to (x+75), so center is at x+25
      this.renderSmallTile(tileTypes[i], x + 25, tileY, tileSize);

      // Render number control beneath tile
      const controlY = tileY + tileSize + 10;
      this.renderNumberControl(x, controlY, settings.tileDistribution[i], 0, 99);

      // Add controls to clickable areas
      controls.push({
        type: 'number',
        x: x - 25,
        y: controlY,
        width: 30,
        height: buttonHeight,
        settingKey: 'tileDistribution',
        tileIndex: i,
        label: '-',
      });
      controls.push({
        type: 'number',
        x: x + 40,
        y: controlY,
        width: 30,
        height: buttonHeight,
        settingKey: 'tileDistribution',
        tileIndex: i,
        label: '+',
      });
    }

    contentY += 80; // Space for tiles + controls

    // Total tiles display
    this.ctx.font = "18px sans-serif";
    this.ctx.fillStyle = "#ffffff"; // White text
    this.ctx.textAlign = "left"; // Ensure left alignment
    const { totalTiles, numGroups } = this.calculateTotalTiles(settings.tileDistribution, settings.boardRadius);
    this.ctx.fillText(`Total: ${totalTiles} tiles (${numGroups} groups)`, contentX, contentY);
    contentY += lineHeight;

    // Reset button
    const resetButtonWidth = 150;
    const resetButtonHeight = 30;
    const resetButtonX = contentX + (dialogWidth - 60 - resetButtonWidth) / 2;
    this.ctx.fillStyle = "#555555";
    this.ctx.fillRect(resetButtonX, contentY, resetButtonWidth, resetButtonHeight);
    this.ctx.strokeStyle = "#ffffff";
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(resetButtonX, contentY, resetButtonWidth, resetButtonHeight);
    this.ctx.fillStyle = "#ffffff";
    this.ctx.font = "16px sans-serif";
    this.ctx.textAlign = "center";
    this.ctx.fillText("Reset to Default", resetButtonX + resetButtonWidth / 2, contentY + resetButtonHeight / 2);
    controls.push({
      type: 'reset-distribution',
      x: resetButtonX,
      y: contentY,
      width: resetButtonWidth,
      height: resetButtonHeight,
    });
    contentY += lineHeight;

    // Reset text alignment and ensure white color for debug section
    this.ctx.font = "18px sans-serif";
    this.ctx.textAlign = "left";
    this.ctx.fillStyle = "#ffffff";

    // Debug section
    contentY += 10;
    this.ctx.font = "bold 20px sans-serif";
    this.ctx.fillText("Debug Options", contentX, contentY);
    contentY += lineHeight;

    this.ctx.font = "18px sans-serif";

    // Debug Show Edge Labels
    this.renderCheckbox(contentX + dialogWidth - 80, contentY, checkboxSize, settings.debugShowEdgeLabels);
    this.ctx.fillStyle = "#ffffff"; // Reset to white after checkbox
    this.ctx.fillText("Show Edge Labels", contentX, contentY + checkboxSize / 2);
    controls.push({
      type: 'checkbox',
      x: contentX + dialogWidth - 80,
      y: contentY,
      width: checkboxSize,
      height: checkboxSize,
      settingKey: 'debugShowEdgeLabels',
    });
    contentY += lineHeight;

    // Debug Show Victory Edges
    this.renderCheckbox(contentX + dialogWidth - 80, contentY, checkboxSize, settings.debugShowVictoryEdges);
    this.ctx.fillStyle = "#ffffff"; // Reset to white after checkbox
    this.ctx.fillText("Show Victory Edges", contentX, contentY + checkboxSize / 2);
    controls.push({
      type: 'checkbox',
      x: contentX + dialogWidth - 80,
      y: contentY,
      width: checkboxSize,
      height: checkboxSize,
      settingKey: 'debugShowVictoryEdges',
    });
    contentY += lineHeight;

    // Debug Legality Test
    this.renderCheckbox(contentX + dialogWidth - 80, contentY, checkboxSize, settings.debugLegalityTest);
    this.ctx.fillStyle = "#ffffff"; // Reset to white after checkbox
    this.ctx.fillText("Legality Test", contentX, contentY + checkboxSize / 2);
    controls.push({
      type: 'checkbox',
      x: contentX + dialogWidth - 80,
      y: contentY,
      width: checkboxSize,
      height: checkboxSize,
      settingKey: 'debugLegalityTest',
    });
    contentY += lineHeight;

    // Debug AI Scoring
    this.renderCheckbox(contentX + dialogWidth - 80, contentY, checkboxSize, settings.debugAIScoring);
    this.ctx.fillStyle = "#ffffff"; // Reset to white after checkbox
    this.ctx.fillText("Show AI Scoring", contentX, contentY + checkboxSize / 2);
    controls.push({
      type: 'checkbox',
      x: contentX + dialogWidth - 80,
      y: contentY,
      width: checkboxSize,
      height: checkboxSize,
      settingKey: 'debugAIScoring',
    });
    contentY += lineHeight;

    // Animation Slowdown
    this.ctx.fillStyle = "#ffffff"; // Ensure white text
    this.ctx.fillText("Animation Slowdown:", contentX, contentY + buttonHeight / 2);
    const slowdownX = contentX + 240;
    this.renderNumberControl(slowdownX, contentY, settings.debugAnimationSlowdown, 1, 10);
    controls.push({
      type: 'number',
      x: slowdownX - 25,
      y: contentY,
      width: 30,
      height: buttonHeight,
      settingKey: 'debugAnimationSlowdown',
      label: '-',
    });
    controls.push({
      type: 'number',
      x: slowdownX + 40,
      y: contentY,
      width: 30,
      height: buttonHeight,
      settingKey: 'debugAnimationSlowdown',
      label: '+',
    });
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

    controls.push({
      type: 'close',
      x: closeButtonX,
      y: closeButtonY,
      width: closeButtonWidth,
      height: closeButtonHeight,
    });

    return {
      controls,
      dialogX,
      dialogY,
      dialogWidth,
      dialogHeight,
    };
  }

  private renderCheckbox(x: number, y: number, size: number, checked: boolean, disabled: boolean = false): void {
    // Checkbox background
    this.ctx.fillStyle = disabled ? "#0d0d16" : "#1a1a2e";
    this.ctx.fillRect(x, y, size, size);
    this.ctx.strokeStyle = disabled ? "#555555" : "#ffffff";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, size, size);

    // Checkmark if checked
    if (checked) {
      this.ctx.strokeStyle = disabled ? "#2a5a2e" : "#4CAF50";
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.moveTo(x + size * 0.2, y + size * 0.5);
      this.ctx.lineTo(x + size * 0.4, y + size * 0.7);
      this.ctx.lineTo(x + size * 0.8, y + size * 0.3);
      this.ctx.stroke();
    }
  }

  private renderNumberControl(x: number, y: number, value: number, min: number, max: number): void {
    const buttonWidth = 30;
    const buttonHeight = 30;
    const valueWidth = 40;

    // Minus button
    this.ctx.fillStyle = value > min ? "#555555" : "#333333";
    this.ctx.fillRect(x - 25, y, buttonWidth, buttonHeight);
    this.ctx.strokeStyle = "#ffffff";
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x - 25, y, buttonWidth, buttonHeight);
    this.ctx.fillStyle = value > min ? "#ffffff" : "#666666";
    this.ctx.font = "bold 20px sans-serif";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText("-", x - 10, y + buttonHeight / 2);

    // Value display
    this.ctx.fillStyle = "#1a1a2e";
    this.ctx.fillRect(x + 5, y, valueWidth, buttonHeight);
    this.ctx.strokeStyle = "#ffffff";
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x + 5, y, valueWidth, buttonHeight);
    this.ctx.fillStyle = "#ffffff";
    this.ctx.font = "18px sans-serif";
    this.ctx.fillText(value.toString(), x + 25, y + buttonHeight / 2);

    // Plus button
    this.ctx.fillStyle = value < max ? "#555555" : "#333333";
    this.ctx.fillRect(x + 45, y, buttonWidth, buttonHeight);
    this.ctx.strokeStyle = "#ffffff";
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x + 45, y, buttonWidth, buttonHeight);
    this.ctx.fillStyle = value < max ? "#ffffff" : "#666666";
    this.ctx.font = "bold 20px sans-serif";
    this.ctx.fillText("+", x + 60, y + buttonHeight / 2);
  }

  // Render a small tile preview using the same approach as gameplayRenderer
  private renderSmallTile(tileType: number, centerX: number, centerY: number, size: number): void {
    const center = { x: centerX, y: centerY };
    
    // Draw hexagon background
    this.ctx.fillStyle = TILE_BG;
    this.drawSmallHexagon(center, size, true);
    
    // Draw hexagon border
    this.ctx.strokeStyle = TILE_BORDER;
    this.ctx.lineWidth = 1;
    this.drawSmallHexagon(center, size, false);

    // Draw flow connections using the canonical tile flows
    const connections = getFlowConnections(tileType as TileType, 0); // rotation 0
    this.ctx.strokeStyle = "#888888";
    this.ctx.lineWidth = size * 0.15; // Proportional to tile size
    this.ctx.lineCap = "round";

    connections.forEach(([dir1, dir2]) => {
      this.drawSmallFlowConnection(center, dir1, dir2, size);
    });
  }

  private drawSmallFlowConnection(
    center: { x: number; y: number },
    dir1: number,
    dir2: number,
    size: number
  ): void {
    // Get edge midpoints using the proper hexLayout functions
    const start = getEdgeMidpoint(center, size, dir1);
    const end = getEdgeMidpoint(center, size, dir2);

    // Get control points (perpendicular to edges)
    const control1Vec = getPerpendicularVector(dir1, size);
    const control2Vec = getPerpendicularVector(dir2, size);

    const control1 = {
      x: start.x + control1Vec.x,
      y: start.y + control1Vec.y,
    };
    const control2 = {
      x: end.x + control2Vec.x,
      y: end.y + control2Vec.y,
    };

    this.ctx.beginPath();
    this.ctx.moveTo(start.x, start.y);
    this.ctx.bezierCurveTo(
      control1.x,
      control1.y,
      control2.x,
      control2.y,
      end.x,
      end.y,
    );
    this.ctx.stroke();
  }

  private drawSmallHexagon(center: { x: number; y: number }, size: number, fill: boolean): void {
    this.ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const vertex = getHexVertex(center, size, i);
      if (i === 0) {
        this.ctx.moveTo(vertex.x, vertex.y);
      } else {
        this.ctx.lineTo(vertex.x, vertex.y);
      }
    }
    this.ctx.closePath();
    if (fill) {
      this.ctx.fill();
    } else {
      this.ctx.stroke();
    }
  }


  private calculateTotalTiles(
    distribution: [number, number, number, number],
    boardRadius: number
  ): { totalTiles: number; numGroups: number } {
    return calculateTileCountsFromRatio(boardRadius, distribution);
  }

  private renderHelpDialog(
    canvasWidth: number,
    canvasHeight: number,
    corner: number, // 0=bottom-left, 1=bottom-right, 2=top-right, 3=top-left
  ): void {
    // Semi-transparent overlay
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Dialog box dimensions
    const dialogWidth = Math.min(500, canvasWidth * 0.8);
    const dialogHeight = Math.min(600, canvasHeight * 0.8);
    
    // Position dialog based on which corner was clicked
    let dialogX: number, dialogY: number;
    const margin = 20;
    
    switch (corner) {
      case 0: // bottom-left
        dialogX = margin;
        dialogY = canvasHeight - dialogHeight - margin;
        break;
      case 1: // bottom-right
        dialogX = canvasWidth - dialogWidth - margin;
        dialogY = canvasHeight - dialogHeight - margin;
        break;
      case 2: // top-right
        dialogX = canvasWidth - dialogWidth - margin;
        dialogY = margin;
        break;
      case 3: // top-left
        dialogX = margin;
        dialogY = margin;
        break;
      default:
        dialogX = (canvasWidth - dialogWidth) / 2;
        dialogY = (canvasHeight - dialogHeight) / 2;
    }

    // Dialog background
    this.ctx.fillStyle = "#2a2a3e";
    this.ctx.fillRect(dialogX, dialogY, dialogWidth, dialogHeight);
    this.ctx.strokeStyle = "#2196F3";
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(dialogX, dialogY, dialogWidth, dialogHeight);

    // Title
    this.ctx.fillStyle = "#ffffff";
    this.ctx.font = "bold 24px sans-serif";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "top";
    this.ctx.fillText("How to Play", dialogX + dialogWidth / 2, dialogY + 20);

    // Help content
    const contentX = dialogX + 30;
    let contentY = dialogY + 70;
    const lineHeight = 30;

    this.ctx.font = "16px sans-serif";
    this.ctx.textAlign = "left";
    this.ctx.fillStyle = "#ffffff";

    // Lobby-specific help
    const helpLines = [
      "Adding Players:",
      "• Click the colored + buttons on each edge",
      "• Players join from their chosen edge",
      "• Each player gets a unique color",
      "",
      "Starting the Game:",
      "• Need at least 2 players to start",
      "• Click the ▶ play button in the center",
      "• Players will select their board edges",
      "",
      "Game Settings:",
      "• Click the ⚙ gear icon for options",
      "• Adjust board size, tile distribution",
      "• Enable/disable special moves",
      "",
      "Click anywhere to close this help",
    ];

    helpLines.forEach((line, index) => {
      const y = contentY + index * lineHeight;
      if (line.startsWith("•")) {
        // Indent bullet points
        this.ctx.fillText(line, contentX + 20, y);
      } else if (line === "") {
        // Skip empty lines
      } else {
        // Headers
        this.ctx.font = "bold 16px sans-serif";
        this.ctx.fillText(line, contentX, y);
        this.ctx.font = "16px sans-serif";
      }
    });
  }
}
