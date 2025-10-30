// Unit test based on e2e complete game that validates ordered flow sequences after every move
// This test validates that flows match exactly the expected ordered sequences extracted from e2e test run
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

    // Expected ordered flow sequences for each move (extracted from e2e test with seed=999)
    // Each flow is an ordered array of {pos, dir} pairs tracing the flow path
    const expectedOrderedFlows = [
  { move: 1,
    p1Flows: [
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
        }
      ]
    ],
    p2Flows: [] },
  { move: 2,
    p1Flows: [
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
        }
      ]
    ],
    p2Flows: [] },
  { move: 3,
    p1Flows: [
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
        }
      ]
    ],
    p2Flows: [] },
  { move: 4,
    p1Flows: [
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
    ],
    p2Flows: [] },
  { move: 5,
    p1Flows: [
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
    ],
    p2Flows: [] },
  { move: 6,
    p1Flows: [
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
    ],
    p2Flows: [] },
  { move: 7,
    p1Flows: [
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
    ],
    p2Flows: [] },
  { move: 8,
    p1Flows: [
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
    ],
    p2Flows: [] },
  { move: 9,
    p1Flows: [
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
    ],
    p2Flows: [] },
  { move: 10,
    p1Flows: [
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
    ],
    p2Flows: [] },
  { move: 11,
    p1Flows: [
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
    ],
    p2Flows: [] },
  { move: 12,
    p1Flows: [
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
    ],
    p2Flows: [] },
  { move: 13,
    p1Flows: [
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
    ],
    p2Flows: [] },
  { move: 14,
    p1Flows: [
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
    ],
    p2Flows: [] },
  { move: 15,
    p1Flows: [
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
    ],
    p2Flows: [] },
  { move: 16,
    p1Flows: [
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
    ],
    p2Flows: [] },
  { move: 17,
    p1Flows: [
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
    ],
    p2Flows: [] },
  { move: 18,
    p1Flows: [
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
    ],
    p2Flows: [] },
  { move: 19,
    p1Flows: [
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
    ],
    p2Flows: [] },
  { move: 20,
    p1Flows: [
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
    ],
    p2Flows: [] },
  { move: 21,
    p1Flows: [
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
    ],
    p2Flows: [] },
  { move: 22,
    p1Flows: [
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
    ],
    p2Flows: [] },
  { move: 23,
    p1Flows: [
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
    ],
    p2Flows: [] },
  { move: 24,
    p1Flows: [
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
    ],
    p2Flows: [] },
  { move: 25,
    p1Flows: [
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
    ],
    p2Flows: [] },
  { move: 26,
    p1Flows: [
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
    ],
    p2Flows: [] },
  { move: 27,
    p1Flows: [
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
    ],
    p2Flows: [] },
  { move: 28,
    p1Flows: [
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
    ],
    p2Flows: [] },
  { move: 29,
    p1Flows: [
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
    ],
    p2Flows: [] },
  { move: 30,
    p1Flows: [
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
    ],
    p2Flows: [] },
  { move: 31,
    p1Flows: [
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
    ],
    p2Flows: [] },
  { move: 32,
    p1Flows: [
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
    ],
    p2Flows: [] },
  { move: 33,
    p1Flows: [
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
    ],
    p2Flows: [] },
  { move: 34,
    p1Flows: [
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
    ],
    p2Flows: [
      [
        {
          "pos": "3,-3",
          "dir": 3
        },
        {
          "pos": "3,-3",
          "dir": 4
        }
      ]
    ] },
  { move: 35,
    p1Flows: [
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
    ],
    p2Flows: [
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
      ]
    ] },
  { move: 36,
    p1Flows: [
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
    ],
    p2Flows: [
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
      ]
    ] },
  { move: 37,
    p1Flows: [
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
    ],
    p2Flows: [
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
    ] },
];

    // Play through game and validate ordered flow sequences after each move
    for (const expected of expectedOrderedFlows) {
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
      
      // Extract actual ordered flows by tracing from each player's edge
      const actualP1Flows: any[] = [];
      const actualP2Flows: any[] = [];
      
      for (const player of state.players) {
        const edgeData = getEdgePositionsWithDirections(player.edgePosition);
        const playerFlows: any[] = [];
        
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
            playerFlows.push(flowEdges);
          }
        }
        
        if (player.id === player1Id) {
          actualP1Flows.push(...playerFlows);
        } else {
          actualP2Flows.push(...playerFlows);
        }
      }
      
      // Validate ordered flow sequences match exactly
      expect(actualP1Flows).toEqual(expected.p1Flows);
      expect(actualP2Flows).toEqual(expected.p2Flows);
      
      // Next player
      state = gameReducer(state, { type: 'NEXT_PLAYER' });
    }
    
    // Verify we tested all 37 moves
    expect(expectedOrderedFlows.length).toBe(37);
  });
});
