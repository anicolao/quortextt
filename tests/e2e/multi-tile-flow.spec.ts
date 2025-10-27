// E2E test demonstrating correct multi-tile flow propagation with screenshots
import { test } from '@playwright/test';

test.describe('Multi-Tile Flow Progression', () => {
  test('should generate screenshots showing correct flow behavior', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    
    // Set up game with two players and deterministic seed
    // Seed 167 gives us: TwoSharps, NoSharps, TwoSharps, ...
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'START_GAME' });
      store.dispatch({ type: 'SHUFFLE_TILES', payload: { seed: 167 } });
      store.dispatch({ type: 'DRAW_TILE' }); // Draw first tile from shuffled deck
    });
    
    await page.waitForTimeout(1000);
    
    // === STEP 0: Initial state ===
    await page.screenshot({ 
      path: 'tests/e2e/screenshots/correct-flow-step0-initial.png',
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
    
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: 'tests/e2e/screenshots/correct-flow-step1-first-tile.png',
      fullPage: false
    });
    
    // === STEP 2: Player 2 places NoSharps at (3, -1) ===
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ 
        type: 'PLACE_TILE', 
        payload: { position: { row: 3, col: -1 }, rotation: 0 } 
      });
      store.dispatch({ type: 'NEXT_PLAYER' });
      store.dispatch({ type: 'DRAW_TILE' });
    });
    
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: 'tests/e2e/screenshots/correct-flow-step2-second-tile.png',
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
    
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: 'tests/e2e/screenshots/correct-flow-step3-extended.png',
      fullPage: false
    });
  });
});
