// E2E test that replays a game from .actions file and validates against .expectations
import { test, expect } from '@playwright/test';
import { getReduxState, pauseAnimations } from './helpers';
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

// Parse expectations file
interface FlowExpectation {
  player: 'p1' | 'p2';
  flows: Map<number, string>; // flowIndex -> "pos:dir pos:dir..."
}

interface MoveExpectations {
  moveNumber: number;
  p1Flows: FlowExpectation;
  p2Flows: FlowExpectation;
  movePrefixes?: { p1: any, p2: any };
}

function parseExpectations(expectationsFile: string): MoveExpectations[] {
  const content = fs.readFileSync(expectationsFile, 'utf-8');
  const lines = content.split('\n');
  
  const expectations: MoveExpectations[] = [];
  let currentPlayer: 'p1' | 'p2' | null = null;
  let currentFlows: Map<number, string> = new Map();
  let p1Flows: Map<number, string> = new Map();
  let p2Flows: Map<number, string> = new Map();
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    if (trimmed === '[P1_FLOWS]') {
      // Save previous section if we have it
      if (currentPlayer === 'p2') {
        p2Flows = new Map(currentFlows);
      }
      currentPlayer = 'p1';
      currentFlows = new Map();
    } else if (trimmed === '[P2_FLOWS]') {
      // Save P1 flows
      if (currentPlayer === 'p1') {
        p1Flows = new Map(currentFlows);
      }
      currentPlayer = 'p2';
      currentFlows = new Map();
    } else if (trimmed === '[MOVE_PREFIXES]') {
      // Save P2 flows if we were parsing them
      if (currentPlayer === 'p2') {
        p2Flows = new Map(currentFlows);
      }
      currentPlayer = null;
    } else if (trimmed.match(/^\d+:/)) {
      // Flow line: "0: pos:dir pos:dir..."
      const colonIndex = trimmed.indexOf(':');
      const flowIndex = parseInt(trimmed.substring(0, colonIndex));
      const flowData = trimmed.substring(colonIndex + 1).trim();
      if (flowData) {
        currentFlows.set(flowIndex, flowData);
      }
    } else if (trimmed.match(/^\d+\s+p1=/)) {
      // Move prefix line: "1 p1={0:2,1:2} p2={}"
      // This indicates we have a complete move expectation
      if (p1Flows.size > 0 || p2Flows.size > 0) {
        const moveMatch = trimmed.match(/^(\d+)\s+/);
        if (moveMatch) {
          const moveNumber = parseInt(moveMatch[1]);
          expectations.push({
            moveNumber,
            p1Flows: { player: 'p1', flows: new Map(p1Flows) },
            p2Flows: { player: 'p2', flows: new Map(p2Flows) }
          });
        }
      }
      // Reset for next move
      p1Flows = new Map();
      p2Flows = new Map();
      currentFlows = new Map();
    }
  }
  
  return expectations;
}

// Convert flow from game state to comparable format
function getFlowsFromState(state: any, playerId: string): Map<number, Set<string>> {
  const flows = new Map<number, Set<string>>();
  
  // Get flow edges for the player
  if (!state.game?.flowEdges) return flows;
  
  const flowEdges = state.game.flowEdges;
  const playerFlows = new Map<string, Set<number>>();
  
  // Collect all positions with flow edges for this player
  for (const [key, edges] of Object.entries(flowEdges)) {
    if (typeof edges === 'object' && edges !== null) {
      for (const [edgeStr, owner] of Object.entries(edges)) {
        if (owner === playerId) {
          const edge = parseInt(edgeStr);
          if (!playerFlows.has(key)) {
            playerFlows.set(key, new Set());
          }
          playerFlows.get(key)!.add(edge);
        }
      }
    }
  }
  
  // Group connected positions into flows
  const visited = new Set<string>();
  let flowIndex = 0;
  
  for (const [startPos, edges] of playerFlows.entries()) {
    if (visited.has(startPos)) continue;
    
    const flowPositions = new Set<string>();
    const queue = [startPos];
    
    while (queue.length > 0) {
      const pos = queue.shift()!;
      if (visited.has(pos)) continue;
      
      visited.add(pos);
      const posEdges = playerFlows.get(pos);
      if (posEdges) {
        for (const edge of posEdges) {
          flowPositions.add(`${pos}:${edge}`);
        }
      }
      
      // Find neighbors through edges
      // (simplified - just collect what we have)
    }
    
    if (flowPositions.size > 0) {
      flows.set(flowIndex++, flowPositions);
    }
  }
  
  return flows;
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
async function testCompleteGameWithValidation(page: any, seed: string) {
  const actionsFile = path.join(__dirname, `user-stories/005-complete-game/${seed}/${seed}.actions`);
  const expectationsFile = path.join(__dirname, `user-stories/005-complete-game/${seed}/${seed}.expectations`);
  const screenshotDir = path.join(__dirname, `user-stories/005-complete-game/${seed}/screenshots`);
  
  // Create screenshot directory
  fs.mkdirSync(screenshotDir, { recursive: true });
  
  // Load actions and expectations
  const actions = loadActions(actionsFile);
  const expectations = parseExpectations(expectationsFile);
  
  console.log(`Loaded ${actions.length} actions for seed ${seed}`);
  console.log(`Loaded ${expectations.length} move expectations`);
  
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
  let actionsInCurrentMove: any[] = [];
  
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
    
    // Track actions in current move
    actionsInCurrentMove.push(action);
    
    // Check if this completes a move (NEXT_PLAYER or game end)
    if (action.type === 'NEXT_PLAYER' || i === actions.length - 1) {
      moveCounter++;
      
      // Get current state
      const state = await getReduxState(page);
      
      console.log(`\nMove ${moveCounter} completed. Validating flows...`);
      
      // Find expectations for this move
      const expectation = expectations.find(e => e.moveNumber === moveCounter);
      
      if (expectation) {
        console.log(`Validating against expectations for move ${moveCounter}`);
        
        // Get actual flows from state
        const flowEdges = state.game?.flowEdges || {};
        
        // Collect all flow positions for each player
        const p1FlowPositions = new Set<string>();
        const p2FlowPositions = new Set<string>();
        
        for (const [posKey, edges] of Object.entries(flowEdges)) {
          if (typeof edges === 'object' && edges !== null) {
            for (const [edgeStr, owner] of Object.entries(edges)) {
              if (owner === 'p1') {
                p1FlowPositions.add(`${posKey}:${edgeStr}`);
              } else if (owner === 'p2') {
                p2FlowPositions.add(`${posKey}:${edgeStr}`);
              }
            }
          }
        }
        
        console.log(`  P1 has ${p1FlowPositions.size} flow edges`);
        console.log(`  P2 has ${p2FlowPositions.size} flow edges`);
        
        // Convert expectations to sets for comparison
        const expectedP1Edges = new Set<string>();
        const expectedP2Edges = new Set<string>();
        
        for (const [, flowStr] of expectation.p1Flows.flows) {
          flowStr.split(/\s+/).forEach(edge => edge && expectedP1Edges.add(edge));
        }
        for (const [, flowStr] of expectation.p2Flows.flows) {
          flowStr.split(/\s+/).forEach(edge => edge && expectedP2Edges.add(edge));
        }
        
        console.log(`  Expected P1: ${expectedP1Edges.size} flow edges`);
        console.log(`  Expected P2: ${expectedP2Edges.size} flow edges`);
        
        // Compare
        const p1Missing = [...expectedP1Edges].filter(e => !p1FlowPositions.has(e));
        const p1Extra = [...p1FlowPositions].filter(e => !expectedP1Edges.has(e));
        const p2Missing = [...expectedP2Edges].filter(e => !p2FlowPositions.has(e));
        const p2Extra = [...p2FlowPositions].filter(e => !expectedP2Edges.has(e));
        
        if (p1Missing.length > 0) {
          console.error(`  P1 MISSING edges: ${p1Missing.join(' ')}`);
        }
        if (p1Extra.length > 0) {
          console.error(`  P1 EXTRA edges: ${p1Extra.join(' ')}`);
        }
        if (p2Missing.length > 0) {
          console.error(`  P2 MISSING edges: ${p2Missing.join(' ')}`);
        }
        if (p2Extra.length > 0) {
          console.error(`  P2 EXTRA edges: ${p2Extra.join(' ')}`);
        }
        
        // Assert flows match
        expect(p1Missing.length, `P1 missing flow edges at move ${moveCounter}`).toBe(0);
        expect(p1Extra.length, `P1 has unexpected flow edges at move ${moveCounter}`).toBe(0);
        expect(p2Missing.length, `P2 missing flow edges at move ${moveCounter}`).toBe(0);
        expect(p2Extra.length, `P2 has unexpected flow edges at move ${moveCounter}`).toBe(0);
        
        console.log(`  ✓ Flows match expectations`);
      } else {
        console.log(`  No expectations found for move ${moveCounter}`);
      }
      
      // Reset for next move
      actionsInCurrentMove = [];
    }
  }
  
  // Take final screenshot
  await page.screenshot({ 
    path: path.join(screenshotDir, 'final-state.png'),
    fullPage: false
  });
  
  // Get final state
  const state = await getReduxState(page);
  console.log('\nFinal state:');
  console.log(`  Screen: ${state.game.screen}`);
  console.log(`  Phase: ${state.game.phase}`);
  console.log(`  Players: ${state.game.players.length}`);
  
  const playerCount = actions.filter(a => a.type === 'ADD_PLAYER').length;
  expect(state.game.configPlayers.length).toBe(playerCount);
  console.log(`✓ Test completed with ${playerCount} players`);
}

test.describe('Complete Game with Flow Validation', () => {
  test('should replay and validate game 888', async ({ page }) => {
    await testCompleteGameWithValidation(page, '888');
  });
  
  test('should replay and validate game 999', async ({ page }) => {
    await testCompleteGameWithValidation(page, '999');
  });
});
