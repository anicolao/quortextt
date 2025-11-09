// Generic E2E test that replays a game from .clicks file (mouse clicks)
import { test, expect } from '@playwright/test';
import { getReduxState, pauseAnimations, waitForAnimationFrame } from './helpers';
import { loadClicksFromFile, ClickAction } from '../utils/actionConverter';
import { getFlowExit } from '../../src/game/tiles';
import { getEdgePositionsWithDirections, positionToKey } from '../../src/game/board';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Parse expectations file to get flow data for validation
 */
interface FlowExpectations {
  p1Flows: Array<string[]>;  // Array of flows, each flow is array of "pos:dir" strings
  p2Flows: Array<string[]>;
  movePrefixes: Array<{ 
    move: number;
    tileType: number;
    position: { row: number; col: number };
    rotation: number;
    p1: Record<number, number>;  // flowIndex -> prefixLength
    p2: Record<number, number>;
  }>;
}

/**
 * Tile placement info from actions file
 */
interface TilePlacementInfo {
  moveNumber: number;
  position: { row: number; col: number };
  rotation: number;
}

function parseExpectationsFile(filepath: string): FlowExpectations {
  const content = fs.readFileSync(filepath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  
  const p1Flows: Array<string[]> = [];
  const p2Flows: Array<string[]> = [];
  const movePrefixes: Array<{ move: number; tileType: number; position: { row: number; col: number }; rotation: number; p1: Record<number, number>; p2: Record<number, number> }> = [];
  
  let section = '';
  
  for (const line of lines) {
    if (line.startsWith('[')) {
      section = line.trim();
      continue;
    }
    
    if (section === '[P1_FLOWS]') {
      const colonIndex = line.indexOf(':');
      const indexStr = line.substring(0, colonIndex).trim();
      const flowStr = line.substring(colonIndex + 1).trim();
      const index = parseInt(indexStr);
      p1Flows[index] = flowStr ? flowStr.split(/\s+/) : [];
    } else if (section === '[P2_FLOWS]') {
      const colonIndex = line.indexOf(':');
      const indexStr = line.substring(0, colonIndex).trim();
      const flowStr = line.substring(colonIndex + 1).trim();
      const index = parseInt(indexStr);
      p2Flows[index] = flowStr ? flowStr.split(/\s+/) : [];
    } else if (section === '[MOVE_PREFIXES]') {
      // Format: 1 tile=0 pos=-3,0 rot=0 p1={0:2,1:2} p2={}
      const match = line.match(/^(\d+)\s+tile=(\d+)\s+pos=([-\d]+),([-\d]+)\s+rot=(\d+)\s+p1=\{([^}]*)\}\s+p2=\{([^}]*)\}/);
      if (match) {
        const move = parseInt(match[1]);
        const tileType = parseInt(match[2]);
        const row = parseInt(match[3]);
        const col = parseInt(match[4]);
        const rotation = parseInt(match[5]);
        const p1Str = match[6];
        const p2Str = match[7];
        
        const p1: Record<number, number> = {};
        if (p1Str) {
          for (const pair of p1Str.split(',')) {
            const [k, v] = pair.split(':');
            p1[parseInt(k)] = parseInt(v);
          }
        }
        
        const p2: Record<number, number> = {};
        if (p2Str) {
          for (const pair of p2Str.split(',')) {
            const [k, v] = pair.split(':');
            p2[parseInt(k)] = parseInt(v);
          }
        }
        
        movePrefixes.push({ move, tileType, position: { row, col }, rotation, p1, p2 });
      }
    }
  }
  
  return { p1Flows, p2Flows, movePrefixes };
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
 * Trace actual flows from game state
 * Returns flows organized by player and starting edge
 */
function traceFlows(state: any): { 
  p1Flows: Array<Array<{pos: string, dir: number}>>, 
  p2Flows: Array<Array<{pos: string, dir: number}>> 
} {
  const p1Flows: Array<Array<{pos: string, dir: number}>> = [];
  const p2Flows: Array<Array<{pos: string, dir: number}>> = [];
  
  if (!state?.game?.players || state.game.players.length < 2) {
    return { p1Flows, p2Flows };
  }
  
  const players = state.game.players;
  const player1 = players[0];
  const player2 = players[1];
  const flowEdgesObj = state.game.flowEdges || {};
  const board = state.game.board || {};
  
  // Trace flows for each player
  for (const player of players) {
    const playerFlows: Array<Array<{pos: string, dir: number}>> = [];
    const edgeData = getEdgePositionsWithDirections(player.edgePosition);
    
    // For each potential starting edge of this player
    for (const { pos: startPos, dir: startDir } of edgeData) {
      const startPosKey = positionToKey(startPos);
      const flowEdgesList: Array<{pos: string, dir: number}> = [];
      
      // Trace this flow
      const visited = new Set<string>();
      let currentPos = startPosKey;
      let currentDir = startDir;
      
      while (true) {
        const key = `${currentPos}:${currentDir}`;
        if (visited.has(key)) break;
        visited.add(key);
        
        const posEdges = flowEdgesObj[currentPos];
        if (!posEdges || posEdges[currentDir] !== player.id) {
          break;
        }
        
        flowEdgesList.push({ pos: currentPos, dir: currentDir });
        
        // Find the next position by getting the tile and following the flow
        const tile = board[currentPos];
        if (!tile) break;
        
        // Find exit direction
        const exitDir = getFlowExit(tile, currentDir);
        if (exitDir === null) break;
        
        // Move to next hex
        const nextPos = getNeighborInDirection(currentPos, exitDir);
        if (!nextPos) break;
        
        currentPos = nextPos;
        currentDir = (exitDir + 3) % 6; // Opposite direction when entering next hex
      }
      
      // If we found a flow, add it
      if (flowEdgesList.length > 0) {
        playerFlows.push(flowEdgesList);
      }
    }
    
    // Store flows for this player
    if (player.id === player1.id) {
      p1Flows.push(...playerFlows);
    } else if (player.id === player2.id) {
      p2Flows.push(...playerFlows);
    }
  }
  
  return { p1Flows, p2Flows };
}

// Helper function to get neighbor in direction (from board.ts logic)
function getNeighborInDirection(posKey: string, dir: number): string | null {
  const parts = posKey.split(',');
  const row = parseInt(parts[0]);
  const col = parseInt(parts[1]);
  
  const directions = [
    { row: -1, col: 0 },  // 0: SW
    { row: -1, col: 1 },  // 1: W  
    { row: 0, col: 1 },   // 2: NW
    { row: 1, col: 0 },   // 3: NE
    { row: 1, col: -1 },  // 4: E
    { row: 0, col: -1 },  // 5: SE
  ];
  
  const delta = directions[dir];
  return `${row + delta.row},${col + delta.col}`;
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
  console.log(`Loaded ${expectations.movePrefixes.length} move expectations`);
  
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
  console.log(`✓ Initial state: 0 players, configuration phase, seed=${state.game.seed}`);
  
  let screenshotCounter = 2;
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
          console.log(`\n=== DISPATCH_ACTION: ${actionType} with seed ${seedValue} ===`);
          
          // Check state BEFORE dispatch
          const stateBefore = await getReduxState(page);
          console.log(`BEFORE dispatch:`);
          console.log(`  - screen: ${stateBefore.game.screen}`);
          console.log(`  - phase: ${stateBefore.game.phase}`);
          console.log(`  - seed in state: ${stateBefore.game.seed}`);
          console.log(`  - availableTiles count: ${stateBefore.game.availableTiles?.length || 0}`);
          console.log(`  - currentTile: ${stateBefore.game.currentTile ? JSON.stringify(stateBefore.game.currentTile) : 'null'}`);
          console.log(`  - players count: ${stateBefore.game.players?.length || 0}`);
          console.log(`  - configPlayers count: ${stateBefore.game.configPlayers?.length || 0}`);
          
          // Dispatch the action to Redux store
          const result = await page.evaluate(({actionType, seedValue}) => {
            const store = (window as any).__REDUX_STORE__;
            if (!store) {
              console.error('Redux store not found on window');
              return { success: false, error: 'Store not found' };
            }
            console.log(`Dispatching ${actionType} with payload:`, { seed: seedValue });
            store.dispatch({
              type: actionType,
              payload: { seed: seedValue }
            });
            const state = store.getState();
            return { 
              success: true, 
              seed: state.game.seed,
              screen: state.game.screen,
              phase: state.game.phase,
              availableTilesCount: state.game.availableTiles?.length || 0,
              currentTile: state.game.currentTile,
            };
          }, {actionType, seedValue});
          
          console.log(`Dispatch result:`, result);
          
          // Wait for the action to be processed
          await waitForAnimationFrame(page);
          await waitForAnimationFrame(page);
          
          // Check state AFTER dispatch
          const stateAfter = await getReduxState(page);
          console.log(`AFTER dispatch:`);
          console.log(`  - screen: ${stateAfter.game.screen}`);
          console.log(`  - phase: ${stateAfter.game.phase}`);
          console.log(`  - seed in state: ${stateAfter.game.seed}`);
          console.log(`  - availableTiles count: ${stateAfter.game.availableTiles?.length || 0}`);
          console.log(`  - currentTile: ${stateAfter.game.currentTile ? JSON.stringify(stateAfter.game.currentTile) : 'null'}`);
          console.log(`  - players count: ${stateAfter.game.players?.length || 0}`);
          
          // If tiles were created, log the first few
          if (stateAfter.game.availableTiles && stateAfter.game.availableTiles.length > 0) {
            const first5Types = stateAfter.game.availableTiles.slice(0, 5);
            console.log(`  - First 5 tiles in deck: ${first5Types.map((t: number) => `type=${t}`).join(', ')}`);
            console.log(`  - First tile type: ${stateAfter.game.availableTiles[0]} (seed ${seedValue} should give specific type)`);
          }
          console.log(`=== END DISPATCH_ACTION ===\n`);
          
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
        console.log(`  After click: ${playerCount} players in game, seed=${state.game.seed}`);
      }
      
      // Log state after edge selection to see when deck is created
      if (click.description?.includes('Select edge')) {
        console.log(`  After edge selection: screen=${state.game.screen}, phase=${state.game.phase}`);
        console.log(`    seed=${state.game.seed}`);
        console.log(`    availableTiles count: ${state.game.availableTiles?.length || 0}`);
        console.log(`    currentTile: ${state.game.currentTile ? `type${state.game.currentTile.type}` : 'null'}`);
        
        // If we just transitioned to gameplay, log the first tiles
        if (state.game.phase === 'playing' && state.game.currentTile) {
          console.log(`  🎲 DECK CREATED! First tile drawn: type${state.game.currentTile.type}`);
          if (state.game.availableTiles && state.game.availableTiles.length > 0) {
            console.log(`    Next 5 tiles: ${state.game.availableTiles.slice(0, 5).map((t: any) => `type${t.type}`).join(', ')}`);
          }
        }
      }
      
      // Validate tiles after PLACE_TILE/checkmark clicks
      if (click.description?.includes('checkmark to confirm')) {
        // Wait extra time for tile placement to complete and flows to update
        await waitForAnimationFrame(page);
        await waitForAnimationFrame(page);
        await waitForAnimationFrame(page);
        await waitForAnimationFrame(page);
        await waitForAnimationFrame(page);
        
        tilesPlaced++;
        const boardSize = state.game.board ? Object.keys(state.game.board).length : 0;
        
        console.log(`  After move ${tilesPlaced}: ${boardSize} tiles on board`);
        console.log(`  Board keys:`, state.game.board ? Object.keys(state.game.board) : []);
        console.log(`  Flow edges keys:`, state.game.flowEdges ? Object.keys(state.game.flowEdges).length : 0);
        
        // Log all flow edges for debugging
        if (state.game.flowEdges) {
          Object.entries(state.game.flowEdges).forEach(([pos, edges]: [string, any]) => {
            const edgeStr = Object.entries(edges).map(([dir, player]) => `${dir}:${player}`).join(', ');
            console.log(`    FlowEdges at ${pos}: {${edgeStr}}`);
          });
        }
        
        // Validate tile type and rotation against expectations
        const moveExpectation = expectations.movePrefixes.find(e => e.move === tilesPlaced);
        
        if (moveExpectation) {
          const posKey = `${moveExpectation.position.row},${moveExpectation.position.col}`;
          
          if (state.game.board && state.game.board[posKey]) {
            const placedTile = state.game.board[posKey];
            const actualRotation = placedTile.rotation;
            const actualTileType = placedTile.type;
            
            console.log(`  Placed tile at ${posKey}: type=${actualTileType}, rotation=${actualRotation}`);
            
            // Validate tile type
            if (actualTileType !== moveExpectation.tileType) {
              console.log(`  ❌ Move ${tilesPlaced}: Tile type mismatch at ${posKey}`);
              console.log(`     Expected type: ${moveExpectation.tileType}, Actual: ${actualTileType}`);
              throw new Error(`Move ${tilesPlaced}: Expected tile type ${moveExpectation.tileType} but got ${actualTileType}`);
            }
            
            // Validate rotation
            if (actualRotation !== moveExpectation.rotation) {
              console.log(`  ❌ Move ${tilesPlaced}: Rotation mismatch at ${posKey}`);
              console.log(`     Expected rotation: ${moveExpectation.rotation}, Actual: ${actualRotation}`);
              throw new Error(`Move ${tilesPlaced}: Expected rotation ${moveExpectation.rotation} but got ${actualRotation}`);
            }
            
            console.log(`  ✓ Tile validation passed: type=${actualTileType}, rotation=${actualRotation}`);
          } else {
            console.log(`  ❌ Move ${tilesPlaced}: Tile not found at expected position ${posKey}`);
            throw new Error(`Move ${tilesPlaced}: Expected tile at ${posKey} but not found`);
          }
        }
        
        // Validate flows against expectations
        if (moveExpectation) {
          console.log(`  Validating flows for move ${tilesPlaced}...`);
          
          // Trace actual flows from game state
          const actualFlows = traceFlows(state);
          
          console.log(`    P1 flows found: ${actualFlows.p1Flows.length}, P2 flows found: ${actualFlows.p2Flows.length}`);
          actualFlows.p1Flows.forEach((flow, idx) => {
            console.log(`    P1 flow ${idx}: ${flow.length} edges - ${flow.map(e => `${e.pos}:${e.dir}`).join(', ')}`);
          });
          actualFlows.p2Flows.forEach((flow, idx) => {
            console.log(`    P2 flow ${idx}: ${flow.length} edges - ${flow.map(e => `${e.pos}:${e.dir}`).join(', ')}`);
          });
          
          // Check exact number of P1 flows
          const expectedP1FlowCount = Object.keys(moveExpectation.p1).length;
          if (actualFlows.p1Flows.length !== expectedP1FlowCount) {
            console.log(`  ❌ Move ${tilesPlaced}: Expected ${expectedP1FlowCount} P1 flows, got ${actualFlows.p1Flows.length}`);
            throw new Error(`Move ${tilesPlaced}: Expected ${expectedP1FlowCount} P1 flows, got ${actualFlows.p1Flows.length}`);
          }
          
          // Validate P1 flows
          for (const [flowIdxStr, prefixLength] of Object.entries(moveExpectation.p1)) {
            const flowIdx = Number(flowIdxStr);
            
            if (!actualFlows.p1Flows[flowIdx]) {
              console.log(`  ❌ Move ${tilesPlaced}: P1 flow ${flowIdx} not found`);
              throw new Error(`Move ${tilesPlaced}: P1 flow ${flowIdx} not found (expected prefix length ${prefixLength})`);
            }
            
            if (actualFlows.p1Flows[flowIdx].length !== prefixLength) {
              console.log(`  ❌ Move ${tilesPlaced}: P1 flow ${flowIdx} has ${actualFlows.p1Flows[flowIdx].length} edges, expected exactly ${prefixLength}`);
              throw new Error(`Move ${tilesPlaced}: P1 flow ${flowIdx} has ${actualFlows.p1Flows[flowIdx].length} edges, expected exactly ${prefixLength}`);
            }
            
            // Validate the prefix matches
            const actualPrefix = actualFlows.p1Flows[flowIdx].slice(0, prefixLength);
            const expectedPrefix = expectations.p1Flows[flowIdx].slice(0, prefixLength);
            
            for (let i = 0; i < prefixLength; i++) {
              const actual = actualPrefix[i];
              const expected = expectedPrefix[i];
              const [expectedPos, expectedDirStr] = expected.split(':');
              const expectedDir = parseInt(expectedDirStr);
              
              if (actual.pos !== expectedPos || actual.dir !== expectedDir) {
                console.log(`  ❌ Move ${tilesPlaced}: P1 flow ${flowIdx} edge ${i} mismatch`);
                console.log(`     Expected: ${expectedPos}:${expectedDir}, Got: ${actual.pos}:${actual.dir}`);
                throw new Error(`Move ${tilesPlaced}: P1 flow ${flowIdx} edge ${i} mismatch: expected ${expectedPos}:${expectedDir}, got ${actual.pos}:${actual.dir}`);
              }
            }
          }
          
          // Check exact number of P2 flows
          const expectedP2FlowCount = Object.keys(moveExpectation.p2).length;
          if (actualFlows.p2Flows.length !== expectedP2FlowCount) {
            console.log(`  ❌ Move ${tilesPlaced}: Expected ${expectedP2FlowCount} P2 flows, got ${actualFlows.p2Flows.length}`);
            throw new Error(`Move ${tilesPlaced}: Expected ${expectedP2FlowCount} P2 flows, got ${actualFlows.p2Flows.length}`);
          }
          
          // Validate P2 flows
          for (const [flowIdxStr, prefixLength] of Object.entries(moveExpectation.p2)) {
            const flowIdx = Number(flowIdxStr);
            
            if (!actualFlows.p2Flows[flowIdx]) {
              console.log(`  ❌ Move ${tilesPlaced}: P2 flow ${flowIdx} not found`);
              throw new Error(`Move ${tilesPlaced}: P2 flow ${flowIdx} not found (expected prefix length ${prefixLength})`);
            }
            
            if (actualFlows.p2Flows[flowIdx].length !== prefixLength) {
              console.log(`  ❌ Move ${tilesPlaced}: P2 flow ${flowIdx} has ${actualFlows.p2Flows[flowIdx].length} edges, expected exactly ${prefixLength}`);
              throw new Error(`Move ${tilesPlaced}: P2 flow ${flowIdx} has ${actualFlows.p2Flows[flowIdx].length} edges, expected exactly ${prefixLength}`);
            }
            
            // Validate the prefix matches
            const actualPrefix = actualFlows.p2Flows[flowIdx].slice(0, prefixLength);
            const expectedPrefix = expectations.p2Flows[flowIdx].slice(0, prefixLength);
            
            for (let i = 0; i < prefixLength; i++) {
              const actual = actualPrefix[i];
              const expected = expectedPrefix[i];
              const [expectedPos, expectedDirStr] = expected.split(':');
              const expectedDir = parseInt(expectedDirStr);
              
              if (actual.pos !== expectedPos || actual.dir !== expectedDir) {
                console.log(`  ❌ Move ${tilesPlaced}: P2 flow ${flowIdx} edge ${i} mismatch`);
                console.log(`     Expected: ${expectedPos}:${expectedDir}, Got: ${actual.pos}:${actual.dir}`);
                throw new Error(`Move ${tilesPlaced}: P2 flow ${flowIdx} edge ${i} mismatch: expected ${expectedPos}:${expectedDir}, got ${actual.pos}:${actual.dir}`);
              }
            }
          }
          
          console.log(`  ✓ Move ${tilesPlaced}: Rotation and flows validated`);
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
