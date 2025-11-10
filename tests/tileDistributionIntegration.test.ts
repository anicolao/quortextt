// Integration tests for tile distribution feature

import { describe, it, expect } from 'vitest';
import { store } from '../src/redux/store';
import { addPlayer, startGame, selectEdge, updateSettings, resetGame } from '../src/redux/actions';
import { TileType } from '../src/game/types';
import { resetPlayerIdCounter } from '../src/redux/gameReducer';

describe('Tile Distribution Integration', () => {
  it('should use custom tile distribution when starting a game', () => {
    // Reset
    resetPlayerIdCounter();
    store.dispatch(resetGame());

    // Set custom distribution: only NoSharps tiles
    store.dispatch(updateSettings({
      tileDistribution: [1, 0, 0, 0]
    }));

    // Add two players
    store.dispatch(addPlayer('#0173B2', 0));
    store.dispatch(addPlayer('#DE8F05', 1));

    // Start game
    store.dispatch(startGame(3));

    // Complete seating phase
    const state1 = store.getState();
    const seatingOrder = state1.game.seatingPhase.seatingOrder;
    store.dispatch(selectEdge(seatingOrder[0], 0));
    store.dispatch(selectEdge(seatingOrder[1], 3));

    // Verify tiles were distributed according to custom distribution
    const state = store.getState();
    const totalTiles = state.game.availableTiles.length + (state.game.currentTile !== null ? 1 : 0);
    
    // With [1,0,0,0] ratio on radius 3 board (37 positions):
    // groupSize = 1, numGroups = 37, totalTiles = 37
    expect(totalTiles).toBe(37);

    // Count tile types
    const allTiles = [...state.game.availableTiles];
    if (state.game.currentTile !== null) {
      allTiles.push(state.game.currentTile);
    }

    const counts = [0, 0, 0, 0];
    allTiles.forEach(tile => counts[tile]++);

    expect(counts[TileType.NoSharps]).toBe(37);
    expect(counts[TileType.OneSharp]).toBe(0);
    expect(counts[TileType.TwoSharps]).toBe(0);
    expect(counts[TileType.ThreeSharps]).toBe(0);
  });

  it('should use weighted distribution [2,1,1,1]', () => {
    // Reset
    resetPlayerIdCounter();
    store.dispatch(resetGame());

    // Set custom distribution: weighted curves
    store.dispatch(updateSettings({
      tileDistribution: [2, 1, 1, 1]
    }));

    // Add two players
    store.dispatch(addPlayer('#0173B2', 0));
    store.dispatch(addPlayer('#DE8F05', 1));

    // Start game
    store.dispatch(startGame(3));

    // Complete seating phase
    const state1 = store.getState();
    const seatingOrder = state1.game.seatingPhase.seatingOrder;
    store.dispatch(selectEdge(seatingOrder[0], 0));
    store.dispatch(selectEdge(seatingOrder[1], 3));

    // Verify tiles were distributed according to custom distribution
    const state = store.getState();
    const totalTiles = state.game.availableTiles.length + (state.game.currentTile !== null ? 1 : 0);
    
    // With [2,1,1,1] ratio on radius 3 board (37 positions):
    // groupSize = 5, numGroups = 8, totalTiles = 40
    expect(totalTiles).toBe(40);

    // Count tile types
    const allTiles = [...state.game.availableTiles];
    if (state.game.currentTile !== null) {
      allTiles.push(state.game.currentTile);
    }

    const counts = [0, 0, 0, 0];
    allTiles.forEach(tile => counts[tile]++);

    expect(counts[TileType.NoSharps]).toBe(16);
    expect(counts[TileType.OneSharp]).toBe(8);
    expect(counts[TileType.TwoSharps]).toBe(8);
    expect(counts[TileType.ThreeSharps]).toBe(8);
  });

  it('should use extremes only distribution [1,0,0,1]', () => {
    // Reset
    resetPlayerIdCounter();
    store.dispatch(resetGame());

    // Set custom distribution: extremes only
    store.dispatch(updateSettings({
      tileDistribution: [1, 0, 0, 1]
    }));

    // Add two players
    store.dispatch(addPlayer('#0173B2', 0));
    store.dispatch(addPlayer('#DE8F05', 1));

    // Start game
    store.dispatch(startGame(3));

    // Complete seating phase
    const state1 = store.getState();
    const seatingOrder = state1.game.seatingPhase.seatingOrder;
    store.dispatch(selectEdge(seatingOrder[0], 0));
    store.dispatch(selectEdge(seatingOrder[1], 3));

    // Verify tiles were distributed according to custom distribution
    const state = store.getState();
    const totalTiles = state.game.availableTiles.length + (state.game.currentTile !== null ? 1 : 0);
    
    // With [1,0,0,1] ratio on radius 3 board (37 positions):
    // groupSize = 2, numGroups = 19, totalTiles = 38
    expect(totalTiles).toBe(38);

    // Count tile types
    const allTiles = [...state.game.availableTiles];
    if (state.game.currentTile !== null) {
      allTiles.push(state.game.currentTile);
    }

    const counts = [0, 0, 0, 0];
    allTiles.forEach(tile => counts[tile]++);

    expect(counts[TileType.NoSharps]).toBe(19);
    expect(counts[TileType.OneSharp]).toBe(0);
    expect(counts[TileType.TwoSharps]).toBe(0);
    expect(counts[TileType.ThreeSharps]).toBe(19);
  });

  it('should default to [1,1,1,1] when all zeros', () => {
    // Reset
    resetPlayerIdCounter();
    store.dispatch(resetGame());

    // Set custom distribution: all zeros (should default to balanced)
    store.dispatch(updateSettings({
      tileDistribution: [0, 0, 0, 0]
    }));

    // Add two players
    store.dispatch(addPlayer('#0173B2', 0));
    store.dispatch(addPlayer('#DE8F05', 1));

    // Start game
    store.dispatch(startGame(3));

    // Complete seating phase
    const state1 = store.getState();
    const seatingOrder = state1.game.seatingPhase.seatingOrder;
    store.dispatch(selectEdge(seatingOrder[0], 0));
    store.dispatch(selectEdge(seatingOrder[1], 3));

    // Verify tiles were distributed with default [1,1,1,1]
    const state = store.getState();
    const totalTiles = state.game.availableTiles.length + (state.game.currentTile !== null ? 1 : 0);
    
    expect(totalTiles).toBe(40);

    // Count tile types
    const allTiles = [...state.game.availableTiles];
    if (state.game.currentTile !== null) {
      allTiles.push(state.game.currentTile);
    }

    const counts = [0, 0, 0, 0];
    allTiles.forEach(tile => counts[tile]++);

    expect(counts[TileType.NoSharps]).toBe(10);
    expect(counts[TileType.OneSharp]).toBe(10);
    expect(counts[TileType.TwoSharps]).toBe(10);
    expect(counts[TileType.ThreeSharps]).toBe(10);
  });

  it('should work with different board radii', () => {
    // Reset
    resetPlayerIdCounter();
    store.dispatch(resetGame());

    // Set custom distribution
    store.dispatch(updateSettings({
      boardRadius: 2,
      tileDistribution: [1, 1, 1, 1]
    }));

    // Add two players
    store.dispatch(addPlayer('#0173B2', 0));
    store.dispatch(addPlayer('#DE8F05', 1));

    // Start game with radius 2
    store.dispatch(startGame(2));

    // Complete seating phase
    const state1 = store.getState();
    const seatingOrder = state1.game.seatingPhase.seatingOrder;
    store.dispatch(selectEdge(seatingOrder[0], 0));
    store.dispatch(selectEdge(seatingOrder[1], 3));

    // Verify tiles were distributed correctly for radius 2
    // Radius 2 = 19 positions, with [1,1,1,1]: groupSize=4, numGroups=5, totalTiles=20
    const state = store.getState();
    const totalTiles = state.game.availableTiles.length + (state.game.currentTile !== null ? 1 : 0);
    
    expect(totalTiles).toBe(20);

    // Count tile types
    const allTiles = [...state.game.availableTiles];
    if (state.game.currentTile !== null) {
      allTiles.push(state.game.currentTile);
    }

    const counts = [0, 0, 0, 0];
    allTiles.forEach(tile => counts[tile]++);

    expect(counts[TileType.NoSharps]).toBe(5);
    expect(counts[TileType.OneSharp]).toBe(5);
    expect(counts[TileType.TwoSharps]).toBe(5);
    expect(counts[TileType.ThreeSharps]).toBe(5);
  });
});
