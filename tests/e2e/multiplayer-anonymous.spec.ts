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
    
    // Verify the info section at the bottom exists
    await expect(page.locator('text=/Play Quortex with friends/i')).toBeVisible();
    await expect(page.locator('text=/Create or join a game room/i')).toBeVisible();
    
    // Verify the login container is properly styled
    const loginContainer = page.locator('.login-container');
    await expect(loginContainer).toBeVisible();
    
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
    
    // Wait for CSS transition to complete (background color transition is 0.3s)
    // We wait for the computed background color to be the enabled state (#667eea)
    await page.waitForFunction(
      () => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const joinButton = buttons.find(b => b.textContent?.includes('Join Lobby'));
        if (!joinButton) return false;
        const style = window.getComputedStyle(joinButton);
        const bgColor = style.backgroundColor;
        // Convert #667eea to rgb(102, 126, 234)
        return bgColor === 'rgb(102, 126, 234)' || bgColor === 'rgba(102, 126, 234, 1)';
      },
      { timeout: 1000 }
    );
    
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

  test('should attempt connection when join button is clicked', async ({ page }) => {
    const usernameInput = page.locator('input[type="text"][placeholder="Enter username"]');
    const joinButton = page.locator('button', { hasText: 'Join Lobby' });
    
    // Enter username
    await usernameInput.fill('TestUser');
    
    // Take screenshot before clicking
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/008-multiplayer-anonymous/007-before-click.png',
      fullPage: true
    });
    
    // Click join button (will attempt connection)
    const buttonClickPromise = joinButton.click();
    
    // Wait a brief moment to capture the UI state during connection attempt
    await page.waitForTimeout(200);
    
    // Take screenshot showing the state after click
    // This may show "Connecting..." or already navigated to lobby if server is fast
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/008-multiplayer-anonymous/007-connecting-state.png',
      fullPage: true
    });
    
    // Wait for the click to complete (may navigate away)
    await buttonClickPromise;
    
    // If server is available, we should navigate to lobby or show error
    // Just verify the page is in a stable state
    await page.waitForTimeout(500);
    
    // Page should either show lobby (if server available) or stay on login with error
    const hasLobbyHeading = await page.locator('h1:has-text("Game Lobby")').count() > 0;
    const hasLoginHeading = await page.locator('h1:has-text("Quortex Multiplayer")').count() > 0;
    
    expect(hasLobbyHeading || hasLoginHeading).toBe(true);
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

