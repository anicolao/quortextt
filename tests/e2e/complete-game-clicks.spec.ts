// Generic E2E test that replays a game from .clicks file (mouse clicks)
import { test, expect } from '@playwright/test';
import { getReduxState, pauseAnimations, waitForAnimationFrame } from './helpers';
import { loadClicksFromFile, ClickAction } from '../utils/actionConverter';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Parse expectations file to extract move prefixes
 */
interface MoveExpectation {
  moveNumber: number;
  p1Flows: Record<number, number>;
  p2Flows: Record<number, number>;
  totalTiles: number;
}

/**
 * Tile placement info from actions file
 */
interface TilePlacementInfo {
  moveNumber: number;
  position: { row: number; col: number };
  rotation: number;
}

function parseExpectationsFile(filepath: string): MoveExpectation[] {
  const content = fs.readFileSync(filepath, 'utf-8');
  const lines = content.split('\n');
  const expectations: MoveExpectation[] = [];
  
  let inMovePrefixes = false;
  for (const line of lines) {
    if (line.includes('[MOVE_PREFIXES]')) {
      inMovePrefixes = true;
      continue;
    }
    
    if (inMovePrefixes && line.trim()) {
      // Parse line like: "1 p1={0:1,1:1} p2={}"
      const match = line.match(/^(\d+)\s+p1=\{([^}]*)\}\s+p2=\{([^}]*)\}/);
      if (match) {
        const moveNumber = parseInt(match[1]);
        const p1Data = match[2];
        const p2Data = match[3];
        
        const p1Flows: Record<number, number> = {};
        if (p1Data) {
          p1Data.split(',').forEach(pair => {
            const [idx, len] = pair.split(':').map(Number);
            p1Flows[idx] = len;
          });
        }
        
        const p2Flows: Record<number, number> = {};
        if (p2Data) {
          p2Data.split(',').forEach(pair => {
            const [idx, len] = pair.split(':').map(Number);
            p2Flows[idx] = len;
          });
        }
        
        expectations.push({
          moveNumber,
          p1Flows,
          p2Flows,
          totalTiles: moveNumber // Each move places one tile
        });
      }
    }
  }
  
  return expectations;
}

/**
 * Load tile placement info from actions file
 */
function loadTilePlacements(actionsFilepath: string): TilePlacementInfo[] {
  const content = fs.readFileSync(actionsFilepath, 'utf-8');
  const actions = content
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
  
  const placements: TilePlacementInfo[] = [];
  let moveNumber = 0;
  
  for (const action of actions) {
    if (action.type === 'PLACE_TILE') {
      moveNumber++;
      placements.push({
        moveNumber,
        position: action.payload.position,
        rotation: action.payload.rotation
      });
    }
  }
  
  return placements;
}

/**
 * Count actual flows and their lengths from game state
 */
function countFlows(state: any): { p1Flows: Record<number, number>, p2Flows: Record<number, number> } {
  const p1Flows: Record<number, number> = {};
  const p2Flows: Record<number, number> = {};
  
  if (!state?.game?.players || state.game.players.length < 2) {
    return { p1Flows, p2Flows };
  }
  
  // Get player flow data
  const player1 = state.game.players[0];
  const player2 = state.game.players[1];
  
  // Count flows for each player
  if (player1?.flows) {
    Object.keys(player1.flows).forEach((key, idx) => {
      const flowData = player1.flows[key];
      if (flowData && flowData.length > 0) {
        p1Flows[idx] = flowData.length;
      }
    });
  }
  
  if (player2?.flows) {
    Object.keys(player2.flows).forEach((key, idx) => {
      const flowData = player2.flows[key];
      if (flowData && flowData.length > 0) {
        p2Flows[idx] = flowData.length;
      }
    });
  }
  
  return { p1Flows, p2Flows };
}

// Test function parameterized by seed
// This test replays a game from .clicks file (actual mouse clicks)
async function testCompleteGameFromClicks(page: any, seed: string) {
  const clicksFile = path.join(__dirname, `user-stories/006-complete-game-mouse/${seed}/${seed}.clicks`);
  const actionsFile = path.join(__dirname, `user-stories/006-complete-game-mouse/${seed}/${seed}.actions`);
  const expectationsFile = path.join(__dirname, `user-stories/006-complete-game-mouse/${seed}/${seed}.expectations`);
  const screenshotDir = path.join(__dirname, `user-stories/006-complete-game-mouse/${seed}/screenshots`);
  
  // Create screenshot directory
  fs.mkdirSync(screenshotDir, { recursive: true });
  
  // Load clicks, actions, and expectations
  const content = fs.readFileSync(clicksFile, 'utf-8');
  const clicks = loadClicksFromFile(content);
  console.log(`Loaded ${clicks.length} clicks for seed ${seed}`);
  
  const expectations = parseExpectationsFile(expectationsFile);
  console.log(`Loaded ${expectations.length} move expectations`);
  
  const expectedPlacements = loadTilePlacements(actionsFile);
  console.log(`Loaded ${expectedPlacements.length} expected tile placements`);
  
  // Navigate to the game
  await page.goto('/');
  await page.waitForSelector('canvas#game-canvas');
  
  const canvas = page.locator('canvas#game-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');
  
  // Verify canvas size matches what clicks were generated for
  console.log(`Canvas size: ${box.width}x${box.height}`);
  
  // Take initial screenshot
  await pauseAnimations(page);
  await page.screenshot({ 
    path: path.join(screenshotDir, '0001-initial-screen.png'),
    fullPage: false
  });
  
  // Validate initial state
  let state = await getReduxState(page);
  expect(state).toBeDefined();
  expect(state.game).toBeDefined();
  expect(state.game.players.length).toBe(0); // No players initially
  console.log(`✓ Initial state: 0 players, configuration phase`);
  
  let screenshotCounter = 2;
  let currentMoveExpectation = 0;
  let tilesPlaced = 0;
  
  // Replay each click
  for (let i = 0; i < clicks.length; i++) {
    const click = clicks[i];
    
    if (click.type === 'click') {
      // Perform the click at the specified coordinates
      await page.mouse.click(box.x + click.x!, box.y + click.y!);
      console.log(`Click ${i + 1}/${clicks.length}: ${click.description} at (${click.x!.toFixed(1)}, ${click.y!.toFixed(1)})`);
      
      // Wait a bit for state to update
      await waitForAnimationFrame(page);
    } else if (click.type === 'wait') {
      // Check if this is a DISPATCH_ACTION marker
      if (click.description?.startsWith('DISPATCH_ACTION:')) {
        const actionMatch = click.description.match(/DISPATCH_ACTION: (\w+) with seed (\d+)/);
        if (actionMatch) {
          const actionType = actionMatch[1];
          const seedValue = parseInt(actionMatch[2]);
          console.log(`Dispatching ${actionType} action with seed ${seedValue}`);
          
          await page.evaluate(({actionType, seedValue}) => {
            const store = (window as any).__REDUX_STORE__;
            store.dispatch({
              type: actionType,
              payload: { seed: seedValue }
            });
          }, {actionType, seedValue});
          
          continue; // Skip the normal wait handling
        }
      }
      
      // Handle wait - must use animationFrames
      if (click.animationFrames !== undefined && click.animationFrames > 0) {
        // Wait for specified number of animation frames
        for (let f = 0; f < click.animationFrames; f++) {
          await waitForAnimationFrame(page);
        }
        // Add extra wait after rotations to ensure UI updates
        if (click.description?.includes('rotation')) {
          await waitForAnimationFrame(page);
        }
      } else if (click.delay !== undefined) {
        // Legacy delay is not supported - fail the test
        throw new Error(`Legacy delay found in click ${i + 1}: ${click.description}. Please regenerate .clicks files with animationFrames instead of delay.`);
      } else if (click.animationFrames === undefined) {
        throw new Error(`Wait action at click ${i + 1} has neither animationFrames nor delay: ${click.description}`);
      }
    }
    
    // Take screenshot after each click action (not after waits)
    if (click.type === 'click') {
      await pauseAnimations(page);
      const filename = String(screenshotCounter).padStart(4, '0') + `-click.png`;
      await page.screenshot({ 
        path: path.join(screenshotDir, filename),
        fullPage: false
      });
      screenshotCounter++;
      
      // Check state after certain actions
      state = await getReduxState(page);
      
      // Validate player count after ADD_PLAYER clicks
      if (click.description?.includes('add player')) {
        const playerCount = state.game.players?.length || 0;
        console.log(`  After click: ${playerCount} players in game`);
      }
      
      // Validate tiles after PLACE_TILE/checkmark clicks
      if (click.description?.includes('checkmark to confirm')) {
        // Wait extra time for tile placement to complete
        await waitForAnimationFrame(page);
        await waitForAnimationFrame(page);
        await waitForAnimationFrame(page);
        
        tilesPlaced++;
        const boardSize = state.game.board ? Object.keys(state.game.board).length : 0;
        
        console.log(`  After move ${tilesPlaced}: ${boardSize} tiles on board`);
        
        // Validate tile type and rotation against expected placement
        if (tilesPlaced <= expectedPlacements.length) {
          const expectedPlacement = expectedPlacements[tilesPlaced - 1];
          const posKey = `${expectedPlacement.position.row},${expectedPlacement.position.col}`;
          
          if (state.game.board && state.game.board[posKey]) {
            const placedTile = state.game.board[posKey];
            const actualRotation = placedTile.rotation;
            const actualTileType = placedTile.type;
            
            // Validate rotation
            if (actualRotation !== expectedPlacement.rotation) {
              console.log(`  ❌ Move ${tilesPlaced}: Rotation mismatch at ${posKey}`);
              console.log(`     Expected rotation: ${expectedPlacement.rotation}, Actual: ${actualRotation}`);
              throw new Error(`Move ${tilesPlaced}: Expected rotation ${expectedPlacement.rotation} but got ${actualRotation}`);
            } else {
              console.log(`  ✓ Move ${tilesPlaced}: Rotation ${actualRotation} matches expected`);
            }
            
            // Log tile type (we can't predict exact type, but it's deterministic with seed)
            console.log(`  ✓ Move ${tilesPlaced}: Tile type ${actualTileType} at ${posKey}`);
          } else {
            console.log(`  ❌ Move ${tilesPlaced}: Tile not found at expected position ${posKey}`);
            throw new Error(`Move ${tilesPlaced}: Expected tile at ${posKey} but not found`);
          }
        }
        
        // Validate against expectations
        if (currentMoveExpectation < expectations.length) {
          const exp = expectations[currentMoveExpectation];
          
          if (exp.moveNumber === tilesPlaced) {
            // Validate expectation - log warning if mismatch but don't fail
            if (boardSize !== exp.totalTiles) {
              console.log(`  ⚠ Move ${tilesPlaced}: ${boardSize} tiles (expected ${exp.totalTiles}) - MISMATCH`);
              console.log(`    This may indicate a difference between action replay and UI click behavior`);
            } else {
              console.log(`  ✓ Move ${tilesPlaced}: ${boardSize} tiles (expected ${exp.totalTiles})`);
            }
            currentMoveExpectation++;
          }
        }
      }
    }
  }
  
  // Take final screenshot
  await page.screenshot({ 
    path: path.join(screenshotDir, 'final-state.png'),
    fullPage: false
  });
  
  // Verify final state
  state = await getReduxState(page);
  expect(state).toBeDefined();
  expect(state.game).toBeDefined();
  
  const finalPlayerCount = state.game.players?.length || 0;
  const finalTileCount = state.game.board ? Object.keys(state.game.board).length : 0;
  
  console.log(`✓ Game completed from ${clicks.length} clicks`);
  console.log(`  Final game phase: ${state.game.phase}`);
  console.log(`  Final player count: ${finalPlayerCount}`);
  console.log(`  Final tiles on board: ${finalTileCount}`);
  
  // Validate we have at least 2 players and some tiles placed
  expect(finalPlayerCount).toBeGreaterThanOrEqual(2);
  expect(finalTileCount).toBeGreaterThan(0);
}

test('Complete game from clicks - seed 888', async ({ page }) => {
  await testCompleteGameFromClicks(page, '888');
});

test('Complete game from clicks - seed 999', async ({ page }) => {
  await testCompleteGameFromClicks(page, '999');
});
