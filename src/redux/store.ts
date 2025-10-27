// Redux store configuration

import { createStore } from 'redux';
import { rootReducer } from './reducer';

// Set up Redux DevTools Extension
const devToolsExtension =
  typeof window !== 'undefined' &&
  (window as any).__REDUX_DEVTOOLS_EXTENSION__
    ? (window as any).__REDUX_DEVTOOLS_EXTENSION__()
    : undefined;

export const store = createStore(rootReducer, devToolsExtension);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
