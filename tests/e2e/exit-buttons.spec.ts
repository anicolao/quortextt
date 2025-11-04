// End-to-end tests for the exit buttons in gameplay screen
import { test, expect } from '@playwright/test';
import { getReduxState, setupTwoPlayerGame } from './helpers';

// Exit button dimensions (from gameplayRenderer.ts)
const EXIT_BUTTON_SIZE = 50;
const EXIT_BUTTON_MARGIN = 10;
// Click position is at the center of the button
const EXIT_BUTTON_CLICK_OFFSET = EXIT_BUTTON_MARGIN + EXIT_BUTTON_SIZE / 2;

test.describe('Exit Buttons in Gameplay Screen', () => {
  test('should completely reset game when clicking top-left exit button', async ({ page }) => {
    await setupTwoPlayerGame(page);
    
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    // Verify we're in gameplay screen with players
    let state = await getReduxState(page);
    expect(state.game.screen).toBe('gameplay');
    expect(state.game.players.length).toBeGreaterThan(0);
    
    // Click top-left exit button
    await canvas.click({
      position: { x: EXIT_BUTTON_CLICK_OFFSET, y: EXIT_BUTTON_CLICK_OFFSET }
    });
    
    await page.waitForTimeout(100);
    
    // Verify game is completely reset - back in configuration with no players
    state = await getReduxState(page);
    expect(state.game.screen).toBe('configuration');
    expect(state.game.players).toEqual([]);
    expect(state.game.configPlayers).toEqual([]);
    expect(state.game.phase).toBe('setup');
    expect(state.game.currentTile).toBeNull();
  });

  test('should completely reset game when clicking top-right exit button', async ({ page }) => {
    await setupTwoPlayerGame(page);
    
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    // Verify we're in gameplay screen with players
    let state = await getReduxState(page);
    expect(state.game.screen).toBe('gameplay');
    expect(state.game.players.length).toBeGreaterThan(0);
    
    // Click top-right exit button
    await canvas.click({
      position: { x: box.width - EXIT_BUTTON_CLICK_OFFSET, y: EXIT_BUTTON_CLICK_OFFSET }
    });
    
    await page.waitForTimeout(100);
    
    // Verify game is completely reset
    state = await getReduxState(page);
    expect(state.game.screen).toBe('configuration');
    expect(state.game.players).toEqual([]);
    expect(state.game.configPlayers).toEqual([]);
  });

  test('should completely reset game when clicking bottom-left exit button', async ({ page }) => {
    await setupTwoPlayerGame(page);
    
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    // Verify we're in gameplay screen with players
    let state = await getReduxState(page);
    expect(state.game.screen).toBe('gameplay');
    expect(state.game.players.length).toBeGreaterThan(0);
    
    // Click bottom-left exit button
    await canvas.click({
      position: { x: EXIT_BUTTON_CLICK_OFFSET, y: box.height - EXIT_BUTTON_CLICK_OFFSET }
    });
    
    await page.waitForTimeout(100);
    
    // Verify game is completely reset
    state = await getReduxState(page);
    expect(state.game.screen).toBe('configuration');
    expect(state.game.players).toEqual([]);
    expect(state.game.configPlayers).toEqual([]);
  });

  test('should completely reset game when clicking bottom-right exit button', async ({ page }) => {
    await setupTwoPlayerGame(page);
    
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    // Verify we're in gameplay screen with players
    let state = await getReduxState(page);
    expect(state.game.screen).toBe('gameplay');
    expect(state.game.players.length).toBeGreaterThan(0);
    
    // Click bottom-right exit button
    await canvas.click({
      position: { x: box.width - EXIT_BUTTON_CLICK_OFFSET, y: box.height - EXIT_BUTTON_CLICK_OFFSET }
    });
    
    await page.waitForTimeout(100);
    
    // Verify game is completely reset
    state = await getReduxState(page);
    expect(state.game.screen).toBe('configuration');
    expect(state.game.players).toEqual([]);
    expect(state.game.configPlayers).toEqual([]);
  });

  test('should allow starting a new game after exiting', async ({ page }) => {
    // Start first game with 2 players
    await setupTwoPlayerGame(page);
    
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    // Verify we're in gameplay
    let state = await getReduxState(page);
    expect(state.game.screen).toBe('gameplay');
    const firstGamePlayerCount = state.game.players.length;
    expect(firstGamePlayerCount).toBe(2);
    
    // Click exit button to reset
    await canvas.click({
      position: { x: EXIT_BUTTON_CLICK_OFFSET, y: EXIT_BUTTON_CLICK_OFFSET }
    });
    await page.waitForTimeout(100);
    
    // Verify complete reset
    state = await getReduxState(page);
    expect(state.game.screen).toBe('configuration');
    expect(state.game.players).toEqual([]);
    expect(state.game.configPlayers).toEqual([]);
    
    // Add 3 new players for the second game
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'ADD_PLAYER' });
    });
    await page.waitForTimeout(100);
    
    // Start the second game
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'START_GAME' });
    });
    await page.waitForTimeout(100);
    
    // Verify seating phase has correct number of players
    state = await getReduxState(page);
    expect(state.game.screen).toBe('seating');
    expect(state.game.seatingPhase.seatingOrder.length).toBe(3);
    expect(state.game.configPlayers.length).toBe(3);
    
    // The players list should still be empty until seating is complete
    expect(state.game.players).toEqual([]);
  });
});
