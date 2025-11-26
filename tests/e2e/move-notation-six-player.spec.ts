import { test, expect, Page } from '@playwright/test';
import { formatMoveHistory } from '../../src/game/notation';
import { getReduxState, pauseAnimations, waitForAnimationFrame, takeScreenshot } from './helpers';

test.describe('Move Notation - Six Player Test', () => {
  test('should display notation for all 6 edges with Type 1 tiles in A1 position', async ({ page }) => {
    test.setTimeout(10000); // 10 seconds (test takes ~2.1s)
    
    // === STEP 1: Navigate to the game ===
    await page.goto('/quortextt/tabletop.html');
    await page.waitForSelector('canvas#game-canvas');
    await waitForAnimationFrame(page);

    // === STEP 2: Set tile distribution to only Type 1 tiles ===
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ 
        type: 'UPDATE_SETTINGS', 
        payload: { 
          tileDistribution: [0, 1, 0, 0] // Only Type 1 (OneSharp) tiles
        } 
      });
    });
    
    await waitForAnimationFrame(page);
    
    // === STEP 3: Add 6 players ===
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      // Add players (starts with 0, so add 6)
      for (let i = 0; i < 6; i++) {
        store.dispatch({ type: 'ADD_PLAYER' });
      }
    });
    
    await waitForAnimationFrame(page);
    
    // === STEP 4: Start game with deterministic seed ===
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      const settings = store.getState().ui.settings;
      store.dispatch({ 
        type: 'START_GAME', 
        payload: { 
          seed: 123456,
          tileDistribution: settings.tileDistribution
        } 
      });
    });

    await waitForAnimationFrame(page);

    let state = await getReduxState(page);
    console.log('Seating phase state:', state.game.seatingPhase);

    // === STEP 5: Select edges for all 6 players by clicking ===
    // Player 1 -> edge 0, Player 2 -> edge 1, ..., Player 6 -> edge 5
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    for (let edge = 0; edge < 6; edge++) {
      // Calculate edge position and click it
      const coords = await page.evaluate((edgeNum) => {
        const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const minDimension = Math.min(canvasWidth, canvasHeight);
        const size = minDimension / 17;
        const originX = canvasWidth / 2;
        const originY = canvasHeight / 2;
        const boardRadiusPixels = size * 7.2 + size * 0.8;
        
        // Edge angles: 0=270°, 1=330°, 2=30°, 3=90°, 4=150°, 5=210°
        const angles = [270, 330, 30, 90, 150, 210];
        const angle = angles[edgeNum];
        const angleRad = (angle * Math.PI) / 180;
        const x = originX + boardRadiusPixels * Math.cos(angleRad);
        const y = originY + boardRadiusPixels * Math.sin(angleRad);
        
        return { x, y };
      }, edge);
      
      await canvas.click({ position: { x: coords.x - box.x, y: coords.y - box.y } });
      await waitForAnimationFrame(page);
    }

    state = await getReduxState(page);
    console.log('\nPlayers after edge selection:');
    state.game.players.forEach((p: any, idx: number) => {
      console.log(`Player ${idx + 1} (${p.id}): edge ${p.edgePosition}`);
    });

    // Take initial screenshot
    await pauseAnimations(page);
    await takeScreenshot(page, { 
      path: 'tests/e2e/user-stories/008-six-player-notation/001-initial-state.png',
      fullPage: false
    });

    // === STEP 4: Place tiles for all 6 players ===
    // Each player places a Type 1 tile at position A1 (the rightmost position from their perspective)
    // All tiles use rotation 0 (sharp corner pointing North in absolute terms)
    
    const rotation = 0; // Same rotation for all tiles
    
    for (let playerIdx = 0; playerIdx < 6; playerIdx++) {
      state = await getReduxState(page);
      const currentPlayer = state.game.players[state.game.currentPlayerIndex];
      const edge = currentPlayer.edgePosition;
      
      console.log(`\n=== Player ${playerIdx + 1} turn (edge ${edge}) ===`);
      
      // Draw tile
      await page.evaluate(() => {
        const store = (window as any).__REDUX_STORE__;
        store.dispatch({ type: 'DRAW_TILE' });
      });
      
      await waitForAnimationFrame(page);
      
      state = await getReduxState(page);
      console.log('Current tile:', state.game.currentTile);
      expect(state.game.currentTile).toBe(1); // Should be Type 1
      
      // Calculate A1 position for this edge
      // A1 is the rightmost position from the player's perspective
      // For each edge, we need to find the position on that edge that's rightmost from player's view
      let position: { row: number; col: number };
      
      switch (edge) {
        case 0: // NW edge (top)
          position = { row: -3, col: 3 }; // Rightmost on top edge
          break;
        case 1: // NE edge
          position = { row: -3, col: 0 }; // Rightmost on NE edge
          break;
        case 2: // E edge (right)
          position = { row: 0, col: 3 }; // Rightmost on right edge
          break;
        case 3: // SE edge (bottom)
          position = { row: 3, col: 0 }; // Rightmost on bottom edge
          break;
        case 4: // SW edge
          position = { row: 3, col: -3 }; // Rightmost on SW edge
          break;
        case 5: // W edge (left)
          position = { row: 0, col: -3 }; // Rightmost on left edge
          break;
        default:
          throw new Error('Invalid edge: ' + edge);
      }
      
      console.log('Placing tile at position:', position, 'with rotation:', rotation);
      
      // Place tile
      await page.evaluate((data) => {
        const store = (window as any).__REDUX_STORE__;
        store.dispatch({ 
          type: 'PLACE_TILE', 
          payload: { position: data.position, rotation: data.rotation } 
        });
      }, { position, rotation });
      
      await waitForAnimationFrame(page);
      
      // Move to next player
      await page.evaluate(() => {
        const store = (window as any).__REDUX_STORE__;
        store.dispatch({ type: 'NEXT_PLAYER' });
      });
      
      await waitForAnimationFrame(page);
      
      // Take screenshot after every 2 moves with move list visible
      if ((playerIdx + 1) % 2 === 0) {
        // Open move list
        await page.evaluate(() => {
          const store = (window as any).__REDUX_STORE__;
          store.dispatch({ type: 'SHOW_MOVE_LIST', payload: { corner: 0 } });
        });
        
        await waitForAnimationFrame(page);
        await pauseAnimations(page);
        
        const screenshotNum = String((playerIdx + 1) / 2 + 1).padStart(3, '0');
        await takeScreenshot(page, { 
          path: `tests/e2e/user-stories/008-six-player-notation/${screenshotNum}-moves-${playerIdx - 1}-${playerIdx}.png`,
          fullPage: false
        });
        
        // Close move list
        await page.evaluate(() => {
          const store = (window as any).__REDUX_STORE__;
          store.dispatch({ type: 'HIDE_MOVE_LIST' });
        });
        
        await waitForAnimationFrame(page);
      }
    }

    // === STEP 5: Open final move list and validate ===
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'SHOW_MOVE_LIST', payload: { corner: 0 } });
    });
    
    await waitForAnimationFrame(page);
    
    state = await getReduxState(page);
    
    const allMoveNotations = formatMoveHistory(
      state.game.moveHistory,
      state.game.players,
      state.game.boardRadius
    );
    
    console.log('\n=== ALL MOVE NOTATIONS ===');
    allMoveNotations.forEach((notation: string, index: number) => {
      const move = state.game.moveHistory[index];
      const player = state.game.players.find((p: any) => p.id === move.playerId);
      console.log(`Move ${index + 1}: ${notation} (player edge ${player?.edgePosition}, pos ${JSON.stringify(move.tile.position)}, rot ${move.tile.rotation})`);
    });
    console.log('==========================\n');
    
    // Validate we have 6 moves
    expect(allMoveNotations.length).toBe(6);
    
    // All tiles should be Type 1 with rotation 0
    for (let i = 0; i < 6; i++) {
      expect(state.game.moveHistory[i].tile.type).toBe(1);
      expect(state.game.moveHistory[i].tile.rotation).toBe(0);
    }
    
    // Log detailed information for all moves for user validation
    console.log('\n=== DETAILED MOVE INFORMATION ===');
    for (let i = 0; i < 6; i++) {
      const move = state.game.moveHistory[i];
      const player = state.game.players.find((p: any) => p.id === move.playerId);
      const playerIndex = state.game.players.indexOf(player);
      console.log(`\nMove ${i + 1}:`);
      console.log('  Player ID:', move.playerId);
      console.log('  Player number:', playerIndex + 1);
      console.log('  Player edge:', player?.edgePosition);
      console.log('  Tile position:', move.tile.position);
      console.log('  Tile rotation:', move.tile.rotation);
      console.log('  Notation:', allMoveNotations[i]);
    }
    console.log('=================================\n');
  });
});
