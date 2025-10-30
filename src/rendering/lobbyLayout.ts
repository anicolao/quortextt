// Lobby UI layout calculations for the redesigned edge-based lobby

import { ConfigPlayer, PLAYER_COLORS, Edge } from '../redux/types';

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

export interface LobbyLayout {
  edgeButtons: EdgeButton[];
  startButton: StartButton;
  exitButtons: ExitButton[];
  playerLists: PlayerListEntry[][]; // One list per edge [bottom, right, top, left]
}

// Calculate which colors are available (not yet taken by players)
function getAvailableColors(players: ConfigPlayer[]): string[] {
  const usedColors = new Set(players.map(p => p.color));
  return PLAYER_COLORS.filter(color => !usedColors.has(color));
}

// Calculate layout for the redesigned lobby
export function calculateLobbyLayout(
  canvasWidth: number,
  canvasHeight: number,
  players: ConfigPlayer[]
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
    const totalWidth = availableColors.length * buttonSize + (availableColors.length - 1) * buttonSpacing;
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
    const totalHeight = availableColors.length * buttonSize + (availableColors.length - 1) * buttonSpacing;
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
    const totalWidth = availableColors.length * buttonSize + (availableColors.length - 1) * buttonSpacing;
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
    const totalHeight = availableColors.length * buttonSize + (availableColors.length - 1) * buttonSpacing;
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

  // Player lists (one per edge, showing all players)
  const playerLists: PlayerListEntry[][] = [[], [], [], []];
  const entryWidth = minDim * 0.18;  // Smaller to fit two columns
  const entryHeight = minDim * 0.08;
  const removeButtonSize = entryHeight * 0.5;
  const columnSpacing = 10;

  // Sort players by join order (timestamp implicit in array order)
  const sortedPlayers = [...players];

  // Calculate available space for player lists at each edge
  // Space between edge buttons and start button
  const centerToEdge = Math.min(canvasWidth, canvasHeight) / 2 - startButtonSize / 2;
  const availableSpace = centerToEdge - edgeMargin - buttonSize - edgeMargin * 2;
  
  // Determine if we need two columns
  const singleColumnHeight = sortedPlayers.length * (entryHeight + 5);
  const useDoubleColumn = singleColumnHeight > availableSpace;

  // For each edge, create player list entries
  for (let edge = 0; edge < 4; edge++) {
    sortedPlayers.forEach((player, index) => {
      let x: number, y: number, rotation: number;
      
      // Calculate column and row for this player
      const column = useDoubleColumn ? index % 2 : 0;
      const row = useDoubleColumn ? Math.floor(index / 2) : index;

      switch (edge) {
        case 0: // Bottom
          if (useDoubleColumn) {
            x = canvasWidth / 2 - entryWidth - columnSpacing / 2 + column * (entryWidth + columnSpacing);
          } else {
            x = canvasWidth / 2 - entryWidth / 2;
          }
          y = canvasHeight - edgeMargin - buttonSize - edgeMargin - (row + 1) * (entryHeight + 5);
          rotation = 0;
          break;
        case 1: // Right
          x = canvasWidth - edgeMargin - buttonSize - edgeMargin - entryWidth - column * (entryWidth + columnSpacing);
          y = canvasHeight / 2 - entryHeight / 2 - row * (entryHeight + 5);
          rotation = 90;
          break;
        case 2: // Top
          if (useDoubleColumn) {
            x = canvasWidth / 2 - entryWidth - columnSpacing / 2 + column * (entryWidth + columnSpacing);
          } else {
            x = canvasWidth / 2 - entryWidth / 2;
          }
          y = edgeMargin + buttonSize + edgeMargin + row * (entryHeight + 5);
          rotation = 180;
          break;
        case 3: // Left
          x = edgeMargin + buttonSize + edgeMargin + column * (entryWidth + columnSpacing);
          y = canvasHeight / 2 - entryHeight / 2 + row * (entryHeight + 5);
          rotation = 270;
          break;
        default:
          x = 0;
          y = 0;
          rotation = 0;
      }

      playerLists[edge].push({
        player,
        x,
        y,
        width: entryWidth,
        height: entryHeight,
        edge: edge as Edge,
        rotation,
        removeButton: {
          x: x + entryWidth - removeButtonSize - 5,
          y: y + (entryHeight - removeButtonSize) / 2,
          size: removeButtonSize,
        },
      });
    });
  }

  return {
    edgeButtons,
    startButton,
    exitButtons,
    playerLists,
  };
}

// Check if a point is inside a button (accounting for rotation)
export function isPointInButton(
  x: number,
  y: number,
  button: { x: number; y: number; size: number }
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
  radius: number
): boolean {
  const dx = x - centerX;
  const dy = y - centerY;
  return dx * dx + dy * dy <= radius * radius;
}
