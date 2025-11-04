// End-to-end tests for the exit buttons in gameplay screen
import { test, expect, Page } from '@playwright/test';
import { getReduxState, completeSeatingPhase, pauseAnimations } from './helpers';

// Helper to setup a game with two players
async function setupTwoPlayerGame(page: Page) {
  await page.goto('/');
  await page.waitForSelector('canvas#game-canvas');
  
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

test.describe('Exit Buttons in Gameplay Screen', () => {
  test('should return to lobby when clicking top-left exit button', async ({ page }) => {
    await setupTwoPlayerGame(page);
    
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    // Verify we're in gameplay screen
    let state = await getReduxState(page);
    expect(state.game.screen).toBe('gameplay');
    
    // Click top-left exit button (margin + half of button size)
    // Exit buttons are 50x50 with 10px margin
    await canvas.click({
      position: { x: 35, y: 35 }
    });
    
    await page.waitForTimeout(100);
    
    // Verify we're back in configuration screen
    state = await getReduxState(page);
    expect(state.game.screen).toBe('configuration');
  });

  test('should return to lobby when clicking top-right exit button', async ({ page }) => {
    await setupTwoPlayerGame(page);
    
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    // Verify we're in gameplay screen
    let state = await getReduxState(page);
    expect(state.game.screen).toBe('gameplay');
    
    // Click top-right exit button
    await canvas.click({
      position: { x: box.width - 35, y: 35 }
    });
    
    await page.waitForTimeout(100);
    
    // Verify we're back in configuration screen
    state = await getReduxState(page);
    expect(state.game.screen).toBe('configuration');
  });

  test('should return to lobby when clicking bottom-left exit button', async ({ page }) => {
    await setupTwoPlayerGame(page);
    
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    // Verify we're in gameplay screen
    let state = await getReduxState(page);
    expect(state.game.screen).toBe('gameplay');
    
    // Click bottom-left exit button
    await canvas.click({
      position: { x: 35, y: box.height - 35 }
    });
    
    await page.waitForTimeout(100);
    
    // Verify we're back in configuration screen
    state = await getReduxState(page);
    expect(state.game.screen).toBe('configuration');
  });

  test('should return to lobby when clicking bottom-right exit button', async ({ page }) => {
    await setupTwoPlayerGame(page);
    
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    // Verify we're in gameplay screen
    let state = await getReduxState(page);
    expect(state.game.screen).toBe('gameplay');
    
    // Click bottom-right exit button
    await canvas.click({
      position: { x: box.width - 35, y: box.height - 35 }
    });
    
    await page.waitForTimeout(100);
    
    // Verify we're back in configuration screen
    state = await getReduxState(page);
    expect(state.game.screen).toBe('configuration');
  });
});
