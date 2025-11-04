// End-to-end tests for lobby interactions using mouse clicks only
// Tests the rotated player labels and remove button functionality

import { test, expect } from '@playwright/test';
import { getReduxState , pauseAnimations, enableDeterministicPlayerIds } from './helpers';

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
// This calculates the actual position based on the player's edge with rotation transformation
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
    
    // Calculate column and row for this player
    const column = useDoubleColumn ? playerIndex % 2 : 0;
    const row = useDoubleColumn ? Math.floor(playerIndex / 2) : playerIndex;
    
    // Calculate position in bottom-edge coordinates (before rotation)
    let x: number, y: number;
    const edge = player.edge;
    
    // Always calculate in bottom-edge space first
    if (useDoubleColumn) {
      x = canvasWidth / 2 - entryWidth - columnSpacing / 2 + column * (entryWidth + columnSpacing);
    } else {
      x = canvasWidth / 2 - entryWidth / 2;
    }
    y = canvasHeight - edgeMargin - buttonSize - edgeMargin - (row + 1) * (entryHeight + 5);
    
    // Calculate remove button center in bottom-edge coordinates
    const removeBtnCenterX = x + entryWidth - removeButtonSize / 2 - 5;
    const removeBtnCenterY = y + entryHeight / 2;
    
    // Apply rotation transformation (matching lobbyLayout.ts transformPoint function)
    const rotation = edge * 90; // 0, 90, 180, 270 degrees
    const screenCenterX = canvasWidth / 2;
    const screenCenterY = canvasHeight / 2;
    
    // Calculate offset from screen center in bottom-edge coordinates
    const xOffset = removeBtnCenterX - screenCenterX;
    const yOffset = removeBtnCenterY - screenCenterY;
    
    // Apply rotation around the origin
    const angleRad = (rotation * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    
    let rotatedX = xOffset * cos - yOffset * sin;
    const rotatedY = xOffset * sin + yOffset * cos;
    
    // Apply aspect ratio adjustment for left/right edges
    if (rotation === 90 || rotation === 270) {
      const maxDim = Math.max(canvasWidth, canvasHeight);
      const edgeAdjustment = (maxDim - minDim) / 2;
      
      const isPortrait = canvasHeight > canvasWidth;
      
      // Translate(0, y) after rotation maps to X-axis adjustment differently for 90° vs 270°
      // For 90°: translate(0, y) → (-y, 0) in original coords
      // For 270°: translate(0, y) → (y, 0) in original coords
      const adjustment = isPortrait ? -edgeAdjustment : edgeAdjustment;
      
      if (rotation === 90) {
        rotatedX -= adjustment;
      } else {
        rotatedX += adjustment;
      }
    }
    
    // Return transformed coordinates
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
    await enableDeterministicPlayerIds(page);
  });

  test('should add players from all four edges using mouse clicks', async ({ page }) => {
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Take screenshot of initial lobby
    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/007-lobby-interactions/001-initial-lobby.png' });

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

    // Take screenshot showing all 4 players
    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/007-lobby-interactions/002-four-players-added.png' });
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

    // Take screenshot with player at bottom
    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/007-lobby-interactions/003-player-at-bottom.png' });
    
    // Click remove button for the player
    const removeCoords = await getRemoveButtonCoordinates(page, 0);
    if (!removeCoords) throw new Error('Remove button not found');
    
    await page.mouse.click(box.x + removeCoords.x, box.y + removeCoords.y);
    await page.waitForTimeout(100);
    
    // Verify player was removed
    state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(0);

    // Take screenshot after removal
    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/007-lobby-interactions/004-player-removed.png' });
  });

  test('should remove player from right edge using X button', async ({ page }) => {
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

    // Take screenshot with player at right edge
    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/007-lobby-interactions/005-player-at-right.png' });
    
    // Click remove button
    const removeCoords = await getRemoveButtonCoordinates(page, 0);
    if (!removeCoords) throw new Error('Remove button not found');
    
    await page.mouse.click(box.x + removeCoords.x, box.y + removeCoords.y);
    await page.waitForTimeout(100);
    
    // Verify player was removed
    state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(0);
  });

  test('should remove player from top edge using X button', async ({ page }) => {
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

    // Take screenshot with player at top edge
    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/007-lobby-interactions/006-player-at-top.png' });
    
    // Click remove button
    const removeCoords = await getRemoveButtonCoordinates(page, 0);
    if (!removeCoords) throw new Error('Remove button not found');
    
    await page.mouse.click(box.x + removeCoords.x, box.y + removeCoords.y);
    await page.waitForTimeout(100);
    
    // Verify player was removed
    state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(0);
  });

  test('should remove player from left edge using X button', async ({ page }) => {
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

    // Take screenshot with player at left edge
    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/007-lobby-interactions/007-player-at-left.png' });
    
    // Click remove button
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

    // Take screenshot with 4 players
    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/007-lobby-interactions/008-four-players-before-removal.png' });
    
    // Remove player from right edge (index 1)
    let removeCoords = await getRemoveButtonCoordinates(page, 1);
    if (!removeCoords) throw new Error('Remove button not found');
    await page.mouse.click(box.x + removeCoords.x, box.y + removeCoords.y);
    await page.waitForTimeout(100);
    
    state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(3);

    // Take screenshot after first removal
    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/007-lobby-interactions/009-after-removing-right.png' });
    
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

    // Take screenshot of final state
    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/007-lobby-interactions/010-two-players-remain.png' });
  });

  test('should work in portrait orientation', async ({ page }) => {
    // Set portrait viewport
    await page.setViewportSize({ width: 720, height: 1024 });
    
    // Reload page to ensure canvas is properly sized for portrait
    await page.reload();
    await page.waitForSelector('canvas#game-canvas');
    await page.waitForTimeout(200);
    
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Take screenshot of portrait lobby
    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/007-lobby-interactions/011-portrait-initial.png' });

    // Add players from bottom and top edges (simpler for portrait testing)
    const playersToAdd = [
      { colorIndex: 0, edge: 0 as const },  // Blue from bottom
      { colorIndex: 1, edge: 2 as const },  // Orange from top
    ];
    
    for (const player of playersToAdd) {
      const coords = await getEdgeButtonCoordinates(page, player.colorIndex, player.edge);
      if (!coords) continue;
      await page.mouse.click(box.x + coords.x, box.y + coords.y);
      await page.waitForTimeout(100);
    }
    
    let state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(2);

    // Take screenshot with players in portrait mode
    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/007-lobby-interactions/012-portrait-with-players.png' });
    
    // Remove player from bottom edge using X button
    const removeCoords = await getRemoveButtonCoordinates(page, 0);
    if (!removeCoords) throw new Error('Remove button not found');
    
    await page.mouse.click(box.x + removeCoords.x, box.y + removeCoords.y);
    await page.waitForTimeout(100);
    
    // Verify player was removed
    state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(1);
    expect(state.game.configPlayers[0].edge).toBe(2); // Top edge remains

    // Take screenshot after removal in portrait
    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/007-lobby-interactions/013-portrait-after-removal.png' });
  });

  test('should work with left/right edges in portrait mode', async ({ page }) => {
    // Set portrait viewport
    await page.setViewportSize({ width: 720, height: 1024 });
    
    // Reload page to ensure canvas is properly sized for portrait
    await page.reload();
    await page.waitForSelector('canvas#game-canvas');
    await page.waitForTimeout(200);
    
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Add players from left and right edges in portrait mode
    // This verifies that player labels stay visible and properly positioned
    const playersToAdd = [
      { colorIndex: 0, edge: 1 as const },  // Blue from right edge
      { colorIndex: 1, edge: 3 as const },  // Orange from left edge
    ];
    
    for (const player of playersToAdd) {
      const coords = await getEdgeButtonCoordinates(page, player.colorIndex, player.edge);
      if (!coords) continue;
      await page.mouse.click(box.x + coords.x, box.y + coords.y);
      await page.waitForTimeout(100);
    }
    
    let state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(2);

    // Take screenshot showing left/right edge players are now visible in portrait mode
    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/007-lobby-interactions/014-portrait-left-right.png' });
    
    // Test removal of player from right edge using X button
    let removeCoords = await getRemoveButtonCoordinates(page, 0);
    if (!removeCoords) throw new Error('Remove button not found for right edge player');
    
    await page.mouse.click(box.x + removeCoords.x, box.y + removeCoords.y);
    await page.waitForTimeout(100);
    
    state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(1);
    expect(state.game.configPlayers[0].edge).toBe(3); // Left edge remains
    
    // Take screenshot after removing right edge player
    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/007-lobby-interactions/015-portrait-after-right-removal.png' });
    
    // Test removal of player from left edge using X button
    removeCoords = await getRemoveButtonCoordinates(page, 0);
    if (!removeCoords) throw new Error('Remove button not found for left edge player');
    
    await page.mouse.click(box.x + removeCoords.x, box.y + removeCoords.y);
    await page.waitForTimeout(100);
    
    state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(0);
    
    // Take screenshot after removing left edge player
    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/007-lobby-interactions/016-portrait-after-left-removal.png' });
  });
});
