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
 * Helper to calculate pixel coordinates for a hex position
 * @param page - Playwright page object
 * @param hexPos - Hex position (row, col)
 * @returns Pixel coordinates for clicking the hex center
 */
export async function getHexPixelCoords(page: any, hexPos: { row: number; col: number }) {
  return await page.evaluate((pos: { row: number; col: number }) => {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // Calculate hex layout (same as in hexLayout.ts)
    const minDimension = Math.min(canvasWidth, canvasHeight);
    const boardRadius = 3; // Default board size
    const canvasSizeMultiplier = ((boardRadius * 2 + 2) * 2 + 1); // = 17 for boardRadius=3
    const size = minDimension / canvasSizeMultiplier;
    const originX = canvasWidth / 2;
    const originY = canvasHeight / 2;
    
    // Convert hex to pixel (pointy-top orientation)
    const x = originX + size * (Math.sqrt(3) * pos.col + (Math.sqrt(3) / 2) * pos.row);
    const y = originY + size * ((3 / 2) * pos.row);
    
    return { x, y };
  }, hexPos);
}

/**
 * Helper to get coordinates for clicking on left or right side of tile to rotate
 * @param page - Playwright page object
 * @param hexPos - Hex position where tile is placed (null if at player's edge)
 * @param side - Which side to click ('left' or 'right')
 * @returns Pixel coordinates for rotation click
 */
export async function getTileRotationCoords(page: any, hexPos: { row: number; col: number } | null, side: 'left' | 'right') {
  return await page.evaluate((args: { pos: { row: number; col: number } | null, side: 'left' | 'right' }) => {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const state = (window as any).__REDUX_STORE__.getState();
    
    // Calculate hex layout
    const minDimension = Math.min(canvasWidth, canvasHeight);
    const boardRadius = 3; // Default board size
    const canvasSizeMultiplier = ((boardRadius * 2 + 2) * 2 + 1); // = 17 for boardRadius=3
    const size = minDimension / canvasSizeMultiplier;
    const originX = canvasWidth / 2;
    const originY = canvasHeight / 2;
    
    let centerX: number, centerY: number;
    
    if (args.pos) {
      // Tile is placed on board
      centerX = originX + size * (Math.sqrt(3) * args.pos.col + (Math.sqrt(3) / 2) * args.pos.row);
      centerY = originY + size * ((3 / 2) * args.pos.row);
    } else {
      // Tile is at player's edge position
      const currentPlayer = state.game.players[state.game.currentPlayerIndex];
      const edgePosition = currentPlayer.edgePosition;
      
      // Calculate player edge position (matching the fixed logic in hexLayout.ts)
      const boardRadiusMultiplier = boardRadius * 2 + 1.2; // = 7.2 for boardRadius=3
      const boardRadiusPixels = size * boardRadiusMultiplier;
      
      // Calculate maximum distance that keeps tile within canvas
      const maxVerticalDistance = Math.min(
        originY - size * 1.5,  // Top edge
        canvasHeight - originY - size * 1.5  // Bottom edge
      );
      
      const maxHorizontalDistance = Math.min(
        originX - size * 1.5,  // Left edge
        canvasWidth - originX - size * 1.5  // Right edge
      );
      
      const idealDistance = boardRadiusPixels + size * 1.5;
      const maxDistance = Math.min(maxVerticalDistance, maxHorizontalDistance);
      const previewDistance = Math.min(idealDistance, maxDistance);
      
      const angles = [270, 330, 30, 90, 150, 210];
      const angleDeg = angles[edgePosition];
      const angleRad = (Math.PI / 180) * angleDeg;
      
      centerX = originX + previewDistance * Math.cos(angleRad);
      centerY = originY + previewDistance * Math.sin(angleRad);
    }
    
    // Click on left or right side of the tile
    const offset = size * 0.6; // Click near edge of tile
    if (args.side === 'left') {
      return { x: centerX - offset, y: centerY };
    } else {
      return { x: centerX + offset, y: centerY };
    }
  }, { pos: hexPos, side });
}

/**
 * Helper to get coordinates for checkmark or X button (oriented to player's edge)
 * @param page - Playwright page object
 * @param hexPos - Hex position where tile is placed
 * @param button - Which button to click ('check' or 'x')
 * @returns Pixel coordinates for button click
 */
export async function getConfirmationButtonCoords(page: any, hexPos: { row: number; col: number }, button: 'check' | 'x') {
  return await page.evaluate((args: { pos: { row: number; col: number }, button: 'check' | 'x' }) => {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const state = (window as any).__REDUX_STORE__.getState();
    
    // Calculate hex layout
    const minDimension = Math.min(canvasWidth, canvasHeight);
    const boardRadius = 3; // Default board size
    const canvasSizeMultiplier = ((boardRadius * 2 + 2) * 2 + 1); // = 17 for boardRadius=3
    const size = minDimension / canvasSizeMultiplier;
    const originX = canvasWidth / 2;
    const originY = canvasHeight / 2;
    
    // Get tile center
    const centerX = originX + size * (Math.sqrt(3) * args.pos.col + (Math.sqrt(3) / 2) * args.pos.row);
    const centerY = originY + size * ((3 / 2) * args.pos.row);
    
    // Button spacing (from gameplayInputHandler.ts)
    const buttonSpacing = size * 2;
    
    // Get current player's edge to orient buttons
    const currentPlayer = state.game.players[state.game.currentPlayerIndex];
    const playerEdge = currentPlayer ? currentPlayer.edgePosition : 0;
    
    // Map edge positions to rotation angles (in degrees)
    const edgeAngles = [0, 60, 120, 180, 240, 300];
    const rotationAngle = edgeAngles[playerEdge];
    const rotationRad = (rotationAngle * Math.PI) / 180;
    
    // Define button positions relative to tile center for edge 0 (bottom player)
    let baseX: number, baseY: number;
    if (args.button === 'check') {
      baseX = buttonSpacing;
      baseY = 0;
    } else {
      baseX = -buttonSpacing;
      baseY = 0;
    }
    
    // Rotate position around tile center
    const cos = Math.cos(rotationRad);
    const sin = Math.sin(rotationRad);
    const rotatedX = centerX + (baseX * cos - baseY * sin);
    const rotatedY = centerY + (baseX * sin + baseY * cos);
    
    return { x: rotatedX, y: rotatedY };
  }, { pos: hexPos, button });
}

/**
 * Helper to wait for all CSS transitions and animations to complete
 * This ensures consistent screenshots by waiting for all visual changes to settle
 * 
 * Usage examples:
 * - After navigating to a new screen with animated elements (e.g., lobby, room)
 * - Before taking screenshots of pages with CSS transitions
 * - After user interactions that trigger CSS animations (e.g., button clicks, form submissions)
 * 
 * @param page - Playwright page object
 * @param selector - Optional CSS selector to check specific elements (default: check all elements)
 * @param maxWaitMs - Maximum time to wait in milliseconds (default: 1000ms)
 */
export async function waitForCSSAnimations(page: any, selector: string = '*', maxWaitMs: number = 1000) {
  // Wait for all transitions and animations to complete
  await page.evaluate(
    ({ sel, timeout }: { sel: string, timeout: number }) => {
      return new Promise<void>((resolve) => {
        const startTime = Date.now();
        let animatingElements = new Set<Element>();
        
        // Function to check if an element has ongoing transitions or animations
        const hasActiveAnimation = (element: Element): boolean => {
          const style = window.getComputedStyle(element);
          
          // Check for running transitions
          const transitionDuration = style.transitionDuration;
          if (transitionDuration && transitionDuration !== '0s') {
            return true;
          }
          
          // Check for running animations
          const animationDuration = style.animationDuration;
          if (animationDuration && animationDuration !== '0s') {
            return true;
          }
          
          return false;
        };
        
        // Function to update the set of animating elements
        const updateAnimatingElements = () => {
          animatingElements.clear();
          const elements = document.querySelectorAll(sel);
          elements.forEach(el => {
            if (hasActiveAnimation(el)) {
              animatingElements.add(el);
            }
          });
        };
        
        // Check periodically until no animations are running or timeout
        const checkInterval = setInterval(() => {
          updateAnimatingElements();
          
          // If no animations or timeout reached, resolve
          if (animatingElements.size === 0 || Date.now() - startTime > timeout) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 50); // Check every 50ms
        
        // Initial check
        updateAnimatingElements();
        if (animatingElements.size === 0) {
          clearInterval(checkInterval);
          resolve();
        }
      });
    },
    { sel: selector, timeout: maxWaitMs }
  );
  
  // Wait one more animation frame to ensure rendering is complete
  await page.evaluate(() => {
    return new Promise(resolve => requestAnimationFrame(resolve));
  });
}

/**
 * Helper to wait for button background transition to complete
 * Waits for the button with the specified text to finish its CSS transition (0.3s)
 * @param page - Playwright page object
 * @param buttonText - Text content of the button to wait for
 */
export async function waitForButtonTransition(page: any, buttonText: string) {
  await page.waitForFunction(
    (text: string) => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const button = buttons.find(b => b.textContent?.includes(text));
      if (!button) return false;
      const style = window.getComputedStyle(button);
      const bgColor = style.backgroundColor;
      // Check if button has the enabled state color (#667eea = rgb(102, 126, 234))
      // or disabled state color (rgb(204, 204, 204))
      // We're looking for stable state after transition
      return bgColor === 'rgb(102, 126, 234)' || 
             bgColor === 'rgba(102, 126, 234, 1)' ||
             bgColor === 'rgb(204, 204, 204)' ||
             bgColor === 'rgba(204, 204, 204, 1)';
    },
    buttonText,
    { timeout: 1000 }
  );
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
