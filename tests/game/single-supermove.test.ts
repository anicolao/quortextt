// Tests for single supermove functionality
import { describe, it, expect } from 'vitest';
import { gameReducer, initialState } from '../../src/redux/gameReducer';
import { placeTile, replaceTile, drawTile } from '../../src/redux/actions';
import { TileType } from '../../src/game/types';
import { positionToKey } from '../../src/game/board';

describe('Single Supermove', () => {
  it('should return replaced tile to bag and shuffle when isSingleSupermove is true', () => {
    // Setup initial state with a tile on the board
    const state = {
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
      boardRadius: 3,
    };

    // Add a tile to replace
    const posToReplace = { row: 0, col: 0 };
    state.board.set(positionToKey(posToReplace), {
      type: TileType.OneSharp,
      rotation: 0,
      position: posToReplace,
    });

    // Perform single supermove replacement
    const action = replaceTile(posToReplace, 0, true); // isSingleSupermove = true
    const newState = gameReducer(state, action);

    // Check that supermoveInProgress is false (single supermove completes immediately)
    expect(newState.supermoveInProgress).toBe(false);
    
    // Check that currentTile is cleared
    expect(newState.currentTile).toBe(null);
    
    // Check that the new tile is on the board
    const boardTile = newState.board.get(positionToKey(posToReplace));
    expect(boardTile?.type).toBe(TileType.NoSharps);
    
    // Check that the replaced tile was returned to the bag
    // Original bag: [TwoSharps, ThreeSharps]
    // After replacement: should have 3 tiles including the returned OneSharp
    expect(newState.availableTiles.length).toBe(3);
    expect(newState.availableTiles).toContain(TileType.OneSharp);
    expect(newState.availableTiles).toContain(TileType.TwoSharps);
    expect(newState.availableTiles).toContain(TileType.ThreeSharps);
  });

  it('should maintain regular supermove behavior when isSingleSupermove is false', () => {
    // Setup initial state with a tile on the board
    const state = {
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

    // Perform regular supermove replacement
    const action = replaceTile(posToReplace, 0, false); // isSingleSupermove = false
    const newState = gameReducer(state, action);

    // Check that supermoveInProgress is true
    expect(newState.supermoveInProgress).toBe(true);
    
    // Check that the replaced tile is now in hand
    expect(newState.currentTile).toBe(TileType.OneSharp);
    
    // Check that the bag is unchanged
    expect(newState.availableTiles.length).toBe(2);
    expect(newState.availableTiles).not.toContain(TileType.OneSharp);
  });

  it('should maintain regular supermove behavior when isSingleSupermove is undefined', () => {
    // Setup initial state with a tile on the board
    const state = {
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

    // Perform replacement without specifying isSingleSupermove (undefined)
    const action = replaceTile(posToReplace, 0); // isSingleSupermove = undefined
    const newState = gameReducer(state, action);

    // Check that supermoveInProgress is true (regular supermove behavior)
    expect(newState.supermoveInProgress).toBe(true);
    
    // Check that the replaced tile is now in hand
    expect(newState.currentTile).toBe(TileType.OneSharp);
    
    // Check that the bag is unchanged
    expect(newState.availableTiles.length).toBe(2);
  });

  it('should handle victory during single supermove', () => {
    // Setup a near-victory state with a path from edge 0 to edge 3
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
      availableTiles: [TileType.ThreeSharps],
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

    // Replace the OneSharp tile with TwoSharps to complete the victory path using single supermove
    const posToReplace = { row: 0, col: 0 };
    const action = replaceTile(posToReplace, 5, true); // rotation 5 to match others, isSingleSupermove = true
    const newState = gameReducer(state, action);

    // Check that game ended with victory
    expect(newState.phase).toBe('finished');
    expect(newState.winners.length).toBeGreaterThan(0);
    expect(newState.winners).toContain('p1');
    expect(newState.winType).toBe('flow');
    expect(newState.screen).toBe('game-over');
    expect(newState.supermoveInProgress).toBe(false);
    
    // Check that currentTile is cleared (victory completes the turn)
    expect(newState.currentTile).toBe(null);
  });

  it('should shuffle the bag with replaced tile included', () => {
    // Setup initial state with a known tile to replace
    const state = {
      ...initialState,
      players: [
        { id: 'p1', color: 'blue', edgePosition: 0, isAI: false },
        { id: 'p2', color: 'red', edgePosition: 3, isAI: false },
      ],
      currentPlayerIndex: 0,
      currentTile: TileType.NoSharps,
      // Create a larger bag to make shuffle more testable
      availableTiles: [
        TileType.TwoSharps,
        TileType.TwoSharps,
        TileType.ThreeSharps,
        TileType.ThreeSharps,
        TileType.NoSharps,
      ],
      phase: 'playing' as const,
      supermoveInProgress: false,
      boardRadius: 3,
    };

    // Add a tile to replace
    const posToReplace = { row: 0, col: 0 };
    state.board.set(positionToKey(posToReplace), {
      type: TileType.OneSharp,
      rotation: 0,
      position: posToReplace,
    });

    // Perform single supermove replacement
    const action = replaceTile(posToReplace, 0, true);
    const newState = gameReducer(state, action);

    // The bag should now have the original 5 tiles plus the returned OneSharp
    expect(newState.availableTiles.length).toBe(6);
    
    // Count each tile type
    const counts = {
      [TileType.NoSharps]: 0,
      [TileType.OneSharp]: 0,
      [TileType.TwoSharps]: 0,
      [TileType.ThreeSharps]: 0,
    };
    
    newState.availableTiles.forEach(tile => {
      counts[tile]++;
    });
    
    // Verify counts: original bag had 1 NoSharps, 0 OneSharp, 2 TwoSharps, 2 ThreeSharps
    // After replacement: should have 1 NoSharps, 1 OneSharp, 2 TwoSharps, 2 ThreeSharps
    expect(counts[TileType.NoSharps]).toBe(1);
    expect(counts[TileType.OneSharp]).toBe(1); // This is the returned tile
    expect(counts[TileType.TwoSharps]).toBe(2);
    expect(counts[TileType.ThreeSharps]).toBe(2);
  });
});
