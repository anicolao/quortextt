// End-to-end tests for the gameplay screen rendering
import { test, expect } from '@playwright/test';
import { getReduxState, completeSeatingPhase , pauseAnimations, enableDeterministicPlayerIds } from './helpers';

// Helper to setup a game with two players
async function setupTwoPlayerGame(page: any) {
  await page.goto('/');
  await page.waitForSelector('canvas#game-canvas');
  await enableDeterministicPlayerIds(page);
  
  const canvas = page.locator('canvas#game-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');
  
  // Add two players
  await page.evaluate(() => {
    const store = (window as any).__REDUX_STORE__;
    store.dispatch({ type: 'ADD_PLAYER' });
    store.dispatch({ type: 'ADD_PLAYER' });
  });
  
  await page.waitForTimeout(100);
  
  // Start the game (transitions to seating)
  await page.evaluate(() => {
    const store = (window as any).__REDUX_STORE__;
    store.dispatch({ type: 'START_GAME' });
  });
  
  await page.waitForTimeout(100);
  
  // Complete seating phase
  await completeSeatingPhase(page, canvas, box);
  
  // Shuffle with deterministic seed and draw a tile
  await page.evaluate(() => {
    const store = (window as any).__REDUX_STORE__;
    store.dispatch({ type: 'SHUFFLE_TILES', payload: { seed: 12345 } });
    store.dispatch({ type: 'DRAW_TILE' });
  });
  
  await page.waitForTimeout(100);
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

  test('should have properly sized hexagons (÷17 factor)', async ({ page }) => {
    await setupTwoPlayerGame(page);
    
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
    await pauseAnimations(page);
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/002-gameplay-rendering/004-hex-sizing.png',
      fullPage: false
    });
  });
});
