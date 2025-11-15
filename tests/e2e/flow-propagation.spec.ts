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
    await page.goto('/quortextt/tabletop.html');
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
    await page.goto('/quortextt/tabletop.html');
    await page.waitForSelector('canvas#game-canvas');
    
    await setupTwoPlayerGame(page);
    
    // Get the new player references after reload
    state = await getReduxState(page);
    if (!state.game.players || state.game.players.length < 2) {
      throw new Error('Expected at least 2 players after game start');
    }
    
    const player1AfterReload = state.game.players[0];
    const player2AfterReload = state.game.players[1];
    
    // For a radius-3 hexagonal board, find a position on player 1's edge
    // Edge positions as defined in board.ts:
    // 0: NorthWest (row = -3), 1: NorthEast (col = 3), 2: East (row + col = 3),
    // 3: SouthEast (row = 3), 4: SouthWest, 5: West
    // Use mid-edge positions to avoid corners that belong to multiple edges
    const edgeToPosition: { [key: number]: { row: number; col: number } } = {
      0: { row: -3, col: 1 },  // NorthWest edge (mid-position, not corner)
      1: { row: -2, col: 3 },  // NorthEast edge (mid-position, not corner)
      2: { row: 1, col: 2 },   // East edge (mid-position, not corner)
      3: { row: 3, col: 1 },   // SouthEast edge (mid-position, not corner)
      4: { row: 2, col: -2 },  // SouthWest edge (mid-position, not corner)
      5: { row: 1, col: -3 },  // West edge (mid-position, not corner)
    };
    
    const positionOnPlayer1Edge = edgeToPosition[player1AfterReload.edgePosition];
    if (!positionOnPlayer1Edge) {
      throw new Error(`Unsupported edge position: ${player1AfterReload.edgePosition}`);
    }
    
    console.log(`  - Testing with player 1 at edge ${player1AfterReload.edgePosition}`);
    console.log(`  - Will place tile at position (${positionOnPlayer1Edge.row}, ${positionOnPlayer1Edge.col})`);
    const posKey = `${positionOnPlayer1Edge.row},${positionOnPlayer1Edge.col}`;
    
    // Place tile ON player 1's edge
    await page.evaluate((pos) => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ 
        type: 'PLACE_TILE', 
        payload: { position: pos, rotation: 0 } 
      });
    }, positionOnPlayer1Edge);
    
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
    
    // Verify player 1 has flows
    player1Flows = state.game.flows[player1AfterReload.id];
    console.log(`  - Player 1 edge: ${player1AfterReload.edgePosition}`);
    console.log(`  - Position used: ${posKey}`);
    console.log(`  - Player 1 flows: ${player1Flows?.length || 0} positions`);
    if (player1Flows && player1Flows.length > 0) {
      console.log(`  - Flow positions: ${player1Flows.join(', ')}`);
    }
    expect(player1Flows?.length || 0).toBeGreaterThan(0);
    expect(player1Flows?.includes(posKey)).toBe(true);
    
    // Verify player 2 has no flows (tile is not near their edge)
    const player2Flows = state.game.flows[player2AfterReload.id];
    expect(player2Flows?.length || 0).toBe(0);
    
    console.log('✓ Flow propagation test passed');
    console.log(`  - Player 1 (edge ${player1AfterReload.edgePosition}): has flows at ${posKey}`);
    console.log('  - Player 2: no flows (tile not on their edge)');
  });
});
