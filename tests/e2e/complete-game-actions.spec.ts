// Generic E2E test that replays a game from .actions file
import { test, expect } from '@playwright/test';
import { getReduxState, pauseAnimations } from './helpers';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load actions from a .actions file
function loadActions(actionsFile: string) {
  const content = fs.readFileSync(actionsFile, 'utf-8');
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

// Wait for next animation frame to ensure rendering is complete
async function waitForNextFrame(page: any) {
  await page.evaluate(() => {
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });
  });
}

// Test function parameterized by seed
async function testCompleteGameFromActions(page: any, seed: string) {
  const actionsFile = path.join(__dirname, `user-stories/005-complete-game/${seed}/${seed}.actions`);
  const screenshotDir = path.join(__dirname, `user-stories/005-complete-game/${seed}/screenshots`);
  
  // Create screenshot directory
  fs.mkdirSync(screenshotDir, { recursive: true });
  
  // Load actions
  const actions = loadActions(actionsFile);
  console.log(`Loaded ${actions.length} actions for seed ${seed}`);
  
  // Count ADD_PLAYER actions to determine expected player count
  const playerCount = actions.filter(a => a.type === 'ADD_PLAYER').length;
  
  // Navigate to the game
  await page.goto('/');
  await page.waitForSelector('canvas#game-canvas');
  
  // Pause animations once at the start
  await pauseAnimations(page);
  
  // Take initial screenshot
  await page.screenshot({ 
    path: path.join(screenshotDir, '001-initial-screen.png'),
    fullPage: false
  });
  
  let screenshotCounter = 2;
  
  // Replay each action
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    console.log(`Action ${i + 1}/${actions.length}: ${action.type}`);
    
    await page.evaluate((act) => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch(act);
    }, action);
    
    // Wait for next frame to ensure rendering is complete
    await waitForNextFrame(page);
    
    // Take screenshot for every action
    const filename = String(screenshotCounter).padStart(3, '0') + `-${action.type.toLowerCase()}.png`;
    await page.screenshot({ 
      path: path.join(screenshotDir, filename),
      fullPage: false
    });
    screenshotCounter++;
  }
  
  // Take final screenshot
  await page.screenshot({ 
    path: path.join(screenshotDir, 'final-state.png'),
    fullPage: false
  });
  
  // Get final state
  const state = await getReduxState(page);
  console.log('Final state:');
  console.log(`  Screen: ${state.game.screen}`);
  console.log(`  Phase: ${state.game.phase}`);
  console.log(`  Players: ${state.game.players.length}`);
  
  // Verify we have the expected number of players
  expect(state.game.configPlayers.length).toBe(playerCount);
}

test.describe('Complete Game from Actions - Seed 888', () => {
  test('should replay game from 888.actions file', async ({ page }) => {
    // Time the test to set appropriate timeout
    const startTime = Date.now();
    await testCompleteGameFromActions(page, '888');
    const duration = Date.now() - startTime;
    console.log(`Test took ${duration}ms`);
    
    // Set timeout to 1.5x measured time for future runs (min 10s)
    const recommendedTimeout = Math.max(10000, Math.ceil(duration * 1.5));
    console.log(`Recommended timeout: ${recommendedTimeout}ms`);
  });
});

test.describe('Complete Game from Actions - Seed 999', () => {
  test('should replay game from 999.actions file', async ({ page }) => {
    // Time the test to set appropriate timeout
    const startTime = Date.now();
    await testCompleteGameFromActions(page, '999');
    const duration = Date.now() - startTime;
    console.log(`Test took ${duration}ms`);
    
    // Set timeout to 1.5x measured time for future runs (min 10s)
    const recommendedTimeout = Math.max(10000, Math.ceil(duration * 1.5));
    console.log(`Recommended timeout: ${recommendedTimeout}ms`);
  });
});
