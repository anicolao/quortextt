// End-to-end tests for lobby interactions using mouse clicks only
// Tests the rotated player labels and remove button functionality

import { test, expect } from '@playwright/test';
import { getReduxState } from './helpers';

// Helper to get edge button coordinates
async function getEdgeButtonCoordinates(page: any, colorIndex: number, edge: 0 | 1 | 2 | 3) {
  return await page.evaluate(({ colorIndex, edge }: { colorIndex: number; edge: number }) => {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const minDim = Math.min(canvasWidth, canvasHeight);
    const buttonSize = Math.max(60, minDim * 0.08);
    const edgeMargin = minDim * 0.05;
    const buttonSpacing = buttonSize * 0.3;
    
    // Get available colors
    const state = (window as any).__REDUX_STORE__.getState();
    const players = state.game.configPlayers;
    const PLAYER_COLORS = ['#0173B2', '#DE8F05', '#029E73', '#ECE133', '#CC78BC', '#CA5127'];
    const usedColors = new Set(players.map((p: any) => p.color));
    const availableColors = PLAYER_COLORS.filter(color => !usedColors.has(color));
    
    const targetColor = PLAYER_COLORS[colorIndex];
    const availableIndex = availableColors.indexOf(targetColor);
    
    if (availableIndex === -1) return null;
    
    let x: number, y: number;
    
    if (edge === 0) { // Bottom
      const totalWidth = availableColors.length * buttonSize + (availableColors.length - 1) * buttonSpacing;
      const startX = (canvasWidth - totalWidth) / 2;
      x = startX + availableIndex * (buttonSize + buttonSpacing) + buttonSize / 2;
      y = canvasHeight - edgeMargin - buttonSize / 2;
    } else if (edge === 1) { // Right
      const totalHeight = availableColors.length * buttonSize + (availableColors.length - 1) * buttonSpacing;
      const startY = (canvasHeight - totalHeight) / 2;
      x = canvasWidth - edgeMargin - buttonSize / 2;
      y = startY + availableIndex * (buttonSize + buttonSpacing) + buttonSize / 2;
    } else if (edge === 2) { // Top
      const totalWidth = availableColors.length * buttonSize + (availableColors.length - 1) * buttonSpacing;
      const startX = (canvasWidth - totalWidth) / 2;
      x = startX + availableIndex * (buttonSize + buttonSpacing) + buttonSize / 2;
      y = edgeMargin + buttonSize / 2;
    } else { // Left
      const totalHeight = availableColors.length * buttonSize + (availableColors.length - 1) * buttonSpacing;
      const startY = (canvasHeight - totalHeight) / 2;
      x = edgeMargin + buttonSize / 2;
      y = startY + availableIndex * (buttonSize + buttonSpacing) + buttonSize / 2;
    }
    
    return { x, y };
  }, { colorIndex, edge });
}

// Helper to get remove button coordinates for a specific player
// This uses the transformed coordinates that account for rotation
async function getRemoveButtonCoordinates(page: any, playerIndex: number) {
  return await page.evaluate(({ playerIndex }: { playerIndex: number }) => {
    const state = (window as any).__REDUX_STORE__.getState();
    const players = state.game.configPlayers;
    
    if (playerIndex >= players.length) return null;
    
    const player = players[playerIndex];
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const minDim = Math.min(canvasWidth, canvasHeight);
    const maxDim = Math.max(canvasWidth, canvasHeight);
    const buttonSize = Math.max(60, minDim * 0.08);
    const edgeMargin = minDim * 0.05;
    const entryWidth = minDim * 0.18;
    const entryHeight = minDim * 0.08;
    const removeButtonSize = entryHeight * 0.5;
    const columnSpacing = 10;
    const startButtonSize = Math.max(100, minDim * 0.12);
    
    // Determine if double column layout is needed
    const centerToEdge = Math.min(canvasWidth, canvasHeight) / 2 - startButtonSize / 2;
    const availableSpace = centerToEdge - edgeMargin - buttonSize - edgeMargin * 2;
    const singleColumnHeight = players.length * (entryHeight + 5);
    const useDoubleColumn = singleColumnHeight > availableSpace;
    
    // Calculate position for this player in bottom-edge coordinates
    const column = useDoubleColumn ? playerIndex % 2 : 0;
    const row = useDoubleColumn ? Math.floor(playerIndex / 2) : playerIndex;
    
    let x: number, y: number;
    if (useDoubleColumn) {
      x = canvasWidth / 2 - entryWidth - columnSpacing / 2 + column * (entryWidth + columnSpacing);
    } else {
      x = canvasWidth / 2 - entryWidth / 2;
    }
    y = canvasHeight - edgeMargin - buttonSize - edgeMargin - (row + 1) * (entryHeight + 5);
    
    // Calculate remove button center in bottom-edge coordinates
    const removeBtnCenterX = x + entryWidth - removeButtonSize / 2 - 5;
    const removeBtnCenterY = y + entryHeight / 2;
    
    // Get rotation for player's edge
    const rotation = player.edge * 90; // 0, 90, 180, 270
    
    // Transform point through rotation (matching lobbyLayout.ts transformPoint)
    const screenCenterX = canvasWidth / 2;
    const screenCenterY = canvasHeight / 2;
    
    const xOffset = removeBtnCenterX - screenCenterX;
    const yOffset = removeBtnCenterY - screenCenterY;
    
    const angleRad = (rotation * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    
    const rotatedX = xOffset * cos - yOffset * sin;
    let rotatedY = xOffset * sin + yOffset * cos;
    
    // Apply aspect ratio adjustment for left/right edges
    if (rotation === 90 || rotation === 270) {
      const edgeAdjustment = (maxDim - minDim) / 2;
      rotatedY += edgeAdjustment;
    }
    
    return {
      x: screenCenterX + rotatedX,
      y: screenCenterY + rotatedY
    };
  }, { playerIndex });
}

test.describe('Lobby Mouse Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
  });

  test('should add players from all four edges using mouse clicks', async ({ page }) => {
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Add one player from each edge
    const playersToAdd = [
      { colorIndex: 0, edge: 0 as const, name: 'bottom' },  // Blue from bottom
      { colorIndex: 1, edge: 1 as const, name: 'right' },   // Orange from right
      { colorIndex: 2, edge: 2 as const, name: 'top' },     // Green from top
      { colorIndex: 3, edge: 3 as const, name: 'left' },    // Yellow from left
    ];
    
    for (const player of playersToAdd) {
      const coords = await getEdgeButtonCoordinates(page, player.colorIndex, player.edge);
      if (!coords) throw new Error(`Button coordinates not found for ${player.name} edge`);
      
      await page.mouse.click(box.x + coords.x, box.y + coords.y);
      await page.waitForTimeout(100);
    }
    
    // Verify all 4 players were added
    const state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(4);
    
    // Verify each player has the correct edge
    expect(state.game.configPlayers[0].edge).toBe(0); // Bottom
    expect(state.game.configPlayers[1].edge).toBe(1); // Right
    expect(state.game.configPlayers[2].edge).toBe(2); // Top
    expect(state.game.configPlayers[3].edge).toBe(3); // Left
  });

  test('should remove player from bottom edge using X button', async ({ page }) => {
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Add a player from bottom edge
    const coords = await getEdgeButtonCoordinates(page, 0, 0); // Blue from bottom
    if (!coords) throw new Error('Button not found');
    await page.mouse.click(box.x + coords.x, box.y + coords.y);
    await page.waitForTimeout(100);
    
    let state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(1);
    
    // Click remove button for the player
    const removeCoords = await getRemoveButtonCoordinates(page, 0);
    if (!removeCoords) throw new Error('Remove button not found');
    
    await page.mouse.click(box.x + removeCoords.x, box.y + removeCoords.y);
    await page.waitForTimeout(100);
    
    // Verify player was removed
    state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(0);
  });

  test('should remove player from right edge using rotated X button', async ({ page }) => {
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Add a player from right edge
    const coords = await getEdgeButtonCoordinates(page, 0, 1); // Blue from right
    if (!coords) throw new Error('Button not found');
    await page.mouse.click(box.x + coords.x, box.y + coords.y);
    await page.waitForTimeout(100);
    
    let state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(1);
    expect(state.game.configPlayers[0].edge).toBe(1); // Right edge
    
    // Click remove button (should be rotated 90° clockwise)
    const removeCoords = await getRemoveButtonCoordinates(page, 0);
    if (!removeCoords) throw new Error('Remove button not found');
    
    await page.mouse.click(box.x + removeCoords.x, box.y + removeCoords.y);
    await page.waitForTimeout(100);
    
    // Verify player was removed
    state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(0);
  });

  test('should remove player from top edge using rotated X button', async ({ page }) => {
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Add a player from top edge
    const coords = await getEdgeButtonCoordinates(page, 0, 2); // Blue from top
    if (!coords) throw new Error('Button not found');
    await page.mouse.click(box.x + coords.x, box.y + coords.y);
    await page.waitForTimeout(100);
    
    let state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(1);
    expect(state.game.configPlayers[0].edge).toBe(2); // Top edge
    
    // Click remove button (should be rotated 180°)
    const removeCoords = await getRemoveButtonCoordinates(page, 0);
    if (!removeCoords) throw new Error('Remove button not found');
    
    await page.mouse.click(box.x + removeCoords.x, box.y + removeCoords.y);
    await page.waitForTimeout(100);
    
    // Verify player was removed
    state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(0);
  });

  test('should remove player from left edge using rotated X button', async ({ page }) => {
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Add a player from left edge
    const coords = await getEdgeButtonCoordinates(page, 0, 3); // Blue from left
    if (!coords) throw new Error('Button not found');
    await page.mouse.click(box.x + coords.x, box.y + coords.y);
    await page.waitForTimeout(100);
    
    let state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(1);
    expect(state.game.configPlayers[0].edge).toBe(3); // Left edge
    
    // Click remove button (should be rotated 270° clockwise)
    const removeCoords = await getRemoveButtonCoordinates(page, 0);
    if (!removeCoords) throw new Error('Remove button not found');
    
    await page.mouse.click(box.x + removeCoords.x, box.y + removeCoords.y);
    await page.waitForTimeout(100);
    
    // Verify player was removed
    state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(0);
  });

  test('should handle multiple players and remove from different edges', async ({ page }) => {
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Add 4 players from different edges
    const playersToAdd = [
      { colorIndex: 0, edge: 0 as const },  // Blue from bottom
      { colorIndex: 1, edge: 1 as const },  // Orange from right
      { colorIndex: 2, edge: 2 as const },  // Green from top
      { colorIndex: 3, edge: 3 as const },  // Yellow from left
    ];
    
    for (const player of playersToAdd) {
      const coords = await getEdgeButtonCoordinates(page, player.colorIndex, player.edge);
      if (!coords) continue;
      await page.mouse.click(box.x + coords.x, box.y + coords.y);
      await page.waitForTimeout(100);
    }
    
    let state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(4);
    
    // Remove player from right edge (index 1)
    let removeCoords = await getRemoveButtonCoordinates(page, 1);
    if (!removeCoords) throw new Error('Remove button not found');
    await page.mouse.click(box.x + removeCoords.x, box.y + removeCoords.y);
    await page.waitForTimeout(100);
    
    state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(3);
    
    // Remove player from top edge (now index 1 after previous removal)
    removeCoords = await getRemoveButtonCoordinates(page, 1);
    if (!removeCoords) throw new Error('Remove button not found');
    await page.mouse.click(box.x + removeCoords.x, box.y + removeCoords.y);
    await page.waitForTimeout(100);
    
    state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(2);
    
    // Verify remaining players are from bottom and left edges
    expect(state.game.configPlayers[0].edge).toBe(0); // Bottom
    expect(state.game.configPlayers[1].edge).toBe(3); // Left
  });

  test('should work in portrait orientation', async ({ page }) => {
    // Set portrait viewport
    await page.setViewportSize({ width: 720, height: 1024 });
    await page.waitForTimeout(200);
    
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Add players from left and right edges (where overlap could occur in portrait)
    const playersToAdd = [
      { colorIndex: 0, edge: 1 as const },  // Blue from right
      { colorIndex: 1, edge: 3 as const },  // Orange from left
    ];
    
    for (const player of playersToAdd) {
      const coords = await getEdgeButtonCoordinates(page, player.colorIndex, player.edge);
      if (!coords) continue;
      await page.mouse.click(box.x + coords.x, box.y + coords.y);
      await page.waitForTimeout(100);
    }
    
    let state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(2);
    
    // Remove player from right edge using X button
    const removeCoords = await getRemoveButtonCoordinates(page, 0);
    if (!removeCoords) throw new Error('Remove button not found');
    
    await page.mouse.click(box.x + removeCoords.x, box.y + removeCoords.y);
    await page.waitForTimeout(100);
    
    // Verify player was removed
    state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(1);
    expect(state.game.configPlayers[0].edge).toBe(3); // Left edge remains
  });
});
