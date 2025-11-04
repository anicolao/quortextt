// End-to-end tests for the exit buttons in gameplay screen
import { test, expect } from '@playwright/test';
import { getReduxState, setupTwoPlayerGame } from './helpers';

// Exit button dimensions (from gameplayRenderer.ts)
const EXIT_BUTTON_SIZE = 50;
const EXIT_BUTTON_MARGIN = 10;
// Click position is at the center of the button
const EXIT_BUTTON_CLICK_OFFSET = EXIT_BUTTON_MARGIN + EXIT_BUTTON_SIZE / 2;

test.describe('Exit Buttons in Gameplay Screen', () => {
  test('should return to lobby when clicking top-left exit button', async ({ page }) => {
    await setupTwoPlayerGame(page);
    
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    // Verify we're in gameplay screen
    let state = await getReduxState(page);
    expect(state.game.screen).toBe('gameplay');
    
    // Click top-left exit button
    await canvas.click({
      position: { x: EXIT_BUTTON_CLICK_OFFSET, y: EXIT_BUTTON_CLICK_OFFSET }
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
      position: { x: box.width - EXIT_BUTTON_CLICK_OFFSET, y: EXIT_BUTTON_CLICK_OFFSET }
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
      position: { x: EXIT_BUTTON_CLICK_OFFSET, y: box.height - EXIT_BUTTON_CLICK_OFFSET }
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
      position: { x: box.width - EXIT_BUTTON_CLICK_OFFSET, y: box.height - EXIT_BUTTON_CLICK_OFFSET }
    });
    
    await page.waitForTimeout(100);
    
    // Verify we're back in configuration screen
    state = await getReduxState(page);
    expect(state.game.screen).toBe('configuration');
  });
});
