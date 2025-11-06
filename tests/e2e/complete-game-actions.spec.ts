// Generic E2E test that replays a game from .actions file
import { test, expect } from '@playwright/test';
import { getReduxState, pauseAnimations } from './helpers';
import * as fs from 'fs';
import * as path from 'path';

// Load actions from a .actions file
function loadActions(actionsFile: string) {
  const content = fs.readFileSync(actionsFile, 'utf-8');
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

test.describe('Complete Game from Actions - Seed 888', () => {
  test('should replay game from 888.actions file', async ({ page }) => {
    const actionsFile = path.join(__dirname, 'user-stories/005-complete-game/888/888.actions');
    const screenshotDir = path.join(__dirname, 'user-stories/005-complete-game/888/screenshots');
    
    // Create screenshot directory
    fs.mkdirSync(screenshotDir, { recursive: true });
    
    // Load actions
    const actions = loadActions(actionsFile);
    console.log(`Loaded ${actions.length} actions`);
    
    // Navigate to the game
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    
    // Take initial screenshot
    await pauseAnimations(page);
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
      
      // Wait for action to process
      await page.waitForTimeout(200);
      
      // Take screenshot after important actions
      if (['ADD_PLAYER', 'START_GAME', 'SELECT_EDGE', 'PLACE_TILE'].includes(action.type)) {
        await pauseAnimations(page);
        const filename = String(screenshotCounter).padStart(3, '0') + `-${action.type.toLowerCase()}.png`;
        await page.screenshot({ 
          path: path.join(screenshotDir, filename),
          fullPage: false
        });
        screenshotCounter++;
      }
    }
    
    // Take final screenshot
    await pauseAnimations(page);
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
    
    // Verify we have players
    expect(state.game.configPlayers.length).toBe(2);
  });
});
