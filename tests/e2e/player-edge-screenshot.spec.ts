// Test to capture screenshot of player edge rendering
import { test } from '@playwright/test';
import { getReduxState, completeSeatingPhase, pauseAnimations } from './helpers';

test('capture player edge rendering screenshot', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('canvas#game-canvas');
  
  const canvas = page.locator('canvas#game-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');
  
  // Add three players for better visibility
  await page.evaluate(() => {
    const store = (window as any).__REDUX_STORE__;
    store.dispatch({ type: 'ADD_PLAYER' });
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
  
  // Pause animations for clean screenshot
  await pauseAnimations(page);
  
  // Verify we're in gameplay
  const state = await getReduxState(page);
  console.log('Screen:', state.game.screen);
  console.log('Number of players:', state.game.players.length);
  console.log('Player edges:', state.game.players.map((p: any) => p.edgePosition));
  
  // Take screenshot
  await page.screenshot({ 
    path: '/tmp/player-edge-rendering.png',
    fullPage: false
  });
  
  console.log('Screenshot saved to /tmp/player-edge-rendering.png');
});
