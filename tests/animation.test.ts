// Tests for animation framework

import { describe, it, expect, beforeEach } from 'vitest';
import { animationReducer, initialAnimationState } from '../src/animation/reducer';
import {
  incrementFrame,
  registerAnimation,
  updateAnimations,
  pauseAnimations,
  resumeAnimations,
  stepFrame,
} from '../src/animation/actions';
import {
  defineAnimation,
  getAnimationFunction,
  undefineAnimation,
  clearAnimations,
  getRegisteredAnimations,
} from '../src/animation/registry';

describe('Animation Framework', () => {
  beforeEach(() => {
    clearAnimations();
  });

  describe('Animation Registry', () => {
    it('should register and retrieve animation functions', () => {
      let callCount = 0;
      const testAnim = (t: number) => {
        callCount++;
      };

      defineAnimation('test-anim', testAnim);
      
      const retrieved = getAnimationFunction('test-anim');
      expect(retrieved).toBeDefined();
      
      if (retrieved) {
        retrieved(0.5);
        expect(callCount).toBe(1);
      }
    });

    it('should undefine animations', () => {
      defineAnimation('temp-anim', (t) => {});
      expect(getAnimationFunction('temp-anim')).toBeDefined();
      
      undefineAnimation('temp-anim');
      expect(getAnimationFunction('temp-anim')).toBeUndefined();
    });

    it('should list registered animations', () => {
      defineAnimation('anim1', (t) => {});
      defineAnimation('anim2', (t) => {});
      
      const registered = getRegisteredAnimations();
      expect(registered).toContain('anim1');
      expect(registered).toContain('anim2');
    });

    it('should clear all animations', () => {
      defineAnimation('anim1', (t) => {});
      defineAnimation('anim2', (t) => {});
      
      clearAnimations();
      expect(getRegisteredAnimations()).toHaveLength(0);
    });
  });

  describe('Animation Reducer', () => {
    it('should have correct initial state', () => {
      expect(initialAnimationState.frameCounter).toBe(0);
      expect(initialAnimationState.paused).toBe(false);
      expect(initialAnimationState.animations).toHaveLength(0);
    });

    it('should increment frame counter', () => {
      const state = animationReducer(initialAnimationState, incrementFrame());
      expect(state.frameCounter).toBe(1);
      
      const state2 = animationReducer(state, incrementFrame());
      expect(state2.frameCounter).toBe(2);
    });

    it('should pause and resume animations', () => {
      let state = animationReducer(initialAnimationState, pauseAnimations());
      expect(state.paused).toBe(true);
      
      state = animationReducer(state, resumeAnimations());
      expect(state.paused).toBe(false);
    });

    it('should step frame only when paused', () => {
      // Step frame when not paused - no change
      let state = animationReducer(initialAnimationState, stepFrame());
      expect(state.frameCounter).toBe(0);
      
      // Pause and step - should increment
      state = animationReducer(state, pauseAnimations());
      state = animationReducer(state, stepFrame());
      expect(state.frameCounter).toBe(1);
    });

    it('should register animations in sorted order', () => {
      // Create a mock store state for registerAnimation to use
      (global as any).window = {
        __REDUX_STORE__: {
          getState: () => ({
            animation: { frameCounter: 0 }
          })
        }
      };

      let state = initialAnimationState;
      
      // Register animation starting at frame 10
      const action1 = {
        type: 'REGISTER_ANIMATION' as const,
        payload: {
          id: 'anim1',
          animationName: 'test1',
          startFrame: 10,
          endFrame: 20,
        }
      };
      state = animationReducer(state, action1);
      
      // Register animation starting at frame 5 (should be inserted before)
      const action2 = {
        type: 'REGISTER_ANIMATION' as const,
        payload: {
          id: 'anim2',
          animationName: 'test2',
          startFrame: 5,
          endFrame: 15,
        }
      };
      state = animationReducer(state, action2);
      
      // Register animation starting at frame 15 (should be inserted in middle)
      const action3 = {
        type: 'REGISTER_ANIMATION' as const,
        payload: {
          id: 'anim3',
          animationName: 'test3',
          startFrame: 15,
          endFrame: 25,
        }
      };
      state = animationReducer(state, action3);
      
      expect(state.animations).toHaveLength(3);
      expect(state.animations[0].startFrame).toBe(5);
      expect(state.animations[1].startFrame).toBe(10);
      expect(state.animations[2].startFrame).toBe(15);
    });

    it('should update animations list', () => {
      let state = initialAnimationState;
      
      const newAnimations = [
        {
          id: 'anim1',
          animationName: 'test1',
          startFrame: 0,
          endFrame: 10,
        }
      ];
      
      state = animationReducer(state, updateAnimations(newAnimations));
      expect(state.animations).toHaveLength(1);
      expect(state.animations[0].id).toBe('anim1');
    });
  });

  describe('Animation Lifecycle', () => {
    it('should handle complete animation flow', () => {
      // Setup mock store
      (global as any).window = {
        __REDUX_STORE__: {
          getState: () => ({
            animation: { frameCounter: 0 }
          })
        }
      };

      let callLog: number[] = [];
      defineAnimation('lifecycle-test', (t: number) => {
        callLog.push(t);
      });

      let state = initialAnimationState;
      
      // Register animation
      const action = {
        type: 'REGISTER_ANIMATION' as const,
        payload: {
          id: 'test',
          animationName: 'lifecycle-test',
          startFrame: 0,
          endFrame: 10,
        }
      };
      state = animationReducer(state, action);
      expect(state.animations).toHaveLength(1);

      // Simulate completion by updating animations list
      state = animationReducer(state, updateAnimations([]));
      expect(state.animations).toHaveLength(0);
    });
  });
});
