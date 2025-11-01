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
  async function verifyPlayerAdded(expectedColor: string, expectedEdge: number, expectedName: string, context: string) {
    const result = await page.evaluate(({ expectedColor, expectedEdge, expectedName }) => {
      const state = (window as any).__REDUX_STORE__.getState();
      const players = state.game.configPlayers;
      
      // Find player with expected name
      const player = players.find((p: any) => p.name === expectedName);
      
      if (!player) {
        return { success: false, message: `Player ${expectedName} not found in Redux state` };
      }
      
      if (player.color !== expectedColor) {
        return { 
          success: false, 
          message: `Player ${expectedName} has wrong color: expected ${expectedColor}, got ${player.color}` 
        };
      }
      
      if (player.edge !== expectedEdge) {
        return { 
          success: false, 
          message: `Player ${expectedName} has wrong edge: expected ${expectedEdge}, got ${player.edge}` 
        };
      }
      
      return { 
        success: true, 
        message: `Player ${expectedName} correct: color=${player.color}, edge=${player.edge}` 
      };
    }, { expectedColor, expectedEdge, expectedName });
    
    if (!result.success) {
      throw new Error(`${context}: ${result.message}`);
    }
    console.log(`✓ ${context}: ${result.message}`);
  }
  
  // 002: Player added from bottom (blue)
  await clickEdgeButton(0, 0);
  await verifyPlayerCount(1, '002-player-added-bottom');
  await verifyPlayerAdded('#0173B2', 0, 'P1', '002-player-added-bottom');
  await page.screenshot({ path: `${outputDir}/002-player-added-bottom.png` });
  
  // 003: Player added from right (orange)
  await clickEdgeButton(1, 1);
  await verifyPlayerCount(2, '003-player-added-right');
  await verifyPlayerAdded('#DE8F05', 1, 'P2', '003-player-added-right');
  await page.screenshot({ path: `${outputDir}/003-player-added-right.png` });
  
  // 004: Player added from top (green)
  await clickEdgeButton(2, 2);
  await verifyPlayerCount(3, '004-player-added-top');
  await verifyPlayerAdded('#029E73', 2, 'P3', '004-player-added-top');
  await page.screenshot({ path: `${outputDir}/004-player-added-top.png` });
  
  // 005: Player added from left (yellow) - 4th player total
  await clickEdgeButton(3, 3);
  await verifyPlayerCount(4, '005-player-added-left');
  await verifyPlayerAdded('#ECE133', 3, 'P4', '005-player-added-left');
  await page.screenshot({ path: `${outputDir}/005-player-added-left.png` });
  
  // Helper to click remove button
  async function clickRemoveButton(playerIndex: number) {
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
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
      
      const centerToEdge = Math.min(canvasWidth, canvasHeight) / 2 - startButtonSize / 2;
      const availableSpace = centerToEdge - edgeMargin - buttonSize - edgeMargin * 2;
      const singleColumnHeight = players.length * (entryHeight + 5);
      const useDoubleColumn = singleColumnHeight > availableSpace;
      
      const column = useDoubleColumn ? playerIndex % 2 : 0;
      const row = useDoubleColumn ? Math.floor(playerIndex / 2) : playerIndex;
      
      let x: number, y: number;
      if (useDoubleColumn) {
        x = canvasWidth / 2 - entryWidth - columnSpacing / 2 + column * (entryWidth + columnSpacing);
      } else {
        x = canvasWidth / 2 - entryWidth / 2;
      }
      y = canvasHeight - edgeMargin - buttonSize - edgeMargin - (row + 1) * (entryHeight + 5);
      
      const removeBtnCenterX = x + entryWidth - removeButtonSize / 2 - 5;
      const removeBtnCenterY = y + entryHeight / 2;
      
      const rotation = player.edge * 90;
      const screenCenterX = canvasWidth / 2;
      const screenCenterY = canvasHeight / 2;
      
      const xOffset = removeBtnCenterX - screenCenterX;
      const yOffset = removeBtnCenterY - screenCenterY;
      
      const angleRad = (rotation * Math.PI) / 180;
      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);
      
      const rotatedX = xOffset * cos - yOffset * sin;
      let rotatedY = xOffset * sin + yOffset * cos;
      
      if (rotation === 90 || rotation === 270) {
        const edgeAdjustment = (maxDim - minDim) / 2;
        rotatedY += edgeAdjustment;
      }
      
      return {
        x: screenCenterX + rotatedX,
        y: screenCenterY + rotatedY
      };
    }, { playerIndex });
    
    if (!coords) throw new Error('Remove button not found');
    await page.mouse.click(box.x + coords.x, box.y + coords.y);
    await page.waitForTimeout(200);
  }
  
  // 006: Remove from bottom (P1)
  await clickRemoveButton(0);
  await verifyPlayerCount(3, '006-remove-from-bottom');
  await page.screenshot({ path: `${outputDir}/006-remove-from-bottom.png` });
  
  // 007: Remove from right (P2, now index 0)
  await clickRemoveButton(0);
  await verifyPlayerCount(2, '007-remove-from-right');
  await page.screenshot({ path: `${outputDir}/007-remove-from-right.png` });
  
  // 008: Remove from top (P3, now index 0)
  await clickRemoveButton(0);
  await verifyPlayerCount(1, '008-remove-from-top');
  await page.screenshot({ path: `${outputDir}/008-remove-from-top.png` });
  
  // 009: Remove from left (P4, now index 0)
  await clickRemoveButton(0);
  await verifyPlayerCount(0, '009-remove-from-left');
  await page.screenshot({ path: `${outputDir}/009-remove-from-left.png` });
  
  // 010: Multiple players from same edge
  await clickEdgeButton(0, 0); // Blue bottom
  await verifyPlayerAdded('#0173B2', 0, 'P1', '010-first-player-bottom');
  await clickEdgeButton(1, 0); // Orange bottom
  await verifyPlayerAdded('#DE8F05', 0, 'P2', '010-second-player-bottom');
  await clickEdgeButton(2, 0); // Green bottom
  await verifyPlayerCount(3, '010-multiple-players-same-edge');
  await verifyPlayerAdded('#029E73', 0, 'P3', '010-third-player-bottom');
  await page.screenshot({ path: `${outputDir}/010-multiple-players-same-edge.png` });
  
  // Clear for portrait test
  await clickRemoveButton(0);
  await clickRemoveButton(0);
  await clickRemoveButton(0);
  await verifyPlayerCount(0, 'Cleared for portrait test');
  
  // 011: Portrait mode
  await page.setViewportSize({ width: 720, height: 1024 });
  await page.waitForTimeout(500);
  await clickEdgeButton(0, 1); // Blue right
  await verifyPlayerAdded('#0173B2', 1, 'P1', '011-first-player-right');
  await clickEdgeButton(1, 3); // Orange left
  await verifyPlayerCount(2, '011-portrait-mode');
  await verifyPlayerAdded('#DE8F05', 3, 'P2', '011-second-player-left');
  await page.screenshot({ path: `${outputDir}/011-portrait-mode.png` });
  
  await browser.close();
  console.log('Screenshots generated successfully!');
}

main().catch(console.error);
