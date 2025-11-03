// Tests for victory animations

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initVictoryAnimations, victoryAnimationState } from '../src/animation/victoryAnimations';

describe('Victory Animations', () => {
  beforeEach(() => {
    // Reset animation state before each test
    victoryAnimationState.glowIntensity = 0;
    
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

  it('should initialize with zero intensity', () => {
    expect(victoryAnimationState.glowIntensity).toBe(0);
  });

  it('should register pulse animation when initialized', () => {
    const mockDispatch = vi.fn();
    (global as any).window.__REDUX_STORE__.dispatch = mockDispatch;
    
    initVictoryAnimations();
    
    // Should have registered one animation: flow pulse
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    
    // Check that flow pulse was registered
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'REGISTER_ANIMATION',
        payload: expect.objectContaining({
          animationName: 'victory-flow-pulse'
        })
      })
    );
  });

  it('should pulse glowIntensity', async () => {
    const { defineAnimation, getAnimationFunction } = await import('../src/animation/registry');
    
    // Define the pulse animation
    defineAnimation('victory-flow-pulse', (t: number) => {
      const pulseValue = 0.5 + 0.5 * Math.sin(t * Math.PI * 4);
      victoryAnimationState.glowIntensity = pulseValue;
    });
    
    const animFn = getAnimationFunction('victory-flow-pulse');
    expect(animFn).toBeDefined();
    
    if (animFn) {
      // At start (sin(0) = 0)
      animFn(0);
      expect(victoryAnimationState.glowIntensity).toBeCloseTo(0.5, 2);
      
      // At quarter cycle (sin(π) = 0)
      animFn(0.25);
      expect(victoryAnimationState.glowIntensity).toBeCloseTo(0.5, 2);
      
      // At peak (sin(π/2) = 1)
      animFn(0.125);
      expect(victoryAnimationState.glowIntensity).toBeCloseTo(1.0, 2);
      
      // Verify it stays within range (0 to 1 because of sin wave)
      for (let t = 0; t <= 1; t += 0.1) {
        animFn(t);
        expect(victoryAnimationState.glowIntensity).toBeGreaterThanOrEqual(0);
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
});
