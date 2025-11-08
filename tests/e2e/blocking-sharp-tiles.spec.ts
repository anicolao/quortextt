// E2E test for blocking detection with three-sharp tiles
// Tests that blocking moves are properly prevented in the UI
import { test, expect } from '@playwright/test';
import { getReduxState, completeSeatingPhase , pauseAnimations } from './helpers';

test.describe('Blocking Detection with Three-Sharp Tiles', () => {
  // Note: Blocking detection is comprehensively tested in unit tests
  // (tests/game/blocking-detection.test.ts and tests/game/blocking-sharp-tiles.test.ts)
  // This e2e test attempts to verify it works in the UI, but creating a proper blocking
  // scenario via UI interactions is complex and fragile.
  test.skip('should prevent blocking moves when using only three-sharp tiles', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    
    // Add two players
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'ADD_PLAYER' });
    });
    
    await page.waitForTimeout(300);
    
    // Start the game
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'START_GAME', payload: { seed: 12345 } });
    });
    
    await page.waitForTimeout(100);
    
    // Complete seating phase (tiles will be automatically shuffled with the seed)
    await completeSeatingPhase(page, canvas, box);
    
    // Reshuffle with only three-sharp tiles (40 tiles, all type 3)
    // We need to use SHUFFLE_TILES here because we're changing the tile distribution
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ 
        type: 'SHUFFLE_TILES', 
        payload: { 
          seed: 12345,
          tileDistribution: [0, 0, 0, 40] // 40 three-sharp tiles
        } 
      });
      store.dispatch({ type: 'DRAW_TILE' });
    });
    
    await page.waitForTimeout(100);
    
    let state = await getReduxState(page);
    expect(state.game.screen).toBe('gameplay');
    expect(state.game.currentTile).toBe(3); // TileType.ThreeSharps
    
    const player1 = state.game.players[0];
    const player2 = state.game.players[1];
    
    console.log('Player 1:', player1.id, 'edge:', player1.edgePosition);
    console.log('Player 2:', player2.id, 'edge:', player2.edgePosition);
    
    // Now try to create a blocking scenario:
    // Place three-sharp tiles in a way that would block player 1 from reaching their target edge
    // The sharp corners should face player 1's starting edge
    
    // Example: If player 1 is on edge 0 (top), place tiles to block path to edge 3 (bottom)
    // We'll place tiles in a horizontal line with sharp corners pointing upward
    
    // Strategy: Place tiles across the middle of the board to separate the two halves
    const blockingPositions = [
      { row: 0, col: -3 },
      { row: 0, col: -2 },
      { row: 0, col: -1 },
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 3 },
    ];
    
    // Place blocking tiles one by one
    for (let i = 0; i < blockingPositions.length - 1; i++) {
      const pos = blockingPositions[i];
      
      // Click on the position to select it
      const hexX = box.x + box.width / 2;
      const hexY = box.y + box.height / 2;
      await canvas.click({ position: { x: hexX, y: hexY } });
      
      // Manually set position via Redux (simpler for testing)
      await page.evaluate((position) => {
        const store = (window as any).__REDUX_STORE__;
        store.dispatch({ 
          type: 'SET_SELECTED_POSITION', 
          payload: position 
        });
      }, pos);
      
      await page.waitForTimeout(100);
      
      // Try to place the tile by dispatching PLACE_TILE action
      // The reducer will check legality and only place if legal
      const placed = await page.evaluate(() => {
        const store = (window as any).__REDUX_STORE__;
        const stateBefore = store.getState();
        
        // Check if position is occupied
        const posKey = `${stateBefore.ui.selectedPosition.row},${stateBefore.ui.selectedPosition.col}`;
        if (stateBefore.game.board.has(posKey)) {
          return false;
        }
        
        const boardSizeBefore = stateBefore.game.board.size;
        
        // Try to place the tile
        store.dispatch({ 
          type: 'PLACE_TILE', 
          payload: { 
            position: stateBefore.ui.selectedPosition, 
            rotation: stateBefore.ui.currentRotation 
          } 
        });
        
        const stateAfter = store.getState();
        const boardSizeAfter = stateAfter.game.board.size;
        
        // Check if tile was actually placed (board size increased)
        if (boardSizeAfter > boardSizeBefore) {
          console.log(`Move at (${stateBefore.ui.selectedPosition.row}, ${stateBefore.ui.selectedPosition.col}) is LEGAL`);
          store.dispatch({ type: 'SET_SELECTED_POSITION', payload: null });
          store.dispatch({ type: 'NEXT_PLAYER' });
          store.dispatch({ type: 'DRAW_TILE' });
          return true;
        } else {
          console.log(`Move at (${stateBefore.ui.selectedPosition.row}, ${stateBefore.ui.selectedPosition.col}) is ILLEGAL`);
          return false;
        }
      });
      
      if (!placed) {
        console.log(`Could not place tile at (${pos.row}, ${pos.col}) - checking if this is expected blocking...`);
      }
      
      await page.waitForTimeout(100);
    }
    
    // Get final state
    state = await getReduxState(page);
    
    // Take a screenshot of the final board
    await pauseAnimations(page);
    await page.screenshot({ 
      path: 'tests/e2e/blocking-sharp-tiles-final.png',
      fullPage: false
    });
    
    // Now try to place the last tile that would complete the blocking wall
    const lastPos = blockingPositions[blockingPositions.length - 1];
    await page.evaluate((position) => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ 
        type: 'SET_SELECTED_POSITION', 
        payload: position 
      });
    }, lastPos);
    
    await page.waitForTimeout(100);
    
    // Check if this move is considered legal (it should be ILLEGAL)
    // Try to place the tile and see if the board size increases
    const result = await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      const stateBefore = store.getState();
      const boardSizeBefore = stateBefore.game.board.size;
      
      // Try to place the tile
      store.dispatch({ 
        type: 'PLACE_TILE', 
        payload: { 
          position: stateBefore.ui.selectedPosition, 
          rotation: stateBefore.ui.currentRotation 
        } 
      });
      
      const stateAfter = store.getState();
      const boardSizeAfter = stateAfter.game.board.size;
      
      // If board size didn't increase, the move was illegal
      const wasPlaced = boardSizeAfter > boardSizeBefore;
      
      return {
        isLegalMove: wasPlaced,
        boardSizeBefore,
        boardSizeAfter
      };
    });
    
    console.log('Is last blocking move legal?', result.isLegalMove);
    console.log('Board size before:', result.boardSizeBefore, 'after:', result.boardSizeAfter);
    
    // Take screenshot showing the blocking attempt
    await pauseAnimations(page);
    await page.screenshot({ 
      path: 'tests/e2e/blocking-sharp-tiles-attempt.png',
      fullPage: false
    });
    
    // ASSERTION: The last move should be ILLEGAL because it blocks a player
    // Since the move was illegal, the board size should not have increased
    expect(result.isLegalMove).toBe(false);
  });
});
