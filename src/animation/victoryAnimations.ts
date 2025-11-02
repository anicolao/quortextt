// Victory animation definitions using the animation framework

import { defineAnimation } from './registry';
import { registerAnimation } from './actions';

// State for victory animation rendering (not in Redux)
export const victoryAnimationState = {
  modalOpacity: 0,
  glowIntensity: 0,
};

/**
 * Initialize victory animations when game over screen is shown
 */
export function initVictoryAnimations(): void {
  // Reset animation state
  victoryAnimationState.modalOpacity = 0;
  victoryAnimationState.glowIntensity = 0;

  // Define modal fade-in animation
  defineAnimation('victory-modal-fade-in', (t: number) => {
    victoryAnimationState.modalOpacity = t;
  });

  // Define pulsing glow animation for winning flow
  // Pulsing effect: sine wave for continuous animation
  defineAnimation('victory-flow-pulse', (t: number) => {
    // Pulse between 0.5 and 1.0 intensity
    const pulseValue = 0.5 + 0.5 * Math.sin(t * Math.PI * 4);
    victoryAnimationState.glowIntensity = pulseValue;
  });

  // Get Redux store from window (it's exposed for testing)
  const store = (window as any).__REDUX_STORE__;
  if (!store) {
    console.warn('Redux store not available for victory animations');
    return;
  }

  // Register animations
  // Modal fade-in: 18 frames (~300ms) with no delay
  store.dispatch(registerAnimation('victory-modal-fade-in', 18, 0));

  // Flow pulse: 120 frames (~2 seconds) - will loop by re-registering
  store.dispatch(registerAnimation('victory-flow-pulse', 120, 0));
}

/**
 * Continue pulsing animation indefinitely
 * Call this after the pulse animation completes to keep it going
 */
export function continuePulseAnimation(): void {
  const store = (window as any).__REDUX_STORE__;
  if (!store) {
    return;
  }

  // Check if we're still on game-over screen
  const state = store.getState();
  if (state.game.screen === 'game-over') {
    // Re-register the pulse animation to continue
    store.dispatch(registerAnimation('victory-flow-pulse', 120, 0));
    
    // Schedule next continuation
    setTimeout(() => continuePulseAnimation(), 2000);
  }
}
