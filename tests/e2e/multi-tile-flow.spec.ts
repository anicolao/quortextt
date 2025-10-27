// E2E test demonstrating correct multi-tile flow propagation with assertions
import { test, expect } from '@playwright/test';

// Helper to get Redux state
async function getReduxState(page: any) {
  return await page.evaluate(() => {
    return (window as any).__REDUX_STORE__.getState();
  });
}

test.describe('Multi-Tile Flow Progression with Assertions', () => {
  test('should correctly show flows only for connected paths', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    
    // Set up game with two players and deterministic seed
    // Seed 167 gives us: TwoSharps, NoSharps, TwoSharps, ...
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'START_GAME' });
      store.dispatch({ type: 'SHUFFLE_TILES', payload: { seed: 167 } });
      store.dispatch({ type: 'DRAW_TILE' }); // Draw first tile from shuffled deck
    });
    
    await page.waitForTimeout(500);
    
    let state = await getReduxState(page);
    const player1 = state.game.players[0];
    const player2 = state.game.players[1];
    
    expect(player1.edgePosition).toBe(0); // NW edge (row=-3)
    expect(player2.edgePosition).toBe(3); // SE edge (row=3)
    
    // Take screenshot of initial state
    await page.screenshot({ 
      path: 'tests/e2e/screenshots/correct-flow-step0-initial.png',
      fullPage: false
    });
    
    // === TILE 1: Player 1 places TwoSharps (type 2) at (-3, 2) ===
    // At (-3, 2), player edge directions are West and NorthWest
    // TwoSharps has: SW-SE (0-5), NW-NE (2-3), W-E (1-4)
    // Expected flows: NW-NE and W-E (both connected to edge)
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ 
        type: 'PLACE_TILE', 
        payload: { position: { row: -3, col: 2 }, rotation: 0 } 
      });
      store.dispatch({ type: 'NEXT_PLAYER' });
      store.dispatch({ type: 'DRAW_TILE' });
    });
    
    await page.waitForTimeout(500);
    
    state = await getReduxState(page);
    let player1Flows = state.game.flows.get(player1.id);
    let flowEdges = state.game.flowEdges.get('-3,2');
    
    // Verify flow state
    expect(player1Flows?.has('-3,2')).toBe(true);
    expect(player1Flows?.size).toBe(1);
    
    // Verify flow edges: should have 1, 2, 3, 4 (W, NW, NE, E)
    expect(flowEdges?.get(1)).toBe(player1.id); // West
    expect(flowEdges?.get(2)).toBe(player1.id); // NorthWest
    expect(flowEdges?.get(3)).toBe(player1.id); // NorthEast
    expect(flowEdges?.get(4)).toBe(player1.id); // East
    expect(flowEdges?.get(0)).toBeUndefined(); // SouthWest - not connected
    expect(flowEdges?.get(5)).toBeUndefined(); // SouthEast - not connected
    
    await page.screenshot({ 
      path: 'tests/e2e/screenshots/correct-flow-step1-first-tile.png',
      fullPage: false
    });
    
    // === TILE 2: Player 2 places NoSharps at (2, 0) ===
    // At (2, 0), player 2's edge directions are SouthWest and SouthEast  
    // NoSharps has: SW-NW (0-2), NE-SE (3-5), W-E (1-4)
    // Expected flows: SW-NW and NE-SE (both connected to edge)
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ 
        type: 'PLACE_TILE', 
        payload: { position: { row: 2, col: 0 }, rotation: 0 } 
      });
      store.dispatch({ type: 'NEXT_PLAYER' });
      store.dispatch({ type: 'DRAW_TILE' });
    });
    
    await page.waitForTimeout(500);
    
    state = await getReduxState(page);
    let player2Flows = state.game.flows.get(player2.id);
    flowEdges = state.game.flowEdges.get('2,0');
    
    // Verify Player 2 flow state
    expect(player2Flows?.has('2,0')).toBe(true);
    expect(player2Flows?.size).toBe(1);
    
    // Verify flow edges: should have 0, 2, 3, 5 (SW, NW, NE, SE)
    expect(flowEdges?.get(0)).toBe(player2.id); // SouthWest
    expect(flowEdges?.get(2)).toBe(player2.id); // NorthWest
    expect(flowEdges?.get(3)).toBe(player2.id); // NorthEast
    expect(flowEdges?.get(5)).toBe(player2.id); // SouthEast
    expect(flowEdges?.get(1)).toBeUndefined(); // West - not connected
    expect(flowEdges?.get(4)).toBeUndefined(); // East - not connected
    
    await page.screenshot({ 
      path: 'tests/e2e/screenshots/correct-flow-step2-second-tile.png',
      fullPage: false
    });
    
    // === TILE 3: Player 1 extends flow at (-2, 2) ===
    // This should connect to the East edge of the first tile
    // TwoSharps has: SW-SE (0-5), NW-NE (2-3), W-E (1-4)
    // Enters from West (from first tile's East), exits East
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ 
        type: 'PLACE_TILE', 
        payload: { position: { row: -2, col: 2 }, rotation: 0 } 
      });
      store.dispatch({ type: 'NEXT_PLAYER' });
      store.dispatch({ type: 'DRAW_TILE' });
    });
    
    await page.waitForTimeout(500);
    
    state = await getReduxState(page);
    player1Flows = state.game.flows.get(player1.id);
    flowEdges = state.game.flowEdges.get('-2,2');
    
    // Verify Player 1 flow extended
    expect(player1Flows?.has('-3,2')).toBe(true);
    expect(player1Flows?.has('-2,2')).toBe(true);
    expect(player1Flows?.size).toBe(2);
    
    // Verify new tile has flow edges only for W-E path
    expect(flowEdges?.get(1)).toBe(player1.id); // West - connected from previous tile
    expect(flowEdges?.get(4)).toBe(player1.id); // East - exit
    // Other directions should not have flow
    expect(flowEdges?.get(0)).toBeUndefined();
    expect(flowEdges?.get(2)).toBeUndefined();
    expect(flowEdges?.get(3)).toBeUndefined();
    expect(flowEdges?.get(5)).toBeUndefined();
    
    await page.screenshot({ 
      path: 'tests/e2e/screenshots/correct-flow-step3-extended.png',
      fullPage: false
    });
    
    console.log('✓ All flow assertions passed');
    console.log('  Player 1 has', player1Flows?.size, 'tiles in flow');
    console.log('  Player 2 has', player2Flows?.size, 'tiles in flow');
  });
});
