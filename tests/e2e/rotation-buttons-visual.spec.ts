// Visual test to verify rotation button arrows point in the correct direction
import { test, expect } from '@playwright/test';
import { pauseAnimations } from './helpers';

test.describe('Rotation Button Visual Test', () => {
  test('should show rotation buttons with correct arrow directions', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    
    // Get canvas bounding box for mouse clicks
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    // Add two players using bottom edge buttons
    // Player 1 (blue) at bottom edge
    const player1X = box.x + box.width / 2 - 120;
    const player1Y = box.y + box.height - 50;
    await page.mouse.click(player1X, player1Y);
    await page.waitForTimeout(100);
    
    // Player 2 (orange) at bottom edge
    const player2X = box.x + box.width / 2 - 40;
    const player2Y = box.y + box.height - 50;
    await page.mouse.click(player2X, player2Y);
    await page.waitForTimeout(100);
    
    // Start the game with a deterministic seed
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'START_GAME', payload: { seed: 12345 } });
    });
    await page.waitForTimeout(200);
    
    // Select edges for both players (bottom edges)
    const selectEdgeX = box.x + box.width / 2;
    const selectEdgeY = box.y + box.height - 150;
    await page.mouse.click(selectEdgeX, selectEdgeY);
    await page.waitForTimeout(100);
    await page.mouse.click(selectEdgeX, selectEdgeY);
    await page.waitForTimeout(200);
    
    // Now we should be in the playing phase
    // Click on a board position to place the tile and show rotation buttons
    const boardCenterX = box.x + box.width / 2;
    const boardCenterY = box.y + box.height / 2;
    await page.mouse.click(boardCenterX, boardCenterY);
    await page.waitForTimeout(100);
    
    // Take a screenshot showing the rotation buttons
    await pauseAnimations(page);
    await page.screenshot({ 
      path: 'tests/e2e/rotation-buttons-after-fix.png',
      fullPage: false
    });
    
    // Verify the buttons are visible by checking Redux state
    const state = await page.evaluate(() => {
      return (window as any).__REDUX_STORE__.getState();
    });
    
    expect(state.ui.selectedPosition).toBeTruthy();
  });
});
