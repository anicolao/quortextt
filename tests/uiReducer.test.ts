// Unit tests for UI Redux reducer

import { describe, it, expect } from 'vitest';
import { uiReducer, initialUIState } from '../src/redux/uiReducer';
import {
  setHoveredPosition,
  setHoveredElement,
  setSelectedPosition,
  setRotation,
  toggleLegalMoves,
  toggleSettings,
  updateSettings,
  showHelp,
  hideHelp,
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

  describe('SET_HOVERED_ELEMENT', () => {
    it('should set hovered element for hexagon', () => {
      const element = { type: 'hexagon' as const, position: { row: 1, col: 2 } };
      const state = uiReducer(initialUIState, setHoveredElement(element));

      expect(state.hoveredElement).toEqual(element);
    });

    it('should set hovered element for rotation button', () => {
      const element = { 
        type: 'rotation-button' as const, 
        position: { x: 100, y: 200 }, 
        radius: 30, 
        clockwise: true 
      };
      const state = uiReducer(initialUIState, setHoveredElement(element));

      expect(state.hoveredElement).toEqual(element);
    });

    it('should set hovered element for action button', () => {
      const element = { 
        type: 'action-button' as const, 
        position: { x: 100, y: 200 }, 
        radius: 40, 
        action: 'checkmark' as const 
      };
      const state = uiReducer(initialUIState, setHoveredElement(element));

      expect(state.hoveredElement).toEqual(element);
    });

    it('should set hovered element for exit button', () => {
      const element = { 
        type: 'exit-button' as const, 
        x: 10, 
        y: 10, 
        width: 50, 
        height: 50 
      };
      const state = uiReducer(initialUIState, setHoveredElement(element));

      expect(state.hoveredElement).toEqual(element);
    });

    it('should clear hovered element with null', () => {
      let state = uiReducer(initialUIState, setHoveredElement({ 
        type: 'hexagon', 
        position: { row: 1, col: 2 } 
      }));
      state = uiReducer(state, setHoveredElement(null));

      expect(state.hoveredElement).toBeNull();
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
      expect(initialUIState.hoveredElement).toBeNull();
      expect(initialUIState.currentRotation).toBe(0);
      expect(initialUIState.showLegalMoves).toBe(false);
      expect(initialUIState.showFlowMarkers).toBe(true);
      expect(initialUIState.animationSpeed).toBe(1.0);
      expect(initialUIState.zoom).toBe(1.0);
      expect(initialUIState.panOffset).toEqual({ x: 0, y: 0 });
    });
  });

  describe('TOGGLE_SETTINGS', () => {
    it('should toggle showSettings from false to true', () => {
      const state = uiReducer(initialUIState, toggleSettings());

      expect(state.showSettings).toBe(true);
    });

    it('should toggle showSettings from true to false', () => {
      let state = uiReducer(initialUIState, toggleSettings());
      state = uiReducer(state, toggleSettings());

      expect(state.showSettings).toBe(false);
    });
  });

  describe('UPDATE_SETTINGS', () => {
    it('should update boardRadius setting', () => {
      const state = uiReducer(initialUIState, updateSettings({ boardRadius: 5 }));

      expect(state.settings.boardRadius).toBe(5);
    });

    it('should update supermove setting', () => {
      const state = uiReducer(initialUIState, updateSettings({ supermove: true }));

      expect(state.settings.supermove).toBe(true);
    });

    it('should update multiple settings at once', () => {
      const state = uiReducer(
        initialUIState,
        updateSettings({ boardRadius: 4, supermove: true, debugShowEdgeLabels: true, debugHitTest: true })
      );

      expect(state.settings.boardRadius).toBe(4);
      expect(state.settings.supermove).toBe(true);
      expect(state.settings.debugShowEdgeLabels).toBe(true);
      expect(state.settings.debugHitTest).toBe(true);
    });

    it('should preserve other settings when updating', () => {
      const state = uiReducer(initialUIState, updateSettings({ boardRadius: 6 }));

      expect(state.settings.supermove).toBe(true); // Should remain unchanged
      expect(state.settings.debugShowEdgeLabels).toBe(false); // Should remain unchanged
    });
  });

  describe('SHOW_HELP', () => {
    it('should show help dialog at bottom-left corner', () => {
      const state = uiReducer(initialUIState, showHelp(0));

      expect(state.showHelp).toBe(true);
      expect(state.helpCorner).toBe(0);
    });

    it('should show help dialog at bottom-right corner', () => {
      const state = uiReducer(initialUIState, showHelp(1));

      expect(state.showHelp).toBe(true);
      expect(state.helpCorner).toBe(1);
    });

    it('should show help dialog at top-right corner', () => {
      const state = uiReducer(initialUIState, showHelp(2));

      expect(state.showHelp).toBe(true);
      expect(state.helpCorner).toBe(2);
    });

    it('should show help dialog at top-left corner', () => {
      const state = uiReducer(initialUIState, showHelp(3));

      expect(state.showHelp).toBe(true);
      expect(state.helpCorner).toBe(3);
    });
  });

  describe('HIDE_HELP', () => {
    it('should hide help dialog', () => {
      let state = uiReducer(initialUIState, showHelp(1));
      state = uiReducer(state, hideHelp());

      expect(state.showHelp).toBe(false);
      expect(state.helpCorner).toBeNull();
    });
  });

  describe('Unknown Action', () => {
    it('should return current state for unknown action', () => {
      const state = uiReducer(initialUIState, { type: 'UNKNOWN_ACTION' } as any);

      expect(state).toEqual(initialUIState);
    });
  });
});
