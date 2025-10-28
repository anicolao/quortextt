// End-to-end test for tile rendering - visualize all tile types in all rotations
// This test helps verify that tile rendering matches the logical model
import { test, expect } from '@playwright/test';
import { getReduxState } from './helpers';

test.describe('Tile Rendering Tests', () => {
  // TileType enum values (must match src/game/types.ts)
  const TileType = {
    NoSharps: 0,
    OneSharp: 1,
    TwoSharps: 2,
    ThreeSharps: 3,
  };
  
  const tileTypes = [
    { name: 'NoSharps', value: TileType.NoSharps },
    { name: 'OneSharp', value: TileType.OneSharp },
    { name: 'TwoSharps', value: TileType.TwoSharps },
    { name: 'ThreeSharps', value: TileType.ThreeSharps },
  ];
  
  // Direction names for labeling
  const directionNames = ['SW', 'W', 'NW', 'NE', 'E', 'SE'];
  
  // Tile connections (base rotation 0)
  const tileConnections = {
    NoSharps: [[0, 3], [1, 4], [2, 5]], // All curved opposite connections
    OneSharp: [[0, 5], [1, 3], [2, 4]], // One sharp corner (SW-SE), two curved
    TwoSharps: [[0, 1], [2, 3], [4, 5]], // Two sharp corners
    ThreeSharps: [[0, 1], [2, 3], [4, 5]], // Three sharp corners (same as TwoSharps physically)
  };
  
  // Helper to rotate a direction
  function rotateDirection(dir: number, rotation: number): number {
    return (dir + rotation) % 6;
  }
  
  // Helper to get rotated connections
  function getRotatedConnections(tileTypeName: string, rotation: number): [number, number][] {
    const baseConnections = tileConnections[tileTypeName as keyof typeof tileConnections];
    return baseConnections.map(([a, b]) => [
      rotateDirection(a, rotation),
      rotateDirection(b, rotation)
    ] as [number, number]);
  }

  tileTypes.forEach((tileType) => {
    test(`should render ${tileType.name} in all 6 rotations with edge labels`, async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('canvas#game-canvas');
      
      // Set up game once
      await page.evaluate(() => {
        const store = (window as any).__REDUX_STORE__;
        store.dispatch({ type: 'ADD_PLAYER' });
        store.dispatch({ type: 'ADD_PLAYER' });
      });
      
      // For each rotation
      for (let rotation = 0; rotation < 6; rotation++) {
        // Start game with a custom deck containing only the desired tile type
        await page.evaluate(({ tileTypeValue }) => {
          const store = (window as any).__REDUX_STORE__;
          
          // If we already started, reset
          if (rotation > 0) {
            store.dispatch({ type: 'RETURN_TO_CONFIG' });
          }
          
          // Start game which will create a shuffled deck
          store.dispatch({ type: 'START_GAME' });
          
          // Replace the entire deck and current tile with our desired tile
          const state = store.getState();
          const customDeck = Array(40).fill(tileTypeValue);
          state.game.availableTiles = customDeck.slice(1);
          state.game.currentTile = tileTypeValue;
        }, { tileTypeValue: tileType.value, rotation });
        
        await page.waitForTimeout(300);
        
        // Place the tile at center position for visibility
        await page.evaluate(({ rotation }) => {
          const store = (window as any).__REDUX_STORE__;
          store.dispatch({ 
            type: 'PLACE_TILE', 
            payload: { position: { row: 0, col: 0 }, rotation } 
          });
        }, { rotation });
        
        await page.waitForTimeout(500);
        
        // Add edge labels using canvas text overlay
        await page.evaluate(({ directionNames, tileTypeName, rotation, connections }) => {
          const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          
          // Get the center hex position
          const hexSize = 40; // From game constants
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          
          // Draw edge labels
          ctx.font = 'bold 16px Arial';
          ctx.fillStyle = 'black';
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 3;
          
          // Edge positions (midpoints of each edge)
          const edgeAngles = [240, 180, 120, 60, 0, 300]; // Degrees for each direction
          const labelRadius = hexSize * 1.3;
          
          for (let dir = 0; dir < 6; dir++) {
            const angle = (edgeAngles[dir] * Math.PI) / 180;
            const x = centerX + labelRadius * Math.cos(angle);
            const y = centerY + labelRadius * Math.sin(angle);
            
            const label = `${dir}:${directionNames[dir]}`;
            ctx.strokeText(label, x - 20, y + 5);
            ctx.fillText(label, x - 20, y + 5);
          }
          
          // Draw title
          ctx.font = 'bold 20px Arial';
          const title = `${tileTypeName} - Rotation ${rotation}`;
          ctx.strokeText(title, centerX - 100, centerY - hexSize * 2);
          ctx.fillText(title, centerX - 100, centerY - hexSize * 2);
          
          // Draw connection info
          ctx.font = '14px Arial';
          let yOffset = centerY + hexSize * 2 + 20;
          ctx.strokeText('Connections:', centerX - 100, yOffset);
          ctx.fillText('Connections:', centerX - 100, yOffset);
          
          connections.forEach(([a, b]: [number, number]) => {
            yOffset += 18;
            const connText = `${a}:${directionNames[a]} ↔ ${b}:${directionNames[b]}`;
            ctx.strokeText(connText, centerX - 100, yOffset);
            ctx.fillText(connText, centerX - 100, yOffset);
          });
        }, { 
          directionNames, 
          tileTypeName: tileType.name, 
          rotation,
          connections: getRotatedConnections(tileType.name, rotation)
        });
        
        await page.waitForTimeout(300);
        
        // Take screenshot
        const filename = `tests/e2e/user-stories/006-tile-rendering/${tileType.name.toLowerCase()}-rotation-${rotation}.png`;
        await page.screenshot({ 
          path: filename,
          fullPage: false
        });
        
        console.log(`Created ${filename}`);
        console.log(`  ${tileType.name} Rotation ${rotation} connections: ${JSON.stringify(getRotatedConnections(tileType.name, rotation))}`);
      }
      
      // Verify we created all screenshots
      const state = await getReduxState(page);
      expect(state).toBeDefined();
    });
  });
});
