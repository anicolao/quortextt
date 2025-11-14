// Test for bag empty constraint victory
import { describe, it, expect, beforeEach } from 'vitest';
import { gameReducer, resetPlayerIdCounter } from '../src/redux/gameReducer';
import { drawTile } from '../src/redux/actions';
import { GameState } from '../src/redux/types';
import { Player } from '../src/game/types';

describe('Bag Empty Constraint Victory', () => {
  beforeEach(() => {
    resetPlayerIdCounter();
  });

  it('should trigger constraint victory when bag is empty in playing phase', () => {
    const players: Player[] = [
      { id: 'p1', color: '#DE8F05', edgePosition: 0, isAI: false },
      { id: 'p2', color: '#0173B2', edgePosition: 3, isAI: false },
    ];

    const state: GameState = {
      screen: 'gameplay',
      configPlayers: [],
      boardRadius: 3,
      seatingPhase: {
        active: false,
        seatingOrder: [],
        seatingIndex: 0,
        availableEdges: [],
        edgeAssignments: new Map(),
      },
      players,
      teams: [],
      currentPlayerIndex: 0,
      board: new Map(),
      availableTiles: [], // Empty bag
      currentTile: null,
      flows: new Map(),
      flowEdges: new Map(),
      phase: 'playing',
      winners: [],
      winType: null,
      moveHistory: [],
      supermove: true,
      singleSupermove: false,
      supermoveInProgress: false,
      lastPlacedTilePosition: null,
    };

    const newState = gameReducer(state, { type: 'DRAW_TILE' });

    expect(newState.phase).toBe('finished');
    expect(newState.winners).toEqual(['p1']);
    expect(newState.winType).toBe('constraint');
    expect(newState.screen).toBe('game-over');
  });

  it('should not trigger constraint victory when bag is empty but not in playing phase', () => {
    const state: GameState = {
      screen: 'configuration',
      configPlayers: [],
      boardRadius: 3,
      seatingPhase: {
        active: false,
        seatingOrder: [],
        seatingIndex: 0,
        availableEdges: [],
        edgeAssignments: new Map(),
      },
      players: [],
      teams: [],
      currentPlayerIndex: 0,
      board: new Map(),
      availableTiles: [], // Empty bag
      currentTile: null,
      flows: new Map(),
      flowEdges: new Map(),
      phase: 'setup',
      winners: [],
      winType: null,
      moveHistory: [],
      supermove: true,
      singleSupermove: false,
      supermoveInProgress: false,
      lastPlacedTilePosition: null,
    };

    const newState = gameReducer(state, { type: 'DRAW_TILE' });

    // Should return state unchanged
    expect(newState).toBe(state);
    expect(newState.phase).toBe('setup');
  });
});
