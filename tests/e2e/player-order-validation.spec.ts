// E2E test to validate that player order follows clockwise seating around hexagon
// This test creates 6 players, has them select seats, and validates that
// the play order is clockwise from the starting player, not based on
// the randomized seating order or join order.
//
// IMPORTANT: This test uses a deterministic seed (54321) to ensure reproducible
// results and consistent screenshots across test runs. All screenshots in
// tests/e2e/user-stories/player-order/ are from a single continuous test execution.

import { test, expect } from '@playwright/test';
import { getReduxState, getSeatingEdgeButtonCoordinates, waitForAnimationFrame, pauseAnimations, takeScreenshot } from './helpers';

// Helper to add players through the configuration UI
async function addPlayers(page: any, canvas: any, box: any, count: number) {
  // PLAYER_COLORS order: Blue, Orange, Green, Yellow, Purple, Red
  const colors = [
    { index: 0, edge: 0 }, // Blue from bottom
    { index: 1, edge: 1 }, // Orange from right
    { index: 2, edge: 2 }, // Green from top
    { index: 3, edge: 3 }, // Yellow from left
    { index: 4, edge: 0 }, // Purple from bottom
    { index: 5, edge: 0 }, // Red from bottom
  ];

  for (let i = 0; i < count && i < colors.length; i++) {
    const { index, edge } = colors[i];
    const coords = await page.evaluate(({ colorIndex, edge }: { colorIndex: number; edge: number }) => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const minDim = Math.min(canvasWidth, canvasHeight);
      const buttonSize = Math.max(60, minDim * 0.08);
      const edgeMargin = minDim * 0.05;
      const buttonSpacing = buttonSize * 0.3;

      const state = (window as any).__REDUX_STORE__.getState();
      const players = state.game.configPlayers;
      const PLAYER_COLORS = ['#0173B2', '#DE8F05', '#029E73', '#ECE133', '#CC78BC', '#CA5127'];
      const usedColors = new Set(players.map((p: any) => p.color));
      const availableColors = PLAYER_COLORS.filter((color: string) => !usedColors.has(color));

      const targetColor = PLAYER_COLORS[colorIndex];
      const availableIndex = availableColors.indexOf(targetColor);

      if (availableIndex === -1) {
        return null;
      }

      let x: number, y: number;

      if (edge === 0) { // Bottom
        const totalWidth = availableColors.length * buttonSize + (availableColors.length - 1) * buttonSpacing;
        const startX = (canvasWidth - totalWidth) / 2;
        x = startX + availableIndex * (buttonSize + buttonSpacing) + buttonSize / 2;
        y = canvasHeight - edgeMargin - buttonSize / 2;
      } else if (edge === 1) { // Right
        const totalHeight = availableColors.length * buttonSize + (availableColors.length - 1) * buttonSpacing;
        const startY = (canvasHeight - totalHeight) / 2;
        x = canvasWidth - edgeMargin - buttonSize / 2;
        y = startY + availableIndex * (buttonSize + buttonSpacing) + buttonSize / 2;
      } else if (edge === 2) { // Top
        const totalWidth = availableColors.length * buttonSize + (availableColors.length - 1) * buttonSpacing;
        const startX = (canvasWidth - totalWidth) / 2;
        x = startX + availableIndex * (buttonSize + buttonSpacing) + buttonSize / 2;
        y = edgeMargin + buttonSize / 2;
      } else { // Left
        const totalHeight = availableColors.length * buttonSize + (availableColors.length - 1) * buttonSpacing;
        const startY = (canvasHeight - totalHeight) / 2;
        x = edgeMargin + buttonSize / 2;
        y = startY + availableIndex * (buttonSize + buttonSpacing) + buttonSize / 2;
      }

      return { x, y };
    }, { colorIndex: index, edge });

    if (!coords) {
      throw new Error(`Could not add player ${i}`);
    }
    await page.mouse.click(box.x + coords.x, box.y + coords.y);
    await waitForAnimationFrame(page);
  }
}

// Helper to click the Start Game button
async function clickStartGame(page: any, canvas: any, box: any) {
  const coords = await page.evaluate(() => {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    return { x: canvas.width / 2, y: canvas.height / 2 };
  });
  await page.mouse.click(box.x + coords.x, box.y + coords.y);
  await waitForAnimationFrame(page);
}

// Helper to complete seating phase with specific edge selections
async function completeSeatingsWithOrder(page: any, canvas: any, box: any, edgeOrder: number[]) {
  const state = await getReduxState(page);
  const numPlayers = state.game.seatingPhase.seatingOrder.length;
  
  if (edgeOrder.length !== numPlayers) {
    throw new Error(`Edge order length ${edgeOrder.length} doesn't match number of players ${numPlayers}`);
  }

  for (let i = 0; i < numPlayers; i++) {
    const edgeNumber = edgeOrder[i];
    const coords = await getSeatingEdgeButtonCoordinates(page, edgeNumber);
    await page.mouse.click(box.x + coords.x, box.y + coords.y);
    await waitForAnimationFrame(page);
  }
  
  await waitForAnimationFrame(page);
}

// Helper to get a hex position for placing a tile
async function getHexPosition(page: any, row: number, col: number) {
  return await page.evaluate(({ row, col }: { row: number; col: number }) => {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const minDimension = Math.min(canvasWidth, canvasHeight);
    const boardRadius = 3; // Default board size
    const canvasSizeMultiplier = ((boardRadius * 2 + 2) * 2 + 1); // = 17 for boardRadius=3
    const size = minDimension / canvasSizeMultiplier;
    const originX = canvasWidth / 2;
    const originY = canvasHeight / 2;

    // Axial to pixel conversion (flat-topped hexagon)
    const x = originX + size * (Math.sqrt(3) * col + Math.sqrt(3) / 2 * row);
    const y = originY + size * (3 / 2 * row);

    return { x, y };
  }, { row, col });
}

test.describe('Player Order Validation', () => {
  test('6-player game should follow clockwise order from starting player', async ({ page }) => {
    await page.goto('/quortextt/tabletop.html');
    await page.waitForSelector('canvas#game-canvas');
    
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // STEP 1: Add 6 players
    await addPlayers(page, canvas, box, 6);
    let state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(6);
    
    // Take screenshot showing 6 players configured
    await pauseAnimations(page);
    await takeScreenshot(page, { path: 'tests/e2e/user-stories/player-order/001-six-players-configured.png' });

    // STEP 2: Start the game with a deterministic seed for reproducible screenshots
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'START_GAME', payload: { seed: 54321 } });
    });
    await waitForAnimationFrame(page);
    state = await getReduxState(page);
    expect(state.game.screen).toBe('seating');
    expect(state.game.seatingPhase.active).toBe(true);
    
    // Record the seating order (now deterministic due to seed)
    const seatingOrder = state.game.seatingPhase.seatingOrder;
    console.log('Seating order (deterministic with seed 54321):', seatingOrder);
    
    // Take screenshot of seating phase
    await pauseAnimations(page);
    await takeScreenshot(page, { path: 'tests/e2e/user-stories/player-order/002-seating-phase.png' });

    // STEP 3: Have players select edges in clockwise order 
    // (edges 0, 1, 2, 3, 4, 5 correspond to positions around the hexagon)
    // Each player in seating order picks the next edge in sequence
    const edgeSelections = [0, 1, 2, 3, 4, 5];
    await completeSeatingsWithOrder(page, canvas, box, edgeSelections);
    
    state = await getReduxState(page);
    expect(state.game.screen).toBe('gameplay');
    expect(state.game.phase).toBe('playing');
    
    // Record the edge assignments
    const players = state.game.players;
    console.log('Players after seating:');
    players.forEach((p: any, idx: number) => {
      console.log(`  ${idx}: ${p.id} at edge ${p.edgePosition}, color ${p.color}`);
    });
    
    // Take screenshot of initial gameplay state
    await pauseAnimations(page);
    await takeScreenshot(page, { path: 'tests/e2e/user-stories/player-order/003-gameplay-started.png' });

    // STEP 4: Verify the starting player is first from seating order
    const currentPlayerIndex = state.game.currentPlayerIndex;
    const currentPlayer = players[currentPlayerIndex];
    const startingPlayerId = seatingOrder[0];
    
    console.log(`Starting player ID from seating order: ${startingPlayerId}`);
    console.log(`Current player at index ${currentPlayerIndex}: ${currentPlayer.id}`);
    
    expect(currentPlayer.id).toBe(startingPlayerId);

    // STEP 5: Build expected play order - clockwise from starting player
    // Players are seated at edges: 0, 1, 2, 3, 4, 5 (in seating order)
    // Expected play order should be clockwise from starting player's edge
    const edgeToPlayer = new Map<number, any>();
    players.forEach((p: any) => {
      edgeToPlayer.set(p.edgePosition, p);
    });
    
    // Starting player is at edge 0 (first in seating order selected edge 0)
    const startingEdge = currentPlayer.edgePosition;
    const expectedPlayOrder: string[] = [];
    
    // Build clockwise order starting from starting player's edge
    for (let i = 0; i < 6; i++) {
      const edge = (startingEdge + i) % 6;
      const player = edgeToPlayer.get(edge);
      if (player) {
        expectedPlayOrder.push(player.id);
      }
    }
    
    console.log('Expected play order (clockwise from starting player):');
    expectedPlayOrder.forEach((id, idx) => {
      const p = players.find((p: any) => p.id === id);
      console.log(`  ${idx}: ${id} at edge ${p.edgePosition}`);
    });

    // STEP 6: Place one tile per player and verify order
    const tilePlacements = [
      { row: 0, col: 0 },   // Center
      { row: -1, col: 0 },  // Above center
      { row: -1, col: 1 },  // Top right
      { row: 0, col: 1 },   // Right
      { row: 1, col: 0 },   // Bottom right
      { row: 1, col: -1 },  // Bottom left
    ];

    for (let turnIndex = 0; turnIndex < 6; turnIndex++) {
      state = await getReduxState(page);
      const currentIdx = state.game.currentPlayerIndex;
      const currentPlayerId = state.game.players[currentIdx].id;
      const currentTile = state.game.currentTile;
      
      console.log(`Turn ${turnIndex}: Player ${currentPlayerId} (index ${currentIdx}) placing tile type ${currentTile}`);
      
      // Verify this is the expected player
      expect(currentPlayerId).toBe(expectedPlayOrder[turnIndex]);
      
      // Place a tile using Redux actions (more reliable for testing)
      const placement = tilePlacements[turnIndex];
      await page.evaluate(({ row, col }: { row: number; col: number }) => {
        const store = (window as any).__REDUX_STORE__;
        // Place tile with rotation 0
        store.dispatch({ type: 'PLACE_TILE', payload: { position: { row, col }, rotation: 0 } });
        // Advance to next player
        store.dispatch({ type: 'NEXT_PLAYER' });
        // Draw next tile
        store.dispatch({ type: 'DRAW_TILE' });
      }, placement);
      await waitForAnimationFrame(page);
      
      // Take screenshot after each placement
      await pauseAnimations(page);
      await takeScreenshot(page, { 
        path: `tests/e2e/user-stories/player-order/004-turn-${turnIndex + 1}-player-${currentPlayerId}.png` 
      });
    }

    // STEP 7: Final verification - all 6 tiles placed in correct order
    state = await getReduxState(page);
    expect(state.game.moveHistory.length).toBe(6);
    
    // Verify each move was made by the expected player
    state.game.moveHistory.forEach((move: any, idx: number) => {
      console.log(`Move ${idx}: ${move.playerId} placed tile at ${move.tile.position.row},${move.tile.position.col}`);
      expect(move.playerId).toBe(expectedPlayOrder[idx]);
    });

    // Take final screenshot
    await pauseAnimations(page);
    await takeScreenshot(page, { path: 'tests/e2e/user-stories/player-order/005-all-turns-complete.png' });
    
    console.log('✓ Player order validated: turns taken in clockwise order from starting player');
  });
});
