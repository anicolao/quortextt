// Generic E2E test that replays a game from .clicks file (mouse clicks)
import { test, expect } from '@playwright/test';
import { getReduxState, pauseAnimations } from './helpers';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { loadClicksFromFile, ClickAction } from '../utils/actionConverter';

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
async function testCompleteGameFromClicks(page: any, seed: string) {
  const clicksFile = path.join(__dirname, `user-stories/005-complete-game/${seed}/${seed}.clicks`);
  const screenshotDir = path.join(__dirname, `user-stories/006-complete-game-mouse/${seed}/screenshots`);
  
  // Create screenshot directory
  fs.mkdirSync(screenshotDir, { recursive: true });
  
  // Load clicks
  const content = fs.readFileSync(clicksFile, 'utf-8');
  const clicks = loadClicksFromFile(content);
  console.log(`Loaded ${clicks.length} click actions for seed ${seed}`);
  
  // Navigate to the game
  await page.goto('/');
  await page.waitForSelector('canvas#game-canvas');
  
  // Get canvas bounding box and actual canvas dimensions
  const canvas = page.locator('canvas#game-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');
  
  const canvasDims = await page.evaluate(() => {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    return { width: canvas.width, height: canvas.height };
  });
  console.log(`Canvas dimensions: ${canvasDims.width}x${canvasDims.height}`);
  
  // Calculate scaling factors (clicks are generated for 800x600)
  const scaleX = canvasDims.width / 800;
  const scaleY = canvasDims.height / 600;
  
  // Pause animations once at the start
  await pauseAnimations(page);
  
  // Take initial screenshot
  await page.screenshot({ 
    path: path.join(screenshotDir, '0001-initial-screen.png'),
    fullPage: false
  });
  
  let screenshotCounter = 2;
  const startTime = Date.now();
  
  // Replay each click
  for (const click of clicks) {
    if (click.type === 'click' && click.x !== undefined && click.y !== undefined) {
      // Scale coordinates to actual canvas size
      const scaledX = click.x * scaleX;
      const scaledY = click.y * scaleY;
      
      // Perform the click at the scaled coordinates (add box offset)
      await page.mouse.click(box.x + scaledX, box.y + scaledY);
      
      // Wait for next frame to ensure rendering is complete
      await waitForNextFrame(page);
      
      // Take screenshot after click
      const actionName = click.description.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      await page.screenshot({
        path: path.join(screenshotDir, `${screenshotCounter.toString().padStart(4, '0')}-${actionName}.png`),
        fullPage: false
      });
      
      screenshotCounter++;
    } else if (click.type === 'wait' && click.delay) {
      // Keep a minimal wait to allow state updates
      await page.waitForTimeout(Math.min(click.delay, 100));
    }
  }
  
  // Take final screenshot
  await page.screenshot({ 
    path: path.join(screenshotDir, 'final-state.png'),
    fullPage: false
  });
  
  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;
  console.log(`Test completed in ${duration.toFixed(1)}s`);
  console.log(`Generated ${screenshotCounter} screenshots`);
  console.log(`Recommended timeout: ${(duration * 1.5).toFixed(1)}s`);
  
  // Verify final state
  const state = await getReduxState(page);
  expect(state).toBeDefined();
  expect(state.game).toBeDefined();
  
  // Count ADD_PLAYER actions by reading the actions file
  const actionsFile = path.join(__dirname, `user-stories/005-complete-game/${seed}/${seed}.actions`);
  const actionsContent = fs.readFileSync(actionsFile, 'utf-8');
  const actions = actionsContent
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
  const playerCount = actions.filter(a => a.type === 'ADD_PLAYER').length;
  
  expect(state.game.configPlayers.length).toBe(playerCount);
  console.log(`✓ Game completed with ${playerCount} players`);
}

test('Complete game from clicks - seed 888', async ({ page }) => {
  await testCompleteGameFromClicks(page, '888');
});
