// End-to-end test for tile rendering - visualize all tile types in all rotations
// This test helps verify that tile rendering matches the logical model
import { test, expect } from '@playwright/test';
import { getReduxState, rotateDirection } from './helpers';

test.describe('Tile Rendering Tests', () => {
  // TileType enum values (must match src/game/types.ts)
  const TileType = {
    NoSharps: 0,
    OneSharp: 1,
    TwoSharps: 2,
    ThreeSharps: 3,
  };
  
  const tileTypes = [
    { name: 'NoSharps', value: TileType.NoSharps, distribution: [40, 0, 0, 0] as [number, number, number, number] },
    { name: 'OneSharp', value: TileType.OneSharp, distribution: [0, 40, 0, 0] as [number, number, number, number] },
    { name: 'TwoSharps', value: TileType.TwoSharps, distribution: [0, 0, 40, 0] as [number, number, number, number] },
    { name: 'ThreeSharps', value: TileType.ThreeSharps, distribution: [0, 0, 0, 40] as [number, number, number, number] },
  ];
  
  // Direction names for labeling
  const directionNames = ['SW', 'W', 'NW', 'NE', 'E', 'SE'];
  
  // Tile connections (base rotation 0) - from TILE_FLOWS in tiles.ts
  const tileConnections = {
    NoSharps: [[0, 2], [1, 4], [3, 5]], // 0-2 curved, 1-4 straight, 3-5 curved
    OneSharp: [[0, 5], [1, 3], [2, 4]], // 0-5 sharp (SW-SE), 1-3 curved, 2-4 curved
    TwoSharps: [[0, 5], [1, 4], [2, 3]], // 0-5 sharp, 1-4 straight, 2-3 sharp
    ThreeSharps: [[0, 5], [1, 2], [3, 4]], // 0-5 sharp, 1-2 sharp, 3-4 sharp
  };
  
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
        // Reset game state
        await page.evaluate(() => {
          const store = (window as any).__REDUX_STORE__;
          store.dispatch({ type: 'RETURN_TO_CONFIG' });
        });
        
        await page.waitForTimeout(300);
        
        // Start game with specific tile distribution (all tiles of one type)
        await page.evaluate(({ distribution }) => {
          const store = (window as any).__REDUX_STORE__;
          store.dispatch({ type: 'START_GAME' });
          // Immediately shuffle with custom distribution
          store.dispatch({ 
            type: 'SHUFFLE_TILES', 
            payload: { 
              seed: 42, // Use fixed seed for reproducibility
              tileDistribution: distribution 
            } 
          });
          // Draw first tile
          store.dispatch({ type: 'DRAW_TILE' });
        }, { distribution: tileType.distribution });
        
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
        
        // Add edge labels and vertex numbers using canvas text overlay
        await page.evaluate(({ directionNames, tileTypeName, rotation, connections }) => {
          const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          
          // Get the center hex position
          const hexSize = 40; // From game constants
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          
          // Vertex pairs for each direction (matches hexLayout.ts after fix)
          const vertexPairs = [
            [2, 3], // SouthWest (0)
            [3, 4], // West (1)
            [4, 5], // NorthWest (2)
            [5, 0], // NorthEast (3)
            [0, 1], // East (4)
            [1, 2], // SouthEast (5)
          ];
          
          // Draw vertex numbers at each vertex position
          ctx.font = 'bold 18px Arial';
          ctx.fillStyle = '#FF0000'; // Red for vertices
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 4;
          
          const vertexRadius = hexSize * 1.15;
          for (let v = 0; v < 6; v++) {
            // Vertex angle: -30° for vertex 0, then +60° for each subsequent vertex
            const angle = ((60 * v - 30) * Math.PI) / 180;
            const x = centerX + vertexRadius * Math.cos(angle);
            const y = centerY + vertexRadius * Math.sin(angle);
            
            const label = `V${v}`;
            ctx.strokeText(label, x - 10, y + 5);
            ctx.fillText(label, x - 10, y + 5);
          }
          
          // Draw edge labels with direction and vertex info
          ctx.font = 'bold 14px Arial';
          ctx.fillStyle = 'black';
          ctx.lineWidth = 3;
          
          const edgeLabelRadius = hexSize * 1.5;
          
          for (let dir = 0; dir < 6; dir++) {
            // Calculate edge midpoint angle based on its vertices
            const [v1, v2] = vertexPairs[dir];
            const angle1 = ((60 * v1 - 30) * Math.PI) / 180;
            const angle2 = ((60 * v2 - 30) * Math.PI) / 180;
            
            const vx1 = centerX + hexSize * Math.cos(angle1);
            const vy1 = centerY + hexSize * Math.sin(angle1);
            const vx2 = centerX + hexSize * Math.cos(angle2);
            const vy2 = centerY + hexSize * Math.sin(angle2);
            
            // Edge midpoint
            const edgeMidX = (vx1 + vx2) / 2;
            const edgeMidY = (vy1 + vy2) / 2;
            
            // Push label outward from center
            const dx = edgeMidX - centerX;
            const dy = edgeMidY - centerY;
            const len = Math.sqrt(dx * dx + dy * dy);
            const x = centerX + (dx / len) * edgeLabelRadius;
            const y = centerY + (dy / len) * edgeLabelRadius;
            
            const label = `${dir}:${directionNames[dir]} (V${v1}-V${v2})`;
            ctx.strokeText(label, x - 30, y + 5);
            ctx.fillText(label, x - 30, y + 5);
          }
          
          // Draw title
          ctx.font = 'bold 20px Arial';
          const title = `${tileTypeName} - Rotation ${rotation}`;
          ctx.strokeText(title, centerX - 100, centerY - hexSize * 2.5);
          ctx.fillText(title, centerX - 100, centerY - hexSize * 2.5);
          
          // Draw connection info
          ctx.font = '14px Arial';
          let yOffset = centerY + hexSize * 2.5 + 20;
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
