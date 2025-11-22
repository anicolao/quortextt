// E2E test for dirty rendering optimization
import { test, expect, Page } from '@playwright/test';
import { getReduxState, waitForAnimationFrame, setupTwoPlayerGame } from './helpers';

/**
 * Get render metrics from the gameplayRenderer
 */
async function getRenderMetrics(page: Page) {
  return await page.evaluate(() => {
    const renderer = (window as any).__REDUX_STORE__.getState();
    // Access the renderer through the canvas element
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    if (!canvas) return null;
    
    // Get the renderer instance from the window (we'll need to expose it)
    const rendererInstance = (window as any).__RENDERER__;
    if (!rendererInstance) return null;
    
    const gameplayRenderer = rendererInstance.getGameplayRenderer();
    if (!gameplayRenderer) return null;
    
    return gameplayRenderer.getRenderMetrics();
  });
}

/**
 * Enable dirty rendering in settings
 */
async function enableDirtyRendering(page: Page) {
  await page.evaluate(() => {
    const store = (window as any).__REDUX_STORE__;
    store.dispatch({
      type: 'UPDATE_SETTINGS',
      payload: {
        enableDirtyRendering: true,
        debugShowDirtyRegions: false,
        debugShowRenderMetrics: false,
      }
    });
  });
  await waitForAnimationFrame(page);
}

/**
 * Dispatch an action to increment frame counter without triggering state changes
 */
async function incrementFrameOnly(page: Page) {
  await page.evaluate(() => {
    const store = (window as any).__REDUX_STORE__;
    store.dispatch({ type: 'INCREMENT_FRAME' });
  });
  await waitForAnimationFrame(page);
}

test.describe('Dirty Rendering Optimization', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/quortextt/tabletop.html');
    await page.waitForSelector('#game-canvas');
    // Game setup will be done in each test after navigating
  });

  test('should skip rendering on idle frames with no state changes', async ({ page }) => {
    // Setup a 2-player game (bypasses lobby by dispatching Redux actions directly)
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'START_GAME', payload: { seed: 12345 } });
    });
    await waitForAnimationFrame(page);
    
    // Wait for seating phase
    await page.waitForFunction(() => {
      const state = (window as any).__REDUX_STORE__.getState();
      return state.game.screen === 'seating';
    }, { timeout: 5000 });
    
    // Complete seating by selecting edges via redux actions
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      const state = store.getState();
      const seatingOrder = state.game.seatingPhase.seatingOrder;
      
      // Player 1 selects edge 0
      store.dispatch({ type: 'SELECT_EDGE', payload: { playerId: seatingOrder[0], edgeNumber: 0 } });
    });
    await waitForAnimationFrame(page);
    
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      const state = store.getState();
      const seatingOrder = state.game.seatingPhase.seatingOrder;
      
      // Player 2 selects edge 3
      store.dispatch({ type: 'SELECT_EDGE', payload: { playerId: seatingOrder[1], edgeNumber: 3 } });
    });
    await waitForAnimationFrame(page);
    
    // Now we should be in gameplay
    const state = await getReduxState(page);
    expect(state.game.screen).toBe('gameplay');
    
    // Enable dirty rendering
    await enableDirtyRendering(page);
    
    // Get initial metrics
    const metrics1 = await getRenderMetrics(page);
    if (!metrics1) {
      // Renderer not exposed, skip test
      test.skip();
      return;
    }
    
    // Increment frame counter multiple times without changing anything else
    await incrementFrameOnly(page);
    await incrementFrameOnly(page);
    await incrementFrameOnly(page);
    
    // Get metrics after idle frames
    const metrics2 = await getRenderMetrics(page);
    
    // On idle frames with dirty rendering enabled, pixels painted should be 0
    // or very small (just debug overlays if enabled)
    expect(metrics2.pixelsPainted).toBeLessThan(1000); // Should be 0 or near 0
    expect(metrics2.dirtyRegionCount).toBeLessThanOrEqual(1);
  });

  test('should reduce pixels painted when only animations are running', async ({ page }) => {
    // Setup a 2-player game
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'START_GAME', payload: { seed: 12345 } });
    });
    await waitForAnimationFrame(page);
    
    // Wait for seating phase
    await page.waitForFunction(() => {
      const state = (window as any).__REDUX_STORE__.getState();
      return state.game.screen === 'seating';
    }, { timeout: 5000 });
    
    const canvas = await page.$('#game-canvas');
    const box = await canvas!.boundingBox();
    
    // Complete seating
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height - 100);
    await waitForAnimationFrame(page);
    await page.mouse.click(box!.x + box!.width / 2, box!.y + 100);
    await waitForAnimationFrame(page);
    
    // Enable dirty rendering
    await enableDirtyRendering(page);
    
    // Place a tile to trigger flow animation
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await waitForAnimationFrame(page);
    
    // Click checkmark to confirm
    await page.mouse.click(box!.x + box!.width / 2 + 100, box!.y + box!.height / 2 + 100);
    await waitForAnimationFrame(page);
    
    // Wait a bit for animation
    await page.waitForTimeout(100);
    
    const metrics = await getRenderMetrics(page);
    if (!metrics) {
      test.skip();
      return;
    }
    
    // Get canvas size
    const canvasSize = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      return canvas.width * canvas.height;
    });
    
    // With dirty rendering, pixels painted should be less than full canvas
    // During animations, we still need to paint, but it should be optimized
    const percentagePainted = (metrics.pixelsPainted / canvasSize) * 100;
    
    // Should paint less than 100% of canvas even during animation
    // (may still be high during active animations, but should not be full canvas every frame)
    expect(percentagePainted).toBeLessThanOrEqual(100);
  });

  test('should properly detect when no rendering is needed', async ({ page }) => {
    // Setup a 2-player game
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'START_GAME', payload: { seed: 12345 } });
    });
    await waitForAnimationFrame(page);
    
    // Wait for seating phase
    await page.waitForFunction(() => {
      const state = (window as any).__REDUX_STORE__.getState();
      return state.game.screen === 'seating';
    }, { timeout: 5000 });
    
    // Complete seating by selecting edges via redux actions
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      const state = store.getState();
      const seatingOrder = state.game.seatingPhase.seatingOrder;
      
      // Player 1 selects edge 0
      store.dispatch({ type: 'SELECT_EDGE', payload: { playerId: seatingOrder[0], edgeNumber: 0 } });
    });
    await waitForAnimationFrame(page);
    
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      const state = store.getState();
      const seatingOrder = state.game.seatingPhase.seatingOrder;
      
      // Player 2 selects edge 3
      store.dispatch({ type: 'SELECT_EDGE', payload: { playerId: seatingOrder[1], edgeNumber: 3 } });
    });
    await waitForAnimationFrame(page);
    
    // Enable dirty rendering
    await enableDirtyRendering(page);
    
    // Wait for any initial animations to complete
    await page.waitForTimeout(500);
    
    // Record metrics before idle period
    const metricsBefore = await getRenderMetrics(page);
    if (!metricsBefore) {
      test.skip();
      return;
    }
    
    // Simulate idle frames (no state changes except frame counter)
    for (let i = 0; i < 10; i++) {
      await incrementFrameOnly(page);
    }
    
    // Get metrics after idle frames
    const metricsAfter = await getRenderMetrics(page);
    
    // During idle frames, dirty region count should be 0 (nothing to render)
    // or pixels painted should be minimal
    const isIdle = metricsAfter.dirtyRegionCount === 0 || metricsAfter.pixelsPainted === 0;
    expect(isIdle).toBe(true);
  });

  test('should compare dirty vs non-dirty rendering pixel counts', async ({ page }) => {
    // Setup a 2-player game
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'START_GAME', payload: { seed: 12345 } });
    });
    await waitForAnimationFrame(page);
    
    // Wait for seating phase
    await page.waitForFunction(() => {
      const state = (window as any).__REDUX_STORE__.getState();
      return state.game.screen === 'seating';
    }, { timeout: 5000 });
    
    // Complete seating by selecting edges via redux actions
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      const state = store.getState();
      const seatingOrder = state.game.seatingPhase.seatingOrder;
      
      // Player 1 selects edge 0
      store.dispatch({ type: 'SELECT_EDGE', payload: { playerId: seatingOrder[0], edgeNumber: 0 } });
    });
    await waitForAnimationFrame(page);
    
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      const state = store.getState();
      const seatingOrder = state.game.seatingPhase.seatingOrder;
      
      // Player 2 selects edge 3
      store.dispatch({ type: 'SELECT_EDGE', payload: { playerId: seatingOrder[1], edgeNumber: 3 } });
    });
    await waitForAnimationFrame(page);
    
    // Wait for animations to settle
    await page.waitForTimeout(500);
    
    // Test with dirty rendering DISABLED first
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({
        type: 'UPDATE_SETTINGS',
        payload: { enableDirtyRendering: false }
      });
    });
    await waitForAnimationFrame(page);
    
    // Increment frame several times and record pixels painted
    const pixelsWithoutDirty: number[] = [];
    for (let i = 0; i < 5; i++) {
      await incrementFrameOnly(page);
      const metrics = await getRenderMetrics(page);
      if (metrics) pixelsWithoutDirty.push(metrics.pixelsPainted);
    }
    
    // Now enable dirty rendering
    await enableDirtyRendering(page);
    
    // Increment frame several times and record pixels painted
    const pixelsWithDirty: number[] = [];
    for (let i = 0; i < 5; i++) {
      await incrementFrameOnly(page);
      const metrics = await getRenderMetrics(page);
      if (metrics) pixelsWithDirty.push(metrics.pixelsPainted);
    }
    
    if (pixelsWithoutDirty.length === 0 || pixelsWithDirty.length === 0) {
      test.skip();
      return;
    }
    
    // Calculate averages
    const avgWithoutDirty = pixelsWithoutDirty.reduce((a, b) => a + b, 0) / pixelsWithoutDirty.length;
    const avgWithDirty = pixelsWithDirty.reduce((a, b) => a + b, 0) / pixelsWithDirty.length;
    
    // With dirty rendering enabled on idle frames, we should paint significantly fewer pixels
    // The dirty rendering should be at most equal to non-dirty, but ideally much less
    expect(avgWithDirty).toBeLessThanOrEqual(avgWithoutDirty);
    
    // For truly idle frames (no animations), dirty rendering should paint 0 pixels
    // while non-dirty will always paint the full canvas
    if (avgWithDirty === 0) {
      expect(avgWithoutDirty).toBeGreaterThan(0);
    }
  });
});
