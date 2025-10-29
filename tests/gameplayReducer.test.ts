// Unit tests for gameplay Redux actions and reducer

import { describe, it, expect } from 'vitest';
import { gameReducer, initialState } from '../src/redux/gameReducer';
import {
  setupGame,
  shuffleTiles,
  drawTile,
  placeTile,
  nextPlayer,
  endGame,
  resetGame,
} from '../src/redux/actions';
import { TileType } from '../src/game/types';
import { GameState } from '../src/redux/types';

describe('gameReducer - Gameplay Actions', () => {
  describe('SETUP_GAME', () => {
    it('should initialize game with players and teams', () => {
      const players = [
        { id: 'p1', color: '#0173B2', edgePosition: 0, isAI: false },
        { id: 'p2', color: '#DE8F05', edgePosition: 3, isAI: false },
      ];
      const teams = [];

      const state = gameReducer(initialState, setupGame(players, teams));

      expect(state.players).toEqual(players);
      expect(state.teams).toEqual(teams);
      expect(state.currentPlayerIndex).toBe(0);
      expect(state.phase).toBe('playing');
      expect(state.board.size).toBe(0);
      expect(state.winner).toBeNull();
    });

    it('should reset game state when setting up', () => {
      let state: GameState = {
        ...initialState,
        moveHistory: [
          {
            playerId: 'p1',
            tile: { type: TileType.NoSharps, rotation: 0, position: { row: 0, col: 0 } },
            timestamp: Date.now(),
          },
        ],
      };

      const players = [
        { id: 'p1', color: '#0173B2', edgePosition: 0, isAI: false },
      ];

      state = gameReducer(state, setupGame(players, []));

      expect(state.moveHistory.length).toBe(0);
      expect(state.board.size).toBe(0);
      expect(state.currentTile).toBeNull();
    });
  });

  describe('SHUFFLE_TILES', () => {
    it('should create a deck of tiles', () => {
      const state = gameReducer(initialState, shuffleTiles());

      expect(state.availableTiles.length).toBe(40); // 10 + 10 + 10 + 10
      expect(state.availableTiles.every((t) => t >= 0 && t <= 3)).toBe(true);
    });

    it('should create same deck with same seed', () => {
      const seed = 12345;
      const state1 = gameReducer(initialState, shuffleTiles(seed));
      const state2 = gameReducer(initialState, shuffleTiles(seed));

      expect(state1.availableTiles).toEqual(state2.availableTiles);
    });

    it('should create different decks with different seeds', () => {
      const state1 = gameReducer(initialState, shuffleTiles(12345));
      const state2 = gameReducer(initialState, shuffleTiles(54321));

      expect(state1.availableTiles).not.toEqual(state2.availableTiles);
    });

    it('should have correct tile distribution', () => {
      const state = gameReducer(initialState, shuffleTiles());

      const counts = state.availableTiles.reduce(
        (acc, tile) => {
          acc[tile]++;
          return acc;
        },
        [0, 0, 0, 0]
      );

      expect(counts[TileType.NoSharps]).toBe(10);
      expect(counts[TileType.OneSharp]).toBe(10);
      expect(counts[TileType.TwoSharps]).toBe(10);
      expect(counts[TileType.ThreeSharps]).toBe(10);
    });
  });

  describe('DRAW_TILE', () => {
    it('should draw a tile from the deck', () => {
      let state = gameReducer(initialState, shuffleTiles(123));
      const firstTile = state.availableTiles[0];
      const remainingCount = state.availableTiles.length;

      state = gameReducer(state, drawTile());

      expect(state.currentTile).toBe(firstTile);
      expect(state.availableTiles.length).toBe(remainingCount - 1);
    });

    it('should not draw when deck is empty', () => {
      const state = gameReducer(initialState, drawTile());

      expect(state.currentTile).toBeNull();
      expect(state.availableTiles.length).toBe(0);
    });

    it('should draw tiles in order', () => {
      let state = gameReducer(initialState, shuffleTiles(456));
      const expectedOrder = [...state.availableTiles];

      const drawnTiles: TileType[] = [];
      for (let i = 0; i < 5; i++) {
        state = gameReducer(state, drawTile());
        if (state.currentTile !== null) {
          drawnTiles.push(state.currentTile);
        }
      }

      expect(drawnTiles).toEqual(expectedOrder.slice(0, 5));
    });
  });

  describe('PLACE_TILE', () => {
    it('should place a tile on the board', () => {
      let state = gameReducer(initialState, shuffleTiles(789));
      state = gameReducer(state, drawTile());
      
      const players = [
        { id: 'p1', color: '#0173B2', edgePosition: 0, isAI: false },
        { id: 'p2', color: '#DE8F05', edgePosition: 3, isAI: false },
      ];
      state = gameReducer(state, setupGame(players, []));
      state = gameReducer(state, shuffleTiles(789));
      state = gameReducer(state, drawTile());

      const position = { row: 0, col: 0 };
      const rotation = 0;
      const tileBefore = state.currentTile;

      state = gameReducer(state, placeTile(position, rotation));

      expect(state.board.size).toBe(1);
      expect(state.board.get('0,0')).toEqual({
        type: tileBefore,
        rotation,
        position,
      });
      expect(state.currentTile).toBeNull();
    });

    it('should not place tile if no current tile', () => {
      const state = gameReducer(initialState, placeTile({ row: 0, col: 0 }, 0));

      expect(state.board.size).toBe(0);
    });

    it('should not place tile on occupied position', () => {
      let state = gameReducer(initialState, shuffleTiles(111));
      const players = [
        { id: 'p1', color: '#0173B2', edgePosition: 0, isAI: false },
        { id: 'p2', color: '#DE8F05', edgePosition: 3, isAI: false },
      ];
      state = gameReducer(state, setupGame(players, []));
      state = gameReducer(state, shuffleTiles(111));
      
      // Place first tile
      state = gameReducer(state, drawTile());
      const position = { row: 0, col: 0 };
      state = gameReducer(state, placeTile(position, 0));

      // Try to place second tile on same position
      state = gameReducer(state, drawTile());
      const currentTile = state.currentTile;
      state = gameReducer(state, placeTile(position, 0));

      // Should still have the tile in hand
      expect(state.currentTile).toBe(currentTile);
      expect(state.board.size).toBe(1);
    });

    it('should add move to history', () => {
      let state = gameReducer(initialState, shuffleTiles(222));
      const players = [
        { id: 'p1', color: '#0173B2', edgePosition: 0, isAI: false },
      ];
      state = gameReducer(state, setupGame(players, []));
      state = gameReducer(state, shuffleTiles(222));
      state = gameReducer(state, drawTile());

      expect(state.moveHistory.length).toBe(0);

      state = gameReducer(state, placeTile({ row: 0, col: 0 }, 0));

      expect(state.moveHistory.length).toBe(1);
      expect(state.moveHistory[0].playerId).toBe('p1');
    });
  });

  describe('NEXT_PLAYER', () => {
    it('should advance to next player', () => {
      let state = gameReducer(initialState, setupGame([
        { id: 'p1', color: '#0173B2', edgePosition: 0, isAI: false },
        { id: 'p2', color: '#DE8F05', edgePosition: 3, isAI: false },
      ], []));

      expect(state.currentPlayerIndex).toBe(0);

      state = gameReducer(state, nextPlayer());
      expect(state.currentPlayerIndex).toBe(1);

      state = gameReducer(state, nextPlayer());
      expect(state.currentPlayerIndex).toBe(0); // Wraps around
    });

    it('should handle single player', () => {
      let state = gameReducer(initialState, setupGame([
        { id: 'p1', color: '#0173B2', edgePosition: 0, isAI: false },
      ], []));

      state = gameReducer(state, nextPlayer());
      expect(state.currentPlayerIndex).toBe(0);
    });
  });

  describe('END_GAME', () => {
    it('should set winner and end game', () => {
      const state = gameReducer(initialState, endGame('p1', 'flow'));

      expect(state.phase).toBe('finished');
      expect(state.winner).toBe('p1');
      expect(state.winType).toBe('flow');
      expect(state.screen).toBe('game-over');
    });

    it('should support different win types', () => {
      const state1 = gameReducer(initialState, endGame('p1', 'constraint'));
      expect(state1.winType).toBe('constraint');

      const state2 = gameReducer(initialState, endGame('p2', 'tie'));
      expect(state2.winType).toBe('tie');
    });
  });

  describe('RESET_GAME', () => {
    it('should reset to initial state', () => {
      let state = gameReducer(initialState, setupGame([
        { id: 'p1', color: '#0173B2', edgePosition: 0, isAI: false },
      ], []));
      state = gameReducer(state, shuffleTiles(123));
      state = gameReducer(state, drawTile());
      state = gameReducer(state, placeTile({ row: 0, col: 0 }, 0));

      state = gameReducer(state, resetGame());

      expect(state.screen).toBe('configuration');
      expect(state.players.length).toBe(0);
      expect(state.board.size).toBe(0);
      expect(state.currentTile).toBeNull();
      expect(state.phase).toBe('setup');
    });
  });
});
