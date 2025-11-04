// Unit tests for seating phase functionality

import { describe, it, expect } from 'vitest';
import { gameReducer, initialState } from '../src/redux/gameReducer';
import { addPlayer, startGame, selectEdge, startSeatingPhase, completeSeatingPhase, drawTile } from '../src/redux/actions';
import { PLAYER_COLORS } from '../src/redux/types';

describe('Seating Phase', () => {
  describe('Player Order Randomization', () => {
    it('should randomize player order when starting game', () => {
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[1], 1));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[2], 2));
      state = gameReducer(state, startGame());

      // Verify all players are in the seating order
      expect(state.seatingPhase.seatingOrder.length).toBe(3);
      
      // Get player IDs
      const playerIds = state.configPlayers.map(p => p.id);
      
      // Each player should be in the seating order exactly once
      for (const playerId of playerIds) {
        expect(state.seatingPhase.seatingOrder.filter(id => id === playerId).length).toBe(1);
      }
    });

    it('should produce different orders across multiple runs (probabilistic)', () => {
      // This test is probabilistic - with 3 players, there are 3! = 6 possible orders
      // The chance of getting the same order twice in a row is 1/6 ≈ 16.7%
      // Getting the same order 5 times in a row would be (1/6)^5 ≈ 0.01%
      
      const orders: string[] = [];
      
      for (let i = 0; i < 5; i++) {
        let state = initialState;
        state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
        state = gameReducer(state, addPlayer(PLAYER_COLORS[1], 1));
        state = gameReducer(state, addPlayer(PLAYER_COLORS[2], 2));
        state = gameReducer(state, startGame());
        
        orders.push(state.seatingPhase.seatingOrder.join(','));
      }
      
      // At least one order should be different from the first
      const uniqueOrders = new Set(orders);
      expect(uniqueOrders.size).toBeGreaterThan(1);
    });
  });

  describe('Edge Selection Validation', () => {
    it('should allow valid edge selection for current player', () => {
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[1], 1));
      state = gameReducer(state, startGame());

      const currentPlayerId = state.seatingPhase.seatingOrder[0];
      
      state = gameReducer(state, selectEdge(currentPlayerId, 2));

      expect(state.seatingPhase.seatingIndex).toBe(1);
      expect(state.seatingPhase.edgeAssignments.get(currentPlayerId)).toBe(2);
      expect(state.seatingPhase.availableEdges).not.toContain(2);
    });

    it('should reject edge selection from non-current player', () => {
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[1], 1));
      state = gameReducer(state, startGame());

      const wrongPlayerId = state.seatingPhase.seatingOrder[1]; // Not current player
      const stateBefore = state;
      
      state = gameReducer(state, selectEdge(wrongPlayerId, 2));

      // State should not change
      expect(state.seatingPhase.seatingIndex).toBe(stateBefore.seatingPhase.seatingIndex);
      expect(state.seatingPhase.edgeAssignments.size).toBe(0);
    });

    it('should reject selection of already-taken edge', () => {
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[1], 1));
      state = gameReducer(state, startGame());

      const player1Id = state.seatingPhase.seatingOrder[0];
      const player2Id = state.seatingPhase.seatingOrder[1];
      
      // Player 1 selects edge 2
      state = gameReducer(state, selectEdge(player1Id, 2));
      
      const stateBefore = state;
      
      // Player 2 tries to select the same edge
      state = gameReducer(state, selectEdge(player2Id, 2));

      // State should not change (edge 2 is not available)
      expect(state.seatingPhase.seatingIndex).toBe(stateBefore.seatingPhase.seatingIndex);
      expect(state.seatingPhase.edgeAssignments.size).toBe(1);
    });

    it('should progress seating index after valid selection', () => {
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[1], 1));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[2], 2));
      state = gameReducer(state, startGame());

      expect(state.seatingPhase.seatingIndex).toBe(0);
      
      const player1Id = state.seatingPhase.seatingOrder[0];
      state = gameReducer(state, selectEdge(player1Id, 0));
      expect(state.seatingPhase.seatingIndex).toBe(1);
      
      const player2Id = state.seatingPhase.seatingOrder[1];
      state = gameReducer(state, selectEdge(player2Id, 1));
      expect(state.seatingPhase.seatingIndex).toBe(2);
      
      const player3Id = state.seatingPhase.seatingOrder[2];
      state = gameReducer(state, selectEdge(player3Id, 2));
      expect(state.seatingPhase.seatingIndex).toBe(3);
    });
  });

  describe('Gameplay Order Determination', () => {
    it('should order players clockwise by edge position', () => {
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[1], 1));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[2], 2));
      state = gameReducer(state, startGame());

      const player1Id = state.seatingPhase.seatingOrder[0];
      const player2Id = state.seatingPhase.seatingOrder[1];
      const player3Id = state.seatingPhase.seatingOrder[2];

      // Players select edges out of order
      state = gameReducer(state, selectEdge(player1Id, 5)); // Last edge
      state = gameReducer(state, selectEdge(player2Id, 1)); // Middle edge
      state = gameReducer(state, selectEdge(player3Id, 3)); // Another edge

      // After seating completes, should transition to gameplay
      expect(state.screen).toBe('gameplay');
      expect(state.players.length).toBe(3);

      // Players should be ordered by edge position: 1, 3, 5
      // Starting player should be player1Id (first in seating order)
      const player1 = state.players.find(p => p.id === player1Id);
      const player2 = state.players.find(p => p.id === player2Id);
      const player3 = state.players.find(p => p.id === player3Id);

      expect(player1?.edgePosition).toBe(5);
      expect(player2?.edgePosition).toBe(1);
      expect(player3?.edgePosition).toBe(3);

      // First current player should be player1Id (first in seating order)
      expect(state.players[state.currentPlayerIndex].id).toBe(player1Id);
    });

    it('should start gameplay with first player from seating order', () => {
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[1], 1));
      state = gameReducer(state, startGame());

      const player1Id = state.seatingPhase.seatingOrder[0];
      const player2Id = state.seatingPhase.seatingOrder[1];

      // Players select edges
      state = gameReducer(state, selectEdge(player1Id, 3));
      state = gameReducer(state, selectEdge(player2Id, 0));

      // Current player should be player1Id (first in seating order)
      // even though player2 has the lower edge position
      expect(state.players[state.currentPlayerIndex].id).toBe(player1Id);
    });
  });

  describe('Phase Transitions', () => {
    it('should transition from configuration to seating', () => {
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      
      expect(state.screen).toBe('configuration');
      
      state = gameReducer(state, startGame());
      
      expect(state.screen).toBe('seating');
      expect(state.phase).toBe('seating');
      expect(state.seatingPhase.active).toBe(true);
    });

    it('should transition from seating to gameplay after all selections', () => {
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[1], 1));
      state = gameReducer(state, startGame());

      expect(state.screen).toBe('seating');

      const player1Id = state.seatingPhase.seatingOrder[0];
      const player2Id = state.seatingPhase.seatingOrder[1];

      state = gameReducer(state, selectEdge(player1Id, 0));
      expect(state.screen).toBe('seating'); // Still in seating

      state = gameReducer(state, selectEdge(player2Id, 3));
      expect(state.screen).toBe('gameplay'); // Now in gameplay
      expect(state.phase).toBe('playing');
      expect(state.seatingPhase.active).toBe(false);
    });

    it('should initialize game state correctly after seating', () => {
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[1], 1));
      state = gameReducer(state, startGame());

      const player1Id = state.seatingPhase.seatingOrder[0];
      const player2Id = state.seatingPhase.seatingOrder[1];

      state = gameReducer(state, selectEdge(player1Id, 0));
      state = gameReducer(state, selectEdge(player2Id, 3));

      // Check game is properly initialized
      expect(state.board.size).toBe(0);
      expect(state.availableTiles.length).toBeGreaterThan(0);
      expect(state.currentTile).not.toBeNull();
      expect(state.flows.size).toBe(0);
      expect(state.moveHistory.length).toBe(0);
    });
  });

  describe('Team Creation', () => {
    it('should create teams for 4 players based on edge positions', () => {
      let state = initialState;
      for (let i = 0; i < 4; i++) {
        state = gameReducer(state, addPlayer(PLAYER_COLORS[i], i));
      }
      state = gameReducer(state, startGame());

      const playerIds = state.seatingPhase.seatingOrder;

      // Players select edges
      state = gameReducer(state, selectEdge(playerIds[0], 0));
      state = gameReducer(state, selectEdge(playerIds[1], 1));
      state = gameReducer(state, selectEdge(playerIds[2], 2));
      state = gameReducer(state, selectEdge(playerIds[3], 3));

      expect(state.teams.length).toBe(2);
      
      // Teams should be opposite sides (edges 0,2 and edges 1,3)
      const sortedPlayers = [...state.players].sort((a, b) => a.edgePosition - b.edgePosition);
      expect(state.teams[0]).toEqual({
        player1Id: sortedPlayers[0].id,
        player2Id: sortedPlayers[2].id,
      });
      expect(state.teams[1]).toEqual({
        player1Id: sortedPlayers[1].id,
        player2Id: sortedPlayers[3].id,
      });
    });

    it('should create teams for 6 players based on edge positions', () => {
      let state = initialState;
      for (let i = 0; i < 6; i++) {
        state = gameReducer(state, addPlayer(PLAYER_COLORS[i], i % 4));
      }
      state = gameReducer(state, startGame());

      const playerIds = state.seatingPhase.seatingOrder;

      // Players select all edges
      for (let i = 0; i < 6; i++) {
        state = gameReducer(state, selectEdge(playerIds[i], i));
      }

      expect(state.teams.length).toBe(3);
      
      // Teams should be opposite sides (edges 0,3), (1,4), (2,5)
      const sortedPlayers = [...state.players].sort((a, b) => a.edgePosition - b.edgePosition);
      expect(state.teams[0]).toEqual({
        player1Id: sortedPlayers[0].id,
        player2Id: sortedPlayers[3].id,
      });
      expect(state.teams[1]).toEqual({
        player1Id: sortedPlayers[1].id,
        player2Id: sortedPlayers[4].id,
      });
      expect(state.teams[2]).toEqual({
        player1Id: sortedPlayers[2].id,
        player2Id: sortedPlayers[5].id,
      });
    });

    it('should not create teams for 2 or 3 players', () => {
      // Test with 2 players
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[1], 1));
      state = gameReducer(state, startGame());

      const player1Id = state.seatingPhase.seatingOrder[0];
      const player2Id = state.seatingPhase.seatingOrder[1];

      state = gameReducer(state, selectEdge(player1Id, 0));
      state = gameReducer(state, selectEdge(player2Id, 3));

      expect(state.teams.length).toBe(0);

      // Test with 3 players
      state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[1], 1));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[2], 2));
      state = gameReducer(state, startGame());

      const p1Id = state.seatingPhase.seatingOrder[0];
      const p2Id = state.seatingPhase.seatingOrder[1];
      const p3Id = state.seatingPhase.seatingOrder[2];

      state = gameReducer(state, selectEdge(p1Id, 0));
      state = gameReducer(state, selectEdge(p2Id, 2));
      state = gameReducer(state, selectEdge(p3Id, 4));

      expect(state.teams.length).toBe(0);
    });
  });

  describe('Available Edges', () => {
    it('should start with all 6 edges available', () => {
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      state = gameReducer(state, startGame());

      expect(state.seatingPhase.availableEdges).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it('should remove selected edges from available list', () => {
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[1], 1));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[2], 2));
      state = gameReducer(state, startGame());

      const player1Id = state.seatingPhase.seatingOrder[0];
      const player2Id = state.seatingPhase.seatingOrder[1];
      const player3Id = state.seatingPhase.seatingOrder[2];

      state = gameReducer(state, selectEdge(player1Id, 1));
      expect(state.seatingPhase.availableEdges).toEqual([0, 2, 3, 4, 5]);

      state = gameReducer(state, selectEdge(player2Id, 4));
      expect(state.seatingPhase.availableEdges).toEqual([0, 2, 3, 5]);

      state = gameReducer(state, selectEdge(player3Id, 0));
      expect(state.seatingPhase.availableEdges).toEqual([2, 3, 5]);
    });

    it('should handle selectEdge for unavailable edge', () => {
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[1], 1));
      state = gameReducer(state, startGame());

      const player1Id = state.seatingPhase.seatingOrder[0];
      
      // First player selects edge 1
      state = gameReducer(state, selectEdge(player1Id, 1));
      expect(state.seatingPhase.availableEdges).not.toContain(1);

      const player2Id = state.seatingPhase.seatingOrder[1];
      const prevState = { ...state };
      
      // Try to select the same edge that's already taken
      state = gameReducer(state, selectEdge(player2Id, 1));
      
      // State should not change (edge is unavailable)
      expect(state).toEqual(prevState);
    });

    it('should handle selectEdge when configPlayer is not found', () => {
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[1], 1));
      
      // Manually create seating phase with a player that's not in configPlayers
      // This is an edge case that shouldn't happen in normal operation
      state = {
        ...state,
        seatingPhase: {
          active: true,
          seatingOrder: ['non-existent-player'],
          seatingIndex: 0,
          availableEdges: [0, 1, 2, 3, 4, 5],
          edgeAssignments: new Map(),
        },
        phase: 'seating',
      };

      const prevState = { ...state };
      
      // Try to select edge for player not in configPlayers
      state = gameReducer(state, selectEdge('non-existent-player', 0));
      
      // State should not change
      expect(state).toEqual(prevState);
    });
  });

  describe('Action creators', () => {
    it('should create startSeatingPhase action', () => {
      const action = startSeatingPhase(['p1', 'p2', 'p3']);
      
      expect(action.type).toBe('START_SEATING_PHASE');
      expect(action.payload.seatingOrder).toEqual(['p1', 'p2', 'p3']);
    });

    it('should create completeSeatingPhase action', () => {
      const action = completeSeatingPhase();
      
      expect(action.type).toBe('COMPLETE_SEATING_PHASE');
    });

    it('should handle START_SEATING_PHASE reducer action', () => {
      let state = initialState;
      const seatingOrder = ['p1', 'p2', 'p3'];
      
      state = gameReducer(state, startSeatingPhase(seatingOrder));
      
      expect(state.screen).toBe('seating');
      expect(state.phase).toBe('seating');
      expect(state.seatingPhase.active).toBe(true);
      expect(state.seatingPhase.seatingOrder).toEqual(seatingOrder);
      expect(state.seatingPhase.seatingIndex).toBe(0);
      expect(state.seatingPhase.availableEdges).toEqual([0, 1, 2, 3, 4, 5]);
    });
  });

  describe('Reducer edge cases', () => {
    it('should handle COMPLETE_SEATING_PHASE action', () => {
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[1], 1));
      state = gameReducer(state, startGame());

      const prevState = { ...state };
      
      // Complete seating phase
      state = gameReducer(state, completeSeatingPhase());
      
      // For now, this action doesn't change state
      expect(state).toEqual(prevState);
    });

    it('should handle DRAW_TILE with empty deck', () => {
      let state = initialState;
      state = {
        ...state,
        availableTiles: [], // Empty deck
      };

      const prevState = { ...state };
      
      // Try to draw tile from empty deck
      state = gameReducer(state, drawTile());
      
      // State should not change
      expect(state).toEqual(prevState);
    });
  });
});
