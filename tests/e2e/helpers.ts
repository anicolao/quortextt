// Shared helper functions for e2e tests

/**
 * Get Redux state from the browser with proper serialization of Maps and Sets
 */
export async function getReduxState(page: any) {
  return await page.evaluate(() => {
    const state = (window as any).__REDUX_STORE__.getState();
    // Custom serialization for Maps and Sets
    return JSON.parse(JSON.stringify(state, (key, value) => {
      if (value instanceof Map) {
        return Object.fromEntries(value);
      }
      if (value instanceof Set) {
        return Array.from(value);
      }
      return value;
    }));
  });
}

/**
 * Helper to get edge button coordinates for seating phase
 * @param page - Playwright page object
 * @param edgeNumber - Edge number (0-5)
 * @returns Coordinates for clicking the edge button
 */
export async function getSeatingEdgeButtonCoordinates(page: any, edgeNumber: number) {
  return await page.evaluate((edge: number) => {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // Calculate hex layout (matching hexLayout.ts)
    const minDimension = Math.min(canvasWidth, canvasHeight);
    const size = minDimension / 17;
    const originX = canvasWidth / 2;
    const originY = canvasHeight / 2;
    
    // Calculate edge button position
    const boardRadius = size * 7.2 + size * 0.8; // Board radius plus offset for buttons
    
    // Edge midpoint angles for flat-topped hexagon (matching seatingRenderer.ts)
    // Edge 0: Bottom (270°), Edge 1: Bottom-right (330°), Edge 2: Top-right (30°)
    // Edge 3: Top (90°), Edge 4: Top-left (150°), Edge 5: Bottom-left (210°)
    const edgeAngles = [270, 330, 30, 90, 150, 210];
    
    const angle = edgeAngles[edge];
    const angleRad = (angle * Math.PI) / 180;
    
    const x = originX + boardRadius * Math.cos(angleRad);
    const y = originY + boardRadius * Math.sin(angleRad);
    
    return { x, y };
  }, edgeNumber);
}

/**
 * Helper to complete the seating phase by having all players select edges
 * @param page - Playwright page object
 * @param canvas - Canvas locator
 * @param box - Canvas bounding box
 */
export async function completeSeatingPhase(page: any, canvas: any, box: any) {
  let state = await getReduxState(page);
  
  // Check if we're in seating phase
  if (state.game.screen !== 'seating' || !state.game.seatingPhase.active) {
    return; // Not in seating phase
  }
  
  // Get the number of players
  const numPlayers = state.game.seatingPhase.seatingOrder.length;
  
  // Each player selects an edge in order
  for (let i = 0; i < numPlayers; i++) {
    // Select edge i for player i (simple strategy)
    const coords = await getSeatingEdgeButtonCoordinates(page, i);
    await page.mouse.click(box.x + coords.x, box.y + coords.y);
    await page.waitForTimeout(100);
  }
  
  // Wait for transition to gameplay
  await page.waitForTimeout(200);
}

/**
 * Helper to pause animations to prevent canvas redraws during screenshots
 * @param page - Playwright page object
 */
export async function pauseAnimations(page: any) {
  await page.evaluate(() => {
    const store = (window as any).__REDUX_STORE__;
    store.dispatch({ type: 'PAUSE_ANIMATIONS' });
  });
  // Wait a bit for animations to stop
  await page.waitForTimeout(100);
}
