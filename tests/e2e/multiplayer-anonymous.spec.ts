// End-to-end tests for multiplayer anonymous user UI flow
// Tests the login screen UI, username input validation, and basic interactions
//
// NOTE: Full multiplayer flow requires backend server. These tests focus on
// the client-side UI behavior that can be tested without a live server.

import { test, expect } from '@playwright/test';

test.describe('Multiplayer Anonymous User UI', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to multiplayer page (index.html)
    await page.goto('/quortextt/');
    // Wait for the app to load
    await page.waitForTimeout(1000);
  });

  test('should display login screen with guest login option', async ({ page }) => {
    // Verify we're on the login screen
    await expect(page.locator('h1')).toContainText('Quortex Multiplayer');
    
    // Verify the guest login section exists
    await expect(page.locator('text=Join as guest')).toBeVisible();
    
    // Verify input field is visible
    const usernameInput = page.locator('input[type="text"][placeholder="Enter username"]');
    await expect(usernameInput).toBeVisible();
    
    // Verify OAuth options are visible
    await expect(page.locator('button', { hasText: 'Continue with Discord' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Continue with Google' })).toBeVisible();
    
    // Take screenshot of initial login screen
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/008-multiplayer-anonymous/001-login-screen.png',
      fullPage: true
    });
  });

  test('should enable join button only when username is entered', async ({ page }) => {
    const usernameInput = page.locator('input[type="text"][placeholder="Enter username"]');
    const joinButton = page.locator('button', { hasText: 'Join Lobby' });
    
    // Initially, button should be disabled with empty username
    await expect(joinButton).toBeDisabled();
    
    // Take screenshot with empty username
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/008-multiplayer-anonymous/002-empty-username-disabled.png',
      fullPage: true
    });
    
    // Enter a username
    await usernameInput.fill('TestPlayer123');
    
    // Button should now be enabled
    await expect(joinButton).toBeEnabled();
    
    // Take screenshot with username entered
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/008-multiplayer-anonymous/003-username-entered-enabled.png',
      fullPage: true
    });
    
    // Clear the username
    await usernameInput.clear();
    
    // Button should be disabled again
    await expect(joinButton).toBeDisabled();
  });

  test('should respect maxlength attribute on username input', async ({ page }) => {
    const usernameInput = page.locator('input[type="text"][placeholder="Enter username"]');
    
    // Try to enter a very long username (more than 20 characters)
    const longUsername = 'A'.repeat(30);
    await usernameInput.fill(longUsername);
    
    // Input should be truncated to 20 characters
    const value = await usernameInput.inputValue();
    expect(value.length).toBeLessThanOrEqual(20);
    
    // Take screenshot
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/008-multiplayer-anonymous/004-maxlength-enforced.png',
      fullPage: true
    });
  });

  test('should show placeholder text correctly', async ({ page }) => {
    const usernameInput = page.locator('input[type="text"][placeholder="Enter username"]');
    
    // Verify placeholder
    await expect(usernameInput).toHaveAttribute('placeholder', 'Enter username');
    
    // Verify the input starts empty
    await expect(usernameInput).toHaveValue('');
  });

  test('should display info section about multiplayer', async ({ page }) => {
    // Verify the info section exists
    await expect(page.locator('text=/Play Quortex with friends/i')).toBeVisible();
    await expect(page.locator('text=/Create or join a game room/i')).toBeVisible();
    
    // Take screenshot showing info section
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/008-multiplayer-anonymous/005-info-section.png',
      fullPage: true
    });
  });

  test('should have proper styling and layout', async ({ page }) => {
    // Verify the login container exists and is styled
    const loginContainer = page.locator('.login-container');
    await expect(loginContainer).toBeVisible();
    
    // Verify buttons are styled
    const joinButton = page.locator('button', { hasText: 'Join Lobby' });
    const discordButton = page.locator('button', { hasText: 'Continue with Discord' });
    
    // All buttons should be visible
    await expect(joinButton).toBeVisible();
    await expect(discordButton).toBeVisible();
    
    // Take full page screenshot to document layout
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/008-multiplayer-anonymous/006-full-layout.png',
      fullPage: true
    });
  });

  test('should show connecting state when join button is clicked', async ({ page }) => {
    const usernameInput = page.locator('input[type="text"][placeholder="Enter username"]');
    const joinButton = page.locator('button', { hasText: 'Join Lobby' });
    
    // Enter username
    await usernameInput.fill('TestUser');
    
    // Click join button
    await joinButton.click();
    
    // Button should show "Connecting..." state
    // Note: This will fail to connect without a backend server, but we can verify
    // the UI changes to show the connecting state
    await page.waitForTimeout(500);
    
    // The button text should have changed to indicate connection attempt
    const buttonText = await joinButton.textContent();
    expect(buttonText).toMatch(/Connecting/i);
    
    // Take screenshot of connecting state
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/008-multiplayer-anonymous/007-connecting-state.png',
      fullPage: true
    });
  });
});

// Test group for when backend server IS available
// These tests will be skipped if server is not running
test.describe('Multiplayer Anonymous User Flow (requires server)', () => {
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

  test.beforeEach(async ({ page }) => {
    test.skip(!serverAvailable, 'Backend server not running on localhost:3001. Start with: npm run dev:server');
    
    // Navigate to multiplayer page
    await page.goto('/quortextt/');
    await page.waitForTimeout(1000);
  });

  test('should join lobby as anonymous user', async ({ page }) => {
    const usernameInput = page.locator('input[type="text"][placeholder="Enter username"]');
    const joinButton = page.locator('button', { hasText: 'Join Lobby' });
    
    // Enter username
    const testUsername = 'E2ETestPlayer';
    await usernameInput.fill(testUsername);
    
    // Click join
    await joinButton.click();
    
    // Wait for navigation to lobby (with generous timeout for server response)
    await page.waitForSelector('h1:has-text("Game Lobby")', { timeout: 10000 });
    
    // Verify we're on lobby screen
    await expect(page.locator('h1')).toContainText('Game Lobby');
    
    // Verify username is displayed
    await expect(page.locator('text=' + testUsername)).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/008-multiplayer-anonymous/008-lobby-screen.png',
      fullPage: true
    });
  });

  test('should create a new game room', async ({ page }) => {
    const usernameInput = page.locator('input[type="text"][placeholder="Enter username"]');
    const joinButton = page.locator('button', { hasText: 'Join Lobby' });
    
    // Join lobby
    await usernameInput.fill('RoomCreator');
    await joinButton.click();
    await page.waitForSelector('h1:has-text("Game Lobby")', { timeout: 10000 });
    
    // Click create room button
    const createRoomButton = page.locator('button', { hasText: 'Create New Room' });
    await createRoomButton.click();
    
    // Wait for modal
    await page.waitForSelector('h2:has-text("Create New Room")', { timeout: 5000 });
    
    // Take screenshot of modal
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/008-multiplayer-anonymous/009-create-room-modal.png',
      fullPage: true
    });
    
    // Room name should be pre-filled
    const roomNameInput = page.locator('input[type="text"]').first();
    const roomName = await roomNameInput.inputValue();
    expect(roomName).toContain('game');
    
    // Select 3 players
    await page.locator('select').selectOption('3');
    
    // Click create
    await page.locator('button', { hasText: /^Create Room$/ }).click();
    
    // Should navigate to room screen
    await page.waitForTimeout(2000);
    
    // Take screenshot of room
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/008-multiplayer-anonymous/010-room-created.png',
      fullPage: true
    });
  });
});

