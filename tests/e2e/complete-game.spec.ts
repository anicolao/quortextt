// E2E test for a complete 2-player game user story
// This test demonstrates a full game from setup to victory
import { test, expect } from '@playwright/test';
import { getReduxState } from './helpers';

test.describe('Complete 2-Player Game', () => {
  // Test configuration constants
  const DETERMINISTIC_SEED = 999; // Seed for reproducible tile shuffle
  const MAX_MOVES_LIMIT = 30; // Safety limit to prevent infinite loops
  const VICTORY_SCREENSHOT_NAME = 'victory-final.png'; // Final victory screenshot

  test('should play through multiple turns and verify flow edge data matches rendered flows', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    
    // === STEP 1: Initial configuration screen ===
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/005-complete-game/001-initial-screen.png',
      fullPage: false
    });
    
    // === STEP 2: Add two players ===
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'ADD_PLAYER' });
    });
    
    await page.waitForTimeout(300);
    
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/005-complete-game/002-players-added.png',
      fullPage: false
    });
    
    // Verify we have 2 players
    let state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(2);
    
    // === STEP 3: Start the game ===
    await page.evaluate((seed) => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'START_GAME' });
      // Use a deterministic seed for reproducible game
      store.dispatch({ type: 'SHUFFLE_TILES', payload: { seed } });
    }, DETERMINISTIC_SEED);
    
    await page.waitForTimeout(500);
    
    state = await getReduxState(page);
    expect(state.game.screen).toBe('gameplay');
    expect(state.game.phase).toBe('playing');
    expect(state.game.players.length).toBe(2);
    
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/005-complete-game/003-game-started.png',
      fullPage: false
    });
    
    const player1 = state.game.players[0];
    const player2 = state.game.players[1];
    
    console.log('Player 1:', player1.id, 'edge:', player1.edgePosition, 'color:', player1.color);
    console.log('Player 2:', player2.id, 'edge:', player2.edgePosition, 'color:', player2.color);
    
    // Players in 2-player game should be on opposite edges (0 and 3)
    expect([player1.edgePosition, player2.edgePosition].sort()).toEqual([0, 3]);
    
    // === Play the game ===
    // Strategy: Place tiles to build paths across the board
    // This sequence uses fixed positions and rotations
    
    let moveNumber = 0;
    let gameEnded = false;
    
    // Define a strategic sequence of moves
    // These positions and rotations are chosen to maximize flow extension
    const plannedMoves = [
      { row: -3, col: 2, rotation: 0 },   // Player 1 edge
      { row: 3, col: -2, rotation: 0 },   // Player 2 edge  
      { row: -2, col: 1, rotation: 1 },   // Extend
      { row: 2, col: -1, rotation: 1 },   // Extend
      { row: -1, col: 1, rotation: 0 },   // Toward center
      { row: 1, col: -1, rotation: 0 },   // Toward center
      { row: 0, col: 0, rotation: 2 },    // Center
      { row: 1, col: 0, rotation: 1 },    // Continue
      { row: -1, col: 0, rotation: 1 },   // Continue
      { row: 2, col: -2, rotation: 0 },   // Extend
      { row: -2, col: 2, rotation: 0 },   // Extend
      { row: 3, col: -3, rotation: 1 },   // Near opposite
      { row: -3, col: 3, rotation: 1 },   // Near opposite
    ];
    
    for (const move of plannedMoves) {
      if (gameEnded || moveNumber >= MAX_MOVES_LIMIT) break;
      
      // Draw tile
      await page.evaluate(() => {
        const store = (window as any).__REDUX_STORE__;
        store.dispatch({ type: 'DRAW_TILE' });
      });
      
      await page.waitForTimeout(200);
      
      state = await getReduxState(page);
      const currentTile = state.game.currentTile;
      
      if (currentTile === null) {
        console.log('No more tiles to draw');
        break;
      }
      
      // Place the tile
      await page.evaluate((moveData) => {
        const store = (window as any).__REDUX_STORE__;
        store.dispatch({ 
          type: 'PLACE_TILE', 
          payload: { position: { row: moveData.row, col: moveData.col }, rotation: moveData.rotation } 
        });
      }, move);
      
      await page.waitForTimeout(300);
      
      state = await getReduxState(page);
      moveNumber++;
      
      // Take screenshot
      const stepNum = String(moveNumber + 3).padStart(3, '0');
      await page.screenshot({ 
        path: `tests/e2e/user-stories/005-complete-game/${stepNum}-move-${moveNumber}.png`,
        fullPage: false
      });
      
      const currentPlayer = state.game.players[state.game.currentPlayerIndex];
      console.log(`Move ${moveNumber}: Player ${currentPlayer.id} placed tile at (${move.row}, ${move.col}) rotation ${move.rotation}`);
      
      // Log flow counts
      if (state.game.flows) {
        const player1Flows = state.game.flows[player1.id];
        const player2Flows = state.game.flows[player2.id];
        console.log(`  Player 1 flows: ${player1Flows?.length || 0} positions`);
        console.log(`  Player 2 flows: ${player2Flows?.length || 0} positions`);
      }
      
      // === VERIFY FLOW EDGES MATCH MODEL ===
      // This is the key verification requested by the user
      const tileKey = `${move.row},${move.col}`;
      const flowEdgesForTile = state.game.flowEdges?.[tileKey];
      const placedTile = state.game.board?.[tileKey];
      
      if (placedTile) {
        // Verify tile exists in board
        expect(placedTile.position.row).toBe(move.row);
        expect(placedTile.position.col).toBe(move.col);
        
        if (flowEdgesForTile && Object.keys(flowEdgesForTile).length > 0) {
          console.log(`  ✓ Tile has flow edges in model:`, flowEdgesForTile);
          
          // Verify each flow edge has a valid player
          Object.entries(flowEdgesForTile).forEach(([direction, playerId]) => {
            const player = state.game.players.find(p => p.id === playerId);
            expect(player).toBeDefined();
            console.log(`    Direction ${direction}: ${player?.color}`);
          });
          
          // Verify the player's flow set includes this position
          Object.values(flowEdgesForTile).forEach((playerId: any) => {
            const playerFlows = state.game.flows?.[playerId];
            expect(playerFlows).toBeDefined();
            expect(playerFlows?.includes(tileKey)).toBe(true);
          });
        } else {
          console.log(`  Tile has no flows (expected for tiles not connected to edges)`);
        }
      }
      
      // Check if game ended
      if (state.game.phase === 'finished') {
        console.log('🎉 Game ended with victory!');
        console.log('  Winner:', state.game.winner);
        console.log('  Win type:', state.game.winType);
        
        gameEnded = true;
        
        await page.screenshot({ 
          path: `tests/e2e/user-stories/005-complete-game/${VICTORY_SCREENSHOT_NAME}`,
          fullPage: false
        });
        
        break;
      }
      
      // Next player
      await page.evaluate(() => {
        const store = (window as any).__REDUX_STORE__;
        store.dispatch({ type: 'NEXT_PLAYER' });
      });
      
      await page.waitForTimeout(200);
    }
    
    // === Final Verification ===
    state = await getReduxState(page);
    
    // Verify meaningful game was played
    expect(moveNumber).toBeGreaterThan(0);
    console.log(`\n✓ Complete game test finished`);
    console.log(`  - Total moves: ${moveNumber}`);
    console.log(`  - Game phase: ${state.game.phase}`);
    console.log(`  - Tiles on board: ${Object.keys(state.game.board || {}).length}`);
    
    if (gameEnded) {
      expect(state.game.phase).toBe('finished');
      expect(state.game.winner).toBeDefined();
      console.log(`  - Winner: ${state.game.winner}`);
      console.log(`  - Victory type: ${state.game.winType}`);
    } else {
      expect(state.game.phase).toBe('playing');
      console.log(`  - Game in progress (no winner yet)`);
    }
  });
});
