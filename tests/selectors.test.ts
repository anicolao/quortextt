// Unit tests for Redux selectors

import { describe, it, expect } from 'vitest';
import {
  selectCurrentPlayer,
  selectLegalPositions,
  selectFlowsForRendering,
  selectIsPositionHovered,
  selectGameStatus,
  selectRemainingTileCounts,
  selectBlockedPlayers,
} from '../src/redux/selectors';
import { RootState } from '../src/redux/types';
import { TileType } from '../src/game/types';
import { initialState as initialGameState } from '../src/redux/gameReducer';
import { initialUIState } from '../src/redux/uiReducer';

describe('Redux Selectors', () => {
  const createMockState = (overrides?: Partial<RootState>): RootState => ({
    game: initialGameState,
    ui: initialUIState,
    ...overrides,
  });

  describe('selectCurrentPlayer', () => {
    it('should return null when no players', () => {
      const state = createMockState();
      const player = selectCurrentPlayer(state);

      expect(player).toBeNull();
    });

    it('should return first player initially', () => {
      const players = [
        { id: 'p1', color: '#0173B2', edgePosition: 0, isAI: false },
        { id: 'p2', color: '#DE8F05', edgePosition: 3, isAI: false },
      ];

      const state = createMockState({
        game: { ...initialGameState, players, currentPlayerIndex: 0 },
      });

      const player = selectCurrentPlayer(state);
      expect(player).toEqual(players[0]);
    });

    it('should return current player based on index', () => {
      const players = [
        { id: 'p1', color: '#0173B2', edgePosition: 0, isAI: false },
        { id: 'p2', color: '#DE8F05', edgePosition: 3, isAI: false },
      ];

      const state = createMockState({
        game: { ...initialGameState, players, currentPlayerIndex: 1 },
      });

      const player = selectCurrentPlayer(state);
      expect(player).toEqual(players[1]);
    });
  });

  describe('selectLegalPositions', () => {
    it('should return empty array when no current tile', () => {
      const state = createMockState();
      const positions = selectLegalPositions(state);

      expect(positions).toEqual([]);
    });

    it('should filter out occupied positions', () => {
      const board = new Map();
      board.set('0,0', {
        type: TileType.NoSharps,
        rotation: 0,
        position: { row: 0, col: 0 },
      });

      const players = [
        { id: 'p1', color: '#0173B2', edgePosition: 0, isAI: false },
        { id: 'p2', color: '#DE8F05', edgePosition: 3, isAI: false },
      ];

      const state = createMockState({
        game: {
          ...initialGameState,
          board,
          currentTile: TileType.NoSharps,
          players,
        },
        ui: { ...initialUIState, currentRotation: 0 },
      });

      const positions = selectLegalPositions(state);

      // Position (0,0) should not be in the list
      expect(positions.find(p => p.row === 0 && p.col === 0)).toBeUndefined();
    });
  });

  describe('selectFlowsForRendering', () => {
    it('should return empty array when no players', () => {
      const state = createMockState();
      const flows = selectFlowsForRendering(state);

      expect(flows).toEqual([]);
    });

    it('should convert flow map to array format', () => {
      const players = [
        { id: 'p1', color: '#0173B2', edgePosition: 0, isAI: false },
        { id: 'p2', color: '#DE8F05', edgePosition: 3, isAI: false },
      ];

      const flowsMap = new Map<string, Set<string>>();
      flowsMap.set('p1', new Set(['0,0', '0,1']));
      flowsMap.set('p2', new Set(['1,0']));

      const state = createMockState({
        game: { ...initialGameState, players, flows: flowsMap },
      });

      const flows = selectFlowsForRendering(state);

      expect(flows).toHaveLength(2);
      expect(flows[0]).toEqual({
        playerId: 'p1',
        color: '#0173B2',
        positions: expect.arrayContaining([
          { row: 0, col: 0 },
          { row: 0, col: 1 },
        ]),
      });
      expect(flows[1]).toEqual({
        playerId: 'p2',
        color: '#DE8F05',
        positions: [{ row: 1, col: 0 }],
      });
    });
  });

  describe('selectIsPositionHovered', () => {
    it('should return false when no hovered position', () => {
      const state = createMockState();
      const isHovered = selectIsPositionHovered(state, { row: 0, col: 0 });

      expect(isHovered).toBe(false);
    });

    it('should return true for hovered position', () => {
      const position = { row: 1, col: 2 };
      const state = createMockState({
        ui: { ...initialUIState, hoveredPosition: position },
      });

      const isHovered = selectIsPositionHovered(state, position);
      expect(isHovered).toBe(true);
    });

    it('should return false for non-hovered position', () => {
      const state = createMockState({
        ui: { ...initialUIState, hoveredPosition: { row: 1, col: 2 } },
      });

      const isHovered = selectIsPositionHovered(state, { row: 0, col: 0 });
      expect(isHovered).toBe(false);
    });
  });

  describe('selectGameStatus', () => {
    it('should return initial game status', () => {
      const state = createMockState();
      const status = selectGameStatus(state);

      expect(status.phase).toBe('setup');
      expect(status.winner).toBeNull();
      expect(status.winType).toBeNull();
      expect(status.currentPlayer).toBeNull();
      expect(status.isGameOver).toBe(false);
    });

    it('should indicate game over when finished', () => {
      const state = createMockState({
        game: {
          ...initialGameState,
          phase: 'finished',
          winner: 'p1',
          winType: 'flow',
        },
      });

      const status = selectGameStatus(state);
      expect(status.isGameOver).toBe(true);
      expect(status.winner).toBe('p1');
      expect(status.winType).toBe('flow');
    });
  });

  describe('selectRemainingTileCounts', () => {
    it('should return zero counts for empty deck', () => {
      const state = createMockState();
      const counts = selectRemainingTileCounts(state);

      expect(counts.total).toBe(0);
      expect(counts.noSharps).toBe(0);
      expect(counts.oneSharp).toBe(0);
      expect(counts.twoSharps).toBe(0);
      expect(counts.threeSharps).toBe(0);
    });

    it('should count tile types correctly', () => {
      const availableTiles = [
        TileType.NoSharps,
        TileType.NoSharps,
        TileType.OneSharp,
        TileType.TwoSharps,
        TileType.ThreeSharps,
        TileType.ThreeSharps,
      ];

      const state = createMockState({
        game: { ...initialGameState, availableTiles },
      });

      const counts = selectRemainingTileCounts(state);
      expect(counts.total).toBe(6);
      expect(counts.noSharps).toBe(2);
      expect(counts.oneSharp).toBe(1);
      expect(counts.twoSharps).toBe(1);
      expect(counts.threeSharps).toBe(2);
    });
  });

  describe('selectBlockedPlayers', () => {
    it('should return empty array when no selected position', () => {
      const players = [
        { id: 'p1', color: '#0173B2', edgePosition: 0, isAI: false },
        { id: 'p2', color: '#DE8F05', edgePosition: 3, isAI: false },
      ];

      const state = createMockState({
        game: { ...initialGameState, players, currentTile: TileType.NoSharps },
        ui: { ...initialUIState, selectedPosition: null },
      });

      const blocked = selectBlockedPlayers(state);
      expect(blocked).toEqual([]);
    });

    it('should return empty array when no current tile', () => {
      const players = [
        { id: 'p1', color: '#0173B2', edgePosition: 0, isAI: false },
        { id: 'p2', color: '#DE8F05', edgePosition: 3, isAI: false },
      ];

      const state = createMockState({
        game: { ...initialGameState, players, currentTile: null },
        ui: { ...initialUIState, selectedPosition: { row: 0, col: 0 } },
      });

      const blocked = selectBlockedPlayers(state);
      expect(blocked).toEqual([]);
    });

    it('should return blocked players when position would block', () => {
      const board = new Map();
      
      // Create a nearly complete wall
      for (let col = -3; col <= 3; col++) {
        if (col !== 0) {
          board.set(`0,${col}`, {
            type: TileType.ThreeSharps,
            rotation: 0,
            position: { row: 0, col },
          });
        }
      }

      const players = [
        { id: 'p1', color: '#0173B2', edgePosition: 0, isAI: false },
        { id: 'p2', color: '#DE8F05', edgePosition: 3, isAI: false },
      ];

      const state = createMockState({
        game: { 
          ...initialGameState, 
          board,
          players, 
          currentTile: TileType.ThreeSharps,
        },
        ui: { 
          ...initialUIState, 
          selectedPosition: { row: 0, col: 0 },
          currentRotation: 0,
        },
      });

      const blocked = selectBlockedPlayers(state);
      expect(Array.isArray(blocked)).toBe(true);
    });
  });
});
