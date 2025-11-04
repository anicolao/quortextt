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
});
