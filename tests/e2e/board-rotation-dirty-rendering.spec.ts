// E2E test to verify board rotation works correctly with dirty rendering
import { test, expect, Page } from '@playwright/test';
import { getReduxState, waitForAnimationFrame, pauseAnimations } from './helpers';

test.describe('Board Rotation with Dirty Rendering', () => {
  test('should render correctly when board is rotated in multiplayer mode', async ({ page }) => {
    test.setTimeout(15000);
    
    // Navigate to multiplayer page (which uses board rotation)
    await page.goto('/quortextt/');
    await page.waitForSelector('#game-canvas');
    
    // Setup a multiplayer game with a local player
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      
      // Set game mode to multiplayer
      store.dispatch({ type: 'SET_GAME_MODE', payload: 'multiplayer' });
      
      // Set local player ID
      store.dispatch({ type: 'SET_LOCAL_PLAYER_ID', payload: 'player1' });
      
      // Add 2 players with specific IDs
      store.dispatch({ type: 'ADD_PLAYER', payload: { userId: 'player1' } });
      store.dispatch({ type: 'ADD_PLAYER', payload: { userId: 'player2' } });
      
      // Start game
      store.dispatch({ type: 'START_GAME', payload: { seed: 99999 } });
    });
    await waitForAnimationFrame(page);
    
    // Wait for seating phase
    await page.waitForFunction(() => {
      const state = (window as any).__REDUX_STORE__.getState();
      return state.game.screen === 'seating';
    }, { timeout: 5000 });
    
    // Complete seating - local player selects an edge that will cause rotation
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      const state = store.getState();
      const seatingOrder = state.game.seatingPhase.seatingOrder;
      
      // Find which player is the local player
      const localPlayerSeatingIndex = seatingOrder.findIndex((pid: string) => pid === 'player1');
      
      // Local player (player1) selects edge 2 (will cause board to rotate)
      store.dispatch({ type: 'SELECT_EDGE', payload: { playerId: 'player1', edgeNumber: 2 } });
    });
    await waitForAnimationFrame(page);
    
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      const state = store.getState();
      const seatingOrder = state.game.seatingPhase.seatingOrder;
      
      // Other player selects edge 5
      const otherPlayer = seatingOrder.find((pid: string) => pid !== 'player1');
      store.dispatch({ type: 'SELECT_EDGE', payload: { playerId: otherPlayer, edgeNumber: 5 } });
    });
    await waitForAnimationFrame(page);
    
    // Now we should be in gameplay with board rotation active
    let state = await getReduxState(page);
    expect(state.game.screen).toBe('gameplay');
    expect(state.ui.gameMode).toBe('multiplayer');
    expect(state.ui.localPlayerId).toBe('player1');
    
    // Verify the local player is on edge 2
    const localPlayer = state.game.players.find((p: any) => p.id === 'player1');
    expect(localPlayer).toBeDefined();
    expect(localPlayer.edgePosition).toBe(2);
    
    // Wait for any initial rendering to settle
    await page.waitForTimeout(500);
    
    // Pause animations for screenshot
    await pauseAnimations(page);
    
    // Take a screenshot showing the rotated board
    await page.screenshot({
      path: 'tests/e2e/screenshots/board-rotation-dirty-rendering.png',
      fullPage: false
    });
    
    // Now interact with the game - draw and place a tile
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'DRAW_TILE' });
    });
    await waitForAnimationFrame(page);
    
    // Click to select a position (center of board)
    const canvas = await page.$('#game-canvas');
    const box = await canvas!.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await waitForAnimationFrame(page);
    
    // Verify preview tile is shown
    state = await getReduxState(page);
    expect(state.ui.selectedPosition).toBeTruthy();
    
    // Pause and take another screenshot
    await pauseAnimations(page);
    await page.screenshot({
      path: 'tests/e2e/screenshots/board-rotation-with-preview.png',
      fullPage: false
    });
    
    // Place the tile
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      const state = store.getState();
      
      // Click checkmark to place tile
      store.dispatch({ 
        type: 'PLACE_TILE', 
        payload: { 
          position: state.ui.selectedPosition, 
          rotation: state.ui.currentRotation 
        } 
      });
    });
    await waitForAnimationFrame(page);
    
    // Wait for placement animation
    await page.waitForTimeout(300);
    
    // Take final screenshot
    await pauseAnimations(page);
    await page.screenshot({
      path: 'tests/e2e/screenshots/board-rotation-after-placement.png',
      fullPage: false
    });
    
    // Verify tile was placed
    state = await getReduxState(page);
    expect(Object.keys(state.game.board).length).toBeGreaterThan(0);
    
    // Test passes if we got here without visual corruption
    // Visual validation is done by comparing screenshots
  });

  test('should handle tile rotation changes with board rotation active', async ({ page }) => {
    test.setTimeout(15000);
    
    await page.goto('/quortextt/');
    await page.waitForSelector('#game-canvas');
    
    // Setup multiplayer game
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'SET_GAME_MODE', payload: 'multiplayer' });
      store.dispatch({ type: 'SET_LOCAL_PLAYER_ID', payload: 'player1' });
      store.dispatch({ type: 'ADD_PLAYER', payload: { userId: 'player1' } });
      store.dispatch({ type: 'ADD_PLAYER', payload: { userId: 'player2' } });
      store.dispatch({ type: 'START_GAME', payload: { seed: 88888 } });
    });
    await waitForAnimationFrame(page);
    
    // Complete seating
    await page.waitForFunction(() => {
      const state = (window as any).__REDUX_STORE__.getState();
      return state.game.screen === 'seating';
    }, { timeout: 5000 });
    
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'SELECT_EDGE', payload: { playerId: 'player1', edgeNumber: 3 } });
    });
    await waitForAnimationFrame(page);
    
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      const state = store.getState();
      const seatingOrder = state.game.seatingPhase.seatingOrder;
      const otherPlayer = seatingOrder.find((pid: string) => pid !== 'player1');
      store.dispatch({ type: 'SELECT_EDGE', payload: { playerId: otherPlayer, edgeNumber: 0 } });
    });
    await waitForAnimationFrame(page);
    
    // Draw tile
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'DRAW_TILE' });
    });
    await waitForAnimationFrame(page);
    
    // Select position
    const canvas = await page.$('#game-canvas');
    const box = await canvas!.boundingBox();
    if (!box) throw new Error('Canvas not found');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await waitForAnimationFrame(page);
    
    // Wait for initial rendering
    await page.waitForTimeout(200);
    
    // Take screenshot before rotation
    await pauseAnimations(page);
    await page.screenshot({
      path: 'tests/e2e/screenshots/board-rotation-before-tile-rotate.png',
      fullPage: false
    });
    
    // Rotate the preview tile
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      const currentRotation = store.getState().ui.currentRotation;
      store.dispatch({ type: 'SET_ROTATION', payload: (currentRotation + 1) % 6 });
    });
    await waitForAnimationFrame(page);
    
    // Take screenshot after rotation
    await pauseAnimations(page);
    await page.screenshot({
      path: 'tests/e2e/screenshots/board-rotation-after-tile-rotate.png',
      fullPage: false
    });
    
    // Rotate again
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      const currentRotation = store.getState().ui.currentRotation;
      store.dispatch({ type: 'SET_ROTATION', payload: (currentRotation + 1) % 6 });
    });
    await waitForAnimationFrame(page);
    
    await pauseAnimations(page);
    await page.screenshot({
      path: 'tests/e2e/screenshots/board-rotation-after-second-tile-rotate.png',
      fullPage: false
    });
    
    // Test passes if screenshots show correct rendering
    // Visual validation is manual
  });
});
