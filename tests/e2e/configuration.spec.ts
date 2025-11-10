// End-to-end tests for the game configuration screen (redesigned edge-based lobby)

import { test, expect } from '@playwright/test';
import { getReduxState, completeSeatingPhase, pauseAnimations, waitForAnimationFrame } from './helpers';

// Helper to get edge button coordinates for the new lobby
// colorIndex: 0=blue, 1=orange, 2=green, 3=yellow, 4=purple, 5=red
// edge: 0=bottom, 1=right, 2=top, 3=left
async function getEdgeButtonCoordinates(page: any, colorIndex: number, edge: 0 | 1 | 2 | 3 = 0) {
  return await page.evaluate(({ colorIndex, edge }: { colorIndex: number; edge: number }) => {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const minDim = Math.min(canvasWidth, canvasHeight);
    const buttonSize = Math.max(60, minDim * 0.08);
    const edgeMargin = minDim * 0.05;
    const buttonSpacing = buttonSize * 0.3;
    
    // Get available colors from Redux
    const state = (window as any).__REDUX_STORE__.getState();
    const players = state.game.configPlayers;
    const PLAYER_COLORS = ['#0173B2', '#DE8F05', '#029E73', '#ECE133', '#CC78BC', '#CA5127'];
    const usedColors = new Set(players.map((p: any) => p.color));
    const availableColors = PLAYER_COLORS.filter(color => !usedColors.has(color));
    
    // Find the actual index in available colors
    const targetColor = PLAYER_COLORS[colorIndex];
    const availableIndex = availableColors.indexOf(targetColor);
    
    if (availableIndex === -1) {
      // Color not available
      return null;
    }
    
    // Calculate position based on edge
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

// Helper to get START button coordinates
async function getStartButtonCoordinates(page: any) {
  return await page.evaluate(() => {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    return { x: canvasWidth / 2, y: canvasHeight / 2 };
  });
}

test.describe('Configuration Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
  });

  test('should display the edge-based lobby with color buttons', async ({ page }) => {
    // Verify canvas exists
    const canvas = await page.locator('canvas#game-canvas');
    await expect(canvas).toBeVisible();
    
    // Verify initial state
    const state = await getReduxState(page);
    expect(state.game.screen).toBe('configuration');
    expect(state.game.configPlayers.length).toBe(0);
    
    // Take a screenshot of the initial state
    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/001-initial-state.png' });
  });

  test('should add a player when clicking a color button', async ({ page }) => {
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Click blue button (index 0) at bottom edge
    const coords = await getEdgeButtonCoordinates(page, 0, 0);
    if (!coords) throw new Error('Button coordinates not found');
    
    await page.mouse.click(box.x + coords.x, box.y + coords.y);
    await waitForAnimationFrame(page);
    
    // Verify a player was added
    const state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(1);
    expect(state.game.configPlayers[0].color).toBe('#0173B2'); // Blue
    expect(state.game.configPlayers[0].edge).toBe(0); // Bottom edge
    expect(state.game.configPlayers[0].id).toBeDefined();

    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/002-player-added.png' });
  });

  test('should add multiple players from different edges', async ({ page }) => {
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Add 3 players from different edges and colors
    const playersToAdd = [
      { colorIndex: 0, edge: 0 as const }, // Blue from bottom
      { colorIndex: 1, edge: 1 as const }, // Orange from right
      { colorIndex: 2, edge: 2 as const }, // Green from top
    ];
    
    for (const player of playersToAdd) {
      const coords = await getEdgeButtonCoordinates(page, player.colorIndex, player.edge);
      if (!coords) throw new Error('Button coordinates not found');
      await page.mouse.click(box.x + coords.x, box.y + coords.y);
      await waitForAnimationFrame(page);
    }
    
    // Verify 3 players were added
    const state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(3);
    // Verify they have different colors
    const colors = state.game.configPlayers.map((p: any) => p.color);
    expect(new Set(colors).size).toBe(3); // All different colors

    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/003-multiple-players.png' });
  });

  test('should not add more than 6 players', async ({ page }) => {
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Add all 6 colors (max players)
    for (let i = 0; i < 6; i++) {
      const coords = await getEdgeButtonCoordinates(page, i, 0);
      if (coords) {
        await page.mouse.click(box.x + coords.x, box.y + coords.y);
        await waitForAnimationFrame(page);
      }
    }
    
    // Verify only 6 players were added (MAX_PLAYERS)
    const state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(6);

    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/004-max-players.png' });
  });

  test('should remove a player when X button is clicked', async ({ page }) => {
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Add 4 players to better demonstrate removal functionality
    const playersToAdd = [
      { colorIndex: 0, edge: 0 as const },
      { colorIndex: 1, edge: 0 as const },
      { colorIndex: 2, edge: 0 as const },
      { colorIndex: 3, edge: 0 as const },
    ];
    
    for (const player of playersToAdd) {
      const coords = await getEdgeButtonCoordinates(page, player.colorIndex, player.edge);
      if (!coords) continue;
      await page.mouse.click(box.x + coords.x, box.y + coords.y);
      await waitForAnimationFrame(page);
    }
    
    let state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(4);

    // Click remove button for first player at bottom edge
    // Calculate the actual remove button position using the same logic as lobbyLayout
    const removeButtonCoords = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const state = (window as any).__REDUX_STORE__.getState();
      const players = state.game.configPlayers;
      
      // Replicate lobbyLayout calculations
      const minDim = Math.min(canvasWidth, canvasHeight);
      const buttonSize = Math.max(60, minDim * 0.08);
      const edgeMargin = minDim * 0.05;
      const entryWidth = minDim * 0.18;
      const entryHeight = minDim * 0.08;
      const removeButtonSize = entryHeight * 0.5;
      const columnSpacing = 10;
      
      // For bottom edge (edge=0), first player (index=0)
      const edge = 0;
      const index = 0;
      
      // Calculate available space and determine if double column is needed
      const startButtonSize = Math.max(120, minDim * 0.15);
      const centerToEdge = Math.min(canvasWidth, canvasHeight) / 2 - startButtonSize / 2;
      const availableSpace = centerToEdge - edgeMargin - buttonSize - edgeMargin * 2;
      const singleColumnHeight = players.length * (entryHeight + 5);
      const useDoubleColumn = singleColumnHeight > availableSpace;
      
      // Calculate position for first player (index 0)
      const column = useDoubleColumn ? index % 2 : 0;
      const row = useDoubleColumn ? Math.floor(index / 2) : index;
      
      let x: number, y: number;
      if (useDoubleColumn) {
        x = canvasWidth / 2 - entryWidth - columnSpacing / 2 + column * (entryWidth + columnSpacing);
      } else {
        x = canvasWidth / 2 - entryWidth / 2;
      }
      y = canvasHeight - edgeMargin - buttonSize - edgeMargin - (row + 1) * (entryHeight + 5);
      
      // Remove button position (from lobbyLayout line 242-244)
      // The `5` is a right margin to keep the button inside the player entry box
      const btnX = x + entryWidth - removeButtonSize - 5;
      const btnY = y + (entryHeight - removeButtonSize) / 2;
      
      // Return the CENTER of the button for clicking
      return {
        x: btnX + removeButtonSize / 2,
        y: btnY + removeButtonSize / 2,
      };
    });
    
    await page.mouse.click(box.x + removeButtonCoords.x, box.y + removeButtonCoords.y);
    await waitForAnimationFrame(page);
    
    // Verify one player was removed (3 remaining out of 4)
    state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(3);

    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/005-player-removed.png' });
  });

  test('should change player color by removing and re-adding', async ({ page }) => {
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Add a player with blue color
    let coords = await getEdgeButtonCoordinates(page, 0, 0); // Blue
    if (!coords) throw new Error('Button not found');
    await page.mouse.click(box.x + coords.x, box.y + coords.y);
    await waitForAnimationFrame(page);
    
    const initialState = await getReduxState(page);
    expect(initialState.game.configPlayers[0].color).toBe('#0173B2'); // Blue

    // Remove the player (single player, single column layout)
    const removeButtonCoords = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const minDim = Math.min(canvasWidth, canvasHeight);
      const entryWidth = minDim * 0.18;  // Updated to match new layout
      const entryHeight = minDim * 0.08;
      const removeButtonSize = entryHeight * 0.5;
      
      // Single player is in column 0, row 0
      const x = canvasWidth / 2 - entryWidth / 2 + entryWidth - removeButtonSize / 2 - 5;
      const y = canvasHeight - minDim * 0.05 - Math.max(60, minDim * 0.08) - minDim * 0.05 - entryHeight / 2;
      
      return { x, y };
    });
    
    await page.mouse.click(box.x + removeButtonCoords.x, box.y + removeButtonCoords.y);
    await waitForAnimationFrame(page);

    // Add a player with orange color
    coords = await getEdgeButtonCoordinates(page, 1, 0); // Orange
    if (!coords) throw new Error('Button not found');
    await page.mouse.click(box.x + coords.x, box.y + coords.y);
    await waitForAnimationFrame(page);
    
    // Verify color changed
    const newState = await getReduxState(page);
    expect(newState.game.configPlayers[0].color).toBe('#DE8F05'); // Orange

    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/007-color-changed.png' });
  });

  test('should start game when Start button is clicked with players', async ({ page }) => {
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Add a player
    const coords = await getEdgeButtonCoordinates(page, 0, 0);
    if (!coords) throw new Error('Button not found');
    await page.mouse.click(box.x + coords.x, box.y + coords.y);
    await waitForAnimationFrame(page);
    
    let state = await getReduxState(page);
    expect(state.game.screen).toBe('configuration');
    expect(state.game.configPlayers.length).toBe(1);

    // Click Start button (center)
    const startCoords = await getStartButtonCoordinates(page);
    await page.mouse.click(box.x + startCoords.x, box.y + startCoords.y);
    await waitForAnimationFrame(page);
    
    // Verify we're now in seating phase
    state = await getReduxState(page);
    expect(state.game.screen).toBe('seating');
    expect(state.game.seatingPhase.active).toBe(true);

    // Complete the seating phase
    await completeSeatingPhase(page, canvas, box);
    
    // Verify screen changed to gameplay
    state = await getReduxState(page);
    expect(state.game.screen).toBe('gameplay');

    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/009-game-started.png' });
  });

  test('should not allow duplicate colors', async ({ page }) => {
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Add 2 players with different colors
    const playersToAdd = [
      { colorIndex: 0, edge: 0 as const },
      { colorIndex: 1, edge: 0 as const },
    ];
    
    for (const player of playersToAdd) {
      const coords = await getEdgeButtonCoordinates(page, player.colorIndex, player.edge);
      if (!coords) continue;
      await page.mouse.click(box.x + coords.x, box.y + coords.y);
      await waitForAnimationFrame(page);
    }
    
    const state = await getReduxState(page);
    const player1Color = state.game.configPlayers[0].color;
    const player2Color = state.game.configPlayers[1].color;
    
    expect(player1Color).not.toBe(player2Color);
    expect(state.game.configPlayers.length).toBe(2);

    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/010-no-duplicate-colors.png' });
  });

  // Comprehensive user story test that generates all screenshots in a continuous flow
  test('User Story: Complete player configuration flow', async ({ page }) => {
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Helper function to get remove button coordinates for a specific player
    async function getRemoveButtonCoordinates(page: any, playerIndex: number) {
      return await page.evaluate((index: number) => {
        const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const state = (window as any).__REDUX_STORE__.getState();
        const players = state.game.configPlayers;
        
        if (index >= players.length) return null;
        
        const minDim = Math.min(canvasWidth, canvasHeight);
        const buttonSize = Math.max(60, minDim * 0.08);
        const edgeMargin = minDim * 0.05;
        const entryWidth = minDim * 0.18;
        const entryHeight = minDim * 0.08;
        const removeButtonSize = entryHeight * 0.5;
        const columnSpacing = 10;
        
        // Calculate available space and determine if double column is needed
        const startButtonSize = Math.max(120, minDim * 0.15);
        const centerToEdge = Math.min(canvasWidth, canvasHeight) / 2 - startButtonSize / 2;
        const availableSpace = centerToEdge - edgeMargin - buttonSize - edgeMargin * 2;
        const singleColumnHeight = players.length * (entryHeight + 5);
        const useDoubleColumn = singleColumnHeight > availableSpace;
        
        // Calculate position for the specified player
        const column = useDoubleColumn ? index % 2 : 0;
        const row = useDoubleColumn ? Math.floor(index / 2) : index;
        
        let x: number, y: number;
        if (useDoubleColumn) {
          x = canvasWidth / 2 - entryWidth - columnSpacing / 2 + column * (entryWidth + columnSpacing);
        } else {
          x = canvasWidth / 2 - entryWidth / 2;
        }
        y = canvasHeight - edgeMargin - buttonSize - edgeMargin - (row + 1) * (entryHeight + 5);
        
        // Remove button position
        const btnX = x + entryWidth - removeButtonSize - 5;
        const btnY = y + (entryHeight - removeButtonSize) / 2;
        
        return {
          x: btnX + removeButtonSize / 2,
          y: btnY + removeButtonSize / 2,
        };
      }, playerIndex);
    }

    // STEP 1: Initial state (0 players)
    let state = await getReduxState(page);
    expect(state.game.screen).toBe('configuration');
    expect(state.game.configPlayers.length).toBe(0);
    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/001-initial-state.png' });

    // STEP 2: Add first player (1 player - Blue)
    let coords = await getEdgeButtonCoordinates(page, 0, 0); // Blue
    if (!coords) throw new Error('Button not found');
    await page.mouse.click(box.x + coords.x, box.y + coords.y);
    await waitForAnimationFrame(page);
    
    state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(1);
    expect(state.game.configPlayers[0].color).toBe('#0173B2'); // Blue
    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/002-player-added.png' });

    // STEP 3: Add second player (2 players - Blue, Orange)
    coords = await getEdgeButtonCoordinates(page, 1, 1); // Orange from right
    if (!coords) throw new Error('Button not found');
    await page.mouse.click(box.x + coords.x, box.y + coords.y);
    await waitForAnimationFrame(page);
    
    state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(2);
    expect(state.game.configPlayers[1].color).toBe('#DE8F05'); // Orange
    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/003-second-player-added.png' });

    // STEP 4: Add third player (3 players - Blue, Orange, Green)
    coords = await getEdgeButtonCoordinates(page, 2, 2); // Green from top
    if (!coords) throw new Error('Button not found');
    await page.mouse.click(box.x + coords.x, box.y + coords.y);
    await waitForAnimationFrame(page);
    
    state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(3);
    expect(state.game.configPlayers[2].color).toBe('#029E73'); // Green
    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/004-third-player-added.png' });

    // STEP 5: Add fourth player (4 players)
    coords = await getEdgeButtonCoordinates(page, 3, 0); // Yellow
    if (!coords) throw new Error('Button not found');
    await page.mouse.click(box.x + coords.x, box.y + coords.y);
    await waitForAnimationFrame(page);
    
    state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(4);
    expect(state.game.configPlayers[3].color).toBe('#ECE133'); // Yellow
    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/005-fourth-player-added.png' });

    // STEP 6: Add fifth player (5 players)
    coords = await getEdgeButtonCoordinates(page, 4, 0); // Purple
    if (!coords) throw new Error('Button not found');
    await page.mouse.click(box.x + coords.x, box.y + coords.y);
    await waitForAnimationFrame(page);
    
    state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(5);
    expect(state.game.configPlayers[4].color).toBe('#CC78BC'); // Purple
    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/006-fifth-player-added.png' });

    // STEP 7: Add sixth player - max players (6 players)
    coords = await getEdgeButtonCoordinates(page, 5, 0); // Red
    if (!coords) throw new Error('Button not found');
    await page.mouse.click(box.x + coords.x, box.y + coords.y);
    await waitForAnimationFrame(page);
    
    state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(6);
    expect(state.game.configPlayers[5].color).toBe('#CA5127'); // Red
    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/007-max-players.png' });

    // STEP 8: Remove first player (5 players remaining)
    const firstPlayerColor = state.game.configPlayers[0].color;
    let removeCoords = await getRemoveButtonCoordinates(page, 0);
    if (!removeCoords) throw new Error('Remove button not found');
    await page.mouse.click(box.x + removeCoords.x, box.y + removeCoords.y);
    await waitForAnimationFrame(page);
    
    state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(5);
    expect(state.game.configPlayers[0].color).not.toBe(firstPlayerColor);
    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/008-player-removed.png' });

    // STEP 9: Remove second player (4 players remaining)
    const secondPlayerColor = state.game.configPlayers[0].color;
    removeCoords = await getRemoveButtonCoordinates(page, 0);
    if (!removeCoords) throw new Error('Remove button not found');
    await page.mouse.click(box.x + removeCoords.x, box.y + removeCoords.y);
    await waitForAnimationFrame(page);
    
    state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(4);
    expect(state.game.configPlayers[0].color).not.toBe(secondPlayerColor);
    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/009-second-player-removed.png' });

    // STEP 10: Remove third player (3 players remaining)
    const thirdPlayerColor = state.game.configPlayers[0].color;
    removeCoords = await getRemoveButtonCoordinates(page, 0);
    if (!removeCoords) throw new Error('Remove button not found');
    await page.mouse.click(box.x + removeCoords.x, box.y + removeCoords.y);
    await waitForAnimationFrame(page);
    
    state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(3);
    expect(state.game.configPlayers[0].color).not.toBe(thirdPlayerColor);
    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/010-third-player-removed.png' });

    // STEP 11: Remove fourth player (2 players remaining)
    const fourthPlayerColor = state.game.configPlayers[0].color;
    removeCoords = await getRemoveButtonCoordinates(page, 0);
    if (!removeCoords) throw new Error('Remove button not found');
    await page.mouse.click(box.x + removeCoords.x, box.y + removeCoords.y);
    await waitForAnimationFrame(page);
    
    state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(2);
    expect(state.game.configPlayers[0].color).not.toBe(fourthPlayerColor);
    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/011-two-players-ready.png' });

    // STEP 12: Click Start Game button
    const startCoords = await getStartButtonCoordinates(page);
    await page.mouse.click(box.x + startCoords.x, box.y + startCoords.y);
    await waitForAnimationFrame(page);
    
    state = await getReduxState(page);
    expect(state.game.screen).toBe('seating');
    expect(state.game.seatingPhase.active).toBe(true);
    expect(state.game.seatingPhase.seatingOrder.length).toBe(2);
    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/012-seating-screen.png' });

    // STEP 13: Player 1 selects their seat (edge 0)
    let seatingCoords = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const minDimension = Math.min(canvasWidth, canvasHeight);
      const boardRadius = 3; // Default board size
      const canvasSizeMultiplier = ((boardRadius * 2 + 2) * 2 + 1); // = 17 for boardRadius=3
      const size = minDimension / canvasSizeMultiplier;
      const originX = canvasWidth / 2;
      const originY = canvasHeight / 2;
      const boardRadiusMultiplier = boardRadius * 2 + 1.2; // = 7.2 for boardRadius=3
      const boardRadiusPixels = size * boardRadiusMultiplier + size * 0.8;
      const edgeAngles = [270, 330, 30, 90, 150, 210];
      const angle = edgeAngles[0]; // Edge 0
      const angleRad = (angle * Math.PI) / 180;
      const x = originX + boardRadiusPixels * Math.cos(angleRad);
      const y = originY + boardRadiusPixels * Math.sin(angleRad);
      return { x, y };
    });
    await page.mouse.click(box.x + seatingCoords.x, box.y + seatingCoords.y);
    await waitForAnimationFrame(page);
    
    state = await getReduxState(page);
    expect(state.game.screen).toBe('seating');
    expect(state.game.seatingPhase.seatingIndex).toBe(1); // One player has selected
    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/013-player1-seated.png' });

    // STEP 14: Player 2 selects their seat (edge 1)
    seatingCoords = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const minDimension = Math.min(canvasWidth, canvasHeight);
      const boardRadius = 3; // Default board size
      const canvasSizeMultiplier = ((boardRadius * 2 + 2) * 2 + 1); // = 17 for boardRadius=3
      const size = minDimension / canvasSizeMultiplier;
      const originX = canvasWidth / 2;
      const originY = canvasHeight / 2;
      const boardRadiusMultiplier = boardRadius * 2 + 1.2; // = 7.2 for boardRadius=3
      const boardRadiusPixels = size * boardRadiusMultiplier + size * 0.8;
      const edgeAngles = [270, 330, 30, 90, 150, 210];
      const angle = edgeAngles[1]; // Edge 1
      const angleRad = (angle * Math.PI) / 180;
      const x = originX + boardRadiusPixels * Math.cos(angleRad);
      const y = originY + boardRadiusPixels * Math.sin(angleRad);
      return { x, y };
    });
    await page.mouse.click(box.x + seatingCoords.x, box.y + seatingCoords.y);
    await waitForAnimationFrame(page); // Wait for transition to gameplay
    
    state = await getReduxState(page);
    expect(state.game.screen).toBe('gameplay');
    await pauseAnimations(page);
    await page.screenshot({ path: 'tests/e2e/user-stories/001-player-configuration/014-gameplay-started.png' });
  });
});

