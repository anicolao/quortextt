// Unit test based on e2e complete game that validates ordered flow sequences after every move
// This test uses an optimized format: stores final flow state + prefix lengths per move
// Data extracted from deterministic seed=999 game

import { describe, it, expect } from 'vitest';
import { gameReducer, initialState } from '../../src/redux/gameReducer';
import { GameState } from '../../src/redux/types';
import { traceFlow } from '../../src/game/flows';
import { getEdgePositionsWithDirections, positionToKey } from '../../src/game/board';

const DETERMINISTIC_SEED = 999;

describe('Complete Game Flow Validation (Unit Test from E2E)', () => {
  it('should have exact ordered flow sequences after every move matching e2e test expectations', () => {
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

    // Final flow states (after move 37) - each flow is an ordered array of {pos, dir} pairs
const finalP1Flows = [
  [
    {
      "pos": "-3,0",
      "dir": 0
    },
    {
      "pos": "-3,0",
      "dir": 1
    }
  ],
  [
    {
      "pos": "-3,0",
      "dir": 5
    },
    {
      "pos": "-3,0",
      "dir": 3
    },
    {
      "pos": "-2,0",
      "dir": 0
    },
    {
      "pos": "-2,0",
      "dir": 2
    },
    {
      "pos": "-1,-1",
      "dir": 5
    },
    {
      "pos": "-1,-1",
      "dir": 1
    },
    {
      "pos": "-1,-2",
      "dir": 4
    },
    {
      "pos": "-1,-2",
      "dir": 3
    },
    {
      "pos": "0,-2",
      "dir": 0
    },
    {
      "pos": "0,-2",
      "dir": 1
    },
    {
      "pos": "0,-3",
      "dir": 4
    },
    {
      "pos": "0,-3",
      "dir": 3
    },
    {
      "pos": "1,-3",
      "dir": 0
    },
    {
      "pos": "1,-3",
      "dir": 2
    }
  ],
  [
    {
      "pos": "-3,1",
      "dir": 0
    },
    {
      "pos": "-3,1",
      "dir": 4
    },
    {
      "pos": "-3,2",
      "dir": 1
    },
    {
      "pos": "-3,2",
      "dir": 0
    }
  ],
  [
    {
      "pos": "-3,1",
      "dir": 5
    },
    {
      "pos": "-3,1",
      "dir": 3
    },
    {
      "pos": "-2,1",
      "dir": 0
    },
    {
      "pos": "-2,1",
      "dir": 1
    },
    {
      "pos": "-2,0",
      "dir": 4
    },
    {
      "pos": "-2,0",
      "dir": 1
    },
    {
      "pos": "-2,-1",
      "dir": 4
    },
    {
      "pos": "-2,-1",
      "dir": 2
    },
    {
      "pos": "-1,-2",
      "dir": 5
    },
    {
      "pos": "-1,-2",
      "dir": 2
    },
    {
      "pos": "0,-3",
      "dir": 5
    },
    {
      "pos": "0,-3",
      "dir": 1
    }
  ],
  [
    {
      "pos": "-3,2",
      "dir": 0
    },
    {
      "pos": "-3,2",
      "dir": 1
    },
    {
      "pos": "-3,1",
      "dir": 4
    },
    {
      "pos": "-3,1",
      "dir": 0
    }
  ],
  [
    {
      "pos": "-3,2",
      "dir": 5
    },
    {
      "pos": "-3,2",
      "dir": 4
    },
    {
      "pos": "-3,3",
      "dir": 1
    },
    {
      "pos": "-3,3",
      "dir": 2
    },
    {
      "pos": "-2,2",
      "dir": 5
    },
    {
      "pos": "-2,2",
      "dir": 1
    },
    {
      "pos": "-2,1",
      "dir": 4
    },
    {
      "pos": "-2,1",
      "dir": 2
    },
    {
      "pos": "-1,0",
      "dir": 5
    },
    {
      "pos": "-1,0",
      "dir": 0
    },
    {
      "pos": "-2,0",
      "dir": 3
    },
    {
      "pos": "-2,0",
      "dir": 5
    },
    {
      "pos": "-3,1",
      "dir": 2
    },
    {
      "pos": "-3,1",
      "dir": 1
    },
    {
      "pos": "-3,0",
      "dir": 4
    },
    {
      "pos": "-3,0",
      "dir": 2
    },
    {
      "pos": "-2,-1",
      "dir": 5
    },
    {
      "pos": "-2,-1",
      "dir": 1
    }
  ],
  [
    {
      "pos": "-3,3",
      "dir": 0
    },
    {
      "pos": "-3,3",
      "dir": 5
    }
  ]
];


const finalP2Flows = [
  [
    {
      "pos": "3,-3",
      "dir": 3
    },
    {
      "pos": "3,-3",
      "dir": 4
    },
    {
      "pos": "3,-2",
      "dir": 1
    },
    {
      "pos": "3,-2",
      "dir": 5
    },
    {
      "pos": "2,-1",
      "dir": 2
    },
    {
      "pos": "2,-1",
      "dir": 5
    },
    {
      "pos": "1,0",
      "dir": 2
    },
    {
      "pos": "1,0",
      "dir": 1
    },
    {
      "pos": "1,-1",
      "dir": 4
    },
    {
      "pos": "1,-1",
      "dir": 3
    },
    {
      "pos": "2,-1",
      "dir": 0
    },
    {
      "pos": "2,-1",
      "dir": 1
    },
    {
      "pos": "2,-2",
      "dir": 4
    },
    {
      "pos": "2,-2",
      "dir": 3
    },
    {
      "pos": "3,-2",
      "dir": 0
    },
    {
      "pos": "3,-2",
      "dir": 3
    }
  ],
  [
    {
      "pos": "3,-2",
      "dir": 2
    },
    {
      "pos": "3,-2",
      "dir": 4
    },
    {
      "pos": "3,-1",
      "dir": 1
    },
    {
      "pos": "3,-1",
      "dir": 4
    },
    {
      "pos": "3,0",
      "dir": 1
    },
    {
      "pos": "3,0",
      "dir": 0
    },
    {
      "pos": "2,0",
      "dir": 3
    },
    {
      "pos": "2,0",
      "dir": 0
    },
    {
      "pos": "1,0",
      "dir": 3
    },
    {
      "pos": "1,0",
      "dir": 4
    },
    {
      "pos": "1,1",
      "dir": 1
    },
    {
      "pos": "1,1",
      "dir": 5
    },
    {
      "pos": "0,2",
      "dir": 2
    },
    {
      "pos": "0,2",
      "dir": 3
    },
    {
      "pos": "1,2",
      "dir": 0
    },
    {
      "pos": "1,2",
      "dir": 1
    },
    {
      "pos": "1,1",
      "dir": 4
    },
    {
      "pos": "1,1",
      "dir": 0
    },
    {
      "pos": "0,1",
      "dir": 3
    },
    {
      "pos": "0,1",
      "dir": 4
    },
    {
      "pos": "0,2",
      "dir": 1
    },
    {
      "pos": "0,2",
      "dir": 5
    },
    {
      "pos": "-1,3",
      "dir": 2
    },
    {
      "pos": "-1,3",
      "dir": 0
    },
    {
      "pos": "-2,3",
      "dir": 3
    },
    {
      "pos": "-2,3",
      "dir": 2
    },
    {
      "pos": "-1,2",
      "dir": 5
    },
    {
      "pos": "-1,2",
      "dir": 1
    },
    {
      "pos": "-1,1",
      "dir": 4
    },
    {
      "pos": "-1,1",
      "dir": 3
    },
    {
      "pos": "0,1",
      "dir": 0
    },
    {
      "pos": "0,1",
      "dir": 5
    },
    {
      "pos": "-1,2",
      "dir": 2
    },
    {
      "pos": "-1,2",
      "dir": 4
    },
    {
      "pos": "-1,3",
      "dir": 1
    },
    {
      "pos": "-1,3",
      "dir": 4
    }
  ],
  [
    {
      "pos": "3,-2",
      "dir": 3
    },
    {
      "pos": "3,-2",
      "dir": 0
    },
    {
      "pos": "2,-2",
      "dir": 3
    },
    {
      "pos": "2,-2",
      "dir": 4
    },
    {
      "pos": "2,-1",
      "dir": 1
    },
    {
      "pos": "2,-1",
      "dir": 0
    },
    {
      "pos": "1,-1",
      "dir": 3
    },
    {
      "pos": "1,-1",
      "dir": 4
    },
    {
      "pos": "1,0",
      "dir": 1
    },
    {
      "pos": "1,0",
      "dir": 2
    },
    {
      "pos": "2,-1",
      "dir": 5
    },
    {
      "pos": "2,-1",
      "dir": 2
    },
    {
      "pos": "3,-2",
      "dir": 5
    },
    {
      "pos": "3,-2",
      "dir": 1
    },
    {
      "pos": "3,-3",
      "dir": 4
    },
    {
      "pos": "3,-3",
      "dir": 3
    }
  ],
  [
    {
      "pos": "3,-1",
      "dir": 2
    },
    {
      "pos": "3,-1",
      "dir": 3
    }
  ],
  [
    {
      "pos": "3,-1",
      "dir": 3
    },
    {
      "pos": "3,-1",
      "dir": 2
    }
  ],
  [
    {
      "pos": "3,0",
      "dir": 2
    },
    {
      "pos": "3,0",
      "dir": 3
    }
  ],
  [
    {
      "pos": "3,0",
      "dir": 3
    },
    {
      "pos": "3,0",
      "dir": 2
    }
  ]
];


    // Prefix lengths for each move
    // Format: { move: N, p1: { flowIndex: prefixLength }, p2: { flowIndex: prefixLength } }
    // For each move, only validate the prefix of each flow up to the specified length
const movePrefixes = [
  {
    "move": 1,
    "p1": {
      "0": 2,
      "1": 2
    },
    "p2": {}
  },
  {
    "move": 2,
    "p1": {
      "0": 2,
      "1": 2,
      "2": 2,
      "3": 2
    },
    "p2": {}
  },
  {
    "move": 3,
    "p1": {
      "0": 2,
      "1": 2,
      "2": 4,
      "3": 2,
      "4": 4,
      "5": 2
    },
    "p2": {}
  },
  {
    "move": 4,
    "p1": {
      "0": 2,
      "1": 2,
      "2": 4,
      "3": 2,
      "4": 4,
      "5": 4,
      "6": 2
    },
    "p2": {}
  },
  {
    "move": 5,
    "p1": {
      "0": 2,
      "1": 2,
      "2": 4,
      "3": 2,
      "4": 4,
      "5": 4,
      "6": 2
    },
    "p2": {}
  },
  {
    "move": 6,
    "p1": {
      "0": 2,
      "1": 4,
      "2": 4,
      "3": 2,
      "4": 4,
      "5": 4,
      "6": 2
    },
    "p2": {}
  },
  {
    "move": 7,
    "p1": {
      "0": 2,
      "1": 4,
      "2": 4,
      "3": 8,
      "4": 4,
      "5": 4,
      "6": 2
    },
    "p2": {}
  },
  {
    "move": 8,
    "p1": {
      "0": 2,
      "1": 4,
      "2": 4,
      "3": 8,
      "4": 4,
      "5": 8,
      "6": 2
    },
    "p2": {}
  },
  {
    "move": 9,
    "p1": {
      "0": 2,
      "1": 4,
      "2": 4,
      "3": 8,
      "4": 4,
      "5": 8,
      "6": 2
    },
    "p2": {}
  },
  {
    "move": 10,
    "p1": {
      "0": 2,
      "1": 4,
      "2": 4,
      "3": 10,
      "4": 4,
      "5": 8,
      "6": 2
    },
    "p2": {}
  },
  {
    "move": 11,
    "p1": {
      "0": 2,
      "1": 8,
      "2": 4,
      "3": 10,
      "4": 4,
      "5": 8,
      "6": 2
    },
    "p2": {}
  },
  {
    "move": 12,
    "p1": {
      "0": 2,
      "1": 8,
      "2": 4,
      "3": 10,
      "4": 4,
      "5": 18,
      "6": 2
    },
    "p2": {}
  },
  {
    "move": 13,
    "p1": {
      "0": 2,
      "1": 8,
      "2": 4,
      "3": 10,
      "4": 4,
      "5": 18,
      "6": 2
    },
    "p2": {}
  },
  {
    "move": 14,
    "p1": {
      "0": 2,
      "1": 8,
      "2": 4,
      "3": 10,
      "4": 4,
      "5": 18,
      "6": 2
    },
    "p2": {}
  },
  {
    "move": 15,
    "p1": {
      "0": 2,
      "1": 8,
      "2": 4,
      "3": 10,
      "4": 4,
      "5": 18,
      "6": 2
    },
    "p2": {}
  },
  {
    "move": 16,
    "p1": {
      "0": 2,
      "1": 8,
      "2": 4,
      "3": 12,
      "4": 4,
      "5": 18,
      "6": 2
    },
    "p2": {}
  },
  {
    "move": 17,
    "p1": {
      "0": 2,
      "1": 12,
      "2": 4,
      "3": 12,
      "4": 4,
      "5": 18,
      "6": 2
    },
    "p2": {}
  },
  {
    "move": 18,
    "p1": {
      "0": 2,
      "1": 12,
      "2": 4,
      "3": 12,
      "4": 4,
      "5": 18,
      "6": 2
    },
    "p2": {}
  },
  {
    "move": 19,
    "p1": {
      "0": 2,
      "1": 12,
      "2": 4,
      "3": 12,
      "4": 4,
      "5": 18,
      "6": 2
    },
    "p2": {}
  },
  {
    "move": 20,
    "p1": {
      "0": 2,
      "1": 12,
      "2": 4,
      "3": 12,
      "4": 4,
      "5": 18,
      "6": 2
    },
    "p2": {}
  },
  {
    "move": 21,
    "p1": {
      "0": 2,
      "1": 12,
      "2": 4,
      "3": 12,
      "4": 4,
      "5": 18,
      "6": 2
    },
    "p2": {}
  },
  {
    "move": 22,
    "p1": {
      "0": 2,
      "1": 12,
      "2": 4,
      "3": 12,
      "4": 4,
      "5": 18,
      "6": 2
    },
    "p2": {}
  },
  {
    "move": 23,
    "p1": {
      "0": 2,
      "1": 14,
      "2": 4,
      "3": 12,
      "4": 4,
      "5": 18,
      "6": 2
    },
    "p2": {}
  },
  {
    "move": 24,
    "p1": {
      "0": 2,
      "1": 14,
      "2": 4,
      "3": 12,
      "4": 4,
      "5": 18,
      "6": 2
    },
    "p2": {}
  },
  {
    "move": 25,
    "p1": {
      "0": 2,
      "1": 14,
      "2": 4,
      "3": 12,
      "4": 4,
      "5": 18,
      "6": 2
    },
    "p2": {}
  },
  {
    "move": 26,
    "p1": {
      "0": 2,
      "1": 14,
      "2": 4,
      "3": 12,
      "4": 4,
      "5": 18,
      "6": 2
    },
    "p2": {}
  },
  {
    "move": 27,
    "p1": {
      "0": 2,
      "1": 14,
      "2": 4,
      "3": 12,
      "4": 4,
      "5": 18,
      "6": 2
    },
    "p2": {}
  },
  {
    "move": 28,
    "p1": {
      "0": 2,
      "1": 14,
      "2": 4,
      "3": 12,
      "4": 4,
      "5": 18,
      "6": 2
    },
    "p2": {}
  },
  {
    "move": 29,
    "p1": {
      "0": 2,
      "1": 14,
      "2": 4,
      "3": 12,
      "4": 4,
      "5": 18,
      "6": 2
    },
    "p2": {}
  },
  {
    "move": 30,
    "p1": {
      "0": 2,
      "1": 14,
      "2": 4,
      "3": 12,
      "4": 4,
      "5": 18,
      "6": 2
    },
    "p2": {}
  },
  {
    "move": 31,
    "p1": {
      "0": 2,
      "1": 14,
      "2": 4,
      "3": 12,
      "4": 4,
      "5": 18,
      "6": 2
    },
    "p2": {}
  },
  {
    "move": 32,
    "p1": {
      "0": 2,
      "1": 14,
      "2": 4,
      "3": 12,
      "4": 4,
      "5": 18,
      "6": 2
    },
    "p2": {}
  },
  {
    "move": 33,
    "p1": {
      "0": 2,
      "1": 14,
      "2": 4,
      "3": 12,
      "4": 4,
      "5": 18,
      "6": 2
    },
    "p2": {}
  },
  {
    "move": 34,
    "p1": {
      "0": 2,
      "1": 14,
      "2": 4,
      "3": 12,
      "4": 4,
      "5": 18,
      "6": 2
    },
    "p2": {
      "0": 2
    }
  },
  {
    "move": 35,
    "p1": {
      "0": 2,
      "1": 14,
      "2": 4,
      "3": 12,
      "4": 4,
      "5": 18,
      "6": 2
    },
    "p2": {
      "0": 16,
      "1": 2,
      "2": 16
    }
  },
  {
    "move": 36,
    "p1": {
      "0": 2,
      "1": 14,
      "2": 4,
      "3": 12,
      "4": 4,
      "5": 18,
      "6": 2
    },
    "p2": {
      "0": 16,
      "1": 4,
      "2": 16,
      "3": 2,
      "4": 2
    }
  },
  {
    "move": 37,
    "p1": {
      "0": 2,
      "1": 14,
      "2": 4,
      "3": 12,
      "4": 4,
      "5": 18,
      "6": 2
    },
    "p2": {
      "0": 16,
      "1": 36,
      "2": 16,
      "3": 2,
      "4": 2,
      "5": 2,
      "6": 2
    }
  }
];


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
    
    // Verify we tested all 37 moves
    expect(movePrefixes.length).toBe(37);
  });
});
