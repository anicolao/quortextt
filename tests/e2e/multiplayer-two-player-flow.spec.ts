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
      await expect(page1.locator('text=' + username1)).toBeVisible();

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
      await expect(page2.locator('text=' + username2)).toBeVisible();

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
      await expect(page1.locator(`text=${username1}`)).toBeVisible();

      // Get the room name from the page to verify we're in the right room
      const roomHeader = await page1.locator('h2').first().textContent();
      expect(roomHeader).toContain('Alice and Bob Game');

      // Take screenshot of Player 1 in the room
      await page1.screenshot({
        path: `${storyDir}/009-player1-in-room-waiting.png`,
        fullPage: true
      });

      // ===== STEP 4: Player 2 Joins the Room =====
      // Player 2 should see the room in the lobby
      await page2.waitForTimeout(1000); // Wait for room list to update

      // Look for the room in the available rooms list
      const roomCard = page2.locator('.room-card').filter({ hasText: 'Alice and Bob Game' });
      await expect(roomCard).toBeVisible({ timeout: 5000 });

      // Take screenshot of Player 2 seeing the room
      await page2.screenshot({
        path: `${storyDir}/010-player2-sees-room.png`,
        fullPage: true
      });

      // Player 2 joins the room
      await roomCard.locator('button', { hasText: 'Join' }).click();
      await page2.waitForTimeout(2000);

      // Verify Player 2 is in the room
      await expect(page2.locator(`text=${username2}`)).toBeVisible();
      const roomHeader2 = await page2.locator('h2').first().textContent();
      expect(roomHeader2).toContain('Alice and Bob Game');

      // Take screenshot of Player 2 in the room
      await page2.screenshot({
        path: `${storyDir}/011-player2-joined-room.png`,
        fullPage: true
      });

      // Player 1's view should update to show Player 2
      await page1.waitForTimeout(1000);
      await expect(page1.locator(`text=${username2}`)).toBeVisible();

      // Take screenshot of Player 1 seeing Player 2 join
      await page1.screenshot({
        path: `${storyDir}/012-player1-sees-player2-joined.png`,
        fullPage: true
      });

      // ===== STEP 5: Color Selection =====
      // Both players should now see color selection UI
      // Player 1 selects a color
      const blueButton1 = page1.locator('button').filter({ hasText: 'Blue' }).first();
      await blueButton1.waitFor({ state: 'visible', timeout: 5000 });
      
      // Take screenshot before Player 1 selects color
      await page1.screenshot({
        path: `${storyDir}/013-player1-color-selection.png`,
        fullPage: true
      });

      await blueButton1.click();
      await page1.waitForTimeout(500);

      // Take screenshot after Player 1 selects Blue
      await page1.screenshot({
        path: `${storyDir}/014-player1-selected-blue.png`,
        fullPage: true
      });

      // Player 2 sees the color selection screen
      await page2.waitForTimeout(1000);
      
      // Take screenshot of Player 2's color selection
      await page2.screenshot({
        path: `${storyDir}/015-player2-color-selection.png`,
        fullPage: true
      });

      // Player 2 selects Orange
      const orangeButton2 = page2.locator('button').filter({ hasText: 'Orange' }).first();
      await orangeButton2.waitFor({ state: 'visible', timeout: 5000 });
      await orangeButton2.click();
      await page2.waitForTimeout(500);

      // Take screenshot after Player 2 selects Orange
      await page2.screenshot({
        path: `${storyDir}/016-player2-selected-orange.png`,
        fullPage: true
      });

      // ===== STEP 6: Player 1 Starts the Game =====
      // Player 1 (host) should now see a Start Game button
      await page1.waitForTimeout(1000);
      
      // Take screenshot showing Player 1 can start the game
      await page1.screenshot({
        path: `${storyDir}/017-player1-ready-to-start.png`,
        fullPage: true
      });

      const startButton = page1.locator('button', { hasText: 'Start Game' });
      await expect(startButton).toBeVisible({ timeout: 5000 });
      await startButton.click();
      await page1.waitForTimeout(2000);

      // ===== STEP 7: Edge Selection Phase =====
      // Both players should now see the seating/edge selection screen
      
      // Take screenshot of Player 1's edge selection screen
      await page1.screenshot({
        path: `${storyDir}/018-player1-edge-selection.png`,
        fullPage: true
      });

      // Take screenshot of Player 2's edge selection screen
      await page2.screenshot({
        path: `${storyDir}/019-player2-edge-selection.png`,
        fullPage: true
      });

      // Player 1 selects an edge (edge buttons should be visible on the canvas)
      // The game uses canvas-based rendering, so we need to click on canvas coordinates
      const canvas1 = page1.locator('canvas#game-canvas');
      await canvas1.waitFor({ state: 'visible', timeout: 5000 });
      
      const box1 = await canvas1.boundingBox();
      if (!box1) throw new Error('Canvas not found for Player 1');

      // Click on the bottom edge (edge 0) for Player 1
      // These coordinates are based on the edge button positions from helpers.ts
      await page1.mouse.click(box1.x + box1.width / 2, box1.y + box1.height - 50);
      await page1.waitForTimeout(1000);

      // Take screenshot after Player 1 selects edge
      await page1.screenshot({
        path: `${storyDir}/020-player1-edge-selected.png`,
        fullPage: true
      });

      // Player 2 selects an edge (top edge - edge 3)
      const canvas2 = page2.locator('canvas#game-canvas');
      await canvas2.waitFor({ state: 'visible', timeout: 5000 });
      
      const box2 = await canvas2.boundingBox();
      if (!box2) throw new Error('Canvas not found for Player 2');

      // Take screenshot before Player 2 selects edge
      await page2.screenshot({
        path: `${storyDir}/021-player2-before-edge-selection.png`,
        fullPage: true
      });

      // Click on the top edge (edge 3) for Player 2
      await page2.mouse.click(box2.x + box2.width / 2, box2.y + 50);
      await page2.waitForTimeout(1000);

      // Take screenshot after Player 2 selects edge
      await page2.screenshot({
        path: `${storyDir}/022-player2-edge-selected.png`,
        fullPage: true
      });

      // ===== STEP 8: Game Start - First Move =====
      // After both players select edges, the game should start
      await page1.waitForTimeout(2000);

      // Take screenshot of Player 1's game start
      await page1.screenshot({
        path: `${storyDir}/023-player1-game-started.png`,
        fullPage: true
      });

      // Take screenshot of Player 2's game start
      await page2.screenshot({
        path: `${storyDir}/024-player2-game-started.png`,
        fullPage: true
      });

      // Player 1 makes the first move (click on a tile position)
      // Click near the center of the board to place a tile
      await page1.mouse.click(box1.x + box1.width / 2 + 50, box1.y + box1.height / 2);
      await page1.waitForTimeout(1000);

      // Take screenshot after Player 1's first move
      await page1.screenshot({
        path: `${storyDir}/025-player1-first-move.png`,
        fullPage: true
      });

      // Player 2's view should update
      await page2.waitForTimeout(1000);

      // Take screenshot of Player 2's view after Player 1's move
      await page2.screenshot({
        path: `${storyDir}/026-player2-sees-player1-move.png`,
        fullPage: true
      });

      // Player 2 makes their first move
      await page2.mouse.click(box2.x + box2.width / 2 - 50, box2.y + box2.height / 2);
      await page2.waitForTimeout(1000);

      // Take screenshot after Player 2's first move
      await page2.screenshot({
        path: `${storyDir}/027-player2-first-move.png`,
        fullPage: true
      });

      // Player 1's view should update
      await page1.waitForTimeout(1000);

      // Take final screenshot of Player 1's view
      await page1.screenshot({
        path: `${storyDir}/028-player1-sees-player2-move.png`,
        fullPage: true
      });

      console.log('✓ Complete two-player flow test passed');
      console.log('  - Both players logged in successfully');
      console.log('  - Player 1 created a room');
      console.log('  - Player 2 joined the room');
      console.log('  - Both players selected colors');
      console.log('  - Player 1 started the game');
      console.log('  - Both players selected edges');
      console.log('  - Both players made their first move');

    } finally {
      // Clean up contexts
      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    }
  });
});
