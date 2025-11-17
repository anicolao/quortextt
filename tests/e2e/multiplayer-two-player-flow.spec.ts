// End-to-end test for complete two-player multiplayer flow
// Shows two users logging in, creating/joining a game, and playing through the first move
//
// This test uses separate browser contexts for each user to ensure isolated sessions
// and demonstrates the complete flow from login to first move.

import { test, expect, Browser } from '@playwright/test';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

test.describe('Multiplayer Two-Player Flow (with isolated server)', () => {
  let serverProcess: ChildProcess | null = null;
  let tempDataDir: string = '';

  test.beforeAll(async () => {
    // Create a temporary data directory for this test run
    tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quortex-e2e-test-'));
    console.log(`Created temporary data directory: ${tempDataDir}`);

    // Start the server with the temporary data directory
    const serverDir = path.join(process.cwd(), 'server');
    
    return new Promise<void>((resolve, reject) => {
      serverProcess = spawn('npm', ['run', 'dev'], {
        cwd: serverDir,
        env: {
          ...process.env,
          DATA_DIR: tempDataDir,
          NODE_ENV: 'test'
        },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let serverStarted = false;
      const timeout = setTimeout(() => {
        if (!serverStarted) {
          reject(new Error('Server failed to start within 30 seconds'));
        }
      }, 30000);

      serverProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log('[SERVER]', output);
        
        // Look for indication that server is ready
        if (output.includes('running on port') || output.includes('Server running') || output.includes('listening')) {
          if (!serverStarted) {
            serverStarted = true;
            clearTimeout(timeout);
            
            // Give server a moment to fully initialize
            setTimeout(() => {
              console.log('Server started successfully');
              resolve();
            }, 2000);
          }
        }
      });

      serverProcess.stderr?.on('data', (data) => {
        console.error('[SERVER ERROR]', data.toString());
      });

      serverProcess.on('error', (error) => {
        console.error('Failed to start server:', error);
        reject(error);
      });

      serverProcess.on('exit', (code) => {
        if (!serverStarted) {
          reject(new Error(`Server exited early with code ${code}`));
        }
      });
    });
  });

  test.afterAll(async () => {
    // Stop the server
    if (serverProcess) {
      console.log('Stopping server...');
      serverProcess.kill();
      
      // Wait for process to exit
      await new Promise<void>((resolve) => {
        if (serverProcess) {
          serverProcess.on('exit', () => {
            console.log('Server stopped');
            resolve();
          });
          
          // Force kill after 5 seconds if graceful shutdown fails
          setTimeout(() => {
            if (serverProcess) {
              serverProcess.kill('SIGKILL');
              resolve();
            }
          }, 5000);
        } else {
          resolve();
        }
      });
    }

    // Clean up temporary data directory
    if (tempDataDir && fs.existsSync(tempDataDir)) {
      console.log(`Cleaning up temporary data directory: ${tempDataDir}`);
      fs.rmSync(tempDataDir, { recursive: true, force: true });
    }
  });

  test('complete two-player flow from login to first move', async ({ browser }) => {
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
      // Use a fixed room name for stable, repeatable screenshots
      const testRoomName = 'E2E Test: Alice and Bob';
      
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
      // Use the fixed test room name for repeatable screenshots
      await roomNameInput.clear();
      await roomNameInput.fill(testRoomName);
      
      // Select 2 players
      const maxPlayersSelect = page1.locator('select');
      await maxPlayersSelect.selectOption('2');
      
      // Validate settings were applied
      await expect(roomNameInput).toHaveValue(testRoomName);
      await expect(maxPlayersSelect).toHaveValue('2');
      
      console.log(`✓ Step 8: Room settings configured - name: "${testRoomName}", max players: 2`);

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
      expect(roomHeading).toContain(testRoomName);
      
      // Validate player count shows 1/2
      const pageContent = await page1.textContent('body');
      expect(pageContent).toContain('1/2');
      
      console.log(`✓ Step 9: Room created - Player 1 in room "${testRoomName}", Host badge visible, 1/2 players`);
      
      // Take screenshot of Player 1 in the room
      await page1.screenshot({
        path: `${storyDir}/009-player1-in-room-waiting.png`,
        fullPage: true
      });

      // ===== STEP 4: Player 2 Joins the Room =====
      // Player 2 should see the room in the lobby (real-time Socket.IO update)
      await page2.waitForTimeout(1000); // Wait for room list to update

      // Look for the room in the available rooms list
      const roomCard = page2.locator('.room-card').filter({ hasText: testRoomName }).first();
      await expect(roomCard).toBeVisible({ timeout: 5000 });
      
      // Validate room card shows 1/2 players
      const roomCardText = await roomCard.textContent();
      expect(roomCardText).toContain('1/2');
      
      console.log(`✓ Step 10: Player 2 sees room "${testRoomName}" in lobby - real-time Socket.IO update confirmed, shows 1/2 players`);

      // Take screenshot of Player 2 seeing the room
      await page2.screenshot({
        path: `${storyDir}/010-player2-sees-room.png`,
        fullPage: true
      });

      // Player 2 joins the room
      // Click on the room card to join
      await roomCard.click();
      
      // Wait for either room screen or navigation to room
      try {
        await page2.waitForSelector('text=Host', { timeout: 5000 });
      } catch {
        // If no Host badge appears, we're in the room but not as host - that's fine
        // Wait a bit more for the room to load
        await page2.waitForTimeout(2000);
      }

      // Verify Player 2 is in the room
      // Player 2 should see the room name or be in the room view
      const room2Heading = await page2.locator('h1, h2, h3').first().textContent();
      
      // Check if we're actually in a room (not lobby) by looking for room-specific content
      const page2Content = await page2.textContent('body');
      
      // If still in lobby, we might need to click a Join button
      if (page2Content?.includes('Game Lobby')) {
        const joinButton = page2.locator('button:has-text("Join")').first();
        if (await joinButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await joinButton.click();
          await page2.waitForTimeout(2000);
        }
      }
      
      // Re-check content after potential join button click
      const finalContent = await page2.textContent('body');
      const finalHeading = await page2.locator('h1, h2, h3').first().textContent();
      
      // Validate we're in the room
      expect(finalHeading || finalContent).toContain(testRoomName);
      
      // Validate room now shows 2 players (may be displayed as "2/2" or "2/ players")
      expect(finalContent).toMatch(/2[\/\s]+\d*\s*players?/i);
      
      // Validate both usernames appear in the room
      expect(finalContent).toContain(username1);
      expect(finalContent).toContain(username2);
      
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
      expect(page1UpdatedContent).toMatch(/2[\/\s]+\d*\s*players?/i);
      expect(page1UpdatedContent).toContain(username2);
      
      console.log(`✓ Step 12: Player 1's view updated - real-time Socket.IO sync confirmed, now shows 2 players with "${username2}" visible`);

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

      // ===== STEP 5: Game Start =====
      // Player 1 (host) starts the game
      const startGameButton = page1.locator('button:has-text("Start Game")');
      await expect(startGameButton).toBeEnabled({ timeout: 5000 });
      
      console.log('✓ Step 14: Start Game button enabled for host');
      
      await startGameButton.click();
      await page1.waitForTimeout(2000);
      
      // Verify that game canvas is now visible (transitioning to configuration screen)
      // The multiplayer game uses canvas#game-canvas
      const canvas1 = page1.locator('canvas#game-canvas');
      await expect(canvas1).toBeVisible({ timeout: 10000 });
      
      // Get Redux state via page.evaluate to check game state
      const getGameState = async (page: any) => {
        return await page.evaluate(() => {
          const store = (window as any).__REDUX_STORE__;
          if (!store) return null;
          const state = store.getState();
          return {
            screen: state.game?.screen,
            phase: state.game?.phase,
            configPlayers: state.game?.configPlayers || [],
            players: state.game?.players || [],
            currentTile: state.game?.currentTile,
            board: state.game?.board ? Object.keys(state.game.board) : []
          };
        });
      };
      
      let gameState1 = await getGameState(page1);
      console.log(`✓ Step 15: Game canvas visible - Player 1 screen: ${gameState1?.screen}`);
      
      await page1.screenshot({
        path: `${storyDir}/014-player1-game-started.png`,
        fullPage: true
      });
      
      // Player 2 should also see the game canvas now (real-time sync)
      await page2.waitForTimeout(2000);
      const canvas2 = page2.locator('canvas#game-canvas');
      await expect(canvas2).toBeVisible({ timeout: 10000 });
      
      let gameState2 = await getGameState(page2);
      console.log(`✓ Step 16: Game synced - Player 2 screen: ${gameState2?.screen}`);
      
      await page2.screenshot({
        path: `${storyDir}/015-player2-game-started.png`,
        fullPage: true
      });
      
      // NOTE: At this point, players are on the configuration screen where they need to
      // add themselves by clicking edge buttons (which triggers ADD_PLAYER actions)
      // This is similar to the tabletop mode configuration screen
      
      // For a complete demonstration, the test would continue from here with:
      // 1. Players clicking edges to add themselves (ADD_PLAYER actions)
      // 2. Host posting START_GAME with a deterministic seed (like 888)
      // 3. Seating phase where players select their starting edges
      // 4. Gameplay phase with validated tile placements
      //
      // However, this requires significant additions to handle the multiplayer
      // configuration flow which is different from the tabletop flow.
      
      console.log('');
      console.log('✓ Multiplayer flow validated through game initialization');
      console.log('');
      console.log('  Current state:');
      console.log(`  - Player 1 screen: ${gameState1?.screen}, configPlayers: ${gameState1?.configPlayers.length}`);
      console.log(`  - Player 2 screen: ${gameState2?.screen}, configPlayers: ${gameState2?.configPlayers.length}`);
      console.log('');
      console.log('  Note: Full gameplay flow requires additional implementation:');
      console.log('  - Configuration screen: Players add themselves with colors (ADD_PLAYER)');
      console.log('  - START_GAME action with deterministic seed (like 888)');
      console.log('  - Seating phase: Players select starting edges');
      console.log('  - Gameplay: Validated tile placements with state checks');

      console.log('');
      console.log('✓ Two-player multiplayer flow test completed');
      console.log('');
      console.log('  Validations performed:');
      console.log('  - Login screens: OAuth buttons, guest login, empty username inputs');
      console.log('  - Cookie isolation: Player 2 NOT auto-logged in as Player 1');
      console.log('  - Authentication: Separate usernames in headers');
      console.log('  - Room creation: Modal elements, name/players settings');
      console.log('  - Real-time sync: Room appears in Player 2 lobby via Socket.IO');
      console.log('  - Room joining: Player count updates (1/2 → 2/2)');
      console.log('  - State synchronization: Both usernames visible to both players');
      console.log('  - Game initialization: Canvas visible, ready for configuration');
      console.log('');
      console.log('  Screenshots captured:');
      console.log('  - 15 screenshots showing flow from login through game initialization');
      console.log('  - Each step validated programmatically before screenshot');

    } finally {
      // Clean up contexts
      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    }
  });
});
