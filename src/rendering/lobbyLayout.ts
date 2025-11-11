// Lobby UI layout calculations for the redesigned edge-based lobby

import { ConfigPlayer, PLAYER_COLORS, Edge } from "../redux/types";

export interface EdgeButton {
  x: number;
  y: number;
  size: number;
  color: string;
  edge: Edge;
  rotation: number; // 0, 90, 180, 270 degrees
}

export interface StartButton {
  x: number;
  y: number;
  size: number;
  enabled: boolean;
}

export interface ExitButton {
  x: number;
  y: number;
  size: number;
  corner: 0 | 1 | 2 | 3; // 0=bottom-left, 1=bottom-right, 2=top-right, 3=top-left
}

export interface HelpButton {
  x: number;
  y: number;
  size: number;
  edge: Edge; // Which edge this help button belongs to (0=bottom, 1=right, 2=top, 3=left)
  corner: 0 | 1 | 2 | 3; // 0=bottom-left, 1=bottom-right, 2=top-right, 3=top-left
}

export interface SettingsButton {
  x: number;
  y: number;
  size: number;
}

export interface PlayerListEntry {
  player: ConfigPlayer;
  x: number;
  y: number;
  width: number;
  height: number;
  edge: Edge;
  rotation: number;
  removeButton: {
    x: number;
    y: number;
    size: number;
  };
}

export interface SettingsControl {
  type: 'checkbox' | 'number' | 'close' | 'reset-distribution';
  x: number;
  y: number;
  width: number;
  height: number;
  settingKey?: keyof import('../redux/types').GameSettings;
  label?: string;
  tileIndex?: number; // For tile distribution controls (0-3)
}

export interface SettingsDialogLayout {
  controls: SettingsControl[];
  dialogX: number;
  dialogY: number;
  dialogWidth: number;
  dialogHeight: number;
}

export interface LobbyLayout {
  edgeButtons: EdgeButton[];
  startButton: StartButton;
  exitButtons: ExitButton[];
  helpButtons: HelpButton[];
  settingsButton: SettingsButton;
  playerLists: PlayerListEntry[][]; // One list per edge [bottom, right, top, left]
  settingsDialog: SettingsDialogLayout | null;
}

// Calculate which colors are available (not yet taken by players)
function getAvailableColors(players: ConfigPlayer[]): string[] {
  const usedColors = new Set(players.map((p) => p.color));
  return PLAYER_COLORS.filter((color) => !usedColors.has(color));
}

// Calculate layout for the redesigned lobby
export function calculateLobbyLayout(
  canvasWidth: number,
  canvasHeight: number,
  players: ConfigPlayer[],
): LobbyLayout {
  const minDim = Math.min(canvasWidth, canvasHeight);
  const buttonSize = Math.max(60, minDim * 0.08); // Minimum 60px for touch targets
  const exitButtonSize = Math.max(50, minDim * 0.06);
  const startButtonSize = Math.max(100, minDim * 0.12);
  const edgeMargin = minDim * 0.05;
  const buttonSpacing = buttonSize * 0.3;

  const availableColors = getAvailableColors(players);

  // Calculate edge buttons (+ buttons) for each edge
  const edgeButtons: EdgeButton[] = [];

  // Bottom edge (0°)
  const bottomY = canvasHeight - edgeMargin - buttonSize;
  availableColors.forEach((color, index) => {
    const totalWidth =
      availableColors.length * buttonSize +
      (availableColors.length - 1) * buttonSpacing;
    const startX = (canvasWidth - totalWidth) / 2;
    edgeButtons.push({
      x: startX + index * (buttonSize + buttonSpacing),
      y: bottomY,
      size: buttonSize,
      color,
      edge: 0,
      rotation: 0,
    });
  });

  // Right edge (90° clockwise)
  const rightX = canvasWidth - edgeMargin - buttonSize;
  availableColors.forEach((color, index) => {
    const totalHeight =
      availableColors.length * buttonSize +
      (availableColors.length - 1) * buttonSpacing;
    const startY = (canvasHeight - totalHeight) / 2;
    edgeButtons.push({
      x: rightX,
      y: startY + index * (buttonSize + buttonSpacing),
      size: buttonSize,
      color,
      edge: 1,
      rotation: 90,
    });
  });

  // Top edge (180°)
  const topY = edgeMargin;
  availableColors.forEach((color, index) => {
    const totalWidth =
      availableColors.length * buttonSize +
      (availableColors.length - 1) * buttonSpacing;
    const startX = (canvasWidth - totalWidth) / 2;
    edgeButtons.push({
      x: startX + index * (buttonSize + buttonSpacing),
      y: topY,
      size: buttonSize,
      color,
      edge: 2,
      rotation: 180,
    });
  });

  // Left edge (270° clockwise)
  const leftX = edgeMargin;
  availableColors.forEach((color, index) => {
    const totalHeight =
      availableColors.length * buttonSize +
      (availableColors.length - 1) * buttonSpacing;
    const startY = (canvasHeight - totalHeight) / 2;
    edgeButtons.push({
      x: leftX,
      y: startY + index * (buttonSize + buttonSpacing),
      size: buttonSize,
      color,
      edge: 3,
      rotation: 270,
    });
  });

  // Center start button
  const startButton: StartButton = {
    x: canvasWidth / 2 - startButtonSize / 2,
    y: canvasHeight / 2 - startButtonSize / 2,
    size: startButtonSize,
    enabled: players.length > 0,
  };

  // Settings button (gear icon) - positioned below start button
  const settingsButtonSize = Math.max(60, minDim * 0.08);
  const settingsButton: SettingsButton = {
    x: canvasWidth / 2 - settingsButtonSize / 2,
    y: canvasHeight / 2 + startButtonSize / 2 + minDim * 0.08,
    size: settingsButtonSize,
  };

  // Corner exit buttons
  const exitButtons: ExitButton[] = [
    {
      x: exitButtonSize / 2,
      y: canvasHeight - exitButtonSize / 2,
      size: exitButtonSize,
      corner: 0, // bottom-left
    },
    {
      x: canvasWidth - exitButtonSize / 2,
      y: canvasHeight - exitButtonSize / 2,
      size: exitButtonSize,
      corner: 1, // bottom-right
    },
    {
      x: canvasWidth - exitButtonSize / 2,
      y: exitButtonSize / 2,
      size: exitButtonSize,
      corner: 2, // top-right
    },
    {
      x: exitButtonSize / 2,
      y: exitButtonSize / 2,
      size: exitButtonSize,
      corner: 3, // top-left
    },
  ];

  // Help buttons (? buttons) - one per edge, positioned in lower-left from each edge's perspective
  const helpButtonSize = exitButtonSize;
  const helpButtonSpacing = exitButtonSize * 0.15;
  const helpButtons: HelpButton[] = [
    {
      // Edge 0 (bottom): lower-left from bottom perspective = bottom-left corner
      x: exitButtonSize / 2 + exitButtonSize + helpButtonSpacing,
      y: canvasHeight - exitButtonSize / 2,
      size: helpButtonSize,
      edge: 0,
      corner: 0,
    },
    {
      // Edge 1 (right): lower-left from right perspective = bottom-right corner (rotated 90° CW)
      x: canvasWidth - exitButtonSize / 2 - exitButtonSize - helpButtonSpacing,
      y: canvasHeight - exitButtonSize / 2,
      size: helpButtonSize,
      edge: 1,
      corner: 1,
    },
    {
      // Edge 2 (top): lower-left from top perspective = top-right corner (rotated 180°)
      x: canvasWidth - exitButtonSize / 2 - exitButtonSize - helpButtonSpacing,
      y: exitButtonSize / 2,
      size: helpButtonSize,
      edge: 2,
      corner: 2,
    },
    {
      // Edge 3 (left): lower-left from left perspective = top-left corner (rotated 270° CW)
      x: exitButtonSize / 2 + exitButtonSize + helpButtonSpacing,
      y: exitButtonSize / 2,
      size: helpButtonSize,
      edge: 3,
      corner: 3,
    },
  ];

  // Player lists (one per edge, showing all players)
  const playerLists: PlayerListEntry[][] = [[], [], [], []];
  const entryWidth = minDim * 0.18; // Smaller to fit two columns
  const entryHeight = minDim * 0.08;
  const removeButtonSize = entryHeight * 0.5;
  const columnSpacing = 10;

  // Sort players by join order (timestamp implicit in array order)
  const sortedPlayers = [...players];

  // Calculate available space for player lists at each edge
  // Space between edge buttons and start button
  const centerToEdge =
    Math.min(canvasWidth, canvasHeight) / 2 - startButtonSize / 2;
  const availableSpace =
    centerToEdge - edgeMargin - buttonSize - edgeMargin * 2;

  // Determine if we need two columns
  const singleColumnHeight = sortedPlayers.length * (entryHeight + 5);
  const useDoubleColumn = singleColumnHeight > availableSpace;

  // For each edge, create player list entries
  // Always calculate positions as if on bottom edge, renderer will rotate around screen center
  for (let edge = 0; edge < 4; edge++) {
    sortedPlayers.forEach((player, index) => {
      // Calculate column and row for this player
      const column = useDoubleColumn ? index % 2 : 0;
      const row = useDoubleColumn ? Math.floor(index / 2) : index;

      // Always calculate position as if on bottom edge
      let x: number, y: number;
      if (useDoubleColumn) {
        x =
          canvasWidth / 2 -
          entryWidth -
          columnSpacing / 2 +
          column * (entryWidth + columnSpacing);
      } else {
        x = canvasWidth / 2 - entryWidth / 2;
      }
      y =
        canvasHeight -
        edgeMargin -
        buttonSize -
        edgeMargin -
        (row + 1) * (entryHeight + 5);

      // Rotation depends on which edge this list is for
      const rotation = edge * 90; // 0, 90, 180, 270

      // Calculate remove button position in bottom-edge coordinates
      const removeBtnX = x + entryWidth - removeButtonSize - 5;
      const removeBtnY = y + (entryHeight - removeButtonSize) / 2;

      // Transform remove button center position to match rendered position after rotation
      const removeBtnCenterX = removeBtnX + removeButtonSize / 2;
      const removeBtnCenterY = removeBtnY + removeButtonSize / 2;
      const screenCenterX = canvasWidth / 2;
      const screenCenterY = canvasHeight / 2;

      const transformedCenter = transformPoint(
        removeBtnCenterX,
        removeBtnCenterY,
        rotation,
        screenCenterX,
        screenCenterY,
        canvasWidth,
        canvasHeight,
      );

      playerLists[edge].push({
        player,
        x,
        y,
        width: entryWidth,
        height: entryHeight,
        edge: edge as Edge,
        rotation,
        removeButton: {
          // Store button top-left from transformed center
          x: transformedCenter.x - removeButtonSize / 2,
          y: transformedCenter.y - removeButtonSize / 2,
          size: removeButtonSize,
        },
      });
    });
  }

  return {
    edgeButtons,
    startButton,
    exitButtons,
    helpButtons,
    settingsButton,
    playerLists,
    settingsDialog: null,
  };
}

// Check if a point is inside a button (accounting for rotation)
export function isPointInButton(
  x: number,
  y: number,
  button: { x: number; y: number; size: number },
): boolean {
  return (
    x >= button.x &&
    x <= button.x + button.size &&
    y >= button.y &&
    y <= button.y + button.size
  );
}

// Check if a point is inside a circular button
export function isPointInCircle(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  radius: number,
): boolean {
  const dx = x - centerX;
  const dy = y - centerY;
  return dx * dx + dy * dy <= radius * radius;
}

/**
 * Transform a point through rotation around screen center.
 * This matches the transformation applied during rendering, ensuring that
 * hit detection coordinates align with the visual representation.
 *
 * @param x - X coordinate in bottom-edge space (pre-rotation)
 * @param y - Y coordinate in bottom-edge space (pre-rotation)
 * @param rotation - Rotation angle in degrees (0, 90, 180, 270)
 * @param screenCenterX - X coordinate of screen center
 * @param screenCenterY - Y coordinate of screen center
 * @param canvasWidth - Width of the canvas
 * @param canvasHeight - Height of the canvas
 * @returns Transformed coordinates after rotation and aspect ratio adjustment
 */
export function transformPoint(
  x: number,
  y: number,
  rotation: number,
  screenCenterX: number,
  screenCenterY: number,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  // Calculate offset from screen center in bottom-edge coordinates
  const xOffset = x - screenCenterX;
  const yOffset = y - screenCenterY;

  // Apply rotation around the origin
  const angleRad = (rotation * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  let rotatedX = xOffset * cos - yOffset * sin;
  const rotatedY = xOffset * sin + yOffset * cos;

  // Apply aspect ratio adjustment for left/right edges to maintain consistent
  // distance from + buttons in both landscape and portrait orientations
  if (rotation === 90 || rotation === 270) {
    const minDim = Math.min(canvasWidth, canvasHeight);
    const maxDim = Math.max(canvasWidth, canvasHeight);
    const edgeAdjustment = (maxDim - minDim) / 2;
    
    const isPortrait = canvasHeight > canvasWidth;
    
    // Translate(0, y) after rotation maps to X-axis adjustment
    // For 90°: translate(0, y) → (-y, 0) in original coords
    // For 270°: translate(0, y) → (y, 0) in original coords
    const adjustment = isPortrait ? -edgeAdjustment : edgeAdjustment;
    
    if (rotation === 90) {
      rotatedX -= adjustment;
    } else {
      rotatedX += adjustment;
    }
  }

  // Translate back to screen coordinates
  return {
    x: screenCenterX + rotatedX,
    y: screenCenterY + rotatedY,
  };
}
