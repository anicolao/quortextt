// End-to-end test for flow propagation from player edges
// This test verifies that flows only enter from hex edges that belong to the player's board edge
import { test, expect } from '@playwright/test';
import { getReduxState, completeSeatingPhase , pauseAnimations } from './helpers';

// Helper to setup a game with two players
async function setupTwoPlayerGame(page: any) {
  const canvas = page.locator('canvas#game-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');
  
  await page.evaluate(() => {
    const store = (window as any).__REDUX_STORE__;
    store.dispatch({ type: 'ADD_PLAYER' });
    store.dispatch({ type: 'ADD_PLAYER' });
    store.dispatch({ type: 'START_GAME' });
  });
  
  await page.waitForTimeout(100);
  
  // Complete seating phase
  await completeSeatingPhase(page, canvas, box);
  
  // Shuffle with deterministic seed and draw a tile
  await page.evaluate(() => {
    const store = (window as any).__REDUX_STORE__;
    store.dispatch({ type: 'SHUFFLE_TILES', payload: { seed: 42 } });
    store.dispatch({ type: 'DRAW_TILE' });
  });
  
  await page.waitForTimeout(100);
}

test.describe('Flow Propagation from Player Edges', () => {
  test('should show correct flows only from player edge hex directions', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    
    // Set up game with two players
    await setupTwoPlayerGame(page);
    
    // Get initial state
    let state = await getReduxState(page);
    expect(state.game.screen).toBe('gameplay');
    expect(state.game.phase).toBe('playing');
    
    const player1 = state.game.players[0];
    const player2 = state.game.players[1];
    
    // Take screenshot of initial state with colored player edges
    await pauseAnimations(page);
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/003-flow-propagation/001-initial-state.png',
      fullPage: false
    });
    
    // Place a tile NOT on the player's edge to show no flows appear
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ 
        type: 'PLACE_TILE', 
        payload: { position: { row: -2, col: 0 }, rotation: 0 } 
      });
    });
    
    await page.waitForTimeout(500);
    state = await getReduxState(page);
    
    // Screenshot showing tile without flows (grey, not colored)
    await pauseAnimations(page);
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/003-flow-propagation/002-no-connection.png',
      fullPage: false
    });
    
    // Verify no flows for this tile (it doesn't connect to edge)
    let player1Flows = state.game.flows[player1.id];
    expect(player1Flows?.length || 0).toBe(0);
    
    // Now restart and place a tile ON the player's edge
    // Reload page to reset
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    
    await setupTwoPlayerGame(page);
    
    // Get the new player references after reload
    state = await getReduxState(page);
    if (!state.game.players || state.game.players.length < 2) {
      throw new Error('Expected at least 2 players after game start');
    }
    const player1AfterReload = state.game.players[0];
    const player2AfterReload = state.game.players[1];
    
    // Place tile ON player 1's edge (row=-3) at position (-3, 2)
    // At this position, player's edge directions are West and NorthWest
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ 
        type: 'PLACE_TILE', 
        payload: { position: { row: -3, col: 2 }, rotation: 0 } 
      });
    });
    
    await page.waitForTimeout(500);
    state = await getReduxState(page);
    
    // Screenshot showing tile WITH colored flows (blue for player 1)
    await pauseAnimations(page);
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/003-flow-propagation/003-with-connection.png',
      fullPage: false
    });
    
    // Verify player 1 has flows
    player1Flows = state.game.flows[player1AfterReload.id];
    expect(player1Flows?.length || 0).toBeGreaterThan(0);
    expect(player1Flows?.includes('-3,2')).toBe(true);
    
    // Verify player 2 has no flows (tile is not near their edge)
    const player2Flows = state.game.flows[player2AfterReload.id];
    expect(player2Flows?.length || 0).toBe(0);
    
    console.log('✓ Flow propagation test passed');
    console.log('  - Player 1 edge:', player1AfterReload.edgePosition, '(NorthWest, row=-3)');
    console.log('  - Tile placed at (-3, 2) with flow connections');
    console.log('  - Player 1 flows:', player1Flows?.length || 0, 'positions');
    console.log('  - Player 2 flows:', player2Flows?.length || 0, 'positions');
  });
});
