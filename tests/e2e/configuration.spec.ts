// End-to-end tests for the game configuration screen

import { test, expect } from '@playwright/test';
import { getReduxState } from './helpers';

// Helper to get button coordinates from the layout
async function getButtonCoordinates(page: any, buttonType: 'add-player' | 'start-game') {
  return await page.evaluate((type: string) => {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const padding = Math.min(canvasWidth, canvasHeight) * 0.05;
    const titleSize = Math.min(canvasWidth, canvasHeight) * 0.06;
    const titleY = padding + titleSize;
    const buttonHeight = Math.min(canvasWidth, canvasHeight) * 0.08;
    const buttonWidth = Math.min(canvasWidth * 0.6, 400);
    
    // Get current players count from Redux store
    const state = (window as any).__REDUX_STORE__.getState();
    const players = state.game.configPlayers;
    
    // Calculate player list area
    const playerListStartY = titleY + titleSize + padding * 2;
    const colorIconSize = Math.min(canvasWidth, canvasHeight) * 0.06;
    const playerEntryHeight = colorIconSize + padding * 0.5;
    
    // Add Player button position (depends on number of players)
    const addPlayerButtonY = players.length > 0
      ? playerListStartY + players.length * playerEntryHeight + padding * 1.5
      : playerListStartY;
    
    const addPlayerButtonCenterX = canvasWidth / 2;
    const addPlayerButtonCenterY = addPlayerButtonY + buttonHeight / 2;
    
    // Start Game button is below Add Player button
    const startGameButtonCenterY = addPlayerButtonY + buttonHeight + padding + buttonHeight / 2;
    
    if (type === 'add-player') {
      return { x: addPlayerButtonCenterX, y: addPlayerButtonCenterY };
    } else {
      return { x: addPlayerButtonCenterX, y: startGameButtonCenterY };
    }
  }, buttonType);
}

test.describe('Configuration Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
  });

  test('should display the title and initial buttons', async ({ page }) => {
    // Verify canvas exists
    const canvas = await page.locator('canvas#game-canvas');
    await expect(canvas).toBeVisible();
    
    // Verify initial state
    const state = await getReduxState(page);
    expect(state.game.screen).toBe('configuration');
    expect(state.game.configPlayers.length).toBe(0);
    
    // Take a screenshot of the initial state
    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/001-initial-state.png' });
  });

  test('should add a player when Add Player button is clicked', async ({ page }) => {
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Get the correct button coordinates
    const coords = await getButtonCoordinates(page, 'add-player');
    
    // Click the Add Player button
    await page.mouse.click(box.x + coords.x, box.y + coords.y);
    await page.waitForTimeout(100);
    
    // Verify a player was added
    const state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(1);
    expect(state.game.configPlayers[0].color).toBeDefined();
    expect(state.game.configPlayers[0].id).toBeDefined();

    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/002-player-added.png' });
  });

  test('should add multiple players', async ({ page }) => {
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Add 3 players
    for (let i = 0; i < 3; i++) {
      const coords = await getButtonCoordinates(page, 'add-player');
      await page.mouse.click(box.x + coords.x, box.y + coords.y);
      await page.waitForTimeout(100);
    }
    
    // Verify 3 players were added
    const state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(3);
    // Verify they have different colors
    const colors = state.game.configPlayers.map((p: any) => p.color);
    expect(new Set(colors).size).toBe(3); // All different colors

    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/003-multiple-players.png' });
  });

  test('should not add more than 6 players', async ({ page }) => {
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Try to add 8 players
    for (let i = 0; i < 8; i++) {
      const coords = await getButtonCoordinates(page, 'add-player');
      await page.mouse.click(box.x + coords.x, box.y + coords.y);
      await page.waitForTimeout(50);
    }
    
    // Verify only 6 players were added (MAX_PLAYERS)
    const state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(6);

    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/004-max-players.png' });
  });

  test('should remove a player when X button is clicked', async ({ page }) => {
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Add 2 players
    for (let i = 0; i < 2; i++) {
      const coords = await getButtonCoordinates(page, 'add-player');
      await page.mouse.click(box.x + coords.x, box.y + coords.y);
      await page.waitForTimeout(100);
    }
    
    let state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(2);

    // Click remove button for first player
    const removeButtonCoords = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const padding = Math.min(canvasWidth, canvasHeight) * 0.05;
      const titleSize = Math.min(canvasWidth, canvasHeight) * 0.06;
      const titleY = padding + titleSize;
      const playerListStartY = titleY + titleSize + padding * 2;
      const buttonWidth = Math.min(canvasWidth * 0.6, 400);
      const removeButtonSize = Math.min(canvasWidth, canvasHeight) * 0.05;
      const entryX = canvasWidth / 2 - buttonWidth / 2;
      
      return {
        x: entryX + buttonWidth - removeButtonSize / 2,
        y: playerListStartY + removeButtonSize / 2
      };
    });
    
    await page.mouse.click(box.x + removeButtonCoords.x, box.y + removeButtonCoords.y);
    await page.waitForTimeout(100);
    
    // Verify one player was removed
    state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(1);

    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/005-player-removed.png' });
  });

  test('should show color picker when clicking on player color', async ({ page }) => {
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Add a player
    const addCoords = await getButtonCoordinates(page, 'add-player');
    await page.mouse.click(box.x + addCoords.x, box.y + addCoords.y);
    await page.waitForTimeout(100);

    // Click on the color icon
    const colorIconCoords = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const padding = Math.min(canvasWidth, canvasHeight) * 0.05;
      const titleSize = Math.min(canvasWidth, canvasHeight) * 0.06;
      const titleY = padding + titleSize;
      const playerListStartY = titleY + titleSize + padding * 2;
      const buttonWidth = Math.min(canvasWidth * 0.6, 400);
      const colorIconSize = Math.min(canvasWidth, canvasHeight) * 0.06;
      const entryX = canvasWidth / 2 - buttonWidth / 2;
      
      return {
        x: entryX + colorIconSize / 2,
        y: playerListStartY + colorIconSize / 2
      };
    });
    
    await page.mouse.click(box.x + colorIconCoords.x, box.y + colorIconCoords.y);
    await page.waitForTimeout(100);

    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/006-color-picker-open.png' });
  });

  test('should change player color when selecting from picker', async ({ page }) => {
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Add a player
    const addCoords = await getButtonCoordinates(page, 'add-player');
    await page.mouse.click(box.x + addCoords.x, box.y + addCoords.y);
    await page.waitForTimeout(100);
    
    const initialState = await getReduxState(page);
    const initialColor = initialState.game.configPlayers[0].color;

    // Click on the color icon to open picker
    const colorIconCoords = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const padding = Math.min(canvasWidth, canvasHeight) * 0.05;
      const titleSize = Math.min(canvasWidth, canvasHeight) * 0.06;
      const titleY = padding + titleSize;
      const playerListStartY = titleY + titleSize + padding * 2;
      const buttonWidth = Math.min(canvasWidth * 0.6, 400);
      const colorIconSize = Math.min(canvasWidth, canvasHeight) * 0.06;
      const entryX = canvasWidth / 2 - buttonWidth / 2;
      
      return {
        x: entryX + colorIconSize / 2,
        y: playerListStartY + colorIconSize / 2
      };
    });
    await page.mouse.click(box.x + colorIconCoords.x, box.y + colorIconCoords.y);
    await page.waitForTimeout(100);

    // Click on a different color in the picker (second color in top row)
    const newColorCoords = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const pickerWidth = Math.min(canvasWidth * 0.8, 500);
      const pickerHeight = Math.min(canvasHeight * 0.5, 300);
      const pickerX = canvasWidth / 2 - pickerWidth / 2;
      const pickerY = canvasHeight / 2 - pickerHeight / 2;
      const colorSize = Math.min(pickerWidth, pickerHeight) * 0.15;
      const spacing = colorSize * 1.3;
      const startX = pickerX + (pickerWidth - spacing * 3) / 2 + colorSize / 2;
      const startY = pickerY + pickerHeight * 0.35;
      
      // Second color (index 1, col 1)
      return {
        x: startX + spacing,
        y: startY
      };
    });
    await page.mouse.click(box.x + newColorCoords.x, box.y + newColorCoords.y);
    await page.waitForTimeout(100);
    
    // Verify color changed
    const newState = await getReduxState(page);
    expect(newState.game.configPlayers[0].color).not.toBe(initialColor);

    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/007-color-changed.png' });
  });

  test('should close color picker when clicking outside', async ({ page }) => {
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Add a player
    const addCoords = await getButtonCoordinates(page, 'add-player');
    await page.mouse.click(box.x + addCoords.x, box.y + addCoords.y);
    await page.waitForTimeout(100);

    // Open color picker
    const colorIconCoords = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const padding = Math.min(canvasWidth, canvasHeight) * 0.05;
      const titleSize = Math.min(canvasWidth, canvasHeight) * 0.06;
      const titleY = padding + titleSize;
      const playerListStartY = titleY + titleSize + padding * 2;
      const buttonWidth = Math.min(canvasWidth * 0.6, 400);
      const colorIconSize = Math.min(canvasWidth, canvasHeight) * 0.06;
      const entryX = canvasWidth / 2 - buttonWidth / 2;
      
      return {
        x: entryX + colorIconSize / 2,
        y: playerListStartY + colorIconSize / 2
      };
    });
    await page.mouse.click(box.x + colorIconCoords.x, box.y + colorIconCoords.y);
    await page.waitForTimeout(100);

    // Click outside the picker (top-left corner)
    await page.mouse.click(box.x + 50, box.y + 50);
    await page.waitForTimeout(100);

    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/008-picker-closed.png' });
  });

  test('should start game when Start Game button is clicked with players', async ({ page }) => {
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Add a player
    const addCoords = await getButtonCoordinates(page, 'add-player');
    await page.mouse.click(box.x + addCoords.x, box.y + addCoords.y);
    await page.waitForTimeout(100);
    
    let state = await getReduxState(page);
    expect(state.game.screen).toBe('configuration');
    expect(state.game.configPlayers.length).toBe(1);

    // Click Start Game button
    const startCoords = await getButtonCoordinates(page, 'start-game');
    await page.mouse.click(box.x + startCoords.x, box.y + startCoords.y);
    await page.waitForTimeout(100);
    
    // Verify screen changed to gameplay
    state = await getReduxState(page);
    expect(state.game.screen).toBe('gameplay');

    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/009-game-started.png' });
  });

  test('should swap colors when selecting a color already in use', async ({ page }) => {
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Add 2 players
    for (let i = 0; i < 2; i++) {
      const coords = await getButtonCoordinates(page, 'add-player');
      await page.mouse.click(box.x + coords.x, box.y + coords.y);
      await page.waitForTimeout(100);
    }
    
    const beforeState = await getReduxState(page);
    const player1ColorBefore = beforeState.game.configPlayers[0].color;
    const player2ColorBefore = beforeState.game.configPlayers[1].color;
    
    expect(player1ColorBefore).not.toBe(player2ColorBefore);

    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/010-two-players-before-swap.png' });

    // Click on first player's color icon
    const colorIconCoords = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const padding = Math.min(canvasWidth, canvasHeight) * 0.05;
      const titleSize = Math.min(canvasWidth, canvasHeight) * 0.06;
      const titleY = padding + titleSize;
      const playerListStartY = titleY + titleSize + padding * 2;
      const buttonWidth = Math.min(canvasWidth * 0.6, 400);
      const colorIconSize = Math.min(canvasWidth, canvasHeight) * 0.06;
      const entryX = canvasWidth / 2 - buttonWidth / 2;
      
      return {
        x: entryX + colorIconSize / 2,
        y: playerListStartY + colorIconSize / 2
      };
    });
    await page.mouse.click(box.x + colorIconCoords.x, box.y + colorIconCoords.y);
    await page.waitForTimeout(100);

    // Click on second player's color in the picker
    // Find which color index player 2 has, then click it
    const player2ColorIndex = await page.evaluate((color: string) => {
      const PLAYER_COLORS = ['#0173B2', '#DE8F05', '#CC78BC', '#029E73', '#ECE133', '#56B4E9'];
      return PLAYER_COLORS.indexOf(color);
    }, player2ColorBefore);
    
    const swatchCoords = await page.evaluate((index: number) => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const pickerWidth = Math.min(canvasWidth * 0.8, 500);
      const pickerHeight = Math.min(canvasHeight * 0.5, 300);
      const pickerX = canvasWidth / 2 - pickerWidth / 2;
      const pickerY = canvasHeight / 2 - pickerHeight / 2;
      const colorSize = Math.min(pickerWidth, pickerHeight) * 0.15;
      const spacing = colorSize * 1.3;
      const startX = pickerX + (pickerWidth - spacing * 3) / 2 + colorSize / 2;
      const startY = pickerY + pickerHeight * 0.35;
      
      const row = Math.floor(index / 3);
      const col = index % 3;
      
      return {
        x: startX + col * spacing,
        y: startY + row * spacing
      };
    }, player2ColorIndex);
    
    await page.mouse.click(box.x + swatchCoords.x, box.y + swatchCoords.y);
    await page.waitForTimeout(100);
    
    // Verify colors were swapped
    const afterState = await getReduxState(page);
    expect(afterState.game.configPlayers[0].color).toBe(player2ColorBefore);
    expect(afterState.game.configPlayers[1].color).toBe(player1ColorBefore);

    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/011-colors-swapped.png' });
  });
});

