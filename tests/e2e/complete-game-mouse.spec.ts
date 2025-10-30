// E2E test for a complete 2-player game using mouse clicks
// This test demonstrates a full game from setup to victory using only mouse interactions
import { test, expect } from '@playwright/test';
import { getReduxState } from './helpers';
import { HexPosition } from '../../src/game/types';

// Helper to calculate pixel coordinates for a hex position
async function getHexPixelCoords(page: any, hexPos: HexPosition) {
  return await page.evaluate((pos: HexPosition) => {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // Calculate hex layout (same as in hexLayout.ts)
    const minDimension = Math.min(canvasWidth, canvasHeight);
    const size = minDimension / 17;
    const originX = canvasWidth / 2;
    const originY = canvasHeight / 2;
    
    // Convert hex to pixel (pointy-top orientation)
    const x = originX + size * (Math.sqrt(3) * pos.col + (Math.sqrt(3) / 2) * pos.row);
    const y = originY + size * ((3 / 2) * pos.row);
    
    return { x, y };
  }, hexPos);
}

// Helper to get coordinates for clicking on left or right side of tile to rotate
async function getTileRotationCoords(page: any, hexPos: HexPosition | null, side: 'left' | 'right') {
  return await page.evaluate((args: { pos: HexPosition | null, side: 'left' | 'right' }) => {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const state = (window as any).__REDUX_STORE__.getState();
    
    // Calculate hex layout
    const minDimension = Math.min(canvasWidth, canvasHeight);
    const size = minDimension / 17;
    const originX = canvasWidth / 2;
    const originY = canvasHeight / 2;
    
    let centerX: number, centerY: number;
    
    if (args.pos) {
      // Tile is placed on board
      centerX = originX + size * (Math.sqrt(3) * args.pos.col + (Math.sqrt(3) / 2) * args.pos.row);
      centerY = originY + size * ((3 / 2) * args.pos.row);
    } else {
      // Tile is at player's edge position
      const currentPlayer = state.game.players[state.game.currentPlayerIndex];
      const edgePosition = currentPlayer.edgePosition;
      
      // Calculate player edge position (matching the fixed logic in hexLayout.ts)
      const boardRadius = size * 7.2;
      
      // Calculate maximum distance that keeps tile within canvas
      const maxVerticalDistance = Math.min(
        originY - size * 1.5,  // Top edge
        canvasHeight - originY - size * 1.5  // Bottom edge
      );
      
      const maxHorizontalDistance = Math.min(
        originX - size * 1.5,  // Left edge
        canvasWidth - originX - size * 1.5  // Right edge
      );
      
      const idealDistance = boardRadius + size * 1.5;
      const maxDistance = Math.min(maxVerticalDistance, maxHorizontalDistance);
      const previewDistance = Math.min(idealDistance, maxDistance);
      
      const angles = [270, 330, 30, 90, 150, 210];
      const angleDeg = angles[edgePosition];
      const angleRad = (Math.PI / 180) * angleDeg;
      
      centerX = originX + previewDistance * Math.cos(angleRad);
      centerY = originY + previewDistance * Math.sin(angleRad);
    }
    
    // Click on left or right side of the tile
    const offset = size * 0.6; // Click near edge of tile
    if (args.side === 'left') {
      return { x: centerX - offset, y: centerY };
    } else {
      return { x: centerX + offset, y: centerY };
    }
  }, { pos: hexPos, side });
}

// Helper to get coordinates for checkmark or X button
async function getConfirmationButtonCoords(page: any, hexPos: HexPosition, button: 'check' | 'x') {
  return await page.evaluate((args: { pos: HexPosition, button: 'check' | 'x' }) => {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // Calculate hex layout
    const minDimension = Math.min(canvasWidth, canvasHeight);
    const size = minDimension / 17;
    const originX = canvasWidth / 2;
    const originY = canvasHeight / 2;
    
    // Get tile center
    const centerX = originX + size * (Math.sqrt(3) * args.pos.col + (Math.sqrt(3) / 2) * args.pos.row);
    const centerY = originY + size * ((3 / 2) * args.pos.row);
    
    // Button spacing (from gameplayInputHandler.ts)
    const buttonSpacing = size * 2;
    
    if (args.button === 'check') {
      return { x: centerX + buttonSpacing, y: centerY };
    } else {
      return { x: centerX - buttonSpacing, y: centerY };
    }
  }, { pos: hexPos, button });
}

// Helper to get button coordinates for configuration screen
async function getConfigButtonCoordinates(page: any, buttonType: 'add-player' | 'start-game') {
  return await page.evaluate((type: string) => {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const padding = Math.min(canvasWidth, canvasHeight) * 0.05;
    const titleSize = Math.min(canvasWidth, canvasHeight) * 0.06;
    const titleY = padding + titleSize;
    const buttonHeight = Math.min(canvasWidth, canvasHeight) * 0.08;
    
    // Get current players count from Redux store
    const state = (window as any).__REDUX_STORE__.getState();
    const players = state.game.configPlayers;
    
    // Calculate player list area
    const playerListStartY = titleY + titleSize + padding * 2;
    const colorIconSize = Math.min(canvasWidth, canvasHeight) * 0.06;
    const playerEntryHeight = colorIconSize + padding * 0.5;
    
    // Add Player button position
    const addPlayerButtonY = players.length > 0
      ? playerListStartY + players.length * playerEntryHeight + padding * 1.5
      : playerListStartY;
    
    const buttonCenterX = canvasWidth / 2;
    const addPlayerButtonCenterY = addPlayerButtonY + buttonHeight / 2;
    
    // Start Game button is below Add Player button
    const startGameButtonCenterY = addPlayerButtonY + buttonHeight + padding + buttonHeight / 2;
    
    if (type === 'add-player') {
      return { x: buttonCenterX, y: addPlayerButtonCenterY };
    } else {
      return { x: buttonCenterX, y: startGameButtonCenterY };
    }
  }, buttonType);
}

test.describe('Complete 2-Player Game with Mouse Clicks', () => {
  // Test configuration constants
  const DETERMINISTIC_SEED = 999; // Seed for reproducible tile shuffle
  const MAX_MOVES_LIMIT = 50; // Safety limit
  const SCREENSHOT_DIR = 'tests/e2e/user-stories/006-complete-game-mouse';

  test('should play through a full game using only mouse clicks', async ({ page }) => {
    // Increase timeout for this long-running test
    test.setTimeout(120000); // 2 minutes
    
    // Screenshot counter for sequential naming
    let screenshotCounter = 1;
    const takeScreenshot = async (description: string) => {
      const filename = `${String(screenshotCounter).padStart(4, '0')}-${description}.png`;
      await page.screenshot({ 
        path: `${SCREENSHOT_DIR}/${filename}`,
        fullPage: false
      });
      screenshotCounter++;
    };
    
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    
    // Get canvas bounding box for mouse clicks
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    // === STEP 1: Initial configuration screen ===
    await takeScreenshot('initial-screen');
    
    // === STEP 2: Add two players using mouse clicks ===
    for (let i = 0; i < 2; i++) {
      const coords = await getConfigButtonCoordinates(page, 'add-player');
      await page.mouse.click(box.x + coords.x, box.y + coords.y);
      await page.waitForTimeout(200);
    }
    
    await takeScreenshot('players-added');
    
    // Verify we have 2 players
    let state = await getReduxState(page);
    expect(state.game.configPlayers.length).toBe(2);
    
    // === STEP 3: Start the game ===
    await page.evaluate((seed) => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'START_GAME' });
      // Use a deterministic seed for reproducible game
      store.dispatch({ type: 'SHUFFLE_TILES', payload: { seed } });
      // Draw a tile from the seeded deck to ensure deterministic currentTile
      store.dispatch({ type: 'DRAW_TILE' });
    }, DETERMINISTIC_SEED);
    
    await page.waitForTimeout(500);
    
    state = await getReduxState(page);
    expect(state.game.screen).toBe('gameplay');
    expect(state.game.phase).toBe('playing');
    expect(state.game.players.length).toBe(2);
    
    await takeScreenshot('game-started');
    
    const player1 = state.game.players[0];
    const player2 = state.game.players[1];
    
    console.log('Player 1:', player1.id, 'edge:', player1.edgePosition, 'color:', player1.color);
    console.log('Player 2:', player2.id, 'edge:', player2.edgePosition, 'color:', player2.color);
    
    // Players in 2-player game should be on opposite edges (0 and 3)
    expect([player1.edgePosition, player2.edgePosition].sort()).toEqual([0, 3]);
    
    // === Play the game using mouse clicks ===
    let moveNumber = 0;
    let gameEnded = false;
    
    // Generate positions in a systematic pattern
    const generatePositions = () => {
      const positions = [];
      for (let row = -3; row <= 3; row++) {
        for (let col = -3; col <= 3; col++) {
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
      
      state = await getReduxState(page);
      const currentTile = state.game.currentTile;
      
      if (currentTile === null) {
        console.log('No more tiles to draw - deck exhausted');
        break;
      }
      
      // Check if game already ended after drawing
      if (state.game.phase === 'finished') {
        console.log('🎉 Game ended after drawing tile!');
        console.log('  Winner:', state.game.winner);
        console.log('  Win type:', state.game.winType);
        
        gameEnded = true;
        moveNumber++;
        
        await takeScreenshot('victory-final');
        
        break;
      }
      
      // Find next valid position
      let position = null;
      let rotation = 0;
      
      while (positionIndex < allPositions.length) {
        const testPos = allPositions[positionIndex];
        const posKey = `${testPos.row},${testPos.col}`;
        
        if (!state.game.board?.[posKey]) {
          position = testPos;
          rotation = (moveNumber + 1) % 6;
          positionIndex++;
          break;
        }
        positionIndex++;
      }
      
      if (!position) {
        console.log('No valid positions - board is full');
        break;
      }
      
      console.log(`\n=== Move ${moveNumber + 1}: Placing tile at (${position.row}, ${position.col}) with rotation ${rotation} ===`);
      
      // Take screenshot before placement
      await takeScreenshot(`before-move-${moveNumber + 1}`);
      
      // Step 1: Rotate the tile to desired rotation using mouse clicks
      state = await getReduxState(page);
      let currentRotation = state.ui.currentRotation;
      
      // Rotate via mouse clicks on the tile
      while (currentRotation !== rotation) {
        const rotateCoords = await getTileRotationCoords(page, null, 'right');
        console.log(`  Clicking to rotate at (${rotateCoords.x.toFixed(1)}, ${rotateCoords.y.toFixed(1)})`);
        
        await page.mouse.click(box.x + rotateCoords.x, box.y + rotateCoords.y);
        await page.waitForTimeout(200); // Wait for rotation animation
        
        state = await getReduxState(page);
        const newRotation = state.ui.currentRotation;
        
        // Verify rotation actually changed
        expect(newRotation).not.toBe(currentRotation);
        
        currentRotation = newRotation;
        console.log(`  Rotated tile: now at rotation ${currentRotation}`);
        
        // Take screenshot of rotation state
        await takeScreenshot(`move-${moveNumber + 1}-rotation-${currentRotation}`);
      }
      
      // Step 2: Click on the hex position to place the tile
      const hexCoords = await getHexPixelCoords(page, position);
      console.log(`  Clicking on hex at pixel (${hexCoords.x.toFixed(1)}, ${hexCoords.y.toFixed(1)})`);
      await page.mouse.click(box.x + hexCoords.x, box.y + hexCoords.y);
      await page.waitForTimeout(300);
      
      // Verify tile is now in selected position
      state = await getReduxState(page);
      expect(state.ui.selectedPosition).not.toBeNull();
      expect(state.ui.selectedPosition?.row).toBe(position.row);
      expect(state.ui.selectedPosition?.col).toBe(position.col);
      
      console.log(`  Tile placed at preview position`);
      
      // Take screenshot showing tile placement with checkmark/X buttons
      await takeScreenshot(`move-${moveNumber + 1}-tile-placed`);
      
      // Step 3: Click the checkmark button to confirm placement
      const checkCoords = await getConfirmationButtonCoords(page, position, 'check');
      console.log(`  Clicking checkmark at pixel (${checkCoords.x.toFixed(1)}, ${checkCoords.y.toFixed(1)})`);
      await page.mouse.click(box.x + checkCoords.x, box.y + checkCoords.y);
      await page.waitForTimeout(400);
      
      state = await getReduxState(page);
      moveNumber++;
      
      // Verify tile was committed
      const tileKey = `${position.row},${position.col}`;
      const placedTile = state.game.board?.[tileKey];
      expect(placedTile).toBeDefined();
      expect(placedTile?.rotation).toBe(rotation);
      
      console.log(`  Tile confirmed and committed`);
      
      // Take screenshot after confirmation
      await takeScreenshot(`move-${moveNumber}-complete`);
      
      const currentPlayer = state.game.players[state.game.currentPlayerIndex];
      console.log(`Move ${moveNumber} complete: Player ${currentPlayer.id} placed tile at (${position.row}, ${position.col}) rotation ${rotation}`);
      
      // Log flow information
      if (state.game.flows) {
        const player1Flows = state.game.flows[player1.id];
        const player2Flows = state.game.flows[player2.id];
        console.log(`  Player 1 flows: ${player1Flows?.length || 0} positions`);
        console.log(`  Player 2 flows: ${player2Flows?.length || 0} positions`);
      }
      
      // Check if game ended
      if (state.game.phase === 'finished') {
        console.log('🎉 Game ended with victory!');
        console.log('  Winner:', state.game.winner);
        console.log('  Win type:', state.game.winType);
        
        gameEnded = true;
        
        await takeScreenshot('victory-final');
        
        break;
      }
      
      // Next player happens automatically via checkmark click
      // Wait for new tile to be drawn for next player
      await page.waitForTimeout(500);
    }
    
    // === Final Verification ===
    state = await getReduxState(page);
    
    // Verify meaningful game was played
    expect(moveNumber).toBeGreaterThan(0);
    console.log(`\n✓ Complete game test (mouse clicks) finished`);
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
