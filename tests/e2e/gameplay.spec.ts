// End-to-end tests for the gameplay screen rendering
import { test, expect } from '@playwright/test';
import { getReduxState, completeSeatingPhase , pauseAnimations } from './helpers';

// Helper to wait for next animation frame (ensures Redux state updates are complete)
async function waitForNextFrame(page: any) {
  await page.evaluate(() => {
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });
  });
}

// Helper to setup a game with Purple and Red players (matching end of 001-player-configuration)
async function setupTwoPlayerGame(page: any) {
  await page.goto('/');
  await page.waitForSelector('canvas#game-canvas');
  
  const canvas = page.locator('canvas#game-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');
  
  // Add two players with Purple and Red colors (matching the end of 001-player-configuration)
  // Purple: #CC78BC (index 4), Red: #CA5127 (index 5)
  await page.evaluate(() => {
    const store = (window as any).__REDUX_STORE__;
    // Add Purple player
    store.dispatch({ type: 'ADD_PLAYER', payload: { color: '#CC78BC', edge: 0 } });
    // Add Red player
    store.dispatch({ type: 'ADD_PLAYER', payload: { color: '#CA5127', edge: 1 } });
  });
  
  await waitForNextFrame(page);
  
  // Start the game with deterministic seed (transitions to seating)
  await page.evaluate(() => {
    const store = (window as any).__REDUX_STORE__;
    store.dispatch({ type: 'START_GAME', payload: { seed: 12345 } });
  });
  
  await waitForNextFrame(page);
  
  // Complete seating phase (tiles will be automatically shuffled with the seed)
  await completeSeatingPhase(page, canvas, box);
  
  // Draw a tile
  await page.evaluate(() => {
    const store = (window as any).__REDUX_STORE__;
    store.dispatch({ type: 'DRAW_TILE' });
  });
  
  await waitForNextFrame(page);
}

test.describe('Gameplay Screen Rendering', () => {
  test('should render gameplay screen with two players', async ({ page }) => {
    await setupTwoPlayerGame(page);
    
    const canvas = page.locator('canvas#game-canvas');
    await expect(canvas).toBeVisible();
    
    // Verify screen changed to gameplay
    const state = await getReduxState(page);
    expect(state.game.screen).toBe('gameplay');
    expect(state.game.phase).toBe('playing');
    expect(state.game.players.length).toBe(2);
    expect(state.game.currentTile).toBeDefined();
    
    // Verify players have edge positions
    expect(state.game.players[0].edgePosition).toBeDefined();
    expect(state.game.players[1].edgePosition).toBeDefined();
    
    // Verify edges are assigned
    const player1Edge = state.game.players[0].edgePosition;
    const player2Edge = state.game.players[1].edgePosition;
    
    // Players should have different edge positions (assigned during seating)
    expect(player1Edge).not.toBe(player2Edge);
    expect(player1Edge).toBeGreaterThanOrEqual(0);
    expect(player1Edge).toBeLessThan(6);
    expect(player2Edge).toBeGreaterThanOrEqual(0);
    expect(player2Edge).toBeLessThan(6);
    
    // Take a screenshot of the gameplay screen
    await pauseAnimations(page);
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/002-gameplay-rendering/001-two-players.png',
      fullPage: false
    });
    
    // Verify the canvas has content (not just blank)
    const canvasData = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Check if there's any non-transparent pixel
      let hasContent = false;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0) {
          hasContent = true;
          break;
        }
      }
      
      return { hasContent, width: canvas.width, height: canvas.height };
    });
    
    expect(canvasData).not.toBeNull();
    expect(canvasData.hasContent).toBe(true);
    expect(canvasData.width).toBeGreaterThan(0);
    expect(canvasData.height).toBeGreaterThan(0);
  });

  test('should display board hexagon with colored player edges', async ({ page }) => {
    await setupTwoPlayerGame(page);
    
    const state = await getReduxState(page);
    expect(state.game.screen).toBe('gameplay');
    
    // Verify players have colors
    const player1Color = state.game.players[0].color;
    const player2Color = state.game.players[1].color;
    
    expect(player1Color).toBeDefined();
    expect(player2Color).toBeDefined();
    expect(player1Color).not.toBe(player2Color);
    
    // Take screenshot
    await pauseAnimations(page);
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/002-gameplay-rendering/002-board-edges.png',
      fullPage: false
    });
  });

  test('should display preview tile with grey flows', async ({ page }) => {
    await setupTwoPlayerGame(page);
    
    const state = await getReduxState(page);
    expect(state.game.screen).toBe('gameplay');
    expect(state.game.currentTile).toBeDefined();
    expect(state.ui.selectedPosition).toBeNull();
    
    // Take screenshot showing preview tile
    await pauseAnimations(page);
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/002-gameplay-rendering/003-preview-tile.png',
      fullPage: false
    });
  });

  test('should have properly sized hexagons (canvas size calculation)', async ({ page }) => {
    await setupTwoPlayerGame(page);
    
    // Verify hex size calculation
    const hexSize = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const minDimension = Math.min(canvas.width, canvas.height);
      const boardRadius = 3; // Default board size
      const canvasSizeMultiplier = ((boardRadius * 2 + 2) * 2 + 1); // = 17 for boardRadius=3
      const expectedSize = minDimension / canvasSizeMultiplier;
      
      return { 
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        minDimension,
        expectedSize
      };
    });
    
    expect(hexSize.expectedSize).toBeGreaterThan(0);
    expect(hexSize.minDimension).toBeGreaterThan(0);
    
    // Take screenshot for visual verification
    await pauseAnimations(page);
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/002-gameplay-rendering/004-hex-sizing.png',
      fullPage: false
    });
  });

  // Comprehensive user story test that demonstrates complete tile placement workflow
  test('User Story: Demonstrate gameplay with tile placement, rotation, and confirmation', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    // Add two players with Purple and Red colors (matching end of 001-player-configuration)
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'ADD_PLAYER', payload: { color: '#CC78BC', edge: 0 } });
      store.dispatch({ type: 'ADD_PLAYER', payload: { color: '#CA5127', edge: 1 } });
    });
    
    await waitForNextFrame(page);
    
    // Verify we have Purple and Red players
    let state = await getReduxState(page);
    expect(state.game.configPlayers[0].color).toBe('#CC78BC'); // Purple
    expect(state.game.configPlayers[1].color).toBe('#CA5127'); // Red
    
    // Start the game with deterministic seed (transitions to seating)
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'START_GAME', payload: { seed: 12345 } });
    });
    
    await waitForNextFrame(page);
    
    // Complete seating phase (tiles will be automatically shuffled with the seed)
    await completeSeatingPhase(page, canvas, box);
    
    // Draw a tile
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'DRAW_TILE' });
    });
    
    await waitForNextFrame(page);
    
    state = await getReduxState(page);
    expect(state.game.screen).toBe('gameplay');
    expect(state.game.phase).toBe('playing');
    expect(state.game.players.length).toBe(2);
    expect(state.game.currentTile).toBeDefined();
    
    // STEP 1: Initial gameplay screen with Purple and Red players
    await pauseAnimations(page);
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/002-gameplay-rendering/001-two-players.png',
      fullPage: false
    });
    
    // STEP 2: Player 1 (Purple) - Select a position for tile placement
    // Select position (0, 0) - center of the board
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'SET_SELECTED_POSITION', payload: { row: 0, col: 0 } });
    });
    
    await waitForNextFrame(page);
    
    state = await getReduxState(page);
    expect(state.ui.selectedPosition).toEqual({ row: 0, col: 0 });
    
    await pauseAnimations(page);
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/002-gameplay-rendering/002-player1-position-selected.png',
      fullPage: false
    });
    
    // STEP 3: Player 1 - Rotate the tile
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'SET_ROTATION', payload: 2 }); // Rotate to position 2
    });
    
    await waitForNextFrame(page);
    
    state = await getReduxState(page);
    expect(state.ui.currentRotation).toBe(2);
    
    await pauseAnimations(page);
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/002-gameplay-rendering/003-player1-tile-rotated.png',
      fullPage: false
    });
    
    // STEP 4: Player 1 - Confirm placement
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'PLACE_TILE', payload: { position: { row: 0, col: 0 }, rotation: 2 } });
    });
    
    await waitForNextFrame(page);
    
    state = await getReduxState(page);
    expect(state.game.board['0,0']).toBeDefined();
    expect(state.game.board['0,0'].rotation).toBe(2);
    
    // Clear the selection manually for cleaner screenshot
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'SET_SELECTED_POSITION', payload: null });
    });
    await waitForNextFrame(page);
    
    await pauseAnimations(page);
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/002-gameplay-rendering/004-player1-tile-placed.png',
      fullPage: false
    });
    
    // STEP 5: Move to next player
    const initialPlayerIndex = state.game.currentPlayerIndex;
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'NEXT_PLAYER' });
    });
    
    await waitForNextFrame(page);
    
    // Draw tile for next player
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'DRAW_TILE' });
    });
    
    await waitForNextFrame(page);
    
    state = await getReduxState(page);
    // Verify we moved to next player (index should have changed)
    expect(state.game.currentPlayerIndex).not.toBe(initialPlayerIndex);
    expect(state.game.currentPlayerIndex).toBe((initialPlayerIndex + 1) % 2);
    expect(state.game.currentTile).toBeDefined();
    
    await pauseAnimations(page);
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/002-gameplay-rendering/005-player2-turn.png',
      fullPage: false
    });
    
    // STEP 6: Player 2 (Red) - Select a position for tile placement
    // Select position (1, 0) - adjacent to first tile
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'SET_SELECTED_POSITION', payload: { row: 1, col: 0 } });
    });
    
    await waitForNextFrame(page);
    
    state = await getReduxState(page);
    expect(state.ui.selectedPosition).toEqual({ row: 1, col: 0 });
    
    await pauseAnimations(page);
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/002-gameplay-rendering/006-player2-position-selected.png',
      fullPage: false
    });
    
    // STEP 7: Player 2 - Rotate the tile
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'SET_ROTATION', payload: 4 }); // Rotate to position 4
    });
    
    await waitForNextFrame(page);
    
    state = await getReduxState(page);
    expect(state.ui.currentRotation).toBe(4);
    
    await pauseAnimations(page);
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/002-gameplay-rendering/007-player2-tile-rotated.png',
      fullPage: false
    });
    
    // STEP 8: Player 2 - Confirm placement
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'PLACE_TILE', payload: { position: { row: 1, col: 0 }, rotation: 4 } });
    });
    
    await waitForNextFrame(page);
    
    state = await getReduxState(page);
    expect(state.game.board['1,0']).toBeDefined();
    expect(state.game.board['1,0'].rotation).toBe(4);
    
    // Clear the selection manually for cleaner screenshot
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'SET_SELECTED_POSITION', payload: null });
    });
    await waitForNextFrame(page);
    
    await pauseAnimations(page);
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/002-gameplay-rendering/008-player2-tile-placed.png',
      fullPage: false
    });
    
    // Verify both tiles are on the board
    expect(Object.keys(state.game.board).length).toBe(2);
    console.log('✓ User story complete: Two players (Purple and Red) each placed a tile with rotation');
  });
});
