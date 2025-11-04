// Animation processor - executes active animations each frame

import { AnimationState, ActiveAnimation } from './types';
import { getAnimationFunction } from './registry';
import { updateAnimations } from './actions';

/**
 * Process all active animations for the current frame
 * Returns updated list of animations (with completed ones removed)
 */
export function processAnimations(
  state: AnimationState,
  dispatch: (action: any) => void
): void {
  const currentFrame = state.frameCounter;
  const animations = state.animations;
  
  // Skip if no animations
  if (animations.length === 0) {
    return;
  }

  // List is sorted by startFrame, so active animations are at the front
  const activeAnimations: ActiveAnimation[] = [];
  let hasCompletedAnimations = false;

  for (const animation of animations) {
    // Skip if not started yet
    if (currentFrame < animation.startFrame) {
      // Since list is sorted, all remaining animations are also not started
      activeAnimations.push(animation);
      continue;
    }

    // Calculate progress
    const totalFrames = animation.endFrame - animation.startFrame;
    const elapsedFrames = currentFrame - animation.startFrame;
    const t = Math.min(1, elapsedFrames / totalFrames);

    // Get and call animation function
    const animFn = getAnimationFunction(animation.animationName);
    if (animFn) {
      try {
        animFn(t);
      } catch (error) {
        console.error(`Error executing animation '${animation.animationName}':`, error);
      }
    } else {
      console.warn(`Animation function '${animation.animationName}' not found in registry`);
    }

    // Keep animation if not complete
    if (t < 1) {
      activeAnimations.push(animation);
    } else {
      // Animation completed
      hasCompletedAnimations = true;
      
      // If animation should loop, restart it
      if (animation.loop) {
        const duration = animation.endFrame - animation.startFrame;
        activeAnimations.push({
          ...animation,
          startFrame: currentFrame,
          endFrame: currentFrame + duration,
        });
      }
    }
  }

  // Update animation list if any animations completed
  if (hasCompletedAnimations) {
    dispatch(updateAnimations(activeAnimations));
  }
}
