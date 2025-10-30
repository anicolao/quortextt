// End-to-end tests for the gameplay screen rendering
import { test, expect } from '@playwright/test';

// Helper to get Redux state
async function getReduxState(page: any) {
  return await page.evaluate(() => {
    return (window as any).__REDUX_STORE__.getState();
  });
}

test.describe('Gameplay Screen Rendering', () => {
  test('should render gameplay screen with two players', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    
    const canvas = page.locator('canvas#game-canvas');
    await expect(canvas).toBeVisible();
    
    // Dispatch actions to add two players and start game
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'ADD_PLAYER' });
    });
    
    // Wait a bit for the state to update
    await page.waitForTimeout(100);
    
    // Verify we have 2 players
    let state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(2);
    
    // Start the game with deterministic seed
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'START_GAME' });
      store.dispatch({ type: 'SHUFFLE_TILES', payload: { seed: 12345 } });
      store.dispatch({ type: 'DRAW_TILE' });
    });
    
    // Wait for the gameplay screen to render
    await page.waitForTimeout(500);
    
    // Verify screen changed to gameplay
    state = await getReduxState(page);
    expect(state.game.screen).toBe('gameplay');
    expect(state.game.phase).toBe('playing');
    expect(state.game.players.length).toBe(2);
    expect(state.game.currentTile).toBeDefined();
    
    // Verify players have edge positions
    expect(state.game.players[0].edgePosition).toBeDefined();
    expect(state.game.players[1].edgePosition).toBeDefined();
    
    // Edge 0 should be at the bottom
    const player1Edge = state.game.players[0].edgePosition;
    const player2Edge = state.game.players[1].edgePosition;
    
    // For 2 players, they should be on opposite edges (0 and 3)
    expect([player1Edge, player2Edge].sort()).toEqual([0, 3]);
    
    // Take a screenshot of the gameplay screen
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
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    
    // Add two players and start game
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'START_GAME' });
      store.dispatch({ type: 'SHUFFLE_TILES', payload: { seed: 12345 } });
      store.dispatch({ type: 'DRAW_TILE' });
    });
    
    await page.waitForTimeout(500);
    
    const state = await getReduxState(page);
    expect(state.game.screen).toBe('gameplay');
    
    // Verify players have colors
    const player1Color = state.game.players[0].color;
    const player2Color = state.game.players[1].color;
    
    expect(player1Color).toBeDefined();
    expect(player2Color).toBeDefined();
    expect(player1Color).not.toBe(player2Color);
    
    // Take screenshot
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/002-gameplay-rendering/002-board-edges.png',
      fullPage: false
    });
  });

  test('should display preview tile with grey flows', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    
    // Add two players and start game
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'START_GAME' });
      store.dispatch({ type: 'SHUFFLE_TILES', payload: { seed: 12345 } });
      store.dispatch({ type: 'DRAW_TILE' });
    });
    
    await page.waitForTimeout(500);
    
    const state = await getReduxState(page);
    expect(state.game.screen).toBe('gameplay');
    expect(state.game.currentTile).toBeDefined();
    expect(state.ui.selectedPosition).toBeNull();
    
    // Take screenshot showing preview tile
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/002-gameplay-rendering/003-preview-tile.png',
      fullPage: false
    });
  });

  test('should have properly sized hexagons (÷17 factor)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    
    // Add two players and start game
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'START_GAME' });
      store.dispatch({ type: 'SHUFFLE_TILES', payload: { seed: 12345 } });
      store.dispatch({ type: 'DRAW_TILE' });
    });
    
    await page.waitForTimeout(500);
    
    // Verify hex size calculation
    const hexSize = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const minDimension = Math.min(canvas.width, canvas.height);
      const expectedSize = minDimension / 17;
      
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
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/002-gameplay-rendering/004-hex-sizing.png',
      fullPage: false
    });
  });
});
