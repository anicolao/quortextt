import { test, expect } from '@playwright/test';
import { getReduxState, pauseAnimations } from './helpers';
import { traceFlow } from '../../src/game/flows';
import { getEdgePositionsWithDirections, positionToKey } from '../../src/game/board';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load actions from a .actions file
function loadActions(actionsFile: string) {
  const content = fs.readFileSync(actionsFile, 'utf-8');
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

// Parse expectations file to get flow data for validation
interface FlowExpectations {
  p1Flows: Array<string[]>;  // Array of flows, each flow is array of "pos:dir" strings
  p2Flows: Array<string[]>;
  movePrefixes: Array<{ 
    move: number; 
    p1: Record<number, number>;  // flowIndex -> prefixLength
    p2: Record<number, number>;
  }>;
}

function parseExpectations(expectationsFile: string): FlowExpectations {
  const content = fs.readFileSync(expectationsFile, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  
  const p1Flows: Array<string[]> = [];
  const p2Flows: Array<string[]> = [];
  const movePrefixes: Array<{ move: number; p1: Record<number, number>; p2: Record<number, number> }> = [];
  
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
      // Format: 1 p1={0:2,1:2} p2={}
      const match = line.match(/^(\d+)\s+p1=\{([^}]*)\}\s+p2=\{([^}]*)\}/);
      if (match) {
        const move = parseInt(match[1]);
        const p1Str = match[2];
        const p2Str = match[3];
        
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
        
        movePrefixes.push({ move, p1, p2 });
      }
    }
  }
  
  return { p1Flows, p2Flows, movePrefixes };
}

// Wait for next animation frame to ensure rendering is complete
async function waitForNextFrame(page: any) {
  await page.evaluate(() => {
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });
  });
}

// Test function parameterized by seed
async function testCompleteGameFromActions(page: any, seed: string) {
  const actionsFile = path.join(__dirname, `user-stories/005-complete-game/${seed}/${seed}.actions`);
  const expectationsFile = path.join(__dirname, `user-stories/005-complete-game/${seed}/${seed}.expectations`);
  const screenshotDir = path.join(__dirname, `user-stories/005-complete-game/${seed}/screenshots`);
  
  // Create screenshot directory
  fs.mkdirSync(screenshotDir, { recursive: true });
  
  // Load actions and expectations
  const actions = loadActions(actionsFile);
  let expectations: FlowExpectations | null = null;
  
  if (fs.existsSync(expectationsFile)) {
    expectations = parseExpectations(expectationsFile);
    console.log(`Loaded ${actions.length} actions and ${expectations.movePrefixes.length} move expectations for seed ${seed}`);
  } else {
    console.log(`Loaded ${actions.length} actions for seed ${seed} (no expectations file)`);
  }
  
  // Count ADD_PLAYER actions to determine expected player count
  const playerCount = actions.filter(a => a.type === 'ADD_PLAYER').length;
  
  // Navigate to the game
  await page.goto('/');
  await page.waitForSelector('canvas#game-canvas');
  
  // Pause animations once at the start
  await pauseAnimations(page);
  
  // Take initial screenshot
  await page.screenshot({ 
    path: path.join(screenshotDir, '001-initial-screen.png'),
    fullPage: false
  });
  
  let screenshotCounter = 2;
  let moveCounter = 0;
  
  // Replay each action
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    console.log(`Action ${i + 1}/${actions.length}: ${action.type}`);
    
    await page.evaluate((act) => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch(act);
    }, action);
    
    // Wait for next frame to ensure rendering is complete
    await waitForNextFrame(page);
    
    // Take screenshot for every action
    const filename = String(screenshotCounter).padStart(3, '0') + `-${action.type.toLowerCase()}.png`;
    await page.screenshot({ 
      path: path.join(screenshotDir, filename),
      fullPage: false
    });
    screenshotCounter++;
    
    // Validate flows after each move (NEXT_PLAYER or game end)
    if (expectations && (action.type === 'NEXT_PLAYER' || i === actions.length - 1)) {
      moveCounter++;
      
      // Find expectations for this move
      const expectation = expectations.movePrefixes.find(e => e.move === moveCounter);
      
      if (expectation) {
        console.log(`  Validating flows for move ${moveCounter}...`);
        
        // Get board and player data from Redux state
        const state = await getReduxState(page);
        const players = state.game.players;
        
        if (!players || players.length < 2) {
          throw new Error('Not enough players');
        }
        
        const player1 = players[0];
        const player2 = players[1];
        
        // Convert board from serialized object back to Map
        const board = new Map();
        for (const [key, value] of Object.entries(state.game.board || {})) {
          board.set(key, value);
        }
        
        // Trace flows for each player (matching unit test approach)
        const actualP1Flows: Array<Array<{pos: string, dir: number}>> = [];
        const actualP2Flows: Array<Array<{pos: string, dir: number}>> = [];
        
        for (const player of players) {
          const edgeData = getEdgePositionsWithDirections(player.edgePosition);
          
          for (const { pos, dir } of edgeData) {
            const posKey = positionToKey(pos);
            const tile = board.get(posKey);
            
            if (!tile) {
              continue;
            }
            
            const { edges } = traceFlow(board, pos, dir, player.id);
            
            if (edges.length > 0) {
              const flowEdges = edges.map(e => ({
                pos: e.position,
                dir: e.direction
              }));
              
              if (player.id === player1.id) {
                actualP1Flows.push(flowEdges);
              } else {
                actualP2Flows.push(flowEdges);
              }
            }
          }
        }
        
        // Validate ordered flow sequences match expected prefixes (matching unit test)
        for (const [flowIdxStr, prefixLength] of Object.entries(expectation.p1)) {
          const flowIdx = Number(flowIdxStr);
          
          if (!actualP1Flows[flowIdx]) {
            throw new Error(`Move ${moveCounter}: P1 flow ${flowIdx} not found (expected prefix length ${prefixLength})`);
          }
          
          if (actualP1Flows[flowIdx].length < prefixLength) {
            throw new Error(`Move ${moveCounter}: P1 flow ${flowIdx} has ${actualP1Flows[flowIdx].length} edges, expected at least ${prefixLength}`);
          }
          
          // Validate the prefix matches
          const actualPrefix = actualP1Flows[flowIdx].slice(0, prefixLength);
          const expectedPrefix = expectations.p1Flows[flowIdx].slice(0, prefixLength);
          
          for (let i = 0; i < prefixLength; i++) {
            const actual = actualPrefix[i];
            const expected = expectedPrefix[i];
            const [expectedPos, expectedDirStr] = expected.split(':');
            const expectedDir = parseInt(expectedDirStr);
            
            if (actual.pos !== expectedPos || actual.dir !== expectedDir) {
              throw new Error(`Move ${moveCounter}: P1 flow ${flowIdx} edge ${i} mismatch: expected ${expectedPos}:${expectedDir}, got ${actual.pos}:${actual.dir}`);
            }
          }
        }
        
        for (const [flowIdxStr, prefixLength] of Object.entries(expectation.p2)) {
          const flowIdx = Number(flowIdxStr);
          
          if (!actualP2Flows[flowIdx]) {
            throw new Error(`Move ${moveCounter}: P2 flow ${flowIdx} not found (expected prefix length ${prefixLength})`);
          }
          
          if (actualP2Flows[flowIdx].length < prefixLength) {
            throw new Error(`Move ${moveCounter}: P2 flow ${flowIdx} has ${actualP2Flows[flowIdx].length} edges, expected at least ${prefixLength}`);
          }
          
          // Validate the prefix matches
          const actualPrefix = actualP2Flows[flowIdx].slice(0, prefixLength);
          const expectedPrefix = expectations.p2Flows[flowIdx].slice(0, prefixLength);
          
          for (let i = 0; i < prefixLength; i++) {
            const actual = actualPrefix[i];
            const expected = expectedPrefix[i];
            const [expectedPos, expectedDirStr] = expected.split(':');
            const expectedDir = parseInt(expectedDirStr);
            
            if (actual.pos !== expectedPos || actual.dir !== expectedDir) {
              throw new Error(`Move ${moveCounter}: P2 flow ${flowIdx} edge ${i} mismatch: expected ${expectedPos}:${expectedDir}, got ${actual.pos}:${actual.dir}`);
            }
          }
        }
        
        console.log(`  ✓ Flow validation passed for move ${moveCounter}`);
      }
    }
  }
  
  // Take final screenshot
  await page.screenshot({ 
    path: path.join(screenshotDir, 'final-state.png'),
    fullPage: false
  });
  
  // Get final state
  const state = await getReduxState(page);
  console.log('Final state:');
  console.log(`  Screen: ${state.game.screen}`);
  console.log(`  Phase: ${state.game.phase}`);
  console.log(`  Players: ${state.game.players.length}`);
  
  // Verify we have the expected number of players
  expect(state.game.configPlayers.length).toBe(playerCount);
}

test.describe('Complete Game from Actions - Seed 888', () => {
  test('should replay game from 888.actions file', async ({ page }) => {
    // Time the test to set appropriate timeout
    const startTime = Date.now();
    await testCompleteGameFromActions(page, '888');
    const duration = Date.now() - startTime;
    console.log(`Test took ${duration}ms`);
    
    // Set timeout to 1.5x measured time for future runs (min 10s)
    const recommendedTimeout = Math.max(10000, Math.ceil(duration * 1.5));
    console.log(`Recommended timeout: ${recommendedTimeout}ms`);
  });
});

test.describe('Complete Game from Actions - Seed 999', () => {
  test('should replay game from 999.actions file', async ({ page }) => {
    // Time the test to set appropriate timeout
    const startTime = Date.now();
    await testCompleteGameFromActions(page, '999');
    const duration = Date.now() - startTime;
    console.log(`Test took ${duration}ms`);
    
    // Set timeout to 1.5x measured time for future runs (min 10s)
    const recommendedTimeout = Math.max(10000, Math.ceil(duration * 1.5));
    console.log(`Recommended timeout: ${recommendedTimeout}ms`);
  });
});
