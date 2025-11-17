// Tests for player authorization when placing tiles in multiplayer mode

import { describe, it, expect } from 'vitest';
import { gameReducer } from '../src/redux/gameReducer';
import { initialState as gameInitialState } from '../src/redux/gameReducer';
import { GameState } from '../src/redux/types';
import { TileType } from '../src/game/types';
import { PlaceTileAction, ReplaceTileAction, PLACE_TILE, REPLACE_TILE } from '../src/redux/actions';

describe('Player Authorization', () => {
  describe('PLACE_TILE authorization', () => {
    it('should allow tile placement when playerId matches current player userId (multiplayer)', () => {
      // Create a game state with two players having userIds
      const state: GameState = {
        ...gameInitialState,
        phase: 'playing',
        players: [
          { id: 'P1', color: '#0173B2', edgePosition: 0, isAI: false, userId: 'google:123' },
          { id: 'P2', color: '#DE8F05', edgePosition: 3, isAI: false, userId: 'google:456' },
        ],
        currentPlayerIndex: 0, // P1 is current
        currentTile: TileType.NoSharps,
        board: new Map(),
        availableTiles: [],
        flows: new Map(),
        flowEdges: new Map(),
        teams: [],
        winners: [],
        winType: null,
        moveHistory: [],
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
        supermove: false,
        singleSupermove: false,
        supermoveAnyPlayer: false,
        supermoveInProgress: false,
        lastPlacedTilePosition: null,
      };

      const action: PlaceTileAction = {
        type: PLACE_TILE,
        payload: { position: { row: 0, col: 0 }, rotation: 0 },
        playerId: 'google:123', // Matches P1's userId
      };

      const newState = gameReducer(state, action);

      // Should successfully place the tile
      expect(newState.board.size).toBe(1);
      expect(newState.board.get('0,0')).toBeDefined();
    });

    it('should reject tile placement when playerId does not match current player userId (multiplayer)', () => {
      const state: GameState = {
        ...gameInitialState,
        phase: 'playing',
        players: [
          { id: 'P1', color: '#0173B2', edgePosition: 0, isAI: false, userId: 'google:123' },
          { id: 'P2', color: '#DE8F05', edgePosition: 3, isAI: false, userId: 'google:456' },
        ],
        currentPlayerIndex: 0, // P1 is current
        currentTile: TileType.NoSharps,
        board: new Map(),
        availableTiles: [],
        flows: new Map(),
        flowEdges: new Map(),
        teams: [],
        winners: [],
        winType: null,
        moveHistory: [],
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
        supermove: false,
        singleSupermove: false,
        supermoveAnyPlayer: false,
        supermoveInProgress: false,
        lastPlacedTilePosition: null,
      };

      const action: PlaceTileAction = {
        type: PLACE_TILE,
        payload: { position: { row: 0, col: 0 }, rotation: 0 },
        playerId: 'google:456', // Does NOT match P1's userId (this is P2's userId)
      };

      const newState = gameReducer(state, action);

      // Should reject the placement - state unchanged
      expect(newState.board.size).toBe(0);
      expect(newState).toEqual(state);
    });

    it('should allow tile placement in tabletop mode (no playerId in action)', () => {
      const state: GameState = {
        ...gameInitialState,
        phase: 'playing',
        players: [
          { id: 'P1', color: '#0173B2', edgePosition: 0, isAI: false }, // No userId in tabletop mode
          { id: 'P2', color: '#DE8F05', edgePosition: 3, isAI: false },
        ],
        currentPlayerIndex: 0,
        currentTile: TileType.NoSharps,
        board: new Map(),
        availableTiles: [],
        flows: new Map(),
        flowEdges: new Map(),
        teams: [],
        winners: [],
        winType: null,
        moveHistory: [],
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
        supermove: false,
        singleSupermove: false,
        supermoveAnyPlayer: false,
        supermoveInProgress: false,
        lastPlacedTilePosition: null,
      };

      const action: PlaceTileAction = {
        type: PLACE_TILE,
        payload: { position: { row: 0, col: 0 }, rotation: 0 },
        // No playerId - tabletop mode
      };

      const newState = gameReducer(state, action);

      // Should successfully place the tile
      expect(newState.board.size).toBe(1);
      expect(newState.board.get('0,0')).toBeDefined();
    });

    it('should allow AI player to place tiles (no userId for AI)', () => {
      const state: GameState = {
        ...gameInitialState,
        phase: 'playing',
        players: [
          { id: 'P1', color: '#0173B2', edgePosition: 0, isAI: true }, // AI player, no userId
          { id: 'P2', color: '#DE8F05', edgePosition: 3, isAI: false, userId: 'google:123' },
        ],
        currentPlayerIndex: 0, // AI is current
        currentTile: TileType.NoSharps,
        board: new Map(),
        availableTiles: [],
        flows: new Map(),
        flowEdges: new Map(),
        teams: [],
        winners: [],
        winType: null,
        moveHistory: [],
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
        supermove: false,
        singleSupermove: false,
        supermoveAnyPlayer: false,
        supermoveInProgress: false,
        lastPlacedTilePosition: null,
      };

      const action: PlaceTileAction = {
        type: PLACE_TILE,
        payload: { position: { row: 0, col: 0 }, rotation: 0 },
        // No playerId for AI actions
      };

      const newState = gameReducer(state, action);

      // Should successfully place the tile
      expect(newState.board.size).toBe(1);
      expect(newState.board.get('0,0')).toBeDefined();
    });
  });

  describe('REPLACE_TILE authorization', () => {
    it('should allow tile replacement when playerId matches current player userId (multiplayer)', () => {
      const state: GameState = {
        ...gameInitialState,
        phase: 'playing',
        players: [
          { id: 'P1', color: '#0173B2', edgePosition: 0, isAI: false, userId: 'google:123' },
          { id: 'P2', color: '#DE8F05', edgePosition: 3, isAI: false, userId: 'google:456' },
        ],
        currentPlayerIndex: 0, // P1 is current
        currentTile: TileType.OneSharp,
        board: new Map([['0,0', { type: TileType.NoSharps, rotation: 0, position: { row: 0, col: 0 } }]]),
        availableTiles: [],
        flows: new Map(),
        flowEdges: new Map(),
        teams: [],
        winners: [],
        winType: null,
        moveHistory: [],
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
        supermove: true,
        singleSupermove: false,
        supermoveAnyPlayer: false,
        supermoveInProgress: false,
        lastPlacedTilePosition: null,
      };

      const action: ReplaceTileAction = {
        type: REPLACE_TILE,
        payload: { position: { row: 0, col: 0 }, rotation: 1 },
        playerId: 'google:123', // Matches P1's userId
      };

      const newState = gameReducer(state, action);

      // Should successfully replace the tile
      const tile = newState.board.get('0,0');
      expect(tile).toBeDefined();
      expect(tile?.type).toBe(TileType.OneSharp);
      expect(tile?.rotation).toBe(1);
    });

    it('should reject tile replacement when playerId does not match current player userId (multiplayer)', () => {
      const state: GameState = {
        ...gameInitialState,
        phase: 'playing',
        players: [
          { id: 'P1', color: '#0173B2', edgePosition: 0, isAI: false, userId: 'google:123' },
          { id: 'P2', color: '#DE8F05', edgePosition: 3, isAI: false, userId: 'google:456' },
        ],
        currentPlayerIndex: 0, // P1 is current
        currentTile: TileType.OneSharp,
        board: new Map([['0,0', { type: TileType.NoSharps, rotation: 0, position: { row: 0, col: 0 } }]]),
        availableTiles: [],
        flows: new Map(),
        flowEdges: new Map(),
        teams: [],
        winners: [],
        winType: null,
        moveHistory: [],
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
        supermove: true,
        singleSupermove: false,
        supermoveAnyPlayer: false,
        supermoveInProgress: false,
        lastPlacedTilePosition: null,
      };

      const action: ReplaceTileAction = {
        type: REPLACE_TILE,
        payload: { position: { row: 0, col: 0 }, rotation: 1 },
        playerId: 'google:456', // Does NOT match P1's userId (this is P2's userId)
      };

      const newState = gameReducer(state, action);

      // Should reject the replacement - tile unchanged
      const tile = newState.board.get('0,0');
      expect(tile?.type).toBe(TileType.NoSharps);
      expect(tile?.rotation).toBe(0);
      expect(newState).toEqual(state);
    });

    it('should allow tile replacement in tabletop mode (no playerId in action)', () => {
      const state: GameState = {
        ...gameInitialState,
        phase: 'playing',
        players: [
          { id: 'P1', color: '#0173B2', edgePosition: 0, isAI: false }, // No userId in tabletop mode
          { id: 'P2', color: '#DE8F05', edgePosition: 3, isAI: false },
        ],
        currentPlayerIndex: 0,
        currentTile: TileType.OneSharp,
        board: new Map([['0,0', { type: TileType.NoSharps, rotation: 0, position: { row: 0, col: 0 } }]]),
        availableTiles: [],
        flows: new Map(),
        flowEdges: new Map(),
        teams: [],
        winners: [],
        winType: null,
        moveHistory: [],
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
        supermove: true,
        singleSupermove: false,
        supermoveAnyPlayer: false,
        supermoveInProgress: false,
        lastPlacedTilePosition: null,
      };

      const action: ReplaceTileAction = {
        type: REPLACE_TILE,
        payload: { position: { row: 0, col: 0 }, rotation: 1 },
        // No playerId - tabletop mode
      };

      const newState = gameReducer(state, action);

      // Should successfully replace the tile
      const tile = newState.board.get('0,0');
      expect(tile).toBeDefined();
      expect(tile?.type).toBe(TileType.OneSharp);
      expect(tile?.rotation).toBe(1);
    });
  });
});
