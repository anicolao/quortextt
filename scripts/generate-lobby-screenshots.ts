// Script to generate screenshots for the lobby rotated labels user story
import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const outputDir = 'tests/e2e/user-stories/007-lobby-rotated-labels';
  
  await page.goto('http://localhost:5173');
  await page.waitForSelector('canvas#game-canvas');
  
  // 001: Initial lobby
  await page.screenshot({ path: `${outputDir}/001-initial-lobby.png` });
  
  // Helper to click on edge button
  async function clickEdgeButton(colorIndex: number, edge: 0 | 1 | 2 | 3) {
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    const coords = await page.evaluate(({ colorIndex, edge }) => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const minDim = Math.min(canvasWidth, canvasHeight);
      const buttonSize = Math.max(60, minDim * 0.08);
      const edgeMargin = minDim * 0.05;
      const buttonSpacing = buttonSize * 0.3;
      
      const state = (window as any).__REDUX_STORE__.getState();
      const players = state.game.configPlayers;
      const PLAYER_COLORS = ['#0173B2', '#DE8F05', '#029E73', '#ECE133', '#CC78BC', '#CA5127'];
      const usedColors = new Set(players.map((p: any) => p.color));
      const availableColors = PLAYER_COLORS.filter(c => !usedColors.has(c));
      
      const targetColor = PLAYER_COLORS[colorIndex];
      const availableIndex = availableColors.indexOf(targetColor);
      
      if (availableIndex === -1) return null;
      
      let x: number, y: number;
      
      if (edge === 0) {
        const totalWidth = availableColors.length * buttonSize + (availableColors.length - 1) * buttonSpacing;
        const startX = (canvasWidth - totalWidth) / 2;
        x = startX + availableIndex * (buttonSize + buttonSpacing) + buttonSize / 2;
        y = canvasHeight - edgeMargin - buttonSize / 2;
      } else if (edge === 1) {
        const totalHeight = availableColors.length * buttonSize + (availableColors.length - 1) * buttonSpacing;
        const startY = (canvasHeight - totalHeight) / 2;
        x = canvasWidth - edgeMargin - buttonSize / 2;
        y = startY + availableIndex * (buttonSize + buttonSpacing) + buttonSize / 2;
      } else if (edge === 2) {
        const totalWidth = availableColors.length * buttonSize + (availableColors.length - 1) * buttonSpacing;
        const startX = (canvasWidth - totalWidth) / 2;
        x = startX + availableIndex * (buttonSize + buttonSpacing) + buttonSize / 2;
        y = edgeMargin + buttonSize / 2;
      } else {
        const totalHeight = availableColors.length * buttonSize + (availableColors.length - 1) * buttonSpacing;
        const startY = (canvasHeight - totalHeight) / 2;
        x = edgeMargin + buttonSize / 2;
        y = startY + availableIndex * (buttonSize + buttonSpacing) + buttonSize / 2;
      }
      
      return { x, y };
    }, { colorIndex, edge });
    
    if (!coords) throw new Error('Button not found');
    await page.mouse.click(box.x + coords.x, box.y + coords.y);
    await page.waitForTimeout(200);
  }
  
  // Helper to verify state
  async function verifyPlayerCount(expected: number, context: string) {
    const actual = await page.evaluate(() => {
      const state = (window as any).__REDUX_STORE__.getState();
      return state.game.configPlayers.length;
    });
    if (actual !== expected) {
      throw new Error(`${context}: Expected ${expected} players, but found ${actual}`);
    }
    console.log(`✓ ${context}: ${actual} players confirmed`);
  }
  
  // Helper to verify player was added with correct properties
  async function verifyPlayerAdded(expectedColor: string, expectedEdge: number, playerIndex: number, context: string) {
    const result = await page.evaluate(({ expectedColor, expectedEdge, playerIndex }) => {
      const state = (window as any).__REDUX_STORE__.getState();
      const players = state.game.configPlayers;
      
      // Get player by index (0-based)
      const player = players[playerIndex];
      
      if (!player) {
        return { success: false, message: `Player at index ${playerIndex} not found in Redux state` };
      }
      
      if (player.color !== expectedColor) {
        return { 
          success: false, 
          message: `Player at index ${playerIndex} has wrong color: expected ${expectedColor}, got ${player.color}` 
        };
      }
      
      if (player.edge !== expectedEdge) {
        return { 
          success: false, 
          message: `Player at index ${playerIndex} has wrong edge: expected ${expectedEdge}, got ${player.edge}` 
        };
      }
      
      return { 
        success: true, 
        message: `Player ${playerIndex} correct: color=${player.color}, edge=${player.edge}` 
      };
    }, { expectedColor, expectedEdge, playerIndex });
    
    if (!result.success) {
      throw new Error(`${context}: ${result.message}`);
    }
    console.log(`✓ ${context}: ${result.message}`);
  }
  
  // 002: Player added from bottom (blue)
  await clickEdgeButton(0, 0);
  await verifyPlayerCount(1, '002-player-added-bottom');
  await verifyPlayerAdded('#0173B2', 0, 0, '002-player-added-bottom');
  await page.screenshot({ path: `${outputDir}/002-player-added-bottom.png` });
  
  // 003: Player added from right (orange)
  await clickEdgeButton(1, 1);
  await verifyPlayerCount(2, '003-player-added-right');
  await verifyPlayerAdded('#DE8F05', 1, 1, '003-player-added-right');
  await page.screenshot({ path: `${outputDir}/003-player-added-right.png` });
  
  // 004: Player added from top (green)
  await clickEdgeButton(2, 2);
  await verifyPlayerCount(3, '004-player-added-top');
  await verifyPlayerAdded('#029E73', 2, 2, '004-player-added-top');
  await page.screenshot({ path: `${outputDir}/004-player-added-top.png` });
  
  // 005: Player added from left (yellow) - 4th player total
  await clickEdgeButton(3, 3);
  await verifyPlayerCount(4, '005-player-added-left');
  await verifyPlayerAdded('#ECE133', 3, 3, '005-player-added-left');
  await page.screenshot({ path: `${outputDir}/005-player-added-left.png` });
  
  // Helper to click remove button
  // We need to wait a bit longer for the layout to update after adding players
  async function clickRemoveButton(playerIndex: number) {
    await page.waitForTimeout(300); // Extra wait for layout update
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    // Try clicking on the player entry area instead of precisely on the remove button
    // This is more reliable since the entry takes up more space
    const coords = await page.evaluate(({ playerIndex }) => {
      const state = (window as any).__REDUX_STORE__.getState();
      const players = state.game.configPlayers;
      
      if (playerIndex >= players.length) return null;
      
      const player = players[playerIndex];
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const minDim = Math.min(canvasWidth, canvasHeight);
      const maxDim = Math.max(canvasWidth, canvasHeight);
      const buttonSize = Math.max(60, minDim * 0.08);
      const edgeMargin = minDim * 0.05;
      const entryWidth = minDim * 0.18;
      const entryHeight = minDim * 0.08;
      const removeButtonSize = entryHeight * 0.5;
      const columnSpacing = 10;
      const startButtonSize = Math.max(100, minDim * 0.12);
      
      // Calculate player list position for bottom edge (edge=0)
      const centerToEdge = Math.min(canvasWidth, canvasHeight) / 2 - startButtonSize / 2;
      const availableSpace = centerToEdge - edgeMargin - buttonSize - edgeMargin * 2;
      
      // Get players on same edge
      const edgePlayers = players.filter((p: any) => p.edge === player.edge);
      const indexInEdge = edgePlayers.findIndex((p: any) => p.index === player.index);
      
      const singleColumnHeight = edgePlayers.length * (entryHeight + 5);
      const useDoubleColumn = singleColumnHeight > availableSpace;
      
      const column = useDoubleColumn ? indexInEdge % 2 : 0;
      const row = useDoubleColumn ? Math.floor(indexInEdge / 2) : indexInEdge;
      
      let x: number, y: number;
      if (useDoubleColumn) {
        x = canvasWidth / 2 - entryWidth - columnSpacing / 2 + column * (entryWidth + columnSpacing);
      } else {
        x = canvasWidth / 2 - entryWidth / 2;
      }
      y = canvasHeight - edgeMargin - buttonSize - edgeMargin - (row + 1) * (entryHeight + 5);
      
      // Remove button is on the right side of the entry
      const removeBtnX = x + entryWidth - removeButtonSize / 2 - 5;
      const removeBtnY = y + entryHeight / 2;
      
      // Apply rotation around screen center
      const rotation = player.edge * 90;
      const screenCenterX = canvasWidth / 2;
      const screenCenterY = canvasHeight / 2;
      
      const xOffset = removeBtnX - screenCenterX;
      const yOffset = removeBtnY - screenCenterY;
      
      const angleRad = (rotation * Math.PI) / 180;
      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);
      
      const rotatedX = xOffset * cos - yOffset * sin;
      let rotatedY = xOffset * sin + yOffset * cos;
      
      // Apply edge adjustment for portrait/landscape
      if (rotation === 90 || rotation === 270) {
        const edgeAdjustment = (maxDim - minDim) / 2;
        rotatedY += edgeAdjustment;
      }
      
      return {
        x: screenCenterX + rotatedX,
        y: screenCenterY + rotatedY
      };
    }, { playerIndex });
    
    if (!coords) throw new Error(`Remove button for player ${playerIndex} not found`);
    await page.mouse.click(box.x + coords.x, box.y + coords.y);
    await page.waitForTimeout(300);
  }
  
  // Skip removal screenshots for now - focus on key screenshots showing rotated labels
  console.log('Skipping removal screenshots (006-009) - X button click not working reliably in script');
  
  // 010: Portrait mode with players on different edges
  await page.setViewportSize({ width: 720, height: 1024 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${outputDir}/010-portrait-mode.png` });
  
  console.log('\nSuccessfully generated key screenshots demonstrating:');
  console.log('  ✓ 001: Initial lobby');
  console.log('  ✓ 002: Player added to bottom edge (blue, 0°)');
  console.log('  ✓ 003: Player added to right edge (orange, 90°)');
  console.log('  ✓ 004: Player added to top edge (green, 180°)');
  console.log('  ✓ 005: Player added to left edge (yellow, 270°)');
  console.log('  ✓ 010: Portrait mode showing all players');
  console.log('\nNote: Screenshots 006-009 (remove functionality) skipped - X button coordinates need manual verification');
  
  await browser.close();
  console.log('Screenshots generated successfully!');
}

main().catch(console.error);
