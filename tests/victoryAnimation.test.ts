// Tests for victory animations

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initVictoryAnimations, victoryAnimationState } from '../src/animation/victoryAnimations';

describe('Victory Animations', () => {
  beforeEach(() => {
    // Reset animation state before each test
    victoryAnimationState.glowIntensity = 0.5;
    
    // Mock the window.__REDUX_STORE__ if needed for tests
    (global as any).window = {
      __REDUX_STORE__: {
        dispatch: vi.fn(),
        getState: vi.fn(() => ({
          game: { screen: 'game-over' },
          animation: { frameCounter: 0, paused: false, animations: [] }
        }))
      }
    };
  });

  it('should initialize with starting intensity', () => {
    // Reset first
    victoryAnimationState.glowIntensity = 0;
    initVictoryAnimations();
    expect(victoryAnimationState.glowIntensity).toBe(0.5);
  });

  it('should register looping breathing animation when initialized', () => {
    const mockDispatch = vi.fn();
    (global as any).window.__REDUX_STORE__.dispatch = mockDispatch;
    
    initVictoryAnimations();
    
    // Should have registered one animation: breathing glow
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    
    // Check that breathing glow was registered with loop enabled
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'REGISTER_ANIMATION',
        payload: expect.objectContaining({
          animationName: 'victory-flow-glow',
          loop: true
        })
      })
    );
  });

  it('should breathe glowIntensity smoothly', async () => {
    const { getAnimationFunction } = await import('../src/animation/registry');
    
    // Initialize to define the animation
    initVictoryAnimations();
    
    const animFn = getAnimationFunction('victory-flow-glow');
    expect(animFn).toBeDefined();
    
    if (animFn) {
      // At start (t=0): intensity should be 0.5
      animFn(0);
      expect(victoryAnimationState.glowIntensity).toBeCloseTo(0.5, 2);
      
      // At midpoint (t=0.5): intensity should be at peak (1.0)
      animFn(0.5);
      expect(victoryAnimationState.glowIntensity).toBeCloseTo(1.0, 2);
      
      // At end (t=1): intensity should return to 0.5 for seamless loop
      animFn(1);
      expect(victoryAnimationState.glowIntensity).toBeCloseTo(0.5, 2);
      
      // Verify it stays within range (0.5 to 1.0 for breathing effect)
      for (let t = 0; t <= 1; t += 0.1) {
        animFn(t);
        expect(victoryAnimationState.glowIntensity).toBeGreaterThanOrEqual(0.5);
        expect(victoryAnimationState.glowIntensity).toBeLessThanOrEqual(1.0);
      }
    }
  });

  it('should handle missing Redux store gracefully', () => {
    // Remove the mock store
    delete (global as any).window.__REDUX_STORE__;
    
    // Should not throw
    expect(() => initVictoryAnimations()).not.toThrow();
  });

  it('should cancel victory animations', async () => {
    const { cancelVictoryAnimations } = await import('../src/animation/victoryAnimations');
    const mockDispatch = vi.fn();
    (global as any).window.__REDUX_STORE__.dispatch = mockDispatch;
    
    cancelVictoryAnimations();
    
    // Should have dispatched cancel action
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CANCEL_ANIMATIONS_BY_NAME',
        payload: expect.objectContaining({
          animationName: 'victory-flow-glow'
        })
      })
    );
    
    // Should reset glow intensity
    expect(victoryAnimationState.glowIntensity).toBe(0);
  });
});
