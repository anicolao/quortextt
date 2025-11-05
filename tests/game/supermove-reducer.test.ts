// Tests for supermove reducer behavior
import { describe, it, expect } from 'vitest';
import { gameReducer, initialState } from '../../src/redux/gameReducer';
import { placeTile, replaceTile, drawTile } from '../../src/redux/actions';
import { TileType } from '../../src/game/types';
import { positionToKey } from '../../src/game/board';

describe('Supermove Reducer', () => {
  it('should set supermoveInProgress when replacing a tile', () => {
    // Setup initial state with a tile on the board
    const state = {
      ...initialState,
      players: [
        { id: 'p1', color: 'blue', edgePosition: 0, isAI: false },
        { id: 'p2', color: 'red', edgePosition: 3, isAI: false },
      ],
      currentPlayerIndex: 0,
      currentTile: TileType.NoSharps,
      phase: 'playing' as const,
      supermoveInProgress: false,
    };

    // Add a tile to replace
    const posToReplace = { row: 0, col: 0 };
    state.board.set(positionToKey(posToReplace), {
      type: TileType.OneSharp,
      rotation: 0,
      position: posToReplace,
    });

    // Perform replacement
    const action = replaceTile(posToReplace, 0);
    const newState = gameReducer(state, action);

    // Check that supermoveInProgress is true
    expect(newState.supermoveInProgress).toBe(true);
    
    // Check that the old tile is now in hand
    expect(newState.currentTile).toBe(TileType.OneSharp);
    
    // Check that the new tile is on the board
    const boardTile = newState.board.get(positionToKey(posToReplace));
    expect(boardTile?.type).toBe(TileType.NoSharps);
  });

  it('should clear supermoveInProgress when placing a tile', () => {
    // Setup state during a supermove
    const state = {
      ...initialState,
      players: [
        { id: 'p1', color: 'blue', edgePosition: 0, isAI: false },
        { id: 'p2', color: 'red', edgePosition: 3, isAI: false },
      ],
      currentPlayerIndex: 0,
      currentTile: TileType.OneSharp,
      phase: 'playing' as const,
      supermoveInProgress: true,
    };

    // Place the tile
    const posToPlace = { row: 1, col: 0 };
    const action = placeTile(posToPlace, 0);
    const newState = gameReducer(state, action);

    // Check that supermoveInProgress is cleared
    expect(newState.supermoveInProgress).toBe(false);
    
    // Check that the tile is placed
    const boardTile = newState.board.get(positionToKey(posToPlace));
    expect(boardTile?.type).toBe(TileType.OneSharp);
    
    // Check that current tile is cleared
    expect(newState.currentTile).toBe(null);
  });

  it('should handle complete supermove sequence', () => {
    // Initial state
    let state = {
      ...initialState,
      players: [
        { id: 'p1', color: 'blue', edgePosition: 0, isAI: false },
        { id: 'p2', color: 'red', edgePosition: 3, isAI: false },
      ],
      currentPlayerIndex: 0,
      currentTile: TileType.NoSharps,
      availableTiles: [TileType.TwoSharps, TileType.ThreeSharps],
      phase: 'playing' as const,
      supermoveInProgress: false,
    };

    // Add a tile to replace
    const posToReplace = { row: 0, col: 0 };
    state.board.set(positionToKey(posToReplace), {
      type: TileType.OneSharp,
      rotation: 0,
      position: posToReplace,
    });

    // Step 1: Replace tile
    state = gameReducer(state, replaceTile(posToReplace, 0));
    expect(state.supermoveInProgress).toBe(true);
    expect(state.currentTile).toBe(TileType.OneSharp);
    expect(state.board.get(positionToKey(posToReplace))?.type).toBe(TileType.NoSharps);

    // Step 2: Place the replaced tile
    const posToPlace = { row: 1, col: 0 };
    state = gameReducer(state, placeTile(posToPlace, 0));
    expect(state.supermoveInProgress).toBe(false);
    expect(state.currentTile).toBe(null);
    expect(state.board.get(positionToKey(posToPlace))?.type).toBe(TileType.OneSharp);

    // Both tiles should be on the board
    expect(state.board.size).toBe(2);
  });

  it('should maintain supermoveInProgress false for normal moves', () => {
    // Setup initial state
    const state = {
      ...initialState,
      players: [
        { id: 'p1', color: 'blue', edgePosition: 0, isAI: false },
        { id: 'p2', color: 'red', edgePosition: 3, isAI: false },
      ],
      currentPlayerIndex: 0,
      currentTile: TileType.NoSharps,
      phase: 'playing' as const,
      supermoveInProgress: false,
    };

    // Place a tile normally (not a replacement)
    const posToPlace = { row: 0, col: 0 };
    const action = placeTile(posToPlace, 0);
    const newState = gameReducer(state, action);

    // Check that supermoveInProgress remains false
    expect(newState.supermoveInProgress).toBe(false);
  });

  it('should return state unchanged when replacing with null currentTile', () => {
    // Setup state with no tile in hand
    const state = {
      ...initialState,
      players: [
        { id: 'p1', color: 'blue', edgePosition: 0, isAI: false },
        { id: 'p2', color: 'red', edgePosition: 3, isAI: false },
      ],
      currentPlayerIndex: 0,
      currentTile: null,
      phase: 'playing' as const,
      supermoveInProgress: false,
    };

    // Add a tile on the board
    const posToReplace = { row: 0, col: 0 };
    state.board.set(positionToKey(posToReplace), {
      type: TileType.OneSharp,
      rotation: 0,
      position: posToReplace,
    });

    // Try to replace without a tile in hand
    const action = replaceTile(posToReplace, 0);
    const newState = gameReducer(state, action);

    // State should be unchanged
    expect(newState).toEqual(state);
  });

  it('should return state unchanged when trying to replace non-existent tile', () => {
    // Setup state with a tile in hand but empty board
    const state = {
      ...initialState,
      board: new Map(), // Explicitly set empty board
      players: [
        { id: 'p1', color: 'blue', edgePosition: 0, isAI: false },
        { id: 'p2', color: 'red', edgePosition: 3, isAI: false },
      ],
      currentPlayerIndex: 0,
      currentTile: TileType.NoSharps,
      phase: 'playing' as const,
      supermoveInProgress: false,
    };

    // Try to replace at an empty position
    const emptyPos = { row: 0, col: 0 };
    const action = replaceTile(emptyPos, 0);
    const newState = gameReducer(state, action);

    // State should be unchanged (no tile was at that position)
    expect(newState).toBe(state);
    expect(newState.currentTile).toBe(TileType.NoSharps);
    expect(newState.board.size).toBe(0);
  });

  it('should handle victory during tile replacement', () => {
    // Setup a near-victory state with a path from edge 0 to edges 1,2,3
    const state = {
      ...initialState,
      board: new Map(),
      players: [
        { id: 'p1', color: 'blue', edgePosition: 0, isAI: false },
        { id: 'p2', color: 'red', edgePosition: 2, isAI: false },
      ],
      teams: [],
      currentPlayerIndex: 0,
      currentTile: TileType.TwoSharps,
      phase: 'playing' as const,
      supermoveInProgress: false,
      boardRadius: 3,
    };

    // Create a winning path from edge 0 to edge 3 using TwoSharps tiles
    // but with one tile (at center) being OneSharp which we'll replace to trigger victory
    const tiles = [
      { type: TileType.TwoSharps, rotation: 5, position: { row: -3, col: 0 } },
      { type: TileType.TwoSharps, rotation: 5, position: { row: -2, col: 0 } },
      { type: TileType.TwoSharps, rotation: 5, position: { row: -1, col: 0 } },
      { type: TileType.OneSharp, rotation: 0, position: { row: 0, col: 0 } }, // This breaks the path
      { type: TileType.TwoSharps, rotation: 5, position: { row: 1, col: 0 } },
      { type: TileType.TwoSharps, rotation: 5, position: { row: 2, col: 0 } },
      { type: TileType.TwoSharps, rotation: 5, position: { row: 3, col: 0 } },
    ];

    tiles.forEach(tile => {
      state.board.set(positionToKey(tile.position), tile);
    });

    // Replace the OneSharp tile with TwoSharps to complete the victory path
    const posToReplace = { row: 0, col: 0 };
    const action = replaceTile(posToReplace, 5); // rotation 5 to match others
    const newState = gameReducer(state, action);

    // Check that game ended with victory
    expect(newState.phase).toBe('finished');
    expect(newState.winners.length).toBeGreaterThan(0);
    expect(newState.winners).toContain('p1');
    expect(newState.winType).toBe('flow');
    expect(newState.screen).toBe('game-over');
    expect(newState.supermoveInProgress).toBe(false);
  });
});
