// Regenerate expectations using unit test placement logic
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
  
  const p1Flows = [];
  const p2Flows = [];
  
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
  
  lines.push('[P1_FLOWS]');
  p1Flows.forEach((flow, idx) => {
    const flowStr = flow.map(e => `${e.pos}:${e.dir}`).join(' ');
    lines.push(`${idx}: ${flowStr}`);
  });
  lines.push('');
  
  lines.push('[P2_FLOWS]');
  p2Flows.forEach((flow, idx) => {
    const flowStr = flow.map(e => `${e.pos}:${e.dir}`).join(' ');
    lines.push(`${idx}: ${flowStr}`);
  });
  lines.push('');
  
  lines.push('[MOVE_PREFIXES]');
  movePrefixes.forEach(prefix => {
    const p1Str = Object.entries(prefix.p1)
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    const p2Str = Object.entries(prefix.p2)
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    
    lines.push(`${prefix.move} p1={${p1Str}} p2={${p2Str}}`);
  });
  
  return lines.join('\n');
}

async function regenerateForSeed(seed) {
  resetPlayerIdCounter();
  let state = initialState;
  
  // Add two players
  state = gameReducer(state, { type: 'ADD_PLAYER', payload: { color: '#0173B2', edge: 0 } });
  state = gameReducer(state, { type: 'ADD_PLAYER', payload: { color: '#DE8F05', edge: 1 } });
  
  // Start game
  state = gameReducer(state, { type: 'START_GAME' });
  
  const player1Id = state.seatingPhase.seatingOrder[0];
  const player2Id = state.seatingPhase.seatingOrder[1];
  
  // Complete seating
  state = gameReducer(state, { type: 'SELECT_EDGE', payload: { playerId: player1Id, edgeNumber: 0 } });
  state = gameReducer(state, { type: 'SELECT_EDGE', payload: { playerId: player2Id, edgeNumber: 3 } });
  
  // Shuffle and start
  state = gameReducer(state, { type: 'SHUFFLE_TILES', payload: { seed } });
  state = gameReducer(state, { type: 'DRAW_TILE' });
  
  // Generate positions in the same order as unit test
  const allPositions = [];
  for (let row = -3; row <= 3; row++) {
    for (let col = -3; col <= 3; col++) {
      if (Math.abs(row + col) <= 3) {
        allPositions.push({ row, col });
      }
    }
  }
  
  let positionIndex = 0;
  const movePrefixes = [];
  let moveNumber = 0;
  
  // Play through 30 moves
  for (let i = 1; i <= 30; i++) {
    state = gameReducer(state, { type: 'DRAW_TILE' });
    
    if (!state.currentTile) break;
    
    // Find next valid position
    let position = null;
    while (positionIndex < allPositions.length) {
      const testPos = allPositions[positionIndex];
      const posKey = `${testPos.row},${testPos.col}`;
      
      if (!state.board.has(posKey)) {
        position = testPos;
        positionIndex++;
        break;
      }
      positionIndex++;
    }
    
    if (!position) break;
    
    // Place tile with rotation pattern matching unit test
    const rotation = i % 6;
    state = gameReducer(state, {
      type: 'PLACE_TILE',
      payload: { position, rotation }
    });
    
    moveNumber++;
    
    // Capture flow lengths
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
    
    movePrefixes.push({
      move: moveNumber,
      p1: p1FlowLengths,
      p2: p2FlowLengths
    });
    
    // Next player
    state = gameReducer(state, { type: 'NEXT_PLAYER' });
    
    // Stop if game ended
    if (state.phase === 'finished') break;
  }
  
  const expectations = generateExpectations(state, movePrefixes);
  
  // Write to file
  const unitPath = path.join(__dirname, `../tests/game/complete-test-${seed}.expectations`);
  fs.writeFileSync(unitPath, expectations);
  console.log(`Generated unit test expectations for seed ${seed}: ${unitPath}`);
  console.log(`Generated ${movePrefixes.length} moves`);
}

await regenerateForSeed(999);
console.log('Done!');
