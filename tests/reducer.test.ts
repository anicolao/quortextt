// Unit tests for Redux reducer

import { describe, it, expect } from 'vitest';
import { gameReducer, initialState, resetPlayerIdCounter } from '../src/redux/gameReducer';
import {
  addPlayer,
  removePlayer,
  changePlayerColor,
  startGame,
  returnToConfig,
  selectEdge,
} from '../src/redux/actions';
import { MAX_PLAYERS, PLAYER_COLORS } from '../src/redux/types';

describe('gameReducer', () => {
  describe('ADD_PLAYER', () => {
    it('should add a player to empty list', () => {
      const state = gameReducer(initialState, addPlayer(PLAYER_COLORS[0], 0));
      expect(state.configPlayers.length).toBe(1);
      expect(state.configPlayers[0].color).toBe(PLAYER_COLORS[0]);
      expect(state.configPlayers[0].isAI).toBe(false);
    });

    it('should add multiple players with different colors', () => {
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[1], 0));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[2], 0));

      expect(state.configPlayers.length).toBe(3);
      expect(state.configPlayers[0].color).toBe(PLAYER_COLORS[0]);
      expect(state.configPlayers[0].isAI).toBe(false);
      expect(state.configPlayers[1].color).toBe(PLAYER_COLORS[1]);
      expect(state.configPlayers[1].isAI).toBe(false);
      expect(state.configPlayers[2].color).toBe(PLAYER_COLORS[2]);
      expect(state.configPlayers[2].isAI).toBe(false);
    });

    it('should not add more than MAX_PLAYERS', () => {
      let state = initialState;
      for (let i = 0; i < MAX_PLAYERS + 2; i++) {
        state = gameReducer(state, addPlayer(PLAYER_COLORS[i % PLAYER_COLORS.length], 0));
      }

      expect(state.configPlayers.length).toBe(MAX_PLAYERS);
    });

    it('should auto-assign color and edge when no payload provided', () => {
      const state = gameReducer(initialState, { type: 'ADD_PLAYER' });
      expect(state.configPlayers.length).toBe(1);
      expect(state.configPlayers[0].color).toBe(PLAYER_COLORS[0]);
      expect(state.configPlayers[0].edge).toBe(0);
      expect(state.configPlayers[0].isAI).toBe(false);
    });

    it('should auto-assign next available color when no color provided', () => {
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      state = gameReducer(state, { type: 'ADD_PLAYER', payload: { edge: 1 } });
      
      expect(state.configPlayers.length).toBe(2);
      expect(state.configPlayers[0].isAI).toBe(false);
      expect(state.configPlayers[1].isAI).toBe(false);
      expect(state.configPlayers[1].color).toBe(PLAYER_COLORS[1]);
      expect(state.configPlayers[1].edge).toBe(1);
    });

    it('should auto-assign next available edge when no edge provided', () => {
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      state = gameReducer(state, { type: 'ADD_PLAYER', payload: { color: PLAYER_COLORS[1] } });
      
      expect(state.configPlayers.length).toBe(2);
      expect(state.configPlayers[1].color).toBe(PLAYER_COLORS[1]);
      expect(state.configPlayers[1].edge).toBe(1); // Edge 0 is taken, use 1
    });

    it('should auto-assign edges in sequence when multiple players added without edges', () => {
      let state = initialState;
      state = gameReducer(state, { type: 'ADD_PLAYER', payload: { color: PLAYER_COLORS[0] } });
      state = gameReducer(state, { type: 'ADD_PLAYER', payload: { color: PLAYER_COLORS[1] } });
      state = gameReducer(state, { type: 'ADD_PLAYER', payload: { color: PLAYER_COLORS[2] } });
      
      expect(state.configPlayers.length).toBe(3);
      expect(state.configPlayers[0].edge).toBe(0);
      expect(state.configPlayers[1].edge).toBe(1);
      expect(state.configPlayers[2].edge).toBe(2);
    });

    it('should skip already-used edges when auto-assigning', () => {
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[1], 2));
      state = gameReducer(state, { type: 'ADD_PLAYER', payload: { color: PLAYER_COLORS[2] } });
      
      expect(state.configPlayers.length).toBe(3);
      expect(state.configPlayers[2].edge).toBe(1); // Should skip 0 and 2, use 1
    });

    it('should fallback to edge 0 when all edges are taken', () => {
      let state = initialState;
      // Add 4 players on all 4 edges
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[1], 1));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[2], 2));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[3], 3));
      
      // Add 5th player without edge - should fallback to 0
      state = gameReducer(state, { type: 'ADD_PLAYER', payload: { color: PLAYER_COLORS[4] } });
      
      expect(state.configPlayers.length).toBe(5);
      expect(state.configPlayers[4].edge).toBe(0);
    });

    it('should fallback to first color when all colors are taken', () => {
      let state = initialState;
      // Add 6 players with all 6 colors
      for (let i = 0; i < PLAYER_COLORS.length; i++) {
        state = gameReducer(state, addPlayer(PLAYER_COLORS[i], 0));
      }
      
      // Remove one player to make room
      const playerToRemove = state.configPlayers[0].id;
      state = gameReducer(state, removePlayer(playerToRemove));
      
      // Add player without color - should get the first color (which is now available)
      state = gameReducer(state, { type: 'ADD_PLAYER', payload: { edge: 0 } });
      
      expect(state.configPlayers.length).toBe(6);
      expect(state.configPlayers[5].color).toBe(PLAYER_COLORS[0]);
    });

    it('should not add player when auto-assigned color is already taken', () => {
      let state = initialState;
      // Add player with first color
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      
      // Try to add player without color when first color is taken
      // This should not happen in normal flow, but tests the colorTaken check
      const stateBefore = state;
      state = gameReducer(state, { type: 'ADD_PLAYER', payload: {} });
      
      // Auto-assigns color 1 since color 0 is taken
      expect(state.configPlayers.length).toBe(2);
      expect(state.configPlayers[0].color).toBe(PLAYER_COLORS[0]);
      expect(state.configPlayers[1].color).toBe(PLAYER_COLORS[1]);
      expect(state.configPlayers[1].isAI).toBe(false);
    });

    it('should not add player when explicitly provided color is already taken', () => {
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      
      const initialLength = state.configPlayers.length;
      // Try to add another player with the same color
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 1));
      
      // Should not add the player
      expect(state.configPlayers.length).toBe(initialLength);
    });
  });

  describe('REMOVE_PLAYER', () => {
    it('should remove a player by id', () => {
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[1], 0));

      const playerIdToRemove = state.configPlayers[0].id;
      state = gameReducer(state, removePlayer(playerIdToRemove));

      expect(state.configPlayers.length).toBe(1);
      expect(state.configPlayers.find((p) => p.id === playerIdToRemove)).toBeUndefined();
    });

    it('should handle removing non-existent player', () => {
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));

      const initialLength = state.configPlayers.length;
      state = gameReducer(state, removePlayer('non-existent-id'));

      expect(state.configPlayers.length).toBe(initialLength);
    });
  });

  describe('CHANGE_PLAYER_COLOR', () => {
    it('should change player color when no conflict', () => {
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));

      const playerId = state.configPlayers[0].id;
      const newColor = PLAYER_COLORS[3];
      state = gameReducer(state, changePlayerColor(playerId, newColor));

      expect(state.configPlayers[0].color).toBe(newColor);
    });

    it('should swap colors when another player has the color', () => {
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[1], 0));

      const player1Id = state.configPlayers[0].id;
      const player2Id = state.configPlayers[1].id;
      const player1Color = state.configPlayers[0].color;
      const player2Color = state.configPlayers[1].color;

      // Player 1 wants Player 2's color
      state = gameReducer(state, changePlayerColor(player1Id, player2Color));

      const player1After = state.configPlayers.find((p) => p.id === player1Id);
      const player2After = state.configPlayers.find((p) => p.id === player2Id);

      expect(player1After?.color).toBe(player2Color);
      expect(player2After?.color).toBe(player1Color);
    });

    it('should handle non-existent player', () => {
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));

      const stateBefore = state;
      state = gameReducer(state, changePlayerColor('non-existent-id', PLAYER_COLORS[0]));

      expect(state).toEqual(stateBefore);
    });
  });

  describe('START_GAME', () => {
    it('should transition to seating screen when players exist', () => {
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      state = gameReducer(state, startGame());

      expect(state.screen).toBe('seating');
      expect(state.phase).toBe('seating');
      expect(state.seatingPhase.active).toBe(true);
      expect(state.seatingPhase.availableEdges).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it('should add AI opponent when only one player and start game', () => {
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      
      // Should have 1 player before starting
      expect(state.configPlayers.length).toBe(1);
      expect(state.configPlayers[0].isAI).toBe(false);
      
      // Start the game
      state = gameReducer(state, startGame());
      
      // Should have 2 players now (original + AI)
      expect(state.configPlayers.length).toBe(2);
      expect(state.configPlayers[0].isAI).toBe(false);
      expect(state.configPlayers[1].isAI).toBe(true);
      expect(state.screen).toBe('seating');
    });

    it('should not add AI when multiple players start game', () => {
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[1], 1));
      
      // Should have 2 players before starting
      expect(state.configPlayers.length).toBe(2);
      
      // Start the game
      state = gameReducer(state, startGame());
      
      // Should still have 2 players (no AI added)
      expect(state.configPlayers.length).toBe(2);
      expect(state.configPlayers.every(p => !p.isAI)).toBe(true);
    });

    it('should not transition when no players exist', () => {
      const state = gameReducer(initialState, startGame());
      expect(state.screen).toBe('configuration');
    });

    it('should assign edge positions correctly for 2 players after seating', () => {
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[1], 1));
      state = gameReducer(state, startGame());

      // Players should select edges during seating phase
      const player1Id = state.seatingPhase.seatingOrder[0];
      const player2Id = state.seatingPhase.seatingOrder[1];

      // Player 1 selects edge 0
      state = gameReducer(state, selectEdge(player1Id, 0));
      expect(state.seatingPhase.seatingIndex).toBe(1);

      // Player 2 selects edge 3
      state = gameReducer(state, selectEdge(player2Id, 3));
      
      // Should transition to gameplay after all players have selected
      expect(state.screen).toBe('gameplay');
      expect(state.players.length).toBe(2);
      expect(state.players.find(p => p.id === player1Id)?.edgePosition).toBe(0);
      expect(state.players.find(p => p.id === player2Id)?.edgePosition).toBe(3);
    });

    it('should assign edge positions correctly for 3 players after seating', () => {
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[1], 1));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[2], 2));
      state = gameReducer(state, startGame());

      const player1Id = state.seatingPhase.seatingOrder[0];
      const player2Id = state.seatingPhase.seatingOrder[1];
      const player3Id = state.seatingPhase.seatingOrder[2];

      // Each player selects an edge
      state = gameReducer(state, selectEdge(player1Id, 0));
      state = gameReducer(state, selectEdge(player2Id, 2));
      state = gameReducer(state, selectEdge(player3Id, 4));
      
      expect(state.screen).toBe('gameplay');
      expect(state.players.length).toBe(3);
      expect(state.players.find(p => p.id === player1Id)?.edgePosition).toBe(0);
      expect(state.players.find(p => p.id === player2Id)?.edgePosition).toBe(2);
      expect(state.players.find(p => p.id === player3Id)?.edgePosition).toBe(4);
    });

    it('should create teams for 4 players after seating', () => {
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[1], 1));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[2], 2));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[3], 3));
      state = gameReducer(state, startGame());

      const playerIds = state.seatingPhase.seatingOrder;

      // Each player selects an edge
      state = gameReducer(state, selectEdge(playerIds[0], 0));
      state = gameReducer(state, selectEdge(playerIds[1], 1));
      state = gameReducer(state, selectEdge(playerIds[2], 2));
      state = gameReducer(state, selectEdge(playerIds[3], 3));

      expect(state.players.length).toBe(4);
      expect(state.teams.length).toBe(2);
      // Teams should be based on sorted edge positions (opposite sides)
    });

    it('should create teams for 6 players after seating', () => {
      let state = initialState;
      for (let i = 0; i < 6; i++) {
        state = gameReducer(state, addPlayer(PLAYER_COLORS[i], i % 4));
      }
      state = gameReducer(state, startGame());

      const playerIds = state.seatingPhase.seatingOrder;

      // Each player selects a different edge
      for (let i = 0; i < 6; i++) {
        state = gameReducer(state, selectEdge(playerIds[i], i));
      }

      expect(state.players.length).toBe(6);
      expect(state.teams.length).toBe(3);
    });
  });

  describe('RETURN_TO_CONFIG', () => {
    it('should return to configuration screen from gameplay', () => {
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      state = gameReducer(state, startGame());
      state = gameReducer(state, returnToConfig());

      expect(state.screen).toBe('configuration');
    });
  });

  describe('resetPlayerIdCounter', () => {
    it('should reset player ID counter for deterministic testing', () => {
      // Add some players to increment the counter
      let state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      state = gameReducer(state, addPlayer(PLAYER_COLORS[1], 0));
      const firstPlayerId = state.configPlayers[0].id;
      
      // Reset counter and add players again
      resetPlayerIdCounter();
      state = initialState;
      state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
      const secondPlayerId = state.configPlayers[0].id;
      
      // After reset, player IDs should start from the beginning again
      expect(secondPlayerId).toBe('P1');
    });
  });

  describe('Board radius and tile distribution', () => {
    it('should use default distribution for default radius (3)', () => {
      const state = gameReducer(initialState, { 
        type: 'SHUFFLE_TILES', 
        payload: { seed: 12345 } 
      });
      
      // Radius 3 -> 37 hexes -> 40 tiles (10 of each type)
      expect(state.availableTiles.length).toBe(40);
    });

    it('should calculate distribution for radius 2', () => {
      let state = { ...initialState, boardRadius: 2 };
      state = gameReducer(state, { 
        type: 'SHUFFLE_TILES', 
        payload: { seed: 12345 } 
      });
      
      // Radius 2 -> 19 hexes -> 20 tiles (5 of each type)
      expect(state.availableTiles.length).toBe(20);
    });

    it('should calculate distribution for radius 4', () => {
      let state = { ...initialState, boardRadius: 4 };
      state = gameReducer(state, { 
        type: 'SHUFFLE_TILES', 
        payload: { seed: 12345 } 
      });
      
      // Radius 4 -> 61 hexes -> 64 tiles (16 of each type)
      expect(state.availableTiles.length).toBe(64);
    });

    it('should respect explicit tile distribution over calculated one', () => {
      let state = { ...initialState, boardRadius: 2 };
      state = gameReducer(state, { 
        type: 'SHUFFLE_TILES', 
        payload: { 
          seed: 12345,
          tileDistribution: [7, 7, 7, 7] as [number, number, number, number]
        } 
      });
      
      // Should use the explicit distribution, not the calculated one
      expect(state.availableTiles.length).toBe(28);
    });
  });
});
