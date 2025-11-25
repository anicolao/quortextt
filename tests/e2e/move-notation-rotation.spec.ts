// E2E test for move notation with specific rotations
// This test validates the notation system for tiles with different rotations
// Specifically testing Type 1 tiles (OneSharp) placed on player edges

import { test, expect } from '@playwright/test';
import { getReduxState, pauseAnimations, waitForAnimationFrame, takeScreenshot } from './helpers';

test.describe('Move Notation with Rotation', () => {
  test('should display notation for Type 1 tiles placed on edges with sharp corner pointing SE', async ({ page }) => {
    test.setTimeout(10000); // 10 seconds (test takes ~2.2s)
    
    await page.goto('/quortextt/tabletop.html');
    await page.waitForSelector('canvas#game-canvas');
    
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    // === STEP 1: Set tile distribution to only Type 1 tiles ===
    // This ensures we only get Type 1 (OneSharp) tiles which make rotation visible
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
    
    // === STEP 2: Add two players ===
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'ADD_PLAYER' });
    });
    
    await waitForAnimationFrame(page);
    
    // === STEP 3: Start game with deterministic seed and tile distribution ===
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      const settings = store.getState().ui.settings;
      store.dispatch({ 
        type: 'START_GAME', 
        payload: { 
          seed: 54321,
          tileDistribution: settings.tileDistribution
        } 
      });
    });
    
    await waitForAnimationFrame(page);
    
    // === STEP 4: Complete seating phase ===
    // Player 1 will select edge 0 (NW edge / top edge)
    // Player 2 will select edge 4 (SW edge)
    
    let state = await getReduxState(page);
    console.log('Seating phase state:', state.game.seatingPhase);
    
    // Player 1 selects edge 0 (top edge)
    const edge0Coords = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const minDimension = Math.min(canvasWidth, canvasHeight);
      const size = minDimension / 17;
      const originX = canvasWidth / 2;
      const originY = canvasHeight / 2;
      const boardRadiusPixels = size * 7.2 + size * 0.8;
      
      // Edge 0 is at 270° (bottom of screen, which is player's "top")
      const angle = 270;
      const angleRad = (angle * Math.PI) / 180;
      const x = originX + boardRadiusPixels * Math.cos(angleRad);
      const y = originY + boardRadiusPixels * Math.sin(angleRad);
      
      return { x, y };
    });
    
    await page.mouse.click(box.x + edge0Coords.x, box.y + edge0Coords.y);
    await waitForAnimationFrame(page);
    
    state = await getReduxState(page);
    console.log('After player 1 edge selection:', state.game.seatingPhase);
    
    // Player 2 selects edge 4 (SW edge)
    const edge4Coords = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const minDimension = Math.min(canvasWidth, canvasHeight);
      const size = minDimension / 17;
      const originX = canvasWidth / 2;
      const originY = canvasHeight / 2;
      const boardRadiusPixels = size * 7.2 + size * 0.8;
      
      // Edge 4 is at 150° (top-left of screen)
      const angle = 150;
      const angleRad = (angle * Math.PI) / 180;
      const x = originX + boardRadiusPixels * Math.cos(angleRad);
      const y = originY + boardRadiusPixels * Math.sin(angleRad);
      
      return { x, y };
    });
    
    await page.mouse.click(box.x + edge4Coords.x, box.y + edge4Coords.y);
    await waitForAnimationFrame(page);
    
    state = await getReduxState(page);
    console.log('After player 2 edge selection:', state.game.seatingPhase);
    console.log('Players:', state.game.players);
    
    // Verify we have 2 players with correct edges
    expect(state.game.players.length).toBe(2);
    
    // Find which player has which edge
    const player1 = state.game.players.find((p: any) => p.edgePosition === 0);
    const player2 = state.game.players.find((p: any) => p.edgePosition === 4);
    
    console.log('Player on edge 0 (top):', player1?.id, player1?.color);
    console.log('Player on edge 4 (SW):', player2?.id, player2?.color);
    
    expect(player1).toBeDefined();
    expect(player2).toBeDefined();
    
    // === STEP 5: Verify tile distribution ===
    // All tiles should be Type 1 (OneSharp) based on our settings
    state = await getReduxState(page);
    console.log('Current player index:', state.game.currentPlayerIndex);
    console.log('Current player ID:', state.game.players[state.game.currentPlayerIndex].id);
    console.log('Available tiles (first 10):', state.game.availableTiles.slice(0, 10));
    
    // Verify all tiles are Type 1
    const allType1 = state.game.availableTiles.every((tile: number) => tile === 1);
    expect(allType1).toBe(true);
    
    await pauseAnimations(page);
    await takeScreenshot(page, { 
      path: 'tests/e2e/user-stories/007-move-notation/001-initial-state.png',
      fullPage: false
    });
    
    // === STEP 6: Draw tile for first player ===
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'DRAW_TILE' });
    });
    
    await waitForAnimationFrame(page);
    
    state = await getReduxState(page);
    console.log('Current tile after draw:', state.game.currentTile);
    expect(state.game.currentTile).toBe(1); // Should be Type 1
    
    // === STEP 7: First player places Type 1 tile on their edge ===
    // Determine which edge the current player is on
    const currentPlayerEdge = state.game.players[state.game.currentPlayerIndex].edgePosition;
    console.log('Current player edge:', currentPlayerEdge);
    
    // Place on the appropriate edge based on player position
    let firstPosition: { row: number; col: number };
    if (currentPlayerEdge === 0) {
      // Edge 0 (NW edge) - row -3
      firstPosition = { row: -3, col: 1 };
    } else if (currentPlayerEdge === 4) {
      // Edge 4 (SW edge) - col -3
      firstPosition = { row: 1, col: -3 };
    } else {
      throw new Error('Unexpected player edge: ' + currentPlayerEdge);
    }
    
    // For Type 1 tile (OneSharp), the canonical orientation (rotation 0) has:
    // - Sharp corner connecting SW (dir 0) and SE (dir 5)
    // - The sharp corner is at the "south" (bottom when viewed from standard orientation)
    // 
    // To point the sharp corner SE "as viewed from the bottom edge of the board":
    // - We want the sharp corner to visually point toward the SE direction
    // - In rotation 5, the sharp corner rotates 300° clockwise (or 60° counter-clockwise)
    // Let's test with rotation 5
    
    const firstRotation = 5;  // Sharp corner pointing SE from board bottom
    
    await page.evaluate((data) => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ 
        type: 'PLACE_TILE', 
        payload: { position: data.position, rotation: data.rotation } 
      });
      // Advance to next player
      store.dispatch({ type: 'NEXT_PLAYER' });
    }, { position: firstPosition, rotation: firstRotation });
    
    await waitForAnimationFrame(page);
    
    state = await getReduxState(page);
    console.log('Move history after first placement:', state.game.moveHistory);
    console.log('First move:', state.game.moveHistory[0]);
    console.log('Current player after NEXT_PLAYER:', state.game.currentPlayerIndex, state.game.players[state.game.currentPlayerIndex].id);
    
    await pauseAnimations(page);
    await takeScreenshot(page, { 
      path: 'tests/e2e/user-stories/007-move-notation/002-first-player-placed.png',
      fullPage: false
    });
    
    // === STEP 8: Draw tile for second player ===
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'DRAW_TILE' });
    });
    
    await waitForAnimationFrame(page);
    
    state = await getReduxState(page);
    console.log('Current tile after second draw:', state.game.currentTile);
    expect(state.game.currentTile).toBe(1); // Should be Type 1
    
    // === STEP 9: Second player places Type 1 tile on their edge ===
    const secondPlayerEdge = state.game.players[state.game.currentPlayerIndex].edgePosition;
    console.log('Second player edge:', secondPlayerEdge);
    
    // Place on the appropriate edge based on player position
    let secondPosition: { row: number; col: number };
    if (secondPlayerEdge === 0) {
      // Edge 0 (NW edge) - row -3
      secondPosition = { row: -3, col: 1 };
    } else if (secondPlayerEdge === 4) {
      // Edge 4 (SW edge) - col -3
      secondPosition = { row: 1, col: -3 };
    } else {
      throw new Error('Unexpected player edge: ' + secondPlayerEdge);
    }
    
    const secondRotation = 5;  // Same rotation for comparison
    
    await page.evaluate((data) => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ 
        type: 'PLACE_TILE', 
        payload: { position: data.position, rotation: data.rotation } 
      });
    }, { position: secondPosition, rotation: secondRotation });
    
    await waitForAnimationFrame(page);
    
    state = await getReduxState(page);
    console.log('Move history after second placement:', state.game.moveHistory);
    console.log('Second move:', state.game.moveHistory[1]);
    
    await pauseAnimations(page);
    await takeScreenshot(page, { 
      path: 'tests/e2e/user-stories/007-move-notation/003-second-player-placed.png',
      fullPage: false
    });
    
    // === STEP 10: Open the move list ===
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'SHOW_MOVE_LIST', payload: { corner: 0 } });
    });
    
    await waitForAnimationFrame(page);
    
    state = await getReduxState(page);
    console.log('Move list visible:', state.ui.moveListCorner !== null);
    
    await pauseAnimations(page);
    await takeScreenshot(page, { 
      path: 'tests/e2e/user-stories/007-move-notation/004-move-list-opened.png',
      fullPage: false
    });
    
    // === STEP 11: Get notation data for validation ===
    // We'll compute the notation in Node.js where we can import the module
    state = await getReduxState(page);
    
    // Import the notation module in Node context
    const { formatMoveHistory } = await import('../../src/game/notation.js');
    
    const moveNotations = formatMoveHistory(
      state.game.moveHistory,
      state.game.players,
      state.game.boardRadius
    );
    
    console.log('\n=== MOVE NOTATIONS ===');
    moveNotations.forEach((notation: string, index: number) => {
      console.log(`Move ${index + 1}: ${notation}`);
    });
    console.log('======================\n');
    
    // Print detailed information for debugging
    console.log('\n=== DETAILED INFORMATION ===');
    console.log('First Move:');
    console.log('  Player ID:', state.game.moveHistory[0].playerId);
    console.log('  Player edge:', state.game.players.find((p: any) => p.id === state.game.moveHistory[0].playerId)?.edgePosition);
    console.log('  Tile position:', state.game.moveHistory[0].tile.position);
    console.log('  Tile rotation:', state.game.moveHistory[0].tile.rotation);
    console.log('  Notation:', moveNotations[0]);
    
    console.log('\nSecond Move:');
    console.log('  Player ID:', state.game.moveHistory[1].playerId);
    console.log('  Player edge:', state.game.players.find((p: any) => p.id === state.game.moveHistory[1].playerId)?.edgePosition);
    console.log('  Tile position:', state.game.moveHistory[1].tile.position);
    console.log('  Tile rotation:', state.game.moveHistory[1].tile.rotation);
    console.log('  Notation:', moveNotations[1]);
    console.log('============================\n');
    
    // Validate the notation format and content
    expect(moveNotations.length).toBe(2);
    
    // Verify both tiles are Type 1
    expect(state.game.moveHistory[0].tile.type).toBe(1);
    expect(state.game.moveHistory[1].tile.type).toBe(1);
    
    // Verify both tiles have rotation 5
    expect(state.game.moveHistory[0].tile.rotation).toBe(5);
    expect(state.game.moveHistory[1].tile.rotation).toBe(5);
    
    // Validate specific expected notation for first 2 moves
    // First move: Player on edge 0, position (-3, 1), rotation 5
    // With formula (rotation - playerEdge + 3) % 6: (5 - 0 + 3) % 6 = 2 (SE)
    expect(moveNotations[0]).toBe('P1A3T1SE');
    
    // Second move: Player on edge 4, position (1, -3), rotation 5
    // With formula (rotation - playerEdge + 3) % 6: (5 - 4 + 3) % 6 = 4 (SW)
    expect(moveNotations[1]).toBe('P2A2T1SW');
    
    // === STEP 12: Close move list and continue with third move ===
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'HIDE_MOVE_LIST' });
    });
    
    await waitForAnimationFrame(page);
    
    // === STEP 13: Draw tile for third move (player 1 again) ===
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'NEXT_PLAYER' });
      store.dispatch({ type: 'DRAW_TILE' });
    });
    
    await waitForAnimationFrame(page);
    
    state = await getReduxState(page);
    console.log('Current tile after third draw:', state.game.currentTile);
    expect(state.game.currentTile).toBe(1); // Should be Type 1
    
    // === STEP 14: Third player places tile with different rotation (rotation 2) ===
    const thirdPlayerEdge = state.game.players[state.game.currentPlayerIndex].edgePosition;
    console.log('Third move player edge:', thirdPlayerEdge);
    
    let thirdPosition: { row: number; col: number };
    if (thirdPlayerEdge === 0) {
      // Edge 0 - place at different position
      thirdPosition = { row: -3, col: 2 };
    } else if (thirdPlayerEdge === 4) {
      // Edge 4 - place at different position
      thirdPosition = { row: 2, col: -3 };
    } else {
      throw new Error('Unexpected player edge: ' + thirdPlayerEdge);
    }
    
    const thirdRotation = 2;  // Different rotation
    
    await page.evaluate((data) => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ 
        type: 'PLACE_TILE', 
        payload: { position: data.position, rotation: data.rotation } 
      });
      store.dispatch({ type: 'NEXT_PLAYER' });
    }, { position: thirdPosition, rotation: thirdRotation });
    
    await waitForAnimationFrame(page);
    
    // === STEP 15: Draw tile for fourth move (player 2 again) ===
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'DRAW_TILE' });
    });
    
    await waitForAnimationFrame(page);
    
    state = await getReduxState(page);
    console.log('Current tile after fourth draw:', state.game.currentTile);
    expect(state.game.currentTile).toBe(1); // Should be Type 1
    
    // === STEP 16: Fourth player places tile with different rotation (rotation 0) ===
    const fourthPlayerEdge = state.game.players[state.game.currentPlayerIndex].edgePosition;
    console.log('Fourth move player edge:', fourthPlayerEdge);
    
    let fourthPosition: { row: number; col: number };
    if (fourthPlayerEdge === 0) {
      // Edge 0 - place at different position
      fourthPosition = { row: -3, col: 0 };
    } else if (fourthPlayerEdge === 4) {
      // Edge 4 - place at different position
      fourthPosition = { row: 0, col: -3 };
    } else {
      throw new Error('Unexpected player edge: ' + fourthPlayerEdge);
    }
    
    const fourthRotation = 0;  // Different rotation
    
    await page.evaluate((data) => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ 
        type: 'PLACE_TILE', 
        payload: { position: data.position, rotation: data.rotation } 
      });
    }, { position: fourthPosition, rotation: fourthRotation });
    
    await waitForAnimationFrame(page);
    
    // === STEP 17: Open move list again to show all 4 moves ===
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'SHOW_MOVE_LIST', payload: { corner: 0 } });
    });
    
    await waitForAnimationFrame(page);
    
    await pauseAnimations(page);
    await takeScreenshot(page, { 
      path: 'tests/e2e/user-stories/007-move-notation/005-four-moves-list.png',
      fullPage: false
    });
    
    // === STEP 18: Get notation for all 4 moves ===
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
      console.log(`Move ${index + 1}: ${notation} (edge ${player?.edgePosition}, pos ${JSON.stringify(move.tile.position)}, rot ${move.tile.rotation})`);
    });
    console.log('==========================\n');
    
    // Validate we have 4 moves
    expect(allMoveNotations.length).toBe(4);
    
    // All tiles should be Type 1
    expect(state.game.moveHistory[2].tile.type).toBe(1);
    expect(state.game.moveHistory[3].tile.type).toBe(1);
    
    // Verify rotations are as expected
    expect(state.game.moveHistory[2].tile.rotation).toBe(2);
    expect(state.game.moveHistory[3].tile.rotation).toBe(0);
    
    // Validate all expected notations with corrected formula: (rotation - playerEdge + 3) % 6
    expect(allMoveNotations[0]).toBe('P1A3T1SE'); // Move 1: edge 0, rot 5 → (5-0+3)%6=2 (SE)
    expect(allMoveNotations[1]).toBe('P2A2T1SW'); // Move 2: edge 4, rot 5 → (5-4+3)%6=4 (SW)
    expect(allMoveNotations[2]).toBe('P1A2T1NW'); // Move 3: edge 0, rot 2 → (2-0+3)%6=5 (NW)
    expect(allMoveNotations[3]).toBe('P2A1T1NW'); // Move 4: edge 4, rot 0 → (0-4+3)%6=5 (NW)
    
    // Log detailed information for all moves for user validation
    console.log('\n=== DETAILED MOVE INFORMATION ===');
    for (let i = 0; i < 4; i++) {
      const move = state.game.moveHistory[i];
      const player = state.game.players.find((p: any) => p.id === move.playerId);
      console.log(`\nMove ${i + 1}:`);
      console.log('  Player ID:', move.playerId);
      console.log('  Player edge:', player?.edgePosition);
      console.log('  Tile position:', move.tile.position);
      console.log('  Tile rotation:', move.tile.rotation);
      console.log('  Notation:', allMoveNotations[i]);
    }
    console.log('=================================\n');
  });
});
