// E2E test for AI gameplay with debug scoring
import { test, expect } from '@playwright/test';

test.describe('AI Gameplay', () => {
  test('should auto-add AI player and play first move', async ({ page }) => {
    await page.goto('/');
    
    // Add a single player
    await page.click('button:has-text("Add Player")');
    await page.fill('input[placeholder="Player Name"]', 'Human');
    await page.click('button:has-text("Save")');
    
    // Verify one player is in the lobby
    await expect(page.locator('text=Human')).toBeVisible();
    
    // Start the game
    await page.click('button:has-text("Start Game")');
    
    // Wait for seating phase
    await expect(page.locator('text=Select Your Edge')).toBeVisible({ timeout: 2000 });
    
    // Check that AI player was auto-added
    await expect(page.locator('text=AI')).toBeVisible();
    
    // Select an edge for human player (edge 0)
    const edgeButtons = page.locator('button:has-text("Edge")');
    await edgeButtons.first().click();
    
    // AI should auto-select its edge and game should start
    await expect(page.locator('text=Playing')).toBeVisible({ timeout: 3000 });
    
    // Check that both players have selected edges
    const playerEdges = page.locator('[data-testid="player-edge"]');
    await expect(playerEdges).toHaveCount(2);
  });
  
  test('should display AI scores with debug mode enabled', async ({ page }) => {
    await page.goto('/');
    
    // Enable debug AI scoring in settings
    await page.click('button[aria-label="Settings"]');
    await page.check('input[type="checkbox"][name="debugAIScoring"]');
    await page.click('button:has-text("Close")');
    
    // Add player and start game
    await page.click('button:has-text("Add Player")');
    await page.fill('input[placeholder="Player Name"]', 'TestPlayer');
    await page.click('button:has-text("Save")');
    await page.click('button:has-text("Start Game")');
    
    // Select edge
    await page.waitForSelector('button:has-text("Edge")', { timeout: 2000 });
    const edgeButtons = page.locator('button:has-text("Edge")');
    await edgeButtons.first().click();
    
    // Wait for gameplay to start
    await expect(page.locator('text=Playing')).toBeVisible({ timeout: 3000 });
    
    // Wait a bit for first tile to be drawn
    await page.waitForTimeout(1000);
    
    // Check for scoring overlays (yellow circles with scores)
    const scoreOverlays = page.locator('[data-testid="ai-score"]');
    const count = await scoreOverlays.count();
    
    // Should have scores displayed for valid positions
    expect(count).toBeGreaterThan(0);
    
    // Verify scores are not NaN or 0 (should have meaningful values)
    const firstScore = await scoreOverlays.first().textContent();
    expect(firstScore).not.toBe('NaN');
    expect(firstScore).not.toBe('0');
  });
  
  test('AI should make moves automatically', async ({ page }) => {
    await page.goto('/');
    
    // Add player
    await page.click('button:has-text("Add Player")');
    await page.fill('input[placeholder="Player Name"]', 'TestPlayer');
    await page.click('button:has-text("Save")');
    
    // Start game
    await page.click('button:has-text("Start Game")');
    
    // Select edge
    await page.waitForSelector('button:has-text("Edge")', { timeout: 2000 });
    const edgeButtons = page.locator('button:has-text("Edge")');
    await edgeButtons.first().click();
    
    // Wait for gameplay
    await expect(page.locator('text=Playing')).toBeVisible({ timeout: 3000 });
    
    // Wait for AI to make its first move
    await page.waitForTimeout(2000);
    
    // Check that tiles have been placed on the board
    const placedTiles = page.locator('[data-testid="placed-tile"]');
    const tileCount = await placedTiles.count();
    
    // AI should have placed at least one tile
    expect(tileCount).toBeGreaterThan(0);
  });
  
  test('should not show scores on non-adjacent tiles', async ({ page }) => {
    await page.goto('/');
    
    // Enable debug mode
    await page.click('button[aria-label="Settings"]');
    await page.check('input[type="checkbox"][name="debugAIScoring"]');
    await page.click('button:has-text("Close")');
    
    // Start game
    await page.click('button:has-text("Add Player")');
    await page.fill('input[placeholder="Player Name"]', 'Test');
    await page.click('button:has-text("Save")');
    await page.click('button:has-text("Start Game")');
    
    // Select edge
    await page.waitForSelector('button:has-text("Edge")', { timeout: 2000 });
    await (await page.locator('button:has-text("Edge")').first()).click();
    
    // Wait for gameplay
    await expect(page.locator('text=Playing')).toBeVisible({ timeout: 3000 });
    await page.waitForTimeout(1000);
    
    // Check score overlays
    const scoreOverlays = page.locator('[data-testid="ai-score"]');
    const count = await scoreOverlays.count();
    
    // Should have limited scores (only on edge positions initially)
    // Not on all 222+ board positions
    expect(count).toBeLessThan(200);
    expect(count).toBeGreaterThan(10); // Should be on edge positions
  });
});
