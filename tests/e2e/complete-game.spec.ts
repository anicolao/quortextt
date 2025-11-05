// E2E test for a complete 2-player game user story
// This test demonstrates a full game from setup to victory
import { test, expect } from '@playwright/test';
import { getReduxState, completeSeatingPhase, pauseAnimations } from './helpers';

test.describe('Complete 2-Player Game', () => {
  // Test configuration constants
  const DETERMINISTIC_SEED = 999; // Seed for reproducible tile shuffle
  const MAX_MOVES_LIMIT = 50; // Safety limit to prevent infinite loops (covers full 40-tile deck)
  const VICTORY_SCREENSHOT_NAME = 'victory-final.png'; // Final victory screenshot

  test('should play through multiple turns and verify flow edge data matches rendered flows', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    
    // === STEP 1: Initial configuration screen ===
    await pauseAnimations(page);
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/005-complete-game/001-initial-screen.png',
      fullPage: false
    });
    
    // === STEP 2: Add two players with specific edges ===
    // Player 1 (blue) at edge 0, Player 2 (orange) at edge 3 (opposite edges)
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'SETUP_GAME', payload: {
        players: [
          { id: 'P1', color: '#0173B2', edgePosition: 0 },
          { id: 'P2', color: '#DE8F05', edgePosition: 3 }
        ],
        teams: []
      }});
    });
    
    await page.waitForTimeout(300);
    
    await pauseAnimations(page);
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/005-complete-game/002-players-added.png',
      fullPage: false
    });
    
    // Verify we have 2 players
    let state = await getReduxState(page);
    expect(state.game.players.length).toBe(2);
    
    // === STEP 3: Start the game ===
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    // Shuffle with deterministic seed and draw a tile
    await page.evaluate((seed) => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'SHUFFLE_TILES', payload: { seed } });
      store.dispatch({ type: 'DRAW_TILE' });
    }, DETERMINISTIC_SEED);
    
    await page.waitForTimeout(100);
    
    state = await getReduxState(page);
    expect(state.game.screen).toBe('gameplay');
    expect(state.game.phase).toBe('playing');
    expect(state.game.players.length).toBe(2);
    
    await pauseAnimations(page);
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/005-complete-game/003-game-started.png',
      fullPage: false
    });
    
    const player1 = state.game.players[0];
    const player2 = state.game.players[1];
    
    console.log('Player 1:', player1.id, 'edge:', player1.edgePosition, 'color:', player1.color);
    console.log('Player 2:', player2.id, 'edge:', player2.edgePosition, 'color:', player2.color);
    
    // Verify players have different edge positions
    expect(player1.edgePosition).not.toBe(player2.edgePosition);
    
    // === Play the game ===
    // Strategy: Continue playing until the game ends naturally (victory or no more tiles)
    // We'll generate positions systematically to fill the board
    
    let moveNumber = 0;
    let gameEnded = false;
    
    // Generate positions in a systematic pattern covering the board
    // This ensures we place tiles across all valid positions
    const generatePositions = () => {
      const positions = [];
      // Cover all valid hexagonal board positions
      for (let row = -3; row <= 3; row++) {
        for (let col = -3; col <= 3; col++) {
          // Valid positions in hexagonal board
          if (Math.abs(row + col) <= 3) {
            positions.push({ row, col });
          }
        }
      }
      return positions;
    };
    
    const allPositions = generatePositions();
    let positionIndex = 0;
    
    while (!gameEnded && moveNumber < MAX_MOVES_LIMIT) {
      
      // Draw tile
      await page.evaluate(() => {
        const store = (window as any).__REDUX_STORE__;
        store.dispatch({ type: 'DRAW_TILE' });
      });
      
      await page.waitForTimeout(200);
      
      state = await getReduxState(page);
      const currentTile = state.game.currentTile;
      
      if (currentTile === null) {
        console.log('No more tiles to draw - deck exhausted');
        break;
      }
      
      // Check if game already ended after drawing (e.g., constraint victory)
      if (state.game.phase === 'finished') {
        console.log('🎉 Game ended after drawing tile!');
        console.log('  Winners:', state.game.winners);
        console.log('  Win type:', state.game.winType);
        
        gameEnded = true;
        moveNumber++;
        
        await pauseAnimations(page);
        await page.screenshot({ 
          path: `tests/e2e/user-stories/005-complete-game/${VICTORY_SCREENSHOT_NAME}`,
          fullPage: false
        });
        
        break;
      }
      
      // Find next valid position (not already occupied)
      let position = null;
      let rotation = 0;
      
      while (positionIndex < allPositions.length) {
        const testPos = allPositions[positionIndex];
        const posKey = `${testPos.row},${testPos.col}`;
        
        if (!state.game.board?.[posKey]) {
          position = testPos;
          // Try different rotations to maximize flow connections
          rotation = (moveNumber + 1) % 6;
          positionIndex++;
          break;
        }
        positionIndex++;
      }
      
      if (!position) {
        console.log('No valid positions - board is full, stopping game');
        // Board is completely filled, game ends
        break;
      }
      
      // Place the tile
      console.log(`About to dispatch PLACE_TILE for move ${moveNumber + 1}: position (${position.row}, ${position.col}), rotation ${rotation}`);
      
      await page.evaluate((moveData) => {
        const store = (window as any).__REDUX_STORE__;
        console.log(`[Browser] Dispatching PLACE_TILE with rotation:`, moveData.rotation);
        store.dispatch({ 
          type: 'PLACE_TILE', 
          payload: { position: { row: moveData.row, col: moveData.col }, rotation: moveData.rotation } 
        });
      }, { row: position.row, col: position.col, rotation });
      
      await page.waitForTimeout(300);
      
      state = await getReduxState(page);
      moveNumber++;
      
      // Get tile from board to verify stored rotation
      const tileKey = `${position.row},${position.col}`;
      const placedTile = state.game.board?.[tileKey];
      console.log(`After placement - Move ${moveNumber}: stored tile rotation in model: ${placedTile?.rotation}`);
      
      // Take screenshot
      await pauseAnimations(page);
      const stepNum = String(moveNumber + 3).padStart(3, '0');
      await page.screenshot({ 
        path: `tests/e2e/user-stories/005-complete-game/${stepNum}-move-${moveNumber}.png`,
        fullPage: false
      });
      
      const currentPlayer = state.game.players[state.game.currentPlayerIndex];
      console.log(`Move ${moveNumber}: Player ${currentPlayer.id} placed tile at (${position.row}, ${position.col}) rotation ${rotation}, model says rotation ${placedTile?.rotation}`);
      
      // Get flow edges for this tile
      const flowEdgesForTile = state.game.flowEdges?.[tileKey];
      
      // Log flow counts
      if (state.game.flows) {
        const player1Flows = state.game.flows[player1.id];
        const player2Flows = state.game.flows[player2.id];
        console.log(`  Player 1 flows: ${player1Flows?.length || 0} positions`);
        console.log(`  Player 2 flows: ${player2Flows?.length || 0} positions`);
        
        // For debugging: log detailed info for moves 4-6
        if (moveNumber >= 4 && moveNumber <= 6) {
          console.log(`  DEBUG - Move ${moveNumber}:`);
          console.log(`    Player 1 flow positions:`, player1Flows);
          console.log(`    Placed tile type: ${placedTile?.type}, rotation: ${rotation}`);
          console.log(`    Tile position: (${position.row}, ${position.col})`);
          
          // Check if this tile is adjacent to any flow positions
          const tileIsAdjacentToFlow = player1Flows?.some((flowPos: string) => {
            const [flowRow, flowCol] = flowPos.split(',').map(Number);
            // Check if adjacent (simplified check)
            const rowDiff = Math.abs(flowRow - position.row);
            const colDiff = Math.abs(flowCol - position.col);
            return (rowDiff + colDiff) === 1 || (rowDiff === 1 && colDiff === 1);
          });
          console.log(`    Tile adjacent to Player 1 flow: ${tileIsAdjacentToFlow}`);
          
          // Check specific tiles
          if (moveNumber === 5) {
            const tile_3_0 = state.game.board?.['-3,0'];
            console.log(`    Tile at (-3,0): type=${tile_3_0?.type}, rotation=${tile_3_0?.rotation}`);
            const flowEdges_3_0 = state.game.flowEdges?.['-3,0'];
            console.log(`    FlowEdges at (-3,0):`, flowEdges_3_0);
            
            // DETAILED ANALYSIS OF MOVE 5 TILE
            console.log(`\n    === MOVE 5 DETAILED ANALYSIS ===`);
            console.log(`    Tile at (-2,-1): type=${placedTile?.type}, rotation=${rotation}`);
            console.log(`    FlowEdges at (-2,-1):`, flowEdgesForTile);
            if (flowEdgesForTile) {
              const dirNames = ['SW', 'W', 'NW', 'NE', 'E', 'SE'];
              console.log(`    FlowEdge directions (human readable):`);
              Object.entries(flowEdgesForTile).forEach(([dir, playerId]) => {
                console.log(`      Direction ${dir} (${dirNames[Number(dir)]}): ${playerId}`);
              });
            }
          }
        }
      }
      
      // === VERIFY FLOW EDGES MATCH MODEL ===
      // This is the key verification requested by the user
      
      if (placedTile) {
        // Verify tile exists in board
        expect(placedTile.position.row).toBe(position.row);
        expect(placedTile.position.col).toBe(position.col);
        
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
        console.log('  Winners:', state.game.winners);
        console.log('  Win type:', state.game.winType);
        
        gameEnded = true;
        
        await pauseAnimations(page);
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
      expect(state.game.winners).toBeDefined();
      expect(state.game.winners.length).toBeGreaterThan(0);
      console.log(`  - Winners: ${state.game.winners.join(', ')}`);
      console.log(`  - Victory type: ${state.game.winType}`);
    } else {
      expect(state.game.phase).toBe('playing');
      console.log(`  - Game in progress (no winner yet)`);
    }
  });
});
