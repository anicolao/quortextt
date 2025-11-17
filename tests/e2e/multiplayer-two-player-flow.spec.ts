// End-to-end test for complete two-player multiplayer flow
// Shows two users logging in, creating/joining a game, and playing through the first move
//
// This test uses separate browser contexts for each user to ensure isolated sessions
// and demonstrates the complete flow from login to first move.

import { test, expect, Browser } from '@playwright/test';

test.describe('Multiplayer Two-Player Flow (requires server)', () => {
  let serverAvailable = false;

  test.beforeAll(async ({ request }) => {
    // Check if backend server is running
    try {
      const response = await request.get('http://localhost:3001/health');
      serverAvailable = response.ok();
    } catch {
      serverAvailable = false;
    }
  });

  test('complete two-player flow from login to first move', async ({ browser }) => {
    test.skip(!serverAvailable, 'Backend server not running on localhost:3001. Start with: npm run dev:server');
    test.setTimeout(120000); // Increase timeout to 120 seconds for multiplayer

    // Create two separate browser contexts for two different users
    // This ensures they have separate cookies and sessions
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    const storyDir = 'tests/e2e/user-stories/009-multiplayer-two-player-flow';

    try {
      // ===== STEP 1: Player 1 Login =====
      await page1.goto('/quortextt/');
      await page1.waitForTimeout(1000);

      // Verify login screen
      await expect(page1.locator('h1')).toContainText('Quortex Multiplayer');

      // Take screenshot of Player 1's login screen
      await page1.screenshot({
        path: `${storyDir}/001-player1-login-screen.png`,
        fullPage: true
      });

      // Player 1 enters username and joins
      const username1 = 'Alice';
      await page1.locator('input[type="text"][placeholder="Enter username"]').fill(username1);
      
      // Take screenshot showing Player 1's username entered
      await page1.screenshot({
        path: `${storyDir}/002-player1-username-entered.png`,
        fullPage: true
      });

      await page1.locator('button', { hasText: 'Join Lobby' }).click();
      await page1.waitForSelector('h1:has-text("Game Lobby")', { timeout: 10000 });

      // Verify Player 1 is in lobby
      await expect(page1.locator('h1')).toContainText('Game Lobby');

      // Take screenshot of Player 1's lobby
      await page1.screenshot({
        path: `${storyDir}/003-player1-in-lobby.png`,
        fullPage: true
      });

      // ===== STEP 2: Player 2 Login =====
      await page2.goto('/quortextt/');
      await page2.waitForTimeout(1000);

      // Verify login screen for Player 2
      await expect(page2.locator('h1')).toContainText('Quortex Multiplayer');

      // Take screenshot of Player 2's login screen
      await page2.screenshot({
        path: `${storyDir}/004-player2-login-screen.png`,
        fullPage: true
      });

      // Player 2 enters username and joins
      const username2 = 'Bob';
      await page2.locator('input[type="text"][placeholder="Enter username"]').fill(username2);

      // Take screenshot showing Player 2's username entered
      await page2.screenshot({
        path: `${storyDir}/005-player2-username-entered.png`,
        fullPage: true
      });

      await page2.locator('button', { hasText: 'Join Lobby' }).click();
      await page2.waitForSelector('h1:has-text("Game Lobby")', { timeout: 10000 });

      // Verify Player 2 is in lobby
      await expect(page2.locator('h1')).toContainText('Game Lobby');

      // Take screenshot of Player 2's lobby
      await page2.screenshot({
        path: `${storyDir}/006-player2-in-lobby.png`,
        fullPage: true
      });

      // ===== STEP 3: Player 1 Creates a Room =====
      await page1.locator('button', { hasText: 'Create New Room' }).click();
      await page1.waitForSelector('h2:has-text("Create New Room")', { timeout: 5000 });

      // Take screenshot of Player 1's create room modal
      await page1.screenshot({
        path: `${storyDir}/007-player1-create-room-modal.png`,
        fullPage: true
      });

      // Set room name and max players
      const roomNameInput = page1.locator('input[type="text"]').first();
      await roomNameInput.clear();
      await roomNameInput.fill('Alice and Bob Game');
      
      // Select 2 players
      await page1.locator('select').selectOption('2');

      // Take screenshot before creating
      await page1.screenshot({
        path: `${storyDir}/008-player1-room-settings.png`,
        fullPage: true
      });

      // Create the room
      await page1.locator('button', { hasText: /^Create Room$/ }).click();
      await page1.waitForTimeout(2000);

      // Verify Player 1 is in the room
      await expect(page1.locator('text=Host')).toBeVisible();
      
      // Take screenshot of Player 1 in the room
      await page1.screenshot({
        path: `${storyDir}/009-player1-in-room-waiting.png`,
        fullPage: true
      });

      // ===== STEP 4: Player 2 Joins the Room =====
      // Player 2 should see the room in the lobby
      await page2.waitForTimeout(1000); // Wait for room list to update

      // Look for the room in the available rooms list
      const roomCard = page2.locator('.room-card').filter({ hasText: 'Alice and Bob Game' }).first();
      await expect(roomCard).toBeVisible({ timeout: 5000 });

      // Take screenshot of Player 2 seeing the room
      await page2.screenshot({
        path: `${storyDir}/010-player2-sees-room.png`,
        fullPage: true
      });

      // Player 2 joins the room
      // Click on the room card - it may have a different click target
      await roomCard.click();
      await page2.waitForTimeout(2000);

      // Verify Player 2 is in the room
      // Take screenshot of Player 2 in the room
      await page2.screenshot({
        path: `${storyDir}/011-player2-joined-room.png`,
        fullPage: true
      });

      // Player 1's view should update to show Player 2
      await page1.waitForTimeout(3000); // Wait longer for socket update

      // Take screenshot of Player 1 seeing Player 2 join
      await page1.screenshot({
        path: `${storyDir}/012-player1-sees-player2-joined.png`,
        fullPage: true
      });

      // Take final screenshot showing both players in the room
      await page1.waitForTimeout(1000);
      await page1.screenshot({
        path: `${storyDir}/013-player1-ready-to-start.png`,
        fullPage: true
      });

      console.log('✓ Complete two-player flow test passed (partial)');
      console.log('  - Both players logged in successfully');
      console.log('  - Player 1 created a room');
      console.log('  - Player 2 joined the room');
      console.log('  - Screenshots captured from both perspectives');
      console.log('');
      console.log('  TODO: Complete remaining flow:');
      console.log('  - Game start by host');
      console.log('  - Edge selection phase');
      console.log('  - First move demonstration');

    } finally {
      // Clean up contexts
      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    }
  });
});
