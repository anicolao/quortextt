// Animation state reducer

import { AnimationState } from './types';
import {
  AnimationAction,
  INCREMENT_FRAME,
  REGISTER_ANIMATION,
  UPDATE_ANIMATIONS,
  PAUSE_ANIMATIONS,
  RESUME_ANIMATIONS,
  STEP_FRAME,
} from './actions';

// Initial animation state
export const initialAnimationState: AnimationState = {
  frameCounter: 0,
  paused: false,
  animations: [],
};

export function animationReducer(
  state: AnimationState = initialAnimationState,
  action: AnimationAction
): AnimationState {
  switch (action.type) {
    case INCREMENT_FRAME:
      return {
        ...state,
        frameCounter: state.frameCounter + 1,
      };

    case REGISTER_ANIMATION: {
      // Insert animation in sorted order by startFrame
      const newAnimation = action.payload;
      const animations = [...state.animations];
      
      // Find insertion point
      let insertIndex = animations.length;
      for (let i = 0; i < animations.length; i++) {
        if (animations[i].startFrame > newAnimation.startFrame) {
          insertIndex = i;
          break;
        }
      }
      
      animations.splice(insertIndex, 0, newAnimation);
      
      return {
        ...state,
        animations,
      };
    }

    case UPDATE_ANIMATIONS:
      return {
        ...state,
        animations: action.payload.animations,
      };

    case PAUSE_ANIMATIONS:
      return {
        ...state,
        paused: true,
      };

    case RESUME_ANIMATIONS:
      return {
        ...state,
        paused: false,
      };

    case STEP_FRAME:
      // Only increment frame if paused (for debugging)
      if (state.paused) {
        return {
          ...state,
          frameCounter: state.frameCounter + 1,
        };
      }
      return state;

    default:
      return state;
  }
}
