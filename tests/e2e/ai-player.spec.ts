// E2E test for AI player functionality
import { test, expect } from '@playwright/test';
import { getReduxState, waitForAnimationFrame, pauseAnimations } from './helpers';

test.describe('AI Player', () => {
  test('should auto-add AI opponent when single player starts game', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    
    // Add one player
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'ADD_PLAYER' });
    });
    
    await waitForAnimationFrame(page);
    
    let state = await getReduxState(page);
    expect(state.game.configPlayers).toHaveLength(1);
    expect(state.game.configPlayers[0].isAI).toBe(false);
    
    // Start the game
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'START_GAME', payload: { seed: 12345 } });
    });
    
    await waitForAnimationFrame(page);
    
    state = await getReduxState(page);
    
    // Should have auto-added AI player
    expect(state.game.configPlayers).toHaveLength(2);
    expect(state.game.configPlayers.filter((p: any) => p.isAI)).toHaveLength(1);
    expect(state.game.configPlayers.filter((p: any) => !p.isAI)).toHaveLength(1);
    
    // Should be in seating phase
    expect(state.game.screen).toBe('seating');
    expect(state.game.seatingPhase.active).toBe(true);
  });
  
  test('should not add AI when multiple players start game', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    
    // Add two players
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'ADD_PLAYER' });
    });
    
    await waitForAnimationFrame(page);
    
    // Start the game
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'START_GAME', payload: { seed: 12345 } });
    });
    
    await waitForAnimationFrame(page);
    
    const state = await getReduxState(page);
    
    // Should NOT have added AI player
    expect(state.game.configPlayers).toHaveLength(2);
    expect(state.game.configPlayers.every((p: any) => !p.isAI)).toBe(true);
  });
  
  test('AI should automatically select an edge during seating', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    // Add one player and start game
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'START_GAME', payload: { seed: 12345 } });
    });
    
    await waitForAnimationFrame(page);
    
    let state = await getReduxState(page);
    expect(state.game.screen).toBe('seating');
    
    // Get seating order
    const seatingOrder = state.game.seatingPhase.seatingOrder;
    
    // Complete seating phase using a loop (similar to passing test)
    for (let i = 0; i < 2; i++) {
      state = await getReduxState(page);
      const currentPlayerId = seatingOrder[state.game.seatingPhase.seatingIndex];
      const currentPlayer = state.game.configPlayers.find((p: any) => p.id === currentPlayerId);
      
      if (!currentPlayer.isAI) {
        // Human player selects edge
        const coords = await page.evaluate((edgeNum: number) => {
          const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
          const canvasWidth = canvas.width;
          const canvasHeight = canvas.height;
          const minDimension = Math.min(canvasWidth, canvasHeight);
          const size = minDimension / 17;
          const originX = canvasWidth / 2;
          const originY = canvasHeight / 2;
          const boardRadius = size * 7.2 + size * 0.8;
          const angles = [270, 330, 30, 90, 150, 210];
          const angle = angles[edgeNum] * Math.PI / 180;
          return {
            x: originX + boardRadius * Math.cos(angle),
            y: originY + boardRadius * Math.sin(angle)
          };
        }, i);
        
        await page.mouse.click(box.x + coords.x, box.y + coords.y);
        await waitForAnimationFrame(page);
      } else {
        // AI player - wait for auto-select
        await page.waitForTimeout(1000);
        await waitForAnimationFrame(page);
      }
    }
    
    state = await getReduxState(page);
    expect(state.game.screen).toBe('gameplay');
  });
  
  test('AI should automatically take turns during gameplay', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    // Setup single player game
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'START_GAME', payload: { seed: 12345 } });
    });
    
    await waitForAnimationFrame(page);
    
    // Complete seating phase manually
    let state = await getReduxState(page);
    const seatingOrder = state.game.seatingPhase.seatingOrder;
    
    // Both players select edges
    for (let i = 0; i < 2; i++) {
      state = await getReduxState(page);
      const currentPlayerId = seatingOrder[state.game.seatingPhase.seatingIndex];
      const currentPlayer = state.game.configPlayers.find((p: any) => p.id === currentPlayerId);
      
      if (!currentPlayer.isAI) {
        // Human player selects edge
        const coords = await page.evaluate((edgeNum: number) => {
          const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
          const canvasWidth = canvas.width;
          const canvasHeight = canvas.height;
          const minDimension = Math.min(canvasWidth, canvasHeight);
          const size = minDimension / 17;
          const originX = canvasWidth / 2;
          const originY = canvasHeight / 2;
          const boardRadius = size * 7.2 + size * 0.8;
          const angles = [270, 330, 30, 90, 150, 210];
          const angle = angles[edgeNum] * Math.PI / 180;
          return {
            x: originX + boardRadius * Math.cos(angle),
            y: originY + boardRadius * Math.sin(angle)
          };
        }, i);
        
        await page.mouse.click(box.x + coords.x, box.y + coords.y);
        await waitForAnimationFrame(page);
      } else {
        // AI player - wait for auto-select
        await page.waitForTimeout(1000);
        await waitForAnimationFrame(page);
      }
    }
    
    state = await getReduxState(page);
    expect(state.game.screen).toBe('gameplay');
    expect(state.game.phase).toBe('playing');
    
    // Draw a tile for the first player
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'DRAW_TILE' });
    });
    
    await waitForAnimationFrame(page);
    
    state = await getReduxState(page);
    const firstPlayer = state.game.players[state.game.currentPlayerIndex];
    
    console.log('First player to play:', firstPlayer.id, 'is AI?', firstPlayer.isAI);
    
    if (firstPlayer.isAI) {
      // AI should automatically place the tile
      await page.waitForTimeout(1500); // AI has 1000ms delay
      await waitForAnimationFrame(page);
      
      state = await getReduxState(page);
      
      // AI should have placed tile and advanced to next player
      expect(state.game.currentTile).toBeTruthy(); // Next player should have a tile
      expect(state.game.currentPlayerIndex).toBe(1); // Should have advanced to next player
    } else {
      // Human player can place manually - just verify AI didn't interfere
      expect(state.game.currentTile).toBeTruthy();
    }
  });
  
  test('DEBUG_AI_SCORING should show scores without NaN', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    
    // Enable debug AI scoring
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ 
        type: 'UPDATE_SETTINGS', 
        payload: { debugAIScoring: true } 
      });
    });
    
    await waitForAnimationFrame(page);
    
    // Setup single player game
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'START_GAME', payload: { seed: 12345 } });
    });
    
    await waitForAnimationFrame(page);
    
    // Complete seating phase
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    let state = await getReduxState(page);
    const seatingOrder = state.game.seatingPhase.seatingOrder;
    
    for (let i = 0; i < 2; i++) {
      state = await getReduxState(page);
      const currentPlayerId = seatingOrder[state.game.seatingPhase.seatingIndex];
      const currentPlayer = state.game.configPlayers.find((p: any) => p.id === currentPlayerId);
      
      if (!currentPlayer.isAI) {
        const coords = await page.evaluate((edgeNum: number) => {
          const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
          const canvasWidth = canvas.width;
          const canvasHeight = canvas.height;
          const minDimension = Math.min(canvasWidth, canvasHeight);
          const size = minDimension / 17;
          const originX = canvasWidth / 2;
          const originY = canvasHeight / 2;
          const boardRadius = size * 7.2 + size * 0.8;
          const angles = [270, 330, 30, 90, 150, 210];
          const angle = angles[edgeNum] * Math.PI / 180;
          return {
            x: originX + boardRadius * Math.cos(angle),
            y: originY + boardRadius * Math.sin(angle)
          };
        }, i);
        
        await page.mouse.click(box.x + coords.x, box.y + coords.y);
        await waitForAnimationFrame(page);
      } else {
        await page.waitForTimeout(1000);
        await waitForAnimationFrame(page);
      }
    }
    
    // Draw a tile
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'DRAW_TILE' });
    });
    
    await waitForAnimationFrame(page);
    
    state = await getReduxState(page);
    
    // Check that AI scoring data exists and has valid scores
    expect(state.game.aiScoringData).toBeDefined();
    
    if (state.game.aiScoringData) {
      const scoringData = state.game.aiScoringData;
      const positions = Object.keys(scoringData);
      
      console.log('Number of positions with scores:', positions.length);
      
      // Check that scores are not NaN
      let hasValidScores = false;
      for (const posKey of positions) {
        const rotationScores = scoringData[posKey];
        for (const { rotation, score } of rotationScores) {
          console.log(`Position ${posKey}, rotation ${rotation}: score = ${score}`);
          expect(score).not.toBeNaN();
          expect(typeof score).toBe('number');
          hasValidScores = true;
        }
      }
      
      expect(hasValidScores).toBe(true);
    }
    
    // Pause animations and take screenshot
    await pauseAnimations(page);
    await page.screenshot({ 
      path: 'tests/e2e/ai-debug-scoring.png',
      fullPage: false
    });
  });
});
