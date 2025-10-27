// Root reducer combining all state slices

import { combineReducers } from 'redux';
import { gameReducer } from './gameReducer';
import { uiReducer } from './uiReducer';

export const rootReducer = combineReducers({
  game: gameReducer,
  ui: uiReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
