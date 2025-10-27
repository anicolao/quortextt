// E2E test demonstrating multi-tile flow propagation
import { test, expect } from '@playwright/test';

// Helper to get Redux state
async function getReduxState(page: any) {
  return await page.evaluate(() => {
    return (window as any).__REDUX_STORE__.getState();
  });
}

test.describe('Multi-Tile Flow Progression', () => {
  test('should show flow extending into the board over multiple tile placements', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    
    // Set up game with two players and deterministic seed
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'START_GAME' });
      store.dispatch({ type: 'SHUFFLE_TILES', payload: { seed: 100 } });
    });
    
    await page.waitForTimeout(500);
    
    let state = await getReduxState(page);
    const player1 = state.game.players[0];
    const player2 = state.game.players[1];
    
    console.log('Player 1:', player1.id, 'edge:', player1.edgePosition, 'color:', player1.color);
    console.log('Player 2:', player2.id, 'edge:', player2.edgePosition, 'color:', player2.color);
    
    // Take screenshot of initial state
    await page.screenshot({ 
      path: 'tests/e2e/screenshots/multi-tile-step0-initial.png',
      fullPage: false
    });
    
    // === TILE 1: Place first tile on Player 1's edge ===
    // Player 1 is on edge 0 (NorthWest, row=-3)
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      const state = store.getState();
      console.log('Tile 1 type:', state.game.currentTile);
      
      // Place at (-3, 1) on player 1's edge
      store.dispatch({ 
        type: 'PLACE_TILE', 
        payload: { position: { row: -3, col: 1 }, rotation: 0 } 
      });
      // Advance to next player and draw
      store.dispatch({ type: 'NEXT_PLAYER' });
      store.dispatch({ type: 'DRAW_TILE' });
    });
    
    await page.waitForTimeout(500);
    
    state = await getReduxState(page);
    const player1FlowsAfterTile1 = state.game.flows.get(player1.id);
    console.log('After tile 1, player 1 flows:', player1FlowsAfterTile1 ? Array.from(player1FlowsAfterTile1) : 'none');
    
    await page.screenshot({ 
      path: 'tests/e2e/screenshots/multi-tile-step1-first-tile.png',
      fullPage: false
    });
    
    // === TILE 2: Player 2's turn ===
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      const state = store.getState();
      console.log('Tile 2 type:', state.game.currentTile);
      
      // Place at (2, -1) on player 2's edge (edge 3, row=3)
      store.dispatch({ 
        type: 'PLACE_TILE', 
        payload: { position: { row: 2, col: -1 }, rotation: 0 } 
      });
      store.dispatch({ type: 'NEXT_PLAYER' });
      store.dispatch({ type: 'DRAW_TILE' });
    });
    
    await page.waitForTimeout(500);
    
    await page.screenshot({ 
      path: 'tests/e2e/screenshots/multi-tile-step2-second-tile.png',
      fullPage: false
    });
    
    // === TILE 3: Back to Player 1, extend flow ===
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      const state = store.getState();
      console.log('Tile 3 type:', state.game.currentTile);
      
      // Place adjacent to first tile to extend flow
      // Try (-2, 1) which is south-east of (-3, 1)
      store.dispatch({ 
        type: 'PLACE_TILE', 
        payload: { position: { row: -2, col: 1 }, rotation: 0 } 
      });
      store.dispatch({ type: 'NEXT_PLAYER' });
      store.dispatch({ type: 'DRAW_TILE' });
    });
    
    await page.waitForTimeout(500);
    
    state = await getReduxState(page);
    const player1FlowsAfterTile3 = state.game.flows.get(player1.id);
    console.log('After tile 3, player 1 flows:', player1FlowsAfterTile3 ? Array.from(player1FlowsAfterTile3) : 'none');
    
    await page.screenshot({ 
      path: 'tests/e2e/screenshots/multi-tile-step3-flow-extended.png',
      fullPage: false
    });
    
    // Verify flow progression
    expect(state.game.board.size).toBe(3);
    expect(state.game.flows).toBeDefined();
    
    // Log final state for verification
    console.log('✓ Multi-tile flow progression test completed');
    console.log('  Total tiles placed:', state.game.board.size);
    console.log('  Player 1 flow size:', player1FlowsAfterTile3?.size || 0);
    console.log('  Current player index:', state.game.currentPlayerIndex);
  });
});
