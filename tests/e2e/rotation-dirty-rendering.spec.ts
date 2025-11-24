// E2E test to verify that rotation changes only mark the preview tile dirty, not the entire canvas
import { test, expect, Page } from '@playwright/test';
import { getReduxState, waitForAnimationFrame } from './helpers';

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
 * Setup a basic 2-player game in gameplay mode
 */
async function setupGame(page: Page) {
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
  
  // Now we should be in gameplay
  const state = await getReduxState(page);
  expect(state.game.screen).toBe('gameplay');
  
  // Wait for any animations to settle
  await page.waitForTimeout(500);
}

test.describe('Rotation with Dirty Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/quortextt/tabletop.html');
    await page.waitForSelector('#game-canvas');
  });

  test('should mark entire canvas dirty when rotation changes with dirty rendering disabled', async ({ page }) => {
    await setupGame(page);
    
    // DISABLE dirty rendering to force full redraws
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({
        type: 'UPDATE_SETTINGS',
        payload: {
          enableDirtyRendering: false,
        }
      });
    });
    await waitForAnimationFrame(page);
    
    // Draw a tile
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'DRAW_TILE' });
    });
    await waitForAnimationFrame(page);
    
    // Select a position for preview
    const canvas = await page.$('#game-canvas');
    const box = await canvas!.boundingBox();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await waitForAnimationFrame(page);
    
    // Wait for animations to settle
    await page.waitForTimeout(200);
    
    // Get current rotation
    const currentRotation = await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      return store.getState().ui.currentRotation;
    });
    
    // Change rotation
    const newRotation = (currentRotation + 1) % 6;
    await page.evaluate((rot) => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'SET_ROTATION', payload: rot });
    }, newRotation);
    await waitForAnimationFrame(page);
    
    // Get metrics after rotation
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
    
    // With dirty rendering DISABLED, should paint entire canvas
    console.log(`With dirty rendering disabled, painted ${metrics.pixelsPainted} pixels (${(metrics.pixelsPainted / canvasSize * 100).toFixed(2)}%)`);
    
    // Should paint entire canvas
    expect(metrics.pixelsPainted).toBe(canvasSize);
  });

  test('should only mark preview tile region dirty when rotation changes', async ({ page }) => {
    await setupGame(page);
    
    // Enable dirty rendering
    await enableDirtyRendering(page);
    
    // Draw a tile so we have something to rotate
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'DRAW_TILE' });
    });
    await waitForAnimationFrame(page);
    
    // Select a position for preview
    const canvas = await page.$('#game-canvas');
    const box = await canvas!.boundingBox();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await waitForAnimationFrame(page);
    
    // Wait for any animations to settle
    await page.waitForTimeout(200);
    
    // Get current rotation
    const rotationBefore = await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      return store.getState().ui.currentRotation;
    });
    console.log('Rotation before:', rotationBefore);
    
    // Change rotation using SET_ROTATION action
    const newRotation = (rotationBefore + 1) % 6;
    await page.evaluate((rot) => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'SET_ROTATION', payload: rot });
    }, newRotation);
    await waitForAnimationFrame(page);
    
    // Verify rotation changed
    const rotationAfter = await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      return store.getState().ui.currentRotation;
    });
    console.log('Rotation after:', rotationAfter, '(expected:', newRotation, ')');
    expect(rotationAfter).toBe(newRotation);
    
    // Get metrics after rotation
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
    
    // Calculate percentage of canvas painted
    const percentagePainted = (metrics.pixelsPainted / canvasSize) * 100;
    
    console.log(`Rotation change painted ${percentagePainted.toFixed(2)}% of canvas`);
    console.log(`Pixels painted: ${metrics.pixelsPainted} / ${canvasSize}`);
    console.log(`Dirty regions: ${metrics.dirtyRegionCount}`);
    
    // With the bug, rotation marks entire canvas dirty (100%)
    // After fix, it should only mark the preview tile region dirty (< 10%)
    // This test currently FAILS, showing the bug
    expect(percentagePainted).toBeLessThan(15); // Preview tile + margins should be < 15% of canvas
  });

  test('should efficiently handle multiple rotation changes', async ({ page }) => {
    await setupGame(page);
    
    // Enable dirty rendering
    await enableDirtyRendering(page);
    
    // Draw a tile
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'DRAW_TILE' });
    });
    await waitForAnimationFrame(page);
    
    // Select a position for preview
    const canvas = await page.$('#game-canvas');
    const box = await canvas!.boundingBox();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await waitForAnimationFrame(page);
    
    // Wait for animations to settle
    await page.waitForTimeout(200);
    
    // Rotate multiple times and track metrics
    const rotationMetrics: number[] = [];
    for (let i = 0; i < 3; i++) {
      // Get current rotation and increment it
      const currentRotation = await page.evaluate(() => {
        const store = (window as any).__REDUX_STORE__;
        return store.getState().ui.currentRotation;
      });
      
      const newRotation = (currentRotation + 1) % 6;
      await page.evaluate((rot) => {
        const store = (window as any).__REDUX_STORE__;
        store.dispatch({ type: 'SET_ROTATION', payload: rot });
      }, newRotation);
      await waitForAnimationFrame(page);
      
      const metrics = await getRenderMetrics(page);
      if (metrics) {
        rotationMetrics.push(metrics.pixelsPainted);
      }
    }
    
    if (rotationMetrics.length === 0) {
      test.skip();
      return;
    }
    
    const canvasSize = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      return canvas.width * canvas.height;
    });
    
    // All rotations should paint similar small regions
    rotationMetrics.forEach((pixels, index) => {
      const percentage = (pixels / canvasSize) * 100;
      console.log(`Rotation ${index + 1} painted ${percentage.toFixed(2)}% of canvas`);
      
      // Each rotation should be efficient (< 15% of canvas)
      expect(percentage).toBeLessThan(15);
    });
    
    // Verify consistency - all rotations should paint similar amounts
    const avgPixels = rotationMetrics.reduce((a, b) => a + b, 0) / rotationMetrics.length;
    rotationMetrics.forEach(pixels => {
      // Should be within 50% of average (they should be roughly the same)
      expect(pixels).toBeGreaterThan(avgPixels * 0.5);
      expect(pixels).toBeLessThan(avgPixels * 1.5);
    });
  });

  test('should not mark canvas dirty when rotation stays the same', async ({ page }) => {
    await setupGame(page);
    
    // Enable dirty rendering
    await enableDirtyRendering(page);
    
    // Draw a tile
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'DRAW_TILE' });
    });
    await waitForAnimationFrame(page);
    
    // Select a position for preview
    const canvas = await page.$('#game-canvas');
    const box = await canvas!.boundingBox();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await waitForAnimationFrame(page);
    
    // Wait for animations to settle
    await page.waitForTimeout(500);
    
    // Increment frame without changing rotation
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'INCREMENT_FRAME' });
    });
    await waitForAnimationFrame(page);
    
    const metrics = await getRenderMetrics(page);
    if (!metrics) {
      test.skip();
      return;
    }
    
    // Without any state changes, should paint 0 pixels (or very minimal for debug)
    console.log(`Idle frame painted ${metrics.pixelsPainted} pixels`);
    expect(metrics.pixelsPainted).toBeLessThan(1000); // Should be near 0
  });
});
