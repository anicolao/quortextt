// Root reducer combining all state slices

import { combineReducers } from 'redux';
import { gameReducer } from './gameReducer';
import { uiReducer } from './uiReducer';
import { animationReducer } from '../animation/reducer';

export const rootReducer = combineReducers({
  game: gameReducer,
  ui: uiReducer,
  animation: animationReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
