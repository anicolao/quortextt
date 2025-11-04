// Victory animation definitions using the animation framework

import { defineAnimation } from './registry';
import { registerAnimation, cancelAnimationsByName } from './actions';

// State for victory animation rendering (not in Redux)
export const victoryAnimationState = {
  glowIntensity: 0.5, // Start at 0.5 (minimum intensity)
};

/**
 * Ease-in-out function for smooth breathing effect
 */
function easeInOut(t: number): number {
  return t < 0.5
    ? 2 * t * t
    : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Initialize victory animations when game over screen is shown
 */
export function initVictoryAnimations(): void {
  // Reset animation state to start of breathing cycle
  victoryAnimationState.glowIntensity = 0.5;

  // Define breathing glow animation for winning flow
  // Breathing effect: smooth ease-in-out from 0.5 to 1.0 and back to 0.5
  defineAnimation('victory-flow-glow', (t: number) => {
    // Apply ease-in-out for smooth breathing
    const eased = easeInOut(t);
    // Breathe from 0.5 to 1.0 and back to 0.5
    // At t=0: intensity=0.5, at t=0.5: intensity=1.0, at t=1: intensity=0.5
    const intensity = 0.5 + 0.5 * Math.sin(eased * Math.PI);
    victoryAnimationState.glowIntensity = intensity;
  });

  // Get Redux store from window (it's exposed for testing)
  const store = (window as any).__REDUX_STORE__;
  if (!store) {
    console.warn('Redux store not available for victory animations');
    return;
  }

  // Register breathing animation: 120 frames (~2 seconds) with loop enabled
  store.dispatch(registerAnimation('victory-flow-glow', 120, 0, true));
}

/**
 * Cancel victory animations when navigating away from victory screen
 */
export function cancelVictoryAnimations(): void {
  const store = (window as any).__REDUX_STORE__;
  if (!store) {
    return;
  }

  // Cancel all victory glow animations
  store.dispatch(cancelAnimationsByName('victory-flow-glow'));
  
  // Reset glow intensity
  victoryAnimationState.glowIntensity = 0;
}
