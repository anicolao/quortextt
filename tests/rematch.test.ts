// Tests for rematch functionality

import { describe, it, expect, beforeEach } from 'vitest';
import { gameReducer, resetPlayerIdCounter } from '../src/redux/gameReducer';
import { GameState } from '../src/redux/types';
import {
  addPlayer,
  startGame,
  selectEdge,
  rematchGame,
} from '../src/redux/actions';

describe('Rematch Functionality', () => {
  beforeEach(() => {
    resetPlayerIdCounter();
  });

  it('should restart the game with the same players and seats after rematch', () => {
    // Start with initial state
    let state = gameReducer(undefined, { type: '@@INIT' } as any);

    // Add two players
    state = gameReducer(state, addPlayer('#0173B2', 0));
    state = gameReducer(state, addPlayer('#DE8F05', 1));

    expect(state.configPlayers).toHaveLength(2);
    const player1Id = state.configPlayers[0].id;
    const player2Id = state.configPlayers[1].id;

    // Start the game
    state = gameReducer(state, startGame());
    expect(state.screen).toBe('seating');
    expect(state.phase).toBe('seating');

    // Complete seating phase - each player selects their edge
    const seatingOrder = state.seatingPhase.seatingOrder;
    state = gameReducer(state, selectEdge(seatingOrder[0], 0));
    state = gameReducer(state, selectEdge(seatingOrder[1], 3));

    // Should now be in gameplay
    expect(state.screen).toBe('gameplay');
    expect(state.phase).toBe('playing');

    // Remember the player states
    const originalPlayers = state.players;
    const originalTeams = state.teams;
    const originalEdgeAssignments = new Map(state.seatingPhase.edgeAssignments);

    // Verify players have their edge positions assigned
    expect(originalPlayers[0].edgePosition).toBeDefined();
    expect(originalPlayers[1].edgePosition).toBeDefined();

    // Trigger rematch
    state = gameReducer(state, rematchGame());

    // Should be back in gameplay (not seating, not config)
    expect(state.screen).toBe('gameplay');
    expect(state.phase).toBe('playing');

    // Should have same players with same IDs
    expect(state.players).toHaveLength(2);
    const playerIds = state.players.map((p) => p.id).sort();
    expect(playerIds).toEqual([player1Id, player2Id].sort());

    // Should have same edge positions as before
    const player1New = state.players.find((p) => p.id === player1Id);
    const player2New = state.players.find((p) => p.id === player2Id);
    const player1Old = originalPlayers.find((p) => p.id === player1Id);
    const player2Old = originalPlayers.find((p) => p.id === player2Id);

    expect(player1New?.edgePosition).toBe(player1Old?.edgePosition);
    expect(player2New?.edgePosition).toBe(player2Old?.edgePosition);

    // Should have same teams
    expect(state.teams).toEqual(originalTeams);

    // Board should be reset
    expect(state.board.size).toBe(0);
    expect(state.moveHistory).toHaveLength(0);
    expect(state.winners).toHaveLength(0);
    expect(state.winType).toBeNull();

    // Should have a new tile shuffle
    expect(state.availableTiles.length).toBeGreaterThan(0);
    expect(state.currentTile).not.toBeNull();

    // Edge assignments should be preserved
    expect(state.seatingPhase.edgeAssignments).toEqual(originalEdgeAssignments);
  });

  it('should randomize the starting player order on rematch', () => {
    // Start with initial state
    let state = gameReducer(undefined, { type: '@@INIT' } as any);

    // Add three players
    state = gameReducer(state, addPlayer('#0173B2', 0));
    state = gameReducer(state, addPlayer('#DE8F05', 1));
    state = gameReducer(state, addPlayer('#029E73', 2));

    // Start the game
    state = gameReducer(state, startGame());

    // Complete seating phase
    const seatingOrder = state.seatingPhase.seatingOrder;
    state = gameReducer(state, selectEdge(seatingOrder[0], 0));
    state = gameReducer(state, selectEdge(seatingOrder[1], 2));
    state = gameReducer(state, selectEdge(seatingOrder[2], 4));

    // Remember the first player
    const firstPlayerId = state.players[0].id;

    // Trigger rematch
    state = gameReducer(state, rematchGame());

    // The seating order should be randomized, so it may be different
    // We can't test randomness directly, but we can verify:
    // - All players are still present
    // - The seating order is a valid permutation
    expect(state.seatingPhase.seatingOrder).toHaveLength(3);
    expect(state.players).toHaveLength(3);

    // Players should still be ordered, just potentially starting from a different player
    const playerIds = state.players.map((p) => p.id);
    expect(new Set(playerIds).size).toBe(3); // All unique
  });

  it('should clear game state but preserve player configuration on rematch', () => {
    // Start with initial state
    let state = gameReducer(undefined, { type: '@@INIT' } as any);

    // Add two players
    state = gameReducer(state, addPlayer('#0173B2', 0));
    state = gameReducer(state, addPlayer('#DE8F05', 1));

    // Start the game
    state = gameReducer(state, startGame());

    // Complete seating
    const seatingOrder = state.seatingPhase.seatingOrder;
    state = gameReducer(state, selectEdge(seatingOrder[0], 0));
    state = gameReducer(state, selectEdge(seatingOrder[1], 3));

    // Simulate some game state (would normally come from placing tiles)
    const stateWithGameHistory: GameState = {
      ...state,
      winners: [seatingOrder[0]],
      winType: 'flow',
      moveHistory: [
        {
          playerId: seatingOrder[0],
          tile: {
            type: 'OneSharp' as any,
            position: { row: 0, col: 0 },
            rotation: 0,
            playerId: seatingOrder[0],
          },
          timestamp: Date.now(),
        },
      ],
    };

    // Trigger rematch
    state = gameReducer(stateWithGameHistory, rematchGame());

    // Game state should be cleared
    expect(state.winners).toHaveLength(0);
    expect(state.winType).toBeNull();
    expect(state.moveHistory).toHaveLength(0);
    expect(state.board.size).toBe(0);
    expect(state.flows.size).toBe(0);
    expect(state.supermoveInProgress).toBe(false);
    expect(state.lastPlacedTilePosition).toBeNull();

    // But players and teams should remain
    expect(state.players).toHaveLength(2);
    expect(state.currentPlayerIndex).toBe(0);
  });

  it('should work with team games (4 players)', () => {
    // Start with initial state
    let state = gameReducer(undefined, { type: '@@INIT' } as any);

    // Add four players
    state = gameReducer(state, addPlayer('#0173B2', 0));
    state = gameReducer(state, addPlayer('#DE8F05', 1));
    state = gameReducer(state, addPlayer('#029E73', 2));
    state = gameReducer(state, addPlayer('#ECE133', 3));

    // Start the game
    state = gameReducer(state, startGame());

    // Complete seating
    const seatingOrder = state.seatingPhase.seatingOrder;
    state = gameReducer(state, selectEdge(seatingOrder[0], 0));
    state = gameReducer(state, selectEdge(seatingOrder[1], 1));
    state = gameReducer(state, selectEdge(seatingOrder[2], 3));
    state = gameReducer(state, selectEdge(seatingOrder[3], 4));

    // Should have teams
    expect(state.teams).toHaveLength(2);
    const originalTeams = state.teams;

    // Trigger rematch
    state = gameReducer(state, rematchGame());

    // Should still have teams
    expect(state.teams).toHaveLength(2);
    expect(state.teams).toEqual(originalTeams);

    // All 4 players should still be present
    expect(state.players).toHaveLength(4);
  });
});
