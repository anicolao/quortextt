// End-to-end test for flow propagation from player edges
// This test verifies that flows only enter from hex edges that belong to the player's board edge
import { test, expect } from '@playwright/test';

// Helper to get Redux state
async function getReduxState(page: any) {
  return await page.evaluate(() => {
    return (window as any).__REDUX_STORE__.getState();
  });
}

test.describe('Flow Propagation from Player Edges', () => {
  test('should show correct flows only from player edge hex directions', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    
    // Set up game with two players
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'START_GAME' });
      // Use deterministic seed for reproducibility
      store.dispatch({ type: 'SHUFFLE_TILES', payload: { seed: 42 } });
    });
    
    await page.waitForTimeout(500);
    
    // Get initial state
    let state = await getReduxState(page);
    expect(state.game.screen).toBe('gameplay');
    expect(state.game.phase).toBe('playing');
    
    const player1 = state.game.players[0];
    const player2 = state.game.players[1];
    
    // Take screenshot of initial state with colored player edges
    await page.screenshot({ 
      path: 'tests/e2e/screenshots/flow-initial-state.png',
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
    await page.screenshot({ 
      path: 'tests/e2e/screenshots/flow-no-connection.png',
      fullPage: false
    });
    
    // Verify no flows for this tile (it doesn't connect to edge)
    let player1Flows = state.game.flows.get(player1.id);
    expect(player1Flows?.size || 0).toBe(0);
    
    // Now restart and place a tile ON the player's edge
    // Reload page to reset
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'START_GAME' });
      store.dispatch({ type: 'SHUFFLE_TILES', payload: { seed: 42 } });
    });
    
    await page.waitForTimeout(500);
    
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
    await page.screenshot({ 
      path: 'tests/e2e/screenshots/flow-with-connection.png',
      fullPage: false
    });
    
    // Verify player 1 has flows
    player1Flows = state.game.flows.get(player1.id);
    expect(player1Flows?.size || 0).toBeGreaterThan(0);
    expect(player1Flows?.has('-3,2')).toBe(true);
    
    // Verify player 2 has no flows (tile is not near their edge)
    const player2Flows = state.game.flows.get(player2.id);
    expect(player2Flows?.size || 0).toBe(0);
    
    console.log('✓ Flow propagation test passed');
    console.log('  - Player 1 edge:', player1.edgePosition, '(NorthWest, row=-3)');
    console.log('  - Tile placed at (-3, 2) with flow connections');
    console.log('  - Player 1 flows:', player1Flows?.size || 0, 'positions');
    console.log('  - Player 2 flows:', player2Flows?.size || 0, 'positions');
  });
});
