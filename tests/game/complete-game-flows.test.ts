// Generic test for validating ordered flow sequences across a complete game
// Loads expectations from complete-test-SEED.expectations files

import { describe, it, expect } from 'vitest';
import { gameReducer, initialState } from '../../src/redux/gameReducer';
import { GameState } from '../../src/redux/types';
import { traceFlow } from '../../src/game/flows';
import { getEdgePositionsWithDirections, positionToKey } from '../../src/game/board';
import * as fs from 'fs';
import * as path from 'path';

interface FlowExpectations {
  p1Flows: Array<Array<{ pos: string; dir: number }>>;
  p2Flows: Array<Array<{ pos: string; dir: number }>>;
  movePrefixes: Array<{ move: number; p1: Record<number, number>; p2: Record<number, number> }>;
}

/**
 * Parse compact expectations file format
 * Format:
 *   [P1_FLOWS]
 *   0: -3,0:0 -3,0:1
 *   1: -3,0:5 -3,0:3 ...
 *   
 *   [P2_FLOWS]
 *   0: 3,-3:3 3,-3:4 ...
 *   
 *   [MOVE_PREFIXES]
 *   1 p1={0:2,1:2} p2={}
 *   2 p1={0:2,1:2,2:2,3:2} p2={}
 */
function parseExpectations(content: string): FlowExpectations {
  const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  
  const p1Flows: Array<Array<{ pos: string; dir: number }>> = [];
  const p2Flows: Array<Array<{ pos: string; dir: number }>> = [];
  const movePrefixes: Array<{ move: number; p1: Record<number, number>; p2: Record<number, number> }> = [];
  
  let section = '';
  
  for (const line of lines) {
    if (line.startsWith('[')) {
      section = line.trim();
      continue;
    }
    
    if (section === '[P1_FLOWS]' || section === '[P2_FLOWS]') {
      const colonIndex = line.indexOf(':');
      const indexStr = line.substring(0, colonIndex).trim();
      const flowStr = line.substring(colonIndex + 1).trim();
      const index = parseInt(indexStr);
      const pairs = flowStr.split(' ').map(pair => {
        const [pos, dirStr] = pair.split(':');
        return { pos, dir: parseInt(dirStr) };
      });
      
      if (section === '[P1_FLOWS]') {
        p1Flows[index] = pairs;
      } else {
        p2Flows[index] = pairs;
      }
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

function loadExpectations(seed: number): FlowExpectations {
  const expectationsPath = path.join(__dirname, `complete-test-${seed}.expectations`);
  const content = fs.readFileSync(expectationsPath, 'utf-8');
  return parseExpectations(content);
}

function runCompleteGameTest(seed: number) {
  describe(`Complete Game Flow Validation (seed ${seed})`, () => {
    it('should have exact ordered flow sequences after every move matching expectations', () => {
      // Load expectations from file
      const { p1Flows: finalP1Flows, p2Flows: finalP2Flows, movePrefixes } = loadExpectations(seed);
      
      // Simulate the game
      let state: GameState = initialState;

      // Add two players
      state = gameReducer(state, { type: 'ADD_PLAYER' });
      state = gameReducer(state, { type: 'ADD_PLAYER' });

      // Start game
      state = gameReducer(state, { type: 'START_GAME' });
      state = gameReducer(state, { type: 'SHUFFLE_TILES', payload: { seed } });
      state = gameReducer(state, { type: 'DRAW_TILE' });

      const player1Id = state.players[0].id;
      const player2Id = state.players[1].id;

      // Generate positions in the same order as e2e test
      const allPositions = [];
      for (let row = -3; row <= 3; row++) {
        for (let col = -3; col <= 3; col++) {
          if (Math.abs(row + col) <= 3) {
            allPositions.push({ row, col });
          }
        }
      }

      let positionIndex = 0;

      // Play through game and validate ordered flow sequences after each move
      for (const { move, p1, p2 } of movePrefixes) {
        // Draw tile
        state = gameReducer(state, { type: 'DRAW_TILE' });
        expect(state.currentTile).not.toBeNull();
        
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
        
        expect(position).not.toBeNull();
        
        // Place tile with same rotation pattern as e2e test
        const rotation = move % 6;
        state = gameReducer(state, {
          type: 'PLACE_TILE',
          payload: { position: position!, rotation }
        });
        
        // Extract actual ordered flows by tracing from each player's edge
        const actualP1Flows: any[] = [];
        const actualP2Flows: any[] = [];
        
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
        
        // Validate ordered flow sequences match expected prefixes
        // For each flow index, validate only the prefix up to the specified length
        for (const [flowIdxStr, prefixLength] of Object.entries(p1)) {
          const flowIdx = Number(flowIdxStr);
          expect(actualP1Flows[flowIdx]).toBeDefined();
          expect(actualP1Flows[flowIdx].length).toBeGreaterThanOrEqual(prefixLength);
          
          // Validate the prefix matches
          const actualPrefix = actualP1Flows[flowIdx].slice(0, prefixLength);
          const expectedPrefix = finalP1Flows[flowIdx].slice(0, prefixLength);
          expect(actualPrefix).toEqual(expectedPrefix);
        }
        
        for (const [flowIdxStr, prefixLength] of Object.entries(p2)) {
          const flowIdx = Number(flowIdxStr);
          expect(actualP2Flows[flowIdx]).toBeDefined();
          expect(actualP2Flows[flowIdx].length).toBeGreaterThanOrEqual(prefixLength);
          
          // Validate the prefix matches
          const actualPrefix = actualP2Flows[flowIdx].slice(0, prefixLength);
          const expectedPrefix = finalP2Flows[flowIdx].slice(0, prefixLength);
          expect(actualPrefix).toEqual(expectedPrefix);
        }
        
        // Next player
        state = gameReducer(state, { type: 'NEXT_PLAYER' });
      }
      
      // Verify we tested the expected number of moves
      expect(movePrefixes.length).toBeGreaterThan(0);
    });
  });
}

// Run tests for all available seeds
runCompleteGameTest(999);
