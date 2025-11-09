// Test for validating games from .actions files
// Loads actions from tests/e2e/user-stories/005-complete-game/SEED/SEED.actions
// and validates against corresponding .expectations files

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
      // Format: 1 tile=0 pos=-3,0 rot=0 p1={0:2,1:2} p2={}
      const match = line.match(/^(\d+)\s+tile=\d+\s+pos=[-\d]+,[-\d]+\s+rot=\d+\s+p1=\{([^}]*)\}\s+p2=\{([^}]*)\}/);
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
  const expectationsPath = path.join(__dirname, `../e2e/user-stories/005-complete-game/${seed}/${seed}.expectations`);
  const content = fs.readFileSync(expectationsPath, 'utf-8');
  return parseExpectations(content);
}

function loadActions(seed: number): any[] {
  const actionsPath = path.join(__dirname, `../e2e/user-stories/005-complete-game/${seed}/${seed}.actions`);
  const content = fs.readFileSync(actionsPath, 'utf-8');
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

function runGameValidationTest(seed: number) {
  describe(`Game Validation from Actions (seed ${seed})`, () => {
    it('should replay actions and validate flow sequences match expectations', () => {
      // Load actions and expectations from files
      const actions = loadActions(seed);
      const { p1Flows: finalP1Flows, p2Flows: finalP2Flows, movePrefixes } = loadExpectations(seed);
      
      // Simulate the game
      let state: GameState = initialState;

      // Replay actions until we get to gameplay phase
      let moveCounter = 0;
      let player1Id = '';
      let player2Id = '';
      
      const validateFlows = () => {
        // Find expectations for this move
        const expectation = movePrefixes.find(e => e.move === moveCounter);
        
        if (expectation && player1Id && player2Id) {
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
          
          // Check exact number of P1 flows
          const expectedP1FlowCount = Object.keys(expectation.p1).length;
          expect(actualP1Flows.length, `P1 should have exactly ${expectedP1FlowCount} flows at move ${moveCounter}`).toBe(expectedP1FlowCount);
          
          // Validate ordered flow sequences match expected prefixes
          // For each flow index, validate only the prefix up to the specified length
          for (const [flowIdxStr, prefixLength] of Object.entries(expectation.p1)) {
            const flowIdx = Number(flowIdxStr);
            expect(actualP1Flows[flowIdx], `P1 flow ${flowIdx} should exist at move ${moveCounter}`).toBeDefined();
            expect(actualP1Flows[flowIdx].length, `P1 flow ${flowIdx} should have exactly ${prefixLength} edges at move ${moveCounter}`).toBe(prefixLength);
            
            // Validate the prefix matches
            const actualPrefix = actualP1Flows[flowIdx].slice(0, prefixLength);
            const expectedPrefix = finalP1Flows[flowIdx].slice(0, prefixLength);
            expect(actualPrefix, `P1 flow ${flowIdx} prefix mismatch at move ${moveCounter}`).toEqual(expectedPrefix);
          }
          
          // Check exact number of P2 flows
          const expectedP2FlowCount = Object.keys(expectation.p2).length;
          expect(actualP2Flows.length, `P2 should have exactly ${expectedP2FlowCount} flows at move ${moveCounter}`).toBe(expectedP2FlowCount);
          
          for (const [flowIdxStr, prefixLength] of Object.entries(expectation.p2)) {
            const flowIdx = Number(flowIdxStr);
            expect(actualP2Flows[flowIdx], `P2 flow ${flowIdx} should exist at move ${moveCounter}`).toBeDefined();
            expect(actualP2Flows[flowIdx].length, `P2 flow ${flowIdx} should have exactly ${prefixLength} edges at move ${moveCounter}`).toBe(prefixLength);
            
            // Validate the prefix matches
            const actualPrefix = actualP2Flows[flowIdx].slice(0, prefixLength);
            const expectedPrefix = finalP2Flows[flowIdx].slice(0, prefixLength);
            expect(actualPrefix, `P2 flow ${flowIdx} prefix mismatch at move ${moveCounter}`).toEqual(expectedPrefix);
          }
        }
      };
      
      for (let i = 0; i < actions.length; i++) {
        let action = actions[i];
        
        // After seating phase starts, capture player IDs and replace them in subsequent actions
        if (state.phase === 'seating' && state.seatingPhase.seatingOrder.length > 0 && !player1Id) {
          player1Id = state.seatingPhase.seatingOrder[0];
          player2Id = state.seatingPhase.seatingOrder[1];
        }
        
        // Replace hardcoded player IDs with actual ones
        if (player1Id && player2Id && action.payload && action.payload.playerId) {
          action = {
            ...action,
            payload: {
              ...action.payload,
              playerId: action.payload.playerId === 'P1' ? player1Id : player2Id
            }
          };
        }
        
        // Skip actions that would cause errors in non-gameplay states
        try {
          state = gameReducer(state, action);
          
          // Log important state changes
          if (action.type === 'START_GAME') {
            console.log(`[Action Test] START_GAME with seed: ${action.payload?.seed}`);
            console.log(`  State after: seed=${state.seed}, screen=${state.screen}, phase=${state.phase}`);
          }
          
          if (action.type === 'SELECT_EDGE' && state.phase === 'playing') {
            console.log(`[Action Test] Transitioned to playing phase after edge selection`);
            console.log(`  seed=${state.seed}`);
            console.log(`  currentTile: ${state.currentTile ? `type${state.currentTile.type}` : 'null'}`);
            console.log(`  availableTiles count: ${state.availableTiles.length}`);
            if (state.availableTiles.length > 0) {
              console.log(`  First 5 tiles in deck: ${state.availableTiles.slice(0, 5).map(t => `type${t.type}`).join(', ')}`);
            }
          }
          
          if (action.type === 'DRAW_TILE' && moveCounter === 0) {
            console.log(`[Action Test] First DRAW_TILE: type${state.currentTile?.type}`);
          }
        } catch (error) {
          console.warn(`Error processing action ${i + 1}/${actions.length} (${action.type}):`, error);
          throw error;
        }
        
        // After each NEXT_PLAYER action, validate flows
        if (action.type === 'NEXT_PLAYER') {
          moveCounter++;
          validateFlows();
        }
        
        // Also validate at the end if the last action wasn't NEXT_PLAYER
        if (i === actions.length - 1 && action.type !== 'NEXT_PLAYER') {
          moveCounter++;
          validateFlows();
        }
      }
      
      // Verify we tested the expected number of moves
      expect(movePrefixes.length).toBeGreaterThan(0);
    });
  });
}

// Run tests for all available seeds
runGameValidationTest(888);
runGameValidationTest(999);
