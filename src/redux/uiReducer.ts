// Redux reducer for UI state management

import { UIState } from './types';
import {
  UIAction,
  SET_HOVERED_POSITION,
  SET_SELECTED_POSITION,
  SET_ROTATION,
  TOGGLE_LEGAL_MOVES,
  TOGGLE_SETTINGS,
  UPDATE_SETTINGS,
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
  showSettings: false,
  settings: {
    boardRadius: 3,
    supermove: true,
    singleSupermove: false,
    debugShowEdgeLabels: false,
    debugShowVictoryEdges: false,
    debugLegalityTest: false,
    debugAnimationSlowdown: 1,
    debugAIScoring: false,
    tileDistribution: [1, 1, 1, 1], // Default balanced distribution
  },
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

    case SET_SELECTED_POSITION: {
      return {
        ...state,
        selectedPosition: action.payload,
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

    case TOGGLE_SETTINGS: {
      return {
        ...state,
        showSettings: !state.showSettings,
      };
    }

    case UPDATE_SETTINGS: {
      return {
        ...state,
        settings: {
          ...state.settings,
          ...action.payload,
        },
      };
    }

    default:
      return state;
  }
}
