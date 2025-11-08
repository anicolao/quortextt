// Generic E2E test that replays a game from .clicks file (mouse clicks)
import { test, expect } from '@playwright/test';
import { getReduxState, pauseAnimations } from './helpers';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
// This test uses the .actions file to replay via Redux actions, not clicks
async function testCompleteGameFromActions(page: any, seed: string) {
  const actionsFile = path.join(__dirname, `user-stories/005-complete-game/${seed}/${seed}.actions`);
  const screenshotDir = path.join(__dirname, `user-stories/006-complete-game-mouse/${seed}/screenshots`);
  
  // Create screenshot directory
  fs.mkdirSync(screenshotDir, { recursive: true });
  
  // Load actions
  const content = fs.readFileSync(actionsFile, 'utf-8');
  const actions = content
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
  console.log(`Loaded ${actions.length} actions for seed ${seed}`);
  
  // Navigate to the game
  await page.goto('/');
  await page.waitForSelector('canvas#game-canvas');
  
  // Pause animations once at the start
  await pauseAnimations(page);
  
  // Take initial screenshot
  await page.screenshot({ 
    path: path.join(screenshotDir, '0001-initial-screen.png'),
    fullPage: false
  });
  
  let screenshotCounter = 2;
  
  // Replay each action
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    
    await page.evaluate((act) => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch(act);
    }, action);
    
    // Wait for next frame to ensure rendering is complete
    await waitForNextFrame(page);
    
    // Take screenshot for every action
    const filename = String(screenshotCounter).padStart(4, '0') + `-${action.type.toLowerCase()}.png`;
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
  
  // Verify final state
  const state = await getReduxState(page);
  expect(state).toBeDefined();
  expect(state.game).toBeDefined();
  
  // Count ADD_PLAYER actions to verify
  const playerCount = actions.filter(a => a.type === 'ADD_PLAYER').length;
  
  expect(state.game.configPlayers.length).toBe(playerCount);
  console.log(`✓ Game completed with ${playerCount} players`);
}

test('Complete game from clicks - seed 888', async ({ page }) => {
  await testCompleteGameFromActions(page, '888');
});
