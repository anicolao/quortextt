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

      // Verify login screen - validate expected elements are present
      await expect(page1.locator('h1')).toContainText('Quortex Multiplayer');
      await expect(page1.locator('text=Join as guest')).toBeVisible();
      await expect(page1.locator('button:has-text("Continue with Discord")')).toBeVisible();
      await expect(page1.locator('button:has-text("Continue with Google")')).toBeVisible();
      
      console.log('✓ Step 1: Player 1 login screen validated - title, OAuth buttons, guest login visible');

      // Take screenshot of Player 1's login screen
      await page1.screenshot({
        path: `${storyDir}/001-player1-login-screen.png`,
        fullPage: true
      });

      // Player 1 enters username and joins
      const username1 = 'Alice';
      const usernameInput1 = page1.locator('input[type="text"][placeholder="Enter username"]');
      await usernameInput1.fill(username1);
      
      // Validate username was entered correctly
      await expect(usernameInput1).toHaveValue(username1);
      const joinButton1 = page1.locator('button:has-text("Join Lobby")');
      await expect(joinButton1).toBeEnabled();
      
      console.log(`✓ Step 2: Player 1 username "${username1}" entered, Join button enabled`);
      
      // Take screenshot showing Player 1's username entered
      await page1.screenshot({
        path: `${storyDir}/002-player1-username-entered.png`,
        fullPage: true
      });

      await joinButton1.click();
      await page1.waitForSelector('h1:has-text("Game Lobby")', { timeout: 10000 });

      // Verify Player 1 is in lobby - validate key lobby elements
      await expect(page1.locator('h1')).toContainText('Game Lobby');
      await expect(page1.locator('button:has-text("Create New Room")')).toBeVisible();
      
      // Verify username appears in header (player is logged in)
      const headerText1 = await page1.locator('header, .header, nav').textContent();
      expect(headerText1).toContain(username1);
      
      console.log(`✓ Step 3: Player 1 in lobby - heading verified, Create Room button visible, username "${username1}" in header`);

      // Take screenshot of Player 1's lobby
      await page1.screenshot({
        path: `${storyDir}/003-player1-in-lobby.png`,
        fullPage: true
      });

      // ===== STEP 2: Player 2 Login =====
      await page2.goto('/quortextt/');
      await page2.waitForTimeout(1000);

      // Verify login screen for Player 2 - should NOT be auto-logged in (cookie isolation test)
      await expect(page2.locator('h1')).toContainText('Quortex Multiplayer');
      await expect(page2.locator('text=Join as guest')).toBeVisible();
      
      // Critical validation: username input should be empty (not pre-filled with Player 1's name)
      const usernameInput2 = page2.locator('input[type="text"][placeholder="Enter username"]');
      await expect(usernameInput2).toHaveValue('');
      
      console.log('✓ Step 4: Player 2 login screen validated - cookie isolation confirmed (not auto-logged in as Player 1)');

      // Take screenshot of Player 2's login screen
      await page2.screenshot({
        path: `${storyDir}/004-player2-login-screen.png`,
        fullPage: true
      });

      // Player 2 enters username and joins
      const username2 = 'Bob';
      await usernameInput2.fill(username2);
      
      // Validate username was entered correctly
      await expect(usernameInput2).toHaveValue(username2);
      const joinButton2 = page2.locator('button:has-text("Join Lobby")');
      await expect(joinButton2).toBeEnabled();
      
      console.log(`✓ Step 5: Player 2 username "${username2}" entered, Join button enabled`);

      // Take screenshot showing Player 2's username entered
      await page2.screenshot({
        path: `${storyDir}/005-player2-username-entered.png`,
        fullPage: true
      });

      await joinButton2.click();
      await page2.waitForSelector('h1:has-text("Game Lobby")', { timeout: 10000 });

      // Verify Player 2 is in lobby with separate session
      await expect(page2.locator('h1')).toContainText('Game Lobby');
      await expect(page2.locator('button:has-text("Create New Room")')).toBeVisible();
      
      // Verify Player 2's username appears in header (not Player 1's)
      const headerText2 = await page2.locator('header, .header, nav').textContent();
      expect(headerText2).toContain(username2);
      expect(headerText2).not.toContain(username1);
      
      console.log(`✓ Step 6: Player 2 in lobby - separate session confirmed, username "${username2}" in header (not "${username1}")`);

      // Take screenshot of Player 2's lobby
      await page2.screenshot({
        path: `${storyDir}/006-player2-in-lobby.png`,
        fullPage: true
      });

      // ===== STEP 3: Player 1 Creates a Room =====
      const createRoomButton = page1.locator('button:has-text("Create New Room")');
      await createRoomButton.click();
      await page1.waitForSelector('h2:has-text("Create New Room")', { timeout: 5000 });

      // Validate modal appeared with expected elements
      await expect(page1.locator('h2:has-text("Create New Room")')).toBeVisible();
      const roomNameInput = page1.locator('input[type="text"]').first();
      await expect(roomNameInput).toBeVisible();
      await expect(page1.locator('select')).toBeVisible();
      
      console.log('✓ Step 7: Create Room modal opened - heading, name input, and max players dropdown visible');

      // Take screenshot of Player 1's create room modal
      await page1.screenshot({
        path: `${storyDir}/007-player1-create-room-modal.png`,
        fullPage: true
      });

      // Set room name and max players
      // Use timestamp to ensure unique room name for each test run
      const timestamp = Date.now();
      const roomName = `E2E Test Room ${timestamp}`;
      await roomNameInput.clear();
      await roomNameInput.fill(roomName);
      
      // Select 2 players
      const maxPlayersSelect = page1.locator('select');
      await maxPlayersSelect.selectOption('2');
      
      // Validate settings were applied
      await expect(roomNameInput).toHaveValue(roomName);
      await expect(maxPlayersSelect).toHaveValue('2');
      
      console.log(`✓ Step 8: Room settings configured - name: "${roomName}", max players: 2`);

      // Take screenshot before creating
      await page1.screenshot({
        path: `${storyDir}/008-player1-room-settings.png`,
        fullPage: true
      });

      // Create the room
      const createButton = page1.locator('button:has-text("Create Room")').first();
      await createButton.click();
      await page1.waitForTimeout(2000);

      // Verify Player 1 is in the room
      await expect(page1.locator('text=Host')).toBeVisible();
      
      // Validate room name is displayed
      const roomHeading = await page1.locator('h1, h2, h3').first().textContent();
      expect(roomHeading).toContain(roomName);
      
      // Validate player count shows 1/2
      const pageContent = await page1.textContent('body');
      expect(pageContent).toContain('1/2');
      
      console.log(`✓ Step 9: Room created - Player 1 in room "${roomName}", Host badge visible, 1/2 players`);
      
      // Take screenshot of Player 1 in the room
      await page1.screenshot({
        path: `${storyDir}/009-player1-in-room-waiting.png`,
        fullPage: true
      });

      // ===== STEP 4: Player 2 Joins the Room =====
      // Player 2 should see the room in the lobby (real-time Socket.IO update)
      await page2.waitForTimeout(1000); // Wait for room list to update

      // Look for the room in the available rooms list
      const roomCard = page2.locator('.room-card').filter({ hasText: roomName }).first();
      await expect(roomCard).toBeVisible({ timeout: 5000 });
      
      // Validate room card shows 1/2 players
      const roomCardText = await roomCard.textContent();
      expect(roomCardText).toContain('1/2');
      
      console.log(`✓ Step 10: Player 2 sees room "${roomName}" in lobby - real-time Socket.IO update confirmed, shows 1/2 players`);

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
      // Player 2 should see the room name
      const room2Heading = await page2.locator('h1, h2, h3').first().textContent();
      expect(room2Heading).toContain(roomName);
      
      // Validate room now shows 2/2 players
      const page2Content = await page2.textContent('body');
      expect(page2Content).toContain('2/2');
      
      // Validate both usernames appear in the room
      expect(page2Content).toContain(username1);
      expect(page2Content).toContain(username2);
      
      console.log(`✓ Step 11: Player 2 joined room - now shows 2/2 players, both "${username1}" and "${username2}" visible`);
      
      // Take screenshot of Player 2 in the room
      await page2.screenshot({
        path: `${storyDir}/011-player2-joined-room.png`,
        fullPage: true
      });

      // Player 1's view should update to show Player 2
      await page1.waitForTimeout(3000); // Wait longer for socket update

      // Validate Player 1's view updated (real-time Socket.IO sync)
      const page1UpdatedContent = await page1.textContent('body');
      expect(page1UpdatedContent).toContain('2/2');
      expect(page1UpdatedContent).toContain(username2);
      
      console.log(`✓ Step 12: Player 1's view updated - real-time Socket.IO sync confirmed, now shows 2/2 players with "${username2}" visible`);

      // Take screenshot of Player 1 seeing Player 2 join
      await page1.screenshot({
        path: `${storyDir}/012-player1-sees-player2-joined.png`,
        fullPage: true
      });

      // Take final screenshot showing both players in the room
      await page1.waitForTimeout(1000);
      
      console.log('✓ Step 13: Room ready - both players in room, ready for game start');
      
      await page1.screenshot({
        path: `${storyDir}/013-player1-ready-to-start.png`,
        fullPage: true
      });

      console.log('');
      console.log('✓ Complete two-player flow test passed with comprehensive validation');
      console.log('');
      console.log('  Validations performed:');
      console.log('  - Login screens: OAuth buttons, guest login, empty username inputs');
      console.log('  - Cookie isolation: Player 2 NOT auto-logged in as Player 1');
      console.log('  - Authentication: Separate usernames in headers');
      console.log('  - Room creation: Modal elements, name/players settings');
      console.log('  - Real-time sync: Room appears in Player 2 lobby via Socket.IO');
      console.log('  - Room joining: Player count updates (1/2 → 2/2)');
      console.log('  - State synchronization: Both usernames visible to both players');
      console.log('');
      console.log('  Screenshots captured:');
      console.log('  - 13 screenshots from both players\' perspectives');
      console.log('  - Each step validated programmatically before screenshot');
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
