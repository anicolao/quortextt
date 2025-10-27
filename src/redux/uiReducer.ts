// Redux reducer for UI state management

import { UIState } from './types';
import {
  UIAction,
  SET_HOVERED_POSITION,
  SET_ROTATION,
  TOGGLE_LEGAL_MOVES,
} from './actions';

// Initial UI state
export const initialUIState: UIState = {
  selectedPosition: null,
  hoveredPosition: null,
  currentRotation: 0,
  showLegalMoves: false,
  showFlowMarkers: true,
  animationSpeed: 1.0,
  zoom: 1.0,
  panOffset: { x: 0, y: 0 },
};

// UI Reducer function
export function uiReducer(
  state: UIState = initialUIState,
  action: UIAction
): UIState {
  switch (action.type) {
    case SET_HOVERED_POSITION: {
      return {
        ...state,
        hoveredPosition: action.payload,
      };
    }

    case SET_ROTATION: {
      return {
        ...state,
        currentRotation: action.payload,
      };
    }

    case TOGGLE_LEGAL_MOVES: {
      return {
        ...state,
        showLegalMoves: !state.showLegalMoves,
      };
    }

    default:
      return state;
  }
}
