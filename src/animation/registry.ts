// Animation function registry
// Animation functions are stored outside Redux (not serializable)

import { AnimationFunction } from './types';

// Global registry of animation functions
const animationFunctions = new Map<string, AnimationFunction>();

/**
 * Register a named animation function
 */
export function defineAnimation(name: string, animFn: AnimationFunction): void {
  animationFunctions.set(name, animFn);
}

/**
 * Get animation function by name
 */
export function getAnimationFunction(name: string): AnimationFunction | undefined {
  return animationFunctions.get(name);
}

/**
 * Remove animation function from registry
 */
export function undefineAnimation(name: string): void {
  animationFunctions.delete(name);
}

/**
 * Clear all animation functions (for testing)
 */
export function clearAnimations(): void {
  animationFunctions.clear();
}

/**
 * Get list of all registered animation names
 */
export function getRegisteredAnimations(): string[] {
  return Array.from(animationFunctions.keys());
}
