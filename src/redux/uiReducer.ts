// Redux reducer for UI state management

import { UIState } from './types';
import {
  UIAction,
  SET_GAME_MODE,
  SET_LOCAL_PLAYER_ID,
  SET_HOVERED_POSITION,
  SET_HOVERED_ELEMENT,
  SET_SELECTED_POSITION,
  SET_ROTATION,
  TOGGLE_LEGAL_MOVES,
  TOGGLE_SETTINGS,
  UPDATE_SETTINGS,
  SHOW_HELP,
  HIDE_HELP,
  SHOW_MOVE_LIST,
  HIDE_MOVE_LIST,
  NAVIGATE_MOVE_LIST,
  SET_PLAYER_CONNECTED,
  SET_PLAYER_DISCONNECTED,
  SET_USER_ID_MAPPING,
  SET_SPECTATOR_MODE,
  SET_SPECTATOR_COUNT,
} from './actions';

// Initial UI state
export const initialUIState: UIState = {
  gameMode: 'tabletop', // Default to tabletop mode
  localPlayerId: null, // No local player in tabletop mode
  selectedPosition: null,
  hoveredPosition: null,
  hoveredElement: null,
  currentRotation: 0,
  showLegalMoves: false,
  showFlowMarkers: true,
  animationSpeed: 1.0,
  zoom: 1.0,
  panOffset: { x: 0, y: 0 },
  showSettings: false,
  showHelp: false,
  helpCorner: null,
  showMoveList: false,
  moveListCorner: null,
  moveListIndex: -1, // -1 means showing current state, 0+ means showing historical state
  savedGameState: null,
  disconnectedPlayers: new Set(), // Track disconnected players in multiplayer
  userIdToPlayerId: new Map(), // Maps user IDs to config player IDs
  isSpectator: false, // Track if user is in spectator mode
  spectatorCount: 0, // Track number of spectators watching
  settings: {
    boardRadius: 3,
    supermove: true,
    singleSupermove: true,
    supermoveAnyPlayer: false,
    debugShowEdgeLabels: false,
    debugShowVictoryEdges: false,
    debugLegalityTest: false,
    debugAnimationSlowdown: 1,
    debugAIScoring: false,
    debugHitTest: false, // Disabled by default - can be enabled in settings
    tileDistribution: [1, 1, 1, 1], // Default balanced distribution
    enableDirtyRendering: false, // Phase 1: disabled by default
    debugShowDirtyRegions: false, // Show dirty regions visualization
    debugShowRenderMetrics: false, // Show rendering performance metrics
  },
};

// UI Reducer function
export function uiReducer(
  state: UIState = initialUIState,
  action: UIAction
): UIState {
  switch (action.type) {
    case SET_GAME_MODE: {
      return {
        ...state,
        gameMode: action.payload,
      };
    }

    case SET_LOCAL_PLAYER_ID: {
      return {
        ...state,
        localPlayerId: action.payload,
      };
    }

    case SET_HOVERED_POSITION: {
      return {
        ...state,
        hoveredPosition: action.payload,
      };
    }

    case SET_HOVERED_ELEMENT: {
      return {
        ...state,
        hoveredElement: action.payload,
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

    case SHOW_HELP: {
      return {
        ...state,
        showHelp: true,
        helpCorner: action.payload.corner,
      };
    }

    case HIDE_HELP: {
      return {
        ...state,
        showHelp: false,
        helpCorner: null,
      };
    }

    case SHOW_MOVE_LIST: {
      return {
        ...state,
        showMoveList: true,
        moveListCorner: action.payload.corner,
        moveListIndex: -1, // Start at current state
      };
    }

    case HIDE_MOVE_LIST: {
      return {
        ...state,
        showMoveList: false,
        moveListCorner: null,
        moveListIndex: -1,
      };
    }

    case NAVIGATE_MOVE_LIST: {
      // This will be handled by accessing the game state's moveHistory length
      // moveListIndex: -1 = current state, 0 = after first move, etc.
      let newIndex = state.moveListIndex;
      
      switch (action.payload.direction) {
        case 'first':
          newIndex = 0;
          break;
        case 'last':
          newIndex = -1;
          break;
        case 'prev':
          if (state.moveListIndex === -1) {
            // Can't go back from current state without knowing history length
            // Will be handled in the component
            newIndex = state.moveListIndex;
          } else {
            newIndex = Math.max(0, state.moveListIndex - 1);
          }
          break;
        case 'next':
          if (state.moveListIndex === -1) {
            // Already at current state
            newIndex = -1;
          } else {
            // Will be clamped in the component based on history length
            newIndex = state.moveListIndex + 1;
          }
          break;
      }
      
      return {
        ...state,
        moveListIndex: newIndex,
      };
    }

    case SET_PLAYER_CONNECTED: {
      const newDisconnectedPlayers = new Set(state.disconnectedPlayers);
      newDisconnectedPlayers.delete(action.payload.playerId);
      return {
        ...state,
        disconnectedPlayers: newDisconnectedPlayers,
      };
    }

    case SET_PLAYER_DISCONNECTED: {
      const newDisconnectedPlayers = new Set(state.disconnectedPlayers);
      newDisconnectedPlayers.add(action.payload.playerId);
      return {
        ...state,
        disconnectedPlayers: newDisconnectedPlayers,
      };
    }

    case SET_USER_ID_MAPPING: {
      return {
        ...state,
        userIdToPlayerId: action.payload.mapping,
      };
    }

    case SET_SPECTATOR_MODE: {
      return {
        ...state,
        isSpectator: action.payload.isSpectator,
      };
    }

    case SET_SPECTATOR_COUNT: {
      return {
        ...state,
        spectatorCount: action.payload.count,
      };
    }

    default:
      return state;
  }
}
