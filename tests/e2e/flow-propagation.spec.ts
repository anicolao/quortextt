// End-to-end test for flow propagation from player edges
// This test verifies that flows only enter from hex edges that belong to the player's board edge
import { test, expect } from '@playwright/test';
import { getReduxState, completeSeatingPhase , pauseAnimations } from './helpers';

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

// Helper to setup a game with two players
async function setupTwoPlayerGame(page: any) {
  
  const canvas = page.locator('canvas#game-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');
  
  await page.evaluate(() => {
    const store = (window as any).__REDUX_STORE__;
    store.dispatch({ type: 'ADD_PLAYER' });
    store.dispatch({ type: 'ADD_PLAYER' });
    store.dispatch({ type: 'START_GAME', payload: { seed: 42 } });
  });
  
  await waitForNextFrame(page);
  
  // Complete seating phase (tiles will be automatically shuffled with the seed)
  await completeSeatingPhase(page, canvas, box);
  
  // Draw a tile
  await page.evaluate(() => {
    const store = (window as any).__REDUX_STORE__;
    store.dispatch({ type: 'DRAW_TILE' });
  });
  
  await waitForNextFrame(page);
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
    
    await waitForNextFrame(page);
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
    
    // Position (-3, 2) is on edge 4 (top-left edge for radius-3 board)
    // Find which player has edge 4
    const playerWithEdge4 = state.game.players.find((p: any) => p.edgePosition === 4);
    const otherPlayer = state.game.players.find((p: any) => p.edgePosition !== 4);
    if (!playerWithEdge4 || !otherPlayer) {
      throw new Error('Could not find players with expected edge positions');
    }
    
    // Place tile ON player's edge (row=-3) at position (-3, 2)
    // At this position, the hex is on edge 4
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ 
        type: 'PLACE_TILE', 
        payload: { position: { row: -3, col: 2 }, rotation: 0 } 
      });
    });
    
    // Wait for state to be updated after tile placement
    await waitForNextFrame(page);
    await waitForNextFrame(page);
    
    state = await getReduxState(page);
    
    // Screenshot showing tile WITH colored flows
    await pauseAnimations(page);
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/003-flow-propagation/003-with-connection.png',
      fullPage: false
    });
    
    // Verify the player with edge 4 has flows
    const playerWithEdge4Flows = state.game.flows[playerWithEdge4.id];
    expect(playerWithEdge4Flows?.length || 0).toBeGreaterThan(0);
    expect(playerWithEdge4Flows?.includes('-3,2')).toBe(true);
    
    // Verify the other player has no flows (tile is not near their edge)
    const otherPlayerFlows = state.game.flows[otherPlayer.id];
    expect(otherPlayerFlows?.length || 0).toBe(0);
    
    console.log('✓ Flow propagation test passed');
    console.log('  - Player with edge 4:', playerWithEdge4.id, 'has flows');
    console.log('  - Tile placed at (-3, 2) with flow connections');
    console.log('  - Player 1 flows:', player1Flows?.length || 0, 'positions');
    console.log('  - Player 2 flows:', player2Flows?.length || 0, 'positions');
  });
});
