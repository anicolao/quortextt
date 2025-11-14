// Tests for AI player behavior during rematch
// This test validates that AI players take their first move after a rematch

import { describe, it, expect, beforeEach } from 'vitest';
import { createStore, applyMiddleware } from 'redux';
import { rootReducer } from '../src/redux/reducer';
import { aiMiddleware } from '../src/redux/aiMiddleware';
import { resetPlayerIdCounter } from '../src/redux/gameReducer';
import {
  addPlayer,
  startGame,
  selectEdge,
  rematchGame,
  placeTile,
  nextPlayer,
  drawTile,
  updateSettings,
  GameAction,
} from '../src/redux/actions';
import type { RootState } from '../src/redux/types';

describe('AI Rematch Functionality', () => {
  beforeEach(() => {
    resetPlayerIdCounter();
  });

  it('should make AI take the first move after rematch when AI becomes first player', { timeout: 30000 }, () => {
    // Create a store with aiMiddleware
    const store = createStore(
      rootReducer,
      applyMiddleware(aiMiddleware)
    );

    // Disable supermoves to make the test run faster
    // The test is about rematch behavior, not supermove functionality
    store.dispatch(updateSettings({ supermove: false }));

    // Add two AI players to guarantee AI behavior
    store.dispatch({
      type: 'ADD_PLAYER',
      payload: { color: '#DE8F05', edge: 0, isAI: true },
    } as GameAction);
    store.dispatch({
      type: 'ADD_PLAYER',
      payload: { color: '#0173B2', edge: 1, isAI: true },
    } as GameAction);

    // Start the game with supermove disabled (random seed is fine - games complete via constraint victory)
    const state_ui = store.getState() as RootState;
    store.dispatch(startGame({
      supermove: state_ui.ui.settings.supermove,
      singleSupermove: state_ui.ui.settings.singleSupermove,
    }) as any);

    // AI players will auto-select edges and play the entire game instantly via middleware
    // since Redux middleware is synchronous
    let state = store.getState() as RootState;
    
    // The game should be over by now (two AIs play instantly until victory)
    console.log(`Game 1 state: ${state.game.screen}, phase: ${state.game.phase}`);
    expect(state.game.screen).toBe('game-over');
    const game1BoardSize = state.game.board.size;

    // Now trigger a rematch from the game-over state
    store.dispatch(rematchGame() as any);

    // Get new state after rematch
    state = store.getState() as RootState;

    console.log(`After rematch - state: ${state.game.screen}, phase: ${state.game.phase}`);
    console.log(`Board size: ${state.game.board.size}`);
    console.log(`First player is AI: ${state.game.players[state.game.currentPlayerIndex].isAI}`);

    // Verify that the AI made at least one move after rematch
    // The test is about rematch behavior - we just need to verify the AI took action
    const firstPlayerAfterRematch = state.game.players[state.game.currentPlayerIndex];
    
    // Since both players are AI, the first player is definitely AI
    expect(firstPlayerAfterRematch.isAI).toBe(true);
    
    // After rematch, AI should have made moves (board should have tiles)
    // The game may have completed entirely, which is fine - we just verify it played
    expect(state.game.board.size).toBeGreaterThan(0);
    console.log(`✓ AI made moves after rematch (${state.game.board.size} tiles placed vs ${game1BoardSize} in game 1)`);
  });
});
