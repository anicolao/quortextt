// Redux store configuration

import { createStore, applyMiddleware, compose } from 'redux';
import { rootReducer } from './reducer';
import { aiMiddleware } from './aiMiddleware';

// Set up Redux DevTools Extension with middleware support
const composeEnhancers =
  typeof window !== 'undefined' &&
  (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
    ? (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
    : compose;

// Apply middleware
const enhancer = composeEnhancers(
  applyMiddleware(aiMiddleware)
);

export const store = createStore(rootReducer, enhancer);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
