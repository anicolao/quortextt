#!/usr/bin/env tsx
/**
 * Regenerate expectations for complete-game-flows.test.ts
 * Uses the same row-major tile placement logic as the test
 */

import * as fs from 'fs';
import * as path from 'path';
import { gameReducer, initialState } from '../src/redux/gameReducer';
import { GameState } from '../src/redux/types';
import { traceFlow } from '../src/game/flows';
import { getEdgePositionsWithDirections, positionToKey } from '../src/game/board';

function generateExpectations(seed: number): string {
  let state: GameState = initialState;

  // Add two players
  state = gameReducer(state, { type: 'ADD_PLAYER', payload: { color: '#0173B2', edge: 0 } });
  state = gameReducer(state, { type: 'ADD_PLAYER', payload: { color: '#DE8F05', edge: 1 } });

  // Start game
  state = gameReducer(state, { type: 'START_GAME' });
  
  // Get player IDs
  const player1Id = state.seatingPhase.seatingOrder[0];
  const player2Id = state.seatingPhase.seatingOrder[1];
  
  // Complete seating phase
  state = gameReducer(state, { type: 'SELECT_EDGE', payload: { playerId: player1Id, edgeNumber: 0 } });
  state = gameReducer(state, { type: 'SELECT_EDGE', payload: { playerId: player2Id, edgeNumber: 3 } });
  
  // Shuffle tiles and draw first tile
  state = gameReducer(state, { type: 'SHUFFLE_TILES', payload: { seed } });
  state = gameReducer(state, { type: 'DRAW_TILE' });

  // Generate positions in row-major order
  const allPositions = [];
  for (let row = -3; row <= 3; row++) {
    for (let col = -3; col <= 3; col++) {
      if (Math.abs(row + col) <= 3) {
        allPositions.push({ row, col });
      }
    }
  }

  let positionIndex = 0;
  const allP1Flows: any[] = [];
  const allP2Flows: any[] = [];
  const movePrefixes: any[] = [];
  let moveNum = 0;

  // Play through the game
  while (state.phase === 'playing' && moveNum < 50) {
    moveNum++;
    
    // Draw tile
    state = gameReducer(state, { type: 'DRAW_TILE' });
    if (state.currentTile === null) {
      break;
    }
    
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
    
    // Place tile with rotation = move % 6
    const rotation = moveNum % 6;
    state = gameReducer(state, {
      type: 'PLACE_TILE',
      payload: { position, rotation }
    });
    
    // Extract flows by tracing from each player's edge
    const actualP1Flows: any[] = [];
    const actualP2Flows: any[] = [];
    
    for (const player of state.players) {
      const edgeData = getEdgePositionsWithDirections(player.edgePosition);
      
      for (const { pos, dir } of edgeData) {
        const posKey = positionToKey(pos);
        const tile = state.board.get(posKey);
        
        if (!tile) continue;
        
        const { edges } = traceFlow(state.board, pos, dir, player.id);
        
        if (edges.length > 0) {
          const flowEdges = edges.map(e => ({
            pos: e.position,
            dir: e.direction
          }));
          
          if (player.id === player1Id) {
            actualP1Flows.push(flowEdges);
          } else {
            actualP2Flows.push(flowEdges);
          }
        }
      }
    }
    
    // Store final flows (will be overwritten each move, keeping only the last)
    allP1Flows.length = 0;
    allP2Flows.length = 0;
    allP1Flows.push(...actualP1Flows);
    allP2Flows.push(...actualP2Flows);
    
    // Compute prefix lengths for this move
    const p1Prefixes: Record<number, number> = {};
    const p2Prefixes: Record<number, number> = {};
    
    for (let i = 0; i < actualP1Flows.length; i++) {
      p1Prefixes[i] = actualP1Flows[i].length;
    }
    for (let i = 0; i < actualP2Flows.length; i++) {
      p2Prefixes[i] = actualP2Flows[i].length;
    }
    
    movePrefixes.push({ move: moveNum, p1: p1Prefixes, p2: p2Prefixes });
    
    // Next player
    state = gameReducer(state, { type: 'NEXT_PLAYER' });
  }

  // Generate expectations file content
  let content = '# Flow expectations for seed ' + seed + '\n\n';
  
  content += '[P1_FLOWS]\n';
  for (let i = 0; i < allP1Flows.length; i++) {
    const edges = allP1Flows[i].map((e: any) => `${e.pos}:${e.dir}`).join(' ');
    content += `${i}: ${edges}\n`;
  }
  
  content += '\n[P2_FLOWS]\n';
  for (let i = 0; i < allP2Flows.length; i++) {
    const edges = allP2Flows[i].map((e: any) => `${e.pos}:${e.dir}`).join(' ');
    content += `${i}: ${edges}\n`;
  }
  
  content += '\n[MOVE_PREFIXES]\n';
  for (const { move, p1, p2 } of movePrefixes) {
    const p1Str = Object.entries(p1).map(([k, v]) => `${k}:${v}`).join(',');
    const p2Str = Object.entries(p2).map(([k, v]) => `${k}:${v}`).join(',');
    content += `${move} p1={${p1Str}} p2={${p2Str}}\n`;
  }
  
  return content;
}

function main() {
  const seeds = [888, 999];
  
  for (const seed of seeds) {
    console.log(`Generating expectations for seed ${seed}...`);
    const content = generateExpectations(seed);
    const outputPath = path.join(process.cwd(), 'tests', 'game', `complete-test-${seed}.expectations`);
    fs.writeFileSync(outputPath, content, 'utf-8');
    console.log(`  ✓ Saved ${outputPath}`);
  }
  
  console.log('\n✓ All expectations regenerated');
}

main();
