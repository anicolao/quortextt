// Unit test based on e2e complete game that validates flow existence after every move
// This test validates that flows match exactly the expected values extracted from e2e test run
// Data extracted from deterministic seed=999 game

import { describe, it, expect } from 'vitest';
import { gameReducer, initialState } from '../../src/redux/gameReducer';
import { GameState } from '../../src/redux/types';

const DETERMINISTIC_SEED = 999;

describe('Complete Game Flow Validation (Unit Test from E2E)', () => {
  it('should have exact flows after every move matching e2e test expectations', () => {
    // Simulate the game
    let state: GameState = initialState;

    // Add two players
    state = gameReducer(state, { type: 'ADD_PLAYER' });
    state = gameReducer(state, { type: 'ADD_PLAYER' });

    // Start game
    state = gameReducer(state, { type: 'START_GAME' });
    state = gameReducer(state, { type: 'SHUFFLE_TILES', payload: { seed: DETERMINISTIC_SEED } });
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

    // Expected flow positions for each move (extracted from e2e test with seed=999)
    const expectedFlows = [
      { move: 1, p1: ["-3,0"], p2: [] },
      { move: 2, p1: ["-3,0", "-3,1"], p2: [] },
      { move: 3, p1: ["-3,0", "-3,1", "-3,2"], p2: [] },
      { move: 4, p1: ["-3,0", "-3,1", "-3,2", "-3,3"], p2: [] },
      { move: 5, p1: ["-3,0", "-3,1", "-3,2", "-3,3"], p2: [] },
      { move: 6, p1: ["-2,0", "-3,0", "-3,1", "-3,2", "-3,3"], p2: [] },
      { move: 7, p1: ["-2,-1", "-2,0", "-2,1", "-3,0", "-3,1", "-3,2", "-3,3"], p2: [] },
      { move: 8, p1: ["-2,-1", "-2,0", "-2,1", "-2,2", "-3,0", "-3,1", "-3,2", "-3,3"], p2: [] },
      { move: 9, p1: ["-2,-1", "-2,0", "-2,1", "-2,2", "-3,0", "-3,1", "-3,2", "-3,3"], p2: [] },
      { move: 10, p1: ["-1,-2", "-2,-1", "-2,0", "-2,1", "-2,2", "-3,0", "-3,1", "-3,2", "-3,3"], p2: [] },
      { move: 11, p1: ["-1,-1", "-1,-2", "-2,-1", "-2,0", "-2,1", "-2,2", "-3,0", "-3,1", "-3,2", "-3,3"], p2: [] },
      { move: 12, p1: ["-1,-1", "-1,-2", "-1,0", "-2,-1", "-2,0", "-2,1", "-2,2", "-3,0", "-3,1", "-3,2", "-3,3"], p2: [] },
      { move: 13, p1: ["-1,-1", "-1,-2", "-1,0", "-2,-1", "-2,0", "-2,1", "-2,2", "-3,0", "-3,1", "-3,2", "-3,3"], p2: [] },
      { move: 14, p1: ["-1,-1", "-1,-2", "-1,0", "-2,-1", "-2,0", "-2,1", "-2,2", "-3,0", "-3,1", "-3,2", "-3,3"], p2: [] },
      { move: 15, p1: ["-1,-1", "-1,-2", "-1,0", "-2,-1", "-2,0", "-2,1", "-2,2", "-3,0", "-3,1", "-3,2", "-3,3"], p2: [] },
      { move: 16, p1: ["-1,-1", "-1,-2", "-1,0", "-2,-1", "-2,0", "-2,1", "-2,2", "-3,0", "-3,1", "-3,2", "-3,3", "0,-3"], p2: [] },
      { move: 17, p1: ["-1,-1", "-1,-2", "-1,0", "-2,-1", "-2,0", "-2,1", "-2,2", "-3,0", "-3,1", "-3,2", "-3,3", "0,-2", "0,-3"], p2: [] },
      { move: 18, p1: ["-1,-1", "-1,-2", "-1,0", "-2,-1", "-2,0", "-2,1", "-2,2", "-3,0", "-3,1", "-3,2", "-3,3", "0,-2", "0,-3"], p2: [] },
      { move: 19, p1: ["-1,-1", "-1,-2", "-1,0", "-2,-1", "-2,0", "-2,1", "-2,2", "-3,0", "-3,1", "-3,2", "-3,3", "0,-2", "0,-3"], p2: [] },
      { move: 20, p1: ["-1,-1", "-1,-2", "-1,0", "-2,-1", "-2,0", "-2,1", "-2,2", "-3,0", "-3,1", "-3,2", "-3,3", "0,-2", "0,-3"], p2: [] },
      { move: 21, p1: ["-1,-1", "-1,-2", "-1,0", "-2,-1", "-2,0", "-2,1", "-2,2", "-3,0", "-3,1", "-3,2", "-3,3", "0,-2", "0,-3"], p2: [] },
      { move: 22, p1: ["-1,-1", "-1,-2", "-1,0", "-2,-1", "-2,0", "-2,1", "-2,2", "-3,0", "-3,1", "-3,2", "-3,3", "0,-2", "0,-3"], p2: [] },
      { move: 23, p1: ["-1,-1", "-1,-2", "-1,0", "-2,-1", "-2,0", "-2,1", "-2,2", "-3,0", "-3,1", "-3,2", "-3,3", "0,-2", "0,-3", "1,-3"], p2: [] },
      { move: 24, p1: ["-1,-1", "-1,-2", "-1,0", "-2,-1", "-2,0", "-2,1", "-2,2", "-3,0", "-3,1", "-3,2", "-3,3", "0,-2", "0,-3", "1,-3"], p2: [] },
      { move: 25, p1: ["-1,-1", "-1,-2", "-1,0", "-2,-1", "-2,0", "-2,1", "-2,2", "-3,0", "-3,1", "-3,2", "-3,3", "0,-2", "0,-3", "1,-3"], p2: [] },
      { move: 26, p1: ["-1,-1", "-1,-2", "-1,0", "-2,-1", "-2,0", "-2,1", "-2,2", "-3,0", "-3,1", "-3,2", "-3,3", "0,-2", "0,-3", "1,-3"], p2: [] },
      { move: 27, p1: ["-1,-1", "-1,-2", "-1,0", "-2,-1", "-2,0", "-2,1", "-2,2", "-3,0", "-3,1", "-3,2", "-3,3", "0,-2", "0,-3", "1,-3"], p2: [] },
      { move: 28, p1: ["-1,-1", "-1,-2", "-1,0", "-2,-1", "-2,0", "-2,1", "-2,2", "-3,0", "-3,1", "-3,2", "-3,3", "0,-2", "0,-3", "1,-3"], p2: [] },
      { move: 29, p1: ["-1,-1", "-1,-2", "-1,0", "-2,-1", "-2,0", "-2,1", "-2,2", "-3,0", "-3,1", "-3,2", "-3,3", "0,-2", "0,-3", "1,-3"], p2: [] },
      { move: 30, p1: ["-1,-1", "-1,-2", "-1,0", "-2,-1", "-2,0", "-2,1", "-2,2", "-3,0", "-3,1", "-3,2", "-3,3", "0,-2", "0,-3", "1,-3"], p2: [] },
      { move: 31, p1: ["-1,-1", "-1,-2", "-1,0", "-2,-1", "-2,0", "-2,1", "-2,2", "-3,0", "-3,1", "-3,2", "-3,3", "0,-2", "0,-3", "1,-3"], p2: [] },
      { move: 32, p1: ["-1,-1", "-1,-2", "-1,0", "-2,-1", "-2,0", "-2,1", "-2,2", "-3,0", "-3,1", "-3,2", "-3,3", "0,-2", "0,-3", "1,-3"], p2: [] },
      { move: 33, p1: ["-1,-1", "-1,-2", "-1,0", "-2,-1", "-2,0", "-2,1", "-2,2", "-3,0", "-3,1", "-3,2", "-3,3", "0,-2", "0,-3", "1,-3"], p2: [] },
      { move: 34, p1: ["-1,-1", "-1,-2", "-1,0", "-2,-1", "-2,0", "-2,1", "-2,2", "-3,0", "-3,1", "-3,2", "-3,3", "0,-2", "0,-3", "1,-3"], p2: ["3,-3"] },
      { move: 35, p1: ["-1,-1", "-1,-2", "-1,0", "-2,-1", "-2,0", "-2,1", "-2,2", "-3,0", "-3,1", "-3,2", "-3,3", "0,-2", "0,-3", "1,-3"], p2: ["1,-1", "1,0", "2,-1", "2,-2", "3,-2", "3,-3"] },
      { move: 36, p1: ["-1,-1", "-1,-2", "-1,0", "-2,-1", "-2,0", "-2,1", "-2,2", "-3,0", "-3,1", "-3,2", "-3,3", "0,-2", "0,-3", "1,-3"], p2: ["1,-1", "1,0", "2,-1", "2,-2", "3,-1", "3,-2", "3,-3"] },
      { move: 37, p1: ["-1,-1", "-1,-2", "-1,0", "-2,-1", "-2,0", "-2,1", "-2,2", "-3,0", "-3,1", "-3,2", "-3,3", "0,-2", "0,-3", "1,-3"], p2: ["-1,1", "-1,2", "-1,3", "-2,3", "0,1", "0,2", "1,-1", "1,0", "1,1", "1,2", "2,-1", "2,-2", "2,0", "3,-1", "3,-2", "3,-3", "3,0"] },
    ];

    // Play through game and validate flows after each move
    for (const expected of expectedFlows) {
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
      const rotation = expected.move % 6;
      state = gameReducer(state, {
        type: 'PLACE_TILE',
        payload: { position: position!, rotation }
      });
      
      // Validate flows match expected
      const p1Flows = Array.from(state.flows.get(player1Id) || []).sort();
      const p2Flows = Array.from(state.flows.get(player2Id) || []).sort();
      
      expect(p1Flows).toEqual(expected.p1.sort());
      expect(p2Flows).toEqual(expected.p2.sort());
      
      // Also verify flowEdges exist for all flow positions
      for (const pos of expected.p1) {
        const edges = state.flowEdges.get(pos);
        expect(edges).toBeDefined();
        // At least one direction should have player1's flow
        const hasP1 = edges && Array.from(edges.values()).some(pid => pid === player1Id);
        expect(hasP1).toBe(true);
      }
      
      for (const pos of expected.p2) {
        const edges = state.flowEdges.get(pos);
        expect(edges).toBeDefined();
        // At least one direction should have player2's flow
        const hasP2 = edges && Array.from(edges.values()).some(pid => pid === player2Id);
        expect(hasP2).toBe(true);
      }
      
      // Next player
      state = gameReducer(state, { type: 'NEXT_PLAYER' });
    }
    
    // Verify we tested all 37 moves
    expect(expectedFlows.length).toBe(37);
  });
});
