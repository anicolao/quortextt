// Animation framework actions

import { ActiveAnimation } from './types';

// Action types
export const INCREMENT_FRAME = 'INCREMENT_FRAME';
export const REGISTER_ANIMATION = 'REGISTER_ANIMATION';
export const UPDATE_ANIMATIONS = 'UPDATE_ANIMATIONS';
export const PAUSE_ANIMATIONS = 'PAUSE_ANIMATIONS';
export const RESUME_ANIMATIONS = 'RESUME_ANIMATIONS';
export const STEP_FRAME = 'STEP_FRAME';
export const CANCEL_ANIMATIONS_BY_NAME = 'CANCEL_ANIMATIONS_BY_NAME';

// Action interfaces
export interface IncrementFrameAction {
  type: typeof INCREMENT_FRAME;
}

export interface RegisterAnimationAction {
  type: typeof REGISTER_ANIMATION;
  payload: ActiveAnimation;
}

export interface UpdateAnimationsAction {
  type: typeof UPDATE_ANIMATIONS;
  payload: {
    animations: ActiveAnimation[];
  };
}

export interface PauseAnimationsAction {
  type: typeof PAUSE_ANIMATIONS;
}

export interface ResumeAnimationsAction {
  type: typeof RESUME_ANIMATIONS;
}

export interface StepFrameAction {
  type: typeof STEP_FRAME;
}

export interface CancelAnimationsByNameAction {
  type: typeof CANCEL_ANIMATIONS_BY_NAME;
  payload: {
    animationName: string;
  };
}

// Combined animation action type
export type AnimationAction =
  | IncrementFrameAction
  | RegisterAnimationAction
  | UpdateAnimationsAction
  | PauseAnimationsAction
  | ResumeAnimationsAction
  | StepFrameAction
  | CancelAnimationsByNameAction;

// Action creators
export const incrementFrame = (): IncrementFrameAction => ({
  type: INCREMENT_FRAME,
});

export const registerAnimation = (
  animationName: string,
  duration: number,
  delay: number = 0,
  loop: boolean = false
): RegisterAnimationAction => {
  // Get current frame from store
  const state = (window as any).__REDUX_STORE__.getState();
  const currentFrame = state.animation.frameCounter;
  
  // Apply debug slowdown if set
  const slowdown = (window as any).ANIMATIONS_DEBUG_SLOWDOWN || 1;
  const adjustedDuration = duration * slowdown;
  const adjustedDelay = delay * slowdown;
  
  return {
    type: REGISTER_ANIMATION,
    payload: {
      id: `${animationName}-${Date.now()}-${Math.random()}`,
      animationName,
      startFrame: currentFrame + adjustedDelay,
      endFrame: currentFrame + adjustedDelay + adjustedDuration,
      loop,
    },
  };
};

export const updateAnimations = (animations: ActiveAnimation[]): UpdateAnimationsAction => ({
  type: UPDATE_ANIMATIONS,
  payload: { animations },
});

export const pauseAnimations = (): PauseAnimationsAction => ({
  type: PAUSE_ANIMATIONS,
});

export const resumeAnimations = (): ResumeAnimationsAction => ({
  type: RESUME_ANIMATIONS,
});

export const stepFrame = (): StepFrameAction => ({
  type: STEP_FRAME,
});

export const cancelAnimationsByName = (animationName: string): CancelAnimationsByNameAction => ({
  type: CANCEL_ANIMATIONS_BY_NAME,
  payload: { animationName },
});
