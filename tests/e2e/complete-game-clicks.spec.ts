// Generic E2E test that replays a game from .clicks file (mouse clicks)
import { test, expect } from '@playwright/test';
import { getReduxState, pauseAnimations, waitForAnimationFrame } from './helpers';
import { loadClicksFromFile, ClickAction } from '../utils/actionConverter';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test function parameterized by seed
// This test replays a game from .clicks file (actual mouse clicks)
async function testCompleteGameFromClicks(page: any, seed: string) {
  const clicksFile = path.join(__dirname, `user-stories/005-complete-game/${seed}/${seed}.clicks`);
  const screenshotDir = path.join(__dirname, `user-stories/006-complete-game-mouse/${seed}/screenshots`);
  
  // Create screenshot directory
  fs.mkdirSync(screenshotDir, { recursive: true });
  
  // Load clicks
  const content = fs.readFileSync(clicksFile, 'utf-8');
  const clicks = loadClicksFromFile(content);
  console.log(`Loaded ${clicks.length} clicks for seed ${seed}`);
  
  // Navigate to the game
  await page.goto('/');
  await page.waitForSelector('canvas#game-canvas');
  
  const canvas = page.locator('canvas#game-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');
  
  // Take initial screenshot
  await pauseAnimations(page);
  await page.screenshot({ 
    path: path.join(screenshotDir, '0001-initial-screen.png'),
    fullPage: false
  });
  
  let screenshotCounter = 2;
  
  // Replay each click
  for (let i = 0; i < clicks.length; i++) {
    const click = clicks[i];
    
    if (click.type === 'click') {
      // Perform the click at the specified coordinates
      await page.mouse.click(box.x + click.x!, box.y + click.y!);
      console.log(`Click ${i + 1}/${clicks.length}: ${click.description}`);
    } else if (click.type === 'wait') {
      // Handle wait - must use animationFrames
      if (click.animationFrames !== undefined) {
        // Wait for specified number of animation frames
        for (let f = 0; f < click.animationFrames; f++) {
          await waitForAnimationFrame(page);
        }
      } else if (click.delay !== undefined) {
        // Legacy delay is not supported - fail the test
        throw new Error(`Legacy delay found in click ${i + 1}: ${click.description}. Please regenerate .clicks files with animationFrames instead of delay.`);
      } else {
        throw new Error(`Wait action at click ${i + 1} has neither animationFrames nor delay: ${click.description}`);
      }
    }
    
    // Take screenshot after each click action (not after waits)
    if (click.type === 'click') {
      await pauseAnimations(page);
      const filename = String(screenshotCounter).padStart(4, '0') + `-click.png`;
      await page.screenshot({ 
        path: path.join(screenshotDir, filename),
        fullPage: false
      });
      screenshotCounter++;
    }
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
  
  console.log(`✓ Game completed from ${clicks.length} clicks`);
  console.log(`  Final game phase: ${state.game.phase}`);
}

test('Complete game from clicks - seed 888', async ({ page }) => {
  await testCompleteGameFromClicks(page, '888');
});

test('Complete game from clicks - seed 999', async ({ page }) => {
  await testCompleteGameFromClicks(page, '999');
});
