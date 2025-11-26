// E2E test demonstrating correct multi-tile flow propagation with screenshots
import { test } from '@playwright/test';
import { completeSeatingPhase , pauseAnimations, waitForAnimationFrame, takeScreenshot } from './helpers';

test.describe('Multi-Tile Flow Progression', () => {
  test('should generate screenshots showing correct flow behavior', async ({ page }) => {
    await page.goto('/quortextt/tabletop.html');
    await page.waitForSelector('canvas#game-canvas');
    
    // Pause animations once at the beginning
    await pauseAnimations(page);
    
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    // Set up game with two players and deterministic seed
    // Seed 167 gives us: TwoSharps, NoSharps, TwoSharps, ...
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'START_GAME', payload: { seed: 167 } });
    });
    
    await waitForAnimationFrame(page);
    
    // Complete seating phase (tiles will be automatically shuffled with the seed)
    await completeSeatingPhase(page, canvas, box);
    
    // Draw first tile
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'DRAW_TILE' });
    });
    
    await waitForAnimationFrame(page);
    
    // === STEP 0: Initial state ===
    await takeScreenshot(page, { 
      path: 'tests/e2e/user-stories/004-multi-tile-flow/001-initial.png',
      fullPage: false
    });
    
    // === STEP 1: Player 1 places TwoSharps at (-3, 2) ===
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ 
        type: 'PLACE_TILE', 
        payload: { position: { row: -3, col: 2 }, rotation: 0 } 
      });
      store.dispatch({ type: 'NEXT_PLAYER' });
      store.dispatch({ type: 'DRAW_TILE' });
    });
    
    await waitForAnimationFrame(page);
    
    await takeScreenshot(page, { 
      path: 'tests/e2e/user-stories/004-multi-tile-flow/002-first-tile.png',
      fullPage: false
    });
    
    // === STEP 2: Player 2 places NoSharps at (3, -1) ===
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ 
        type: 'PLACE_TILE', 
        payload: { position: { row: 3, col: -1 }, rotation: 2 } 
      });
      store.dispatch({ type: 'NEXT_PLAYER' });
      store.dispatch({ type: 'DRAW_TILE' });
    });
    
    await waitForAnimationFrame(page);
    
    await takeScreenshot(page, { 
      path: 'tests/e2e/user-stories/004-multi-tile-flow/003-second-tile.png',
      fullPage: false
    });
    
    // === STEP 3: Player 1 extends flow at (-3, 3) ===
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ 
        type: 'PLACE_TILE', 
        payload: { position: { row: -3, col: 3 }, rotation: 0 } 
      });
      store.dispatch({ type: 'NEXT_PLAYER' });
      store.dispatch({ type: 'DRAW_TILE' });
    });
    
    await waitForAnimationFrame(page);
    
    await takeScreenshot(page, { 
      path: 'tests/e2e/user-stories/004-multi-tile-flow/004-extended-flow.png',
      fullPage: false
    });
  });
});
