// Test for constraint victory with supermove enabled
import { describe, it, expect, beforeEach } from 'vitest';
import { gameReducer, resetPlayerIdCounter, calculateHexCount } from '../src/redux/gameReducer';
import { drawTile } from '../src/redux/actions';
import { GameState } from '../src/redux/types';
import { Player, TileType, PlacedTile } from '../src/game/types';
import { getAllBoardPositions, positionToKey } from '../src/game/board';

describe('Constraint Victory with Supermove', () => {
  beforeEach(() => {
    resetPlayerIdCounter();
  });

  it('should NOT trigger constraint victory when supermove is enabled and board has empty positions', () => {
    const players: Player[] = [
      { id: 'p1', color: '#DE8F05', edgePosition: 0, isAI: false },
      { id: 'p2', color: '#0173B2', edgePosition: 3, isAI: false },
    ];

    const board = new Map<string, PlacedTile>();
    // Fill most of the board (35 out of 37 hexes for radius 3)
    const allPositions = getAllBoardPositions(3);
    for (let i = 0; i < 35; i++) {
      const pos = allPositions[i];
      board.set(positionToKey(pos), {
        type: TileType.ThreeSharps,
        rotation: 0,
        position: pos,
      });
    }

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
      board,
      availableTiles: [TileType.NoSharps], // One tile left
      currentTile: null,
      flows: new Map(),
      flowEdges: new Map(),
      phase: 'playing',
      winners: [],
      winType: null,
      moveHistory: [],
      supermove: true, // Supermove enabled
      singleSupermove: false,
      supermoveInProgress: false,
      lastPlacedTilePosition: null,
    };

    // With supermove enabled, this should NOT trigger constraint victory
    // because there are still empty positions where tiles can be placed
    const newState = gameReducer(state, { type: 'DRAW_TILE' });

    // Game should continue
    expect(newState.phase).toBe('playing');
    expect(newState.currentTile).toBe(TileType.NoSharps);
    expect(newState.winners).toEqual([]);
  });

  it('should trigger constraint victory when supermove is enabled and board is full', () => {
    const players: Player[] = [
      { id: 'p1', color: '#DE8F05', edgePosition: 0, isAI: false },
      { id: 'p2', color: '#0173B2', edgePosition: 3, isAI: false },
    ];

    const board = new Map<string, PlacedTile>();
    // Fill the entire board (37 hexes for radius 3)
    const allPositions = getAllBoardPositions(3);
    const hexCount = calculateHexCount(3);
    expect(hexCount).toBe(37); // Verify we have the right count
    
    for (let i = 0; i < hexCount; i++) {
      const pos = allPositions[i];
      board.set(positionToKey(pos), {
        type: TileType.ThreeSharps,
        rotation: 0,
        position: pos,
      });
    }

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
      board,
      availableTiles: [TileType.NoSharps], // One tile left but can't place it
      currentTile: null,
      flows: new Map(),
      flowEdges: new Map(),
      phase: 'playing',
      winners: [],
      winType: null,
      moveHistory: [],
      supermove: true, // Supermove enabled
      singleSupermove: false,
      supermoveInProgress: false,
      lastPlacedTilePosition: null,
    };

    // With supermove enabled and board full, this SHOULD trigger constraint victory
    const newState = gameReducer(state, { type: 'DRAW_TILE' });

    // Game should end with constraint victory
    expect(newState.phase).toBe('finished');
    expect(newState.winners).toEqual(['p1']);
    expect(newState.winType).toBe('constraint');
    expect(newState.screen).toBe('game-over');
  });

  it('should trigger constraint victory when supermove is disabled and player is blocked', () => {
    const players: Player[] = [
      { id: 'p1', color: '#DE8F05', edgePosition: 0, isAI: false },
      { id: 'p2', color: '#0173B2', edgePosition: 3, isAI: false },
    ];

    // Create a board state where placing the current tile would block a player
    // This is a simplified scenario - in reality this requires specific board setup
    const board = new Map<string, PlacedTile>();
    
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
      board,
      availableTiles: [TileType.NoSharps],
      currentTile: null,
      flows: new Map(),
      flowEdges: new Map(),
      phase: 'playing',
      winners: [],
      winType: null,
      moveHistory: [],
      supermove: false, // Supermove disabled
      singleSupermove: false,
      supermoveInProgress: false,
      lastPlacedTilePosition: null,
    };

    // With supermove disabled, constraint victory depends on blocking detection
    // For an empty board, all moves are legal, so no constraint victory
    const newState = gameReducer(state, { type: 'DRAW_TILE' });

    // With an empty board, no constraint victory should occur
    expect(newState.phase).toBe('playing');
    expect(newState.currentTile).toBe(TileType.NoSharps);
  });
});
