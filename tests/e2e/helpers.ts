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
 * Wait for the next animation frame
 * This is sufficient for redux state changes since redux is synchronous
 */
export async function waitForAnimationFrame(page: any) {
  await page.evaluate(() => {
    return new Promise(resolve => {
      requestAnimationFrame(resolve);
    });
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
    const boardRadius = 3; // Default board size
    const canvasSizeMultiplier = ((boardRadius * 2 + 2) * 2 + 1); // = 17 for boardRadius=3
    const size = minDimension / canvasSizeMultiplier;
    const originX = canvasWidth / 2;
    const originY = canvasHeight / 2;
    
    // Calculate edge button position
    const boardRadiusMultiplier = boardRadius * 2 + 1.2; // = 7.2 for boardRadius=3
    const boardRadiusPixels = size * boardRadiusMultiplier + size * 0.8; // Board radius plus offset for buttons
    
    // Edge midpoint angles for flat-topped hexagon (matching seatingRenderer.ts)
    // Edge 0: Bottom (270°), Edge 1: Bottom-right (330°), Edge 2: Top-right (30°)
    // Edge 3: Top (90°), Edge 4: Top-left (150°), Edge 5: Bottom-left (210°)
    const edgeAngles = [270, 330, 30, 90, 150, 210];
    
    const angle = edgeAngles[edge];
    const angleRad = (angle * Math.PI) / 180;
    
    const x = originX + boardRadiusPixels * Math.cos(angleRad);
    const y = originY + boardRadiusPixels * Math.sin(angleRad);
    
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
    await waitForAnimationFrame(page);
  }
  
  // Wait for transition to gameplay - redux is synchronous, one frame is enough
  await waitForAnimationFrame(page);
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
  // Wait for multiple animation frames to ensure rendering is complete
  await page.evaluate(() => {
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(resolve);
          });
        });
      });
    });
  });
  // Force a canvas rendering flush by reading canvas data
  await page.evaluate(() => {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Reading pixel data forces the canvas to flush any pending operations
      ctx.getImageData(0, 0, 1, 1);
    }
  });
  // Redux is synchronous, animation frames above are sufficient
}

/**
 * Helper to get edge button coordinates for lobby/configuration screen
 * @param page - Playwright page object
 * @param edge - Edge number (0-3: bottom, right, top, left)
 * @param colorIndex - Index of the color button on that edge (0 for first color)
 * @returns Coordinates for clicking the edge button
 */
export async function getLobbyEdgeButtonCoordinates(page: any, edge: number, colorIndex: number = 0) {
  return await page.evaluate(({edgeNum, colorIdx}: {edgeNum: number, colorIdx: number}) => {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // Constants matching lobbyLayout.ts
    const buttonSize = 80;
    const buttonSpacing = 20;
    const edgeMargin = 40;
    
    // Get available colors (6 standard colors)
    const availableColors = 6;
    
    let x = 0;
    let y = 0;
    
    if (edgeNum === 0) {
      // Bottom edge
      const totalWidth = availableColors * buttonSize + (availableColors - 1) * buttonSpacing;
      const startX = (canvasWidth - totalWidth) / 2;
      x = startX + colorIdx * (buttonSize + buttonSpacing) + buttonSize / 2;
      y = canvasHeight - edgeMargin - buttonSize + buttonSize / 2;
    } else if (edgeNum === 1) {
      // Right edge
      const totalHeight = availableColors * buttonSize + (availableColors - 1) * buttonSpacing;
      const startY = (canvasHeight - totalHeight) / 2;
      x = canvasWidth - edgeMargin - buttonSize + buttonSize / 2;
      y = startY + colorIdx * (buttonSize + buttonSpacing) + buttonSize / 2;
    } else if (edgeNum === 2) {
      // Top edge
      const totalWidth = availableColors * buttonSize + (availableColors - 1) * buttonSpacing;
      const startX = (canvasWidth - totalWidth) / 2;
      x = startX + colorIdx * (buttonSize + buttonSpacing) + buttonSize / 2;
      y = edgeMargin + buttonSize / 2;
    } else if (edgeNum === 3) {
      // Left edge
      const totalHeight = availableColors * buttonSize + (availableColors - 1) * buttonSpacing;
      const startY = (canvasHeight - totalHeight) / 2;
      x = edgeMargin + buttonSize / 2;
      y = startY + colorIdx * (buttonSize + buttonSpacing) + buttonSize / 2;
    }
    
    return { x, y };
  }, {edgeNum: edge, colorIdx: colorIndex});
}

/**
 * Helper to get start button coordinates for lobby/configuration screen
 * @param page - Playwright page object
 * @returns Coordinates for clicking the start button
 */
export async function getStartButtonCoordinates(page: any) {
  return await page.evaluate(() => {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    return { 
      x: canvasWidth / 2, 
      y: canvasHeight / 2 
    };
  });
}

/**
 * Helper to setup a game with two players
 * @param page - Playwright page object
 */
export async function setupTwoPlayerGame(page: any) {
  await page.goto('/quortextt/tabletop.html');
  await page.waitForSelector('canvas#game-canvas');
  
  const canvas = page.locator('canvas#game-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');
  
  // Add two players
  await page.evaluate(() => {
    const store = (window as any).__REDUX_STORE__;
    store.dispatch({ type: 'ADD_PLAYER' });
    store.dispatch({ type: 'ADD_PLAYER' });
  });
  
  await waitForAnimationFrame(page);
  
  // Start the game with deterministic seed (transitions to seating)
  await page.evaluate(() => {
    const store = (window as any).__REDUX_STORE__;
    store.dispatch({ type: 'START_GAME', payload: { seed: 12345 } });
  });
  
  await waitForAnimationFrame(page);
  
  // Complete seating phase (tiles will be automatically shuffled with the seed)
  await completeSeatingPhase(page, canvas, box);
  
  // Draw a tile
  await page.evaluate(() => {
    const store = (window as any).__REDUX_STORE__;
    store.dispatch({ type: 'DRAW_TILE' });
  });
  
  await waitForAnimationFrame(page);
}
