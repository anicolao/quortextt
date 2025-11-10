// E2E test for AI gameplay with debug scoring
import { test, expect } from '@playwright/test';
import { getReduxState, waitForAnimationFrame } from './helpers';

test.describe('AI Gameplay', () => {
  test('should auto-add AI player and play first move', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    // Add a single player
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
    
    // Check that AI player was auto-added
    expect(state.game.configPlayers).toHaveLength(2);
    expect(state.game.configPlayers.filter((p: any) => p.isAI)).toHaveLength(1);
    expect(state.game.configPlayers.filter((p: any) => !p.isAI)).toHaveLength(1);
    
    // Should be in seating phase
    expect(state.game.screen).toBe('seating');
    expect(state.game.seatingPhase.active).toBe(true);
    
    // Get seating order and complete seating phase
    const seatingOrder = state.game.seatingPhase.seatingOrder;
    
    // Both players select edges
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
        // AI player - wait for auto-select
        await page.waitForTimeout(1000);
        await waitForAnimationFrame(page);
      }
    }
    
    state = await getReduxState(page);
    expect(state.game.screen).toBe('gameplay');
  });
  
  test('should display AI scores with debug mode enabled', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    // Enable debug AI scoring
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ 
        type: 'UPDATE_SETTINGS', 
        payload: { debugAIScoring: true } 
      });
    });
    
    await waitForAnimationFrame(page);
    
    // Add player and start game
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'START_GAME', payload: { seed: 12345 } });
    });
    
    await waitForAnimationFrame(page);
    
    let state = await getReduxState(page);
    
    // Complete seating phase
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
    expect(state.game.screen).toBe('gameplay');
    
    // Check that AI scoring data exists
    expect(state.game.aiScoringData).toBeDefined();
    
    if (state.game.aiScoringData) {
      const scoringData = state.game.aiScoringData;
      const positions = Object.keys(scoringData);
      
      // Should have scores displayed for valid positions
      expect(positions.length).toBeGreaterThan(0);
      
      // Verify scores are not NaN
      let hasValidScores = false;
      for (const posKey of positions) {
        const rotationScores = scoringData[posKey];
        for (const { rotation, score } of rotationScores) {
          expect(score).not.toBeNaN();
          expect(typeof score).toBe('number');
          hasValidScores = true;
        }
      }
      
      expect(hasValidScores).toBe(true);
    }
  });
  
  test('AI should make moves automatically', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    // Add player and start game
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'START_GAME', payload: { seed: 12345 } });
    });
    
    await waitForAnimationFrame(page);
    
    let state = await getReduxState(page);
    
    // Complete seating phase
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
    
    if (firstPlayer.isAI) {
      // AI should automatically place the tile
      await page.waitForTimeout(1500);
      await waitForAnimationFrame(page);
      
      state = await getReduxState(page);
      
      // Check that tiles have been placed on the board
      const tileCount = Object.keys(state.game.board || {}).length;
      expect(tileCount).toBeGreaterThan(0);
    } else {
      // Human player can place manually - just verify game state is correct
      expect(state.game.currentTile).toBeTruthy();
    }
  });
  
  test('should not show scores on non-adjacent tiles', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    // Enable debug mode
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ 
        type: 'UPDATE_SETTINGS', 
        payload: { debugAIScoring: true } 
      });
    });
    
    await waitForAnimationFrame(page);
    
    // Start game
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'START_GAME', payload: { seed: 12345 } });
    });
    
    await waitForAnimationFrame(page);
    
    let state = await getReduxState(page);
    
    // Complete seating phase
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
    
    // Check score overlays
    if (state.game.aiScoringData) {
      const scoringData = state.game.aiScoringData;
      const positions = Object.keys(scoringData);
      
      // Should have limited scores (only on edge positions initially)
      // Not on all 222+ board positions
      expect(positions.length).toBeLessThan(200);
      expect(positions.length).toBeGreaterThan(10); // Should be on edge positions
    }
  });
});
