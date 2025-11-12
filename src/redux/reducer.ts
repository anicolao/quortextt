// Root reducer combining all state slices

import { combineReducers } from 'redux';
import { gameReducer } from './gameReducer';
import { uiReducer } from './uiReducer';
import { animationReducer } from '../animation/reducer';
import { RESET_GAME, RESTORE_GAME } from './actions';
import type { GameAction, UIAction } from './actions';

const combinedReducer = combineReducers({
  game: gameReducer,
  ui: uiReducer,
  animation: animationReducer,
});

// Custom root reducer to handle cross-slice actions
export const rootReducer = (state: ReturnType<typeof combinedReducer> | undefined, action: GameAction | UIAction | any) => {
  // Handle RESET_GAME: save game state to UI before resetting
  if (action.type === RESET_GAME && state) {
    const savedState = {
      ...state,
      ui: {
        ...state.ui,
        savedGameState: state.game,
      },
    };
    return combinedReducer(savedState, action);
  }

  // Handle RESTORE_GAME: restore saved game state from UI
  if (action.type === RESTORE_GAME && state?.ui.savedGameState) {
    return {
      ...state,
      game: state.ui.savedGameState,
      ui: {
        ...state.ui,
        savedGameState: null, // Clear saved state after restoring
      },
    };
  }

  return combinedReducer(state, action);
};

export type RootState = ReturnType<typeof rootReducer>;
