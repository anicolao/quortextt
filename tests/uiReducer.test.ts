// Unit tests for UI Redux reducer

import { describe, it, expect } from 'vitest';
import { uiReducer, initialUIState } from '../src/redux/uiReducer';
import {
  setHoveredPosition,
  setSelectedPosition,
  setRotation,
  toggleLegalMoves,
} from '../src/redux/actions';

describe('uiReducer', () => {
  describe('SET_HOVERED_POSITION', () => {
    it('should set hovered position', () => {
      const position = { row: 1, col: 2 };
      const state = uiReducer(initialUIState, setHoveredPosition(position));

      expect(state.hoveredPosition).toEqual(position);
    });

    it('should clear hovered position with null', () => {
      let state = uiReducer(initialUIState, setHoveredPosition({ row: 1, col: 2 }));
      state = uiReducer(state, setHoveredPosition(null));

      expect(state.hoveredPosition).toBeNull();
    });
  });

  describe('SET_SELECTED_POSITION', () => {
    it('should set selected position', () => {
      const position = { row: 1, col: 2 };
      const state = uiReducer(initialUIState, setSelectedPosition(position));

      expect(state.selectedPosition).toEqual(position);
    });

    it('should clear selected position with null', () => {
      let state = uiReducer(initialUIState, setSelectedPosition({ row: 1, col: 2 }));
      state = uiReducer(state, setSelectedPosition(null));

      expect(state.selectedPosition).toBeNull();
    });
  });

  describe('SET_ROTATION', () => {
    it('should set rotation value', () => {
      const state = uiReducer(initialUIState, setRotation(3));

      expect(state.currentRotation).toBe(3);
    });

    it('should accept all valid rotations', () => {
      const rotations = [0, 1, 2, 3, 4, 5] as const;

      rotations.forEach((rotation) => {
        const state = uiReducer(initialUIState, setRotation(rotation));
        expect(state.currentRotation).toBe(rotation);
      });
    });
  });

  describe('TOGGLE_LEGAL_MOVES', () => {
    it('should toggle showLegalMoves from false to true', () => {
      const state = uiReducer(initialUIState, toggleLegalMoves());

      expect(state.showLegalMoves).toBe(true);
    });

    it('should toggle showLegalMoves from true to false', () => {
      let state = uiReducer(initialUIState, toggleLegalMoves());
      state = uiReducer(state, toggleLegalMoves());

      expect(state.showLegalMoves).toBe(false);
    });
  });

  describe('Initial State', () => {
    it('should have correct initial values', () => {
      expect(initialUIState.selectedPosition).toBeNull();
      expect(initialUIState.hoveredPosition).toBeNull();
      expect(initialUIState.currentRotation).toBe(0);
      expect(initialUIState.showLegalMoves).toBe(false);
      expect(initialUIState.showFlowMarkers).toBe(true);
      expect(initialUIState.animationSpeed).toBe(1.0);
      expect(initialUIState.zoom).toBe(1.0);
      expect(initialUIState.panOffset).toEqual({ x: 0, y: 0 });
    });
  });

  describe('Unknown Action', () => {
    it('should return current state for unknown action', () => {
      const state = uiReducer(initialUIState, { type: 'UNKNOWN_ACTION' } as any);

      expect(state).toEqual(initialUIState);
    });
  });
});
