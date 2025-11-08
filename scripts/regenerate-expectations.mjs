// Script to regenerate flow expectations after modifying traceFlow
import { gameReducer, initialState, resetPlayerIdCounter } from '../src/redux/gameReducer.ts';
import { traceFlow } from '../src/game/flows.ts';
import { getEdgePositionsWithDirections, positionToKey } from '../src/game/board.ts';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function generateExpectations(finalState, movePrefixes) {
  const lines = [];
  
  const player1Id = finalState.players[0]?.id;
  const player2Id = finalState.players[1]?.id;
  
  if (!player1Id || !player2Id) {
    return '# No players found\n';
  }
  
  // Collect flows for each player
  const p1Flows = [];
  const p2Flows = [];
  
  // Trace flows from each player's edge
  for (const player of finalState.players) {
    const edgeData = getEdgePositionsWithDirections(player.edgePosition);
    
    for (const { pos, dir } of edgeData) {
      const posKey = positionToKey(pos);
      const tile = finalState.board.get(posKey);
      
      if (!tile) {
        continue;
      }
      
      const { edges } = traceFlow(finalState.board, pos, dir, player.id);
      
      if (edges.length > 0) {
        const flowEdges = edges.map(e => ({
          pos: e.position,
          dir: e.direction
        }));
        
        if (player.id === player1Id) {
          p1Flows.push(flowEdges);
        } else {
          p2Flows.push(flowEdges);
        }
      }
    }
  }
  
  // Write P1 flows
  lines.push('[P1_FLOWS]');
  p1Flows.forEach((flow, idx) => {
    const flowStr = flow.map(e => `${e.pos}:${e.dir}`).join(' ');
    lines.push(`${idx}: ${flowStr}`);
  });
  lines.push('');
  
  // Write P2 flows
  lines.push('[P2_FLOWS]');
  p2Flows.forEach((flow, idx) => {
    const flowStr = flow.map(e => `${e.pos}:${e.dir}`).join(' ');
    lines.push(`${idx}: ${flowStr}`);
  });
  lines.push('');
  
  // Write move prefixes
  lines.push('[MOVE_PREFIXES]');
  if (movePrefixes) {
    movePrefixes.forEach(prefix => {
      const p1Str = Object.entries(prefix.p1FlowLengths || prefix.p1 || {})
        .map(([k, v]) => `${k}:${v}`)
        .join(',');
      const p2Str = Object.entries(prefix.p2FlowLengths || prefix.p2 || {})
        .map(([k, v]) => `${k}:${v}`)
        .join(',');
      
      lines.push(`${prefix.move} p1={${p1Str}} p2={${p2Str}}`);
    });
  }
  
  return lines.join('\n');
}

async function regenerateForSeed(seed) {
  // Load actions
  const actionsPath = path.join(__dirname, `../tests/e2e/user-stories/005-complete-game/${seed}/${seed}.actions`);
  const actionsContent = fs.readFileSync(actionsPath, 'utf-8');
  const actions = actionsContent
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
  
  // Replay to get final state and track move prefixes
  resetPlayerIdCounter();
  let state = initialState;
  const movePrefixes = [];
  let moveNumber = 0;
  let player1Id = null;
  let player2Id = null;
  
  for (const action of actions) {
    state = gameReducer(state, action);
    
    // Track player IDs
    if (!player1Id && state.players.length >= 1) {
      player1Id = state.players[0].id;
    }
    if (!player2Id && state.players.length >= 2) {
      player2Id = state.players[1].id;
    }
    
    // After PLACE_TILE or at the end, capture flow lengths
    if (action.type === 'PLACE_TILE' || (action.type === 'NEXT_PLAYER' && movePrefixes.length === moveNumber)) {
      if (action.type === 'PLACE_TILE') {
        moveNumber++;
      }
      
      // Trace flows for each player
      const p1FlowLengths = {};
      const p2FlowLengths = {};
      let p1FlowIdx = 0;
      let p2FlowIdx = 0;
      
      for (const player of state.players) {
        const edgeData = getEdgePositionsWithDirections(player.edgePosition);
        
        for (const { pos, dir } of edgeData) {
          const posKey = positionToKey(pos);
          const tile = state.board.get(posKey);
          
          if (!tile) {
            continue;
          }
          
          const { edges } = traceFlow(state.board, pos, dir, player.id);
          
          if (edges.length > 0) {
            if (player.id === player1Id) {
              p1FlowLengths[p1FlowIdx] = edges.length;
              p1FlowIdx++;
            } else if (player.id === player2Id) {
              p2FlowLengths[p2FlowIdx] = edges.length;
              p2FlowIdx++;
            }
          }
        }
      }
      
      if (action.type === 'PLACE_TILE' && movePrefixes.length < moveNumber) {
        movePrefixes.push({
          move: moveNumber,
          p1: p1FlowLengths,
          p2: p2FlowLengths
        });
      }
    }
  }
  
  // Generate expectations
  const expectations = generateExpectations(state, movePrefixes);
  
  // Write to both e2e and unit test locations
  const e2ePath = path.join(__dirname, `../tests/e2e/user-stories/005-complete-game/${seed}/${seed}.expectations`);
  fs.writeFileSync(e2ePath, expectations);
  console.log(`Generated e2e expectations for seed ${seed}: ${e2ePath}`);
  
  const unitPath = path.join(__dirname, `../tests/game/complete-test-${seed}.expectations`);
  fs.writeFileSync(unitPath, expectations);
  console.log(`Generated unit test expectations for seed ${seed}: ${unitPath}`);
}

// Regenerate for seeds 888 and 999
await regenerateForSeed(888);
await regenerateForSeed(999);

console.log('Done!');
