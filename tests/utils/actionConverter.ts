/**
 * Action Converter Utility
 * 
 * Converts a log of Redux actions into:
 * 1. .actions file (JSONL of all actions)
 * 2. .clicks file (sequence of UI clicks to reproduce actions)
 * 3. .expectations file (board state expectations for validation)
 */

import { GameAction } from '../../src/redux/actions';
import { gameReducer, initialState } from '../../src/redux/gameReducer';
import { GameState } from '../../src/redux/types';
import { HexPosition, Rotation } from '../../src/game/types';
import { traceFlow } from '../../src/game/flows';
import { getEdgePositionsWithDirections, positionToKey } from '../../src/game/board';

/**
 * Represents a click action in the UI
 */
export interface ClickAction {
  type: 'click' | 'wait';
  target?: string; // Description of what to click
  x?: number;      // Pixel x coordinate (relative)
  y?: number;      // Pixel y coordinate (relative)
  delay?: number;  // Milliseconds to wait (deprecated - use animationFrames instead)
  animationFrames?: number; // Number of animation frames to wait (default: 1)
  description: string;
}

/**
 * Calculate hex pixel coordinates (matches hexLayout.ts)
 */
function getHexPixelCoords(
  hexPos: HexPosition,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  const minDimension = Math.min(canvasWidth, canvasHeight);
  const size = minDimension / 17;
  const originX = canvasWidth / 2;
  const originY = canvasHeight / 2;
  
  const x = originX + size * (Math.sqrt(3) * hexPos.col + (Math.sqrt(3) / 2) * hexPos.row);
  const y = originY + size * ((3 / 2) * hexPos.row);
  
  return { x, y };
}

/**
 * Get coordinates for ADD_PLAYER button in lobby
 * Buttons move as colors are used up, so we calculate based on available colors
 */
function getEdgeButtonCoords(
  color: string,
  edge: number,
  usedColors: string[],
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  const PLAYER_COLORS = ['#0173B2', '#DE8F05', '#029E73', '#ECE133', '#CC78BC', '#CA5127'];
  const availableColors = PLAYER_COLORS.filter(c => !usedColors.includes(c));
  const targetColorIndex = availableColors.indexOf(color);
  
  if (targetColorIndex === -1) {
    // Color not available, return center as fallback
    return { x: canvasWidth / 2, y: canvasHeight / 2 };
  }
  
  const minDim = Math.min(canvasWidth, canvasHeight);
  const buttonSize = Math.max(60, minDim * 0.08);
  const edgeMargin = minDim * 0.05;
  const buttonSpacing = buttonSize * 0.3;
  
  let x: number, y: number;
  
  if (edge === 0) { // Bottom
    const totalWidth = availableColors.length * buttonSize + (availableColors.length - 1) * buttonSpacing;
    const startX = (canvasWidth - totalWidth) / 2;
    x = startX + targetColorIndex * (buttonSize + buttonSpacing) + buttonSize / 2;
    y = canvasHeight - edgeMargin - buttonSize / 2;
  } else if (edge === 1) { // Right
    const totalHeight = availableColors.length * buttonSize + (availableColors.length - 1) * buttonSpacing;
    const startY = (canvasHeight - totalHeight) / 2;
    x = canvasWidth - edgeMargin - buttonSize / 2;
    y = startY + targetColorIndex * (buttonSize + buttonSpacing) + buttonSize / 2;
  } else if (edge === 2) { // Top
    const totalWidth = availableColors.length * buttonSize + (availableColors.length - 1) * buttonSpacing;
    const startX = (canvasWidth - totalWidth) / 2;
    x = startX + targetColorIndex * (buttonSize + buttonSpacing) + buttonSize / 2;
    y = edgeMargin + buttonSize / 2;
  } else { // Left (edge === 3)
    const totalHeight = availableColors.length * buttonSize + (availableColors.length - 1) * buttonSpacing;
    const startY = (canvasHeight - totalHeight) / 2;
    x = edgeMargin + buttonSize / 2;
    y = startY + targetColorIndex * (buttonSize + buttonSpacing) + buttonSize / 2;
  }
  
  return { x, y };
}

/**
 * Get coordinates for tile rotation (click on right side)
 */
function getTileRotationCoords(
  canvasWidth: number,
  canvasHeight: number,
  hexPos: HexPosition | null = null
): { x: number; y: number } {
  const minDimension = Math.min(canvasWidth, canvasHeight);
  const size = minDimension / 17;
  const offset = size * 0.6;
  
  let centerX: number, centerY: number;
  
  if (hexPos) {
    const coords = getHexPixelCoords(hexPos, canvasWidth, canvasHeight);
    centerX = coords.x;
    centerY = coords.y;
  } else {
    // Tile at edge position (simplified - center for now)
    centerX = canvasWidth / 2;
    centerY = canvasHeight / 2;
  }
  
  return { x: centerX + offset, y: centerY };
}

/**
 * Get coordinates for checkmark button
 */
function getCheckmarkCoords(
  hexPos: HexPosition,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  const minDimension = Math.min(canvasWidth, canvasHeight);
  const size = minDimension / 17;
  const buttonSpacing = size * 2;
  
  const hexCoords = getHexPixelCoords(hexPos, canvasWidth, canvasHeight);
  return { x: hexCoords.x + buttonSpacing, y: hexCoords.y };
}

/**
 * Get coordinates for seating edge button
 */
function getSeatingEdgeButtonCoords(
  edgeNumber: number,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
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
  
  const angle = edgeAngles[edgeNumber];
  const angleRad = (angle * Math.PI) / 180;
  
  const x = originX + boardRadius * Math.cos(angleRad);
  const y = originY + boardRadius * Math.sin(angleRad);
  
  return { x, y };
}

/**
 * Convert actions to click sequence
 * Note: This does NOT replay the actions through the reducer to avoid player ID issues.
 * It converts each action independently.
 */
export function actionsToClicks(
  actions: GameAction[],
  canvasWidth = 800,
  canvasHeight = 600
): ClickAction[] {
  const clicks: ClickAction[] = [];
  let currentRotation = 0;
  const usedColors: string[] = []; // Track used colors for dynamic button positioning
  
  for (const action of actions) {
    switch (action.type) {
      case 'ADD_PLAYER': {
        const color = action.payload?.color || '#0173B2';
        const edge = action.payload?.edge || 0;
        const coords = getEdgeButtonCoords(color, edge, usedColors, canvasWidth, canvasHeight);
        
        clicks.push({
          type: 'click',
          target: 'edge-button',
          x: coords.x,
          y: coords.y,
          description: `Click to add player (${color} at edge ${edge})`
        });
        
        // Track this color as used for next iteration
        usedColors.push(color);
        break;
        break;
      }
      
      case 'START_GAME': {
        // Don't generate a click for START_GAME - use action dispatch to preserve seed
        // Add a special marker that the test should dispatch this action directly
        clicks.push({
          type: 'wait',
          animationFrames: 0,
          description: `DISPATCH_ACTION: START_GAME with seed ${action.payload?.seed || 'default'}`
        });
        clicks.push({ type: 'wait', animationFrames: 1, description: 'Wait for game start' });
        break;
      }
      
      case 'SELECT_EDGE': {
        // Click on an edge hexagon in the seating phase
        const edgeCoords = getSeatingEdgeButtonCoords(
          action.payload.edgeNumber,
          canvasWidth,
          canvasHeight
        );
        clicks.push({
          type: 'click',
          target: 'edge-hex',
          x: edgeCoords.x,
          y: edgeCoords.y,
          description: `Select edge ${action.payload.edgeNumber} for player ${action.payload.playerId}`
        });
        clicks.push({ type: 'wait', animationFrames: 1, description: 'Wait for edge selection' });
        break;
      }
      
      case 'PLACE_TILE': {
        const { position, rotation } = action.payload;
        
        // First, click on hex position to place tile preview
        const hexCoords = getHexPixelCoords(position, canvasWidth, canvasHeight);
        clicks.push({
          type: 'click',
          target: 'hex-position',
          x: hexCoords.x,
          y: hexCoords.y,
          description: `Click hex at (${position.row}, ${position.col})`
        });
        clicks.push({ type: 'wait', animationFrames: 1, description: 'Wait for tile placement' });
        
        // Then rotate tile to desired rotation (if needed)
        if (rotation !== 0) {
          for (let i = 0; i < rotation; i++) {
            const rotateCoords = getTileRotationCoords(canvasWidth, canvasHeight, position);
            clicks.push({
              type: 'click',
              target: 'tile-rotate',
              x: rotateCoords.x,
              y: rotateCoords.y,
              description: `Rotate tile (rotation ${i + 1})`
            });
            clicks.push({ type: 'wait', animationFrames: 1, description: 'Wait for rotation' });
          }
        }
        
        // Finally, click checkmark to confirm
        const checkCoords = getCheckmarkCoords(position, canvasWidth, canvasHeight);
        clicks.push({
          type: 'click',
          target: 'checkmark',
          x: checkCoords.x,
          y: checkCoords.y,
          description: 'Click checkmark to confirm'
        });
        clicks.push({ type: 'wait', animationFrames: 1, description: 'Wait for confirmation' });
        
        break;
      }
      
      case 'DRAW_TILE':
      case 'NEXT_PLAYER':
      case 'SHUFFLE_TILES':
        // These are automatic/programmatic actions, no clicks needed
        break;
    }
  }
  
  return clicks;
}

/**
 * Generate expectations file from a completed game state
 * Note: This should be called with the final state from generateRandomGame,
 * not by replaying actions (to avoid player ID issues).
 */
export function generateExpectations(finalState: GameState): string {
  const lines: string[] = [];
  
  // Extract final flow data
  const player1Id = finalState.players[0]?.id;
  const player2Id = finalState.players[1]?.id;
  
  if (!player1Id || !player2Id) {
    return '# No players found\n';
  }
  
  // Collect flows for each player
  const p1Flows: Array<Array<{ pos: string; dir: number }>> = [];
  const p2Flows: Array<Array<{ pos: string; dir: number }>> = [];
  
  // Trace flows from each player's edge
  for (const player of finalState.players) {
    const edgeData = getEdgePositionsWithDirections(player.edgePosition);
    
    for (const { pos, dir } of edgeData) {
      const posKey = positionToKey(pos);
      const tile = finalState.board.get(posKey);
      
      if (!tile) {
        continue;
      }
      
      const { edges } = traceFlow(finalState.board, pos, dir, player.id);
      
      if (edges.length > 0) {
        const flowEdges = edges.map(e => ({
          pos: e.position,
          dir: e.direction
        }));
        
        if (player.id === player1Id) {
          p1Flows.push(flowEdges);
        } else {
          p2Flows.push(flowEdges);
        }
      }
    }
  }
  
  // Write P1 flows
  lines.push('[P1_FLOWS]');
  p1Flows.forEach((flow, idx) => {
    const flowStr = flow.map(e => `${e.pos}:${e.dir}`).join(' ');
    lines.push(`${idx}: ${flowStr}`);
  });
  lines.push('');
  
  // Write P2 flows
  lines.push('[P2_FLOWS]');
  p2Flows.forEach((flow, idx) => {
    const flowStr = flow.map(e => `${e.pos}:${e.dir}`).join(' ');
    lines.push(`${idx}: ${flowStr}`);
  });
  lines.push('');
  
  // Add empty move prefixes section header (to be filled by generateExpectationsWithPrefixes)
  lines.push('[MOVE_PREFIXES]');
  
  return lines.join('\n');
}

/**
 * Move prefix data structure (matches gameGenerator.ts)
 */
export interface MovePrefix {
  move: number;
  p1FlowLengths: Record<number, number>;
  p2FlowLengths: Record<number, number>;
}

/**
 * Generate expectations with move prefixes
 * Use this instead of actionsToExpectations to avoid player ID replay issues.
 * Takes the final state and move prefixes directly from game generation.
 */
export function generateExpectationsWithPrefixes(
  state: GameState,
  movePrefixes: MovePrefix[]
): string {
  const baseExpectations = generateExpectations(state);
  const prefixLines = formatMovePrefixes(movePrefixes);
  
  // Replace the empty move prefixes section with actual data
  const lines = baseExpectations.split('\n');
  const movePrefixIndex = lines.findIndex(line => line.includes('[MOVE_PREFIXES]'));
  
  if (movePrefixIndex >= 0) {
    // Remove lines after [MOVE_PREFIXES]
    lines.splice(movePrefixIndex + 1);
    // Add the actual move prefix data
    lines.push(...prefixLines);
  }
  
  return lines.join('\n');
}

/**
 * Format move prefixes into expectation file lines
 */
function formatMovePrefixes(movePrefixes: MovePrefix[]): string[] {
  return movePrefixes.map(prefix => {
    const p1Str = Object.entries(prefix.p1FlowLengths)
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    const p2Str = Object.entries(prefix.p2FlowLengths)
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    
    return `${prefix.move} p1={${p1Str}} p2={${p2Str}}`;
  });
}

/**
 * Generate move prefixes by replaying the game and tracking flow lengths after each PLACE_TILE
 * This reuses the same logic as complete-game-flows.test.ts
 */
function generateMovePrefixes(actions: GameAction[]): string[] {
  let state: GameState = initialState;
  const prefixLines: string[] = [];
  let moveNumber = 0;
  let player1Id: string | null = null;
  let player2Id: string | null = null;
  
  try {
    for (const action of actions) {
      state = gameReducer(state, action);
      
      // Track player IDs from seating phase
      if (action.type === 'START_GAME' && state.seatingPhase.seatingOrder.length >= 2) {
        player1Id = state.seatingPhase.seatingOrder[0];
        player2Id = state.seatingPhase.seatingOrder[1];
      }
      
      // After each PLACE_TILE, record flow lengths
      if (action.type === 'PLACE_TILE' && player1Id && player2Id) {
        moveNumber++;
        
        // Collect all flows for each player (same logic as complete-game-flows.test.ts)
        const actualP1Flows: Array<Array<any>> = [];
        const actualP2Flows: Array<Array<any>> = [];
        
        for (const player of state.players) {
          const edgeData = getEdgePositionsWithDirections(player.edgePosition);
          
          for (const { pos, dir } of edgeData) {
            const posKey = positionToKey(pos);
            const tile = state.board.get(posKey);
            
            if (!tile) {
              continue;
            }
            
            const { edges } = traceFlow(state.board, pos, dir, player.id);
            
            if (edges.length > 0) {
              const flowEdges = edges.map(e => ({
                pos: e.position,
                dir: e.direction
              }));
              
              if (player.id === player1Id) {
                actualP1Flows.push(flowEdges);
              } else if (player.id === player2Id) {
                actualP2Flows.push(flowEdges);
              }
            }
          }
        }
        
        // Build move prefix line: record the length of each flow
        const p1FlowLengths: Record<number, number> = {};
        actualP1Flows.forEach((flow, idx) => {
          p1FlowLengths[idx] = flow.length;
        });
        
        const p2FlowLengths: Record<number, number> = {};
        actualP2Flows.forEach((flow, idx) => {
          p2FlowLengths[idx] = flow.length;
        });
        
        // Format: "1 p1={0:2,1:2} p2={}"
        const p1Str = Object.entries(p1FlowLengths)
          .map(([k, v]) => `${k}:${v}`)
          .join(',');
        const p2Str = Object.entries(p2FlowLengths)
          .map(([k, v]) => `${k}:${v}`)
          .join(',');
        
        prefixLines.push(`${moveNumber} p1={${p1Str}} p2={${p2Str}}`);
      }
    }
  } catch (e) {
    console.error('Error generating move prefixes:', e);
    return ['# Error generating move prefixes: ' + (e as Error).message];
  }
  
  return prefixLines;
}

/**
 * Generate expectations file from actions (legacy compatibility)
 * This replays actions which may have player ID issues in unit tests.
 * For production use, call generateExpectations with the final state instead.
 */
export function actionsToExpectations(actions: GameAction[]): string {
  let state: GameState = initialState;
  
  // Play through all actions
  try {
    for (const action of actions) {
      state = gameReducer(state, action);
    }
  } catch (e) {
    // If replay fails due to player ID issues, return empty expectations
    return '# Replay failed\n[P1_FLOWS]\n[P2_FLOWS]\n[MOVE_PREFIXES]\n';
  }
  
  return generateExpectationsWithPrefixes(state, actions);
}

/**
 * Save clicks to file
 */
export function saveClicksToFile(clicks: ClickAction[]): string {
  return clicks.map(click => JSON.stringify(click)).join('\n');
}

/**
 * Load clicks from file
 */
export function loadClicksFromFile(content: string): ClickAction[] {
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line) as ClickAction);
}

/**
 * Generate a comprehensive README.md file documenting the test
 */
export function generateReadme(
  seed: number,
  actions: GameAction[],
  finalState: GameState,
  movePrefixes: MovePrefix[]
): string {
  const lines: string[] = [];
  const playerCount = actions.filter(a => a.type === 'ADD_PLAYER').length;
  const placeCount = actions.filter(a => a.type === 'PLACE_TILE').length;
  
  // Header
  lines.push(`# Complete Game Test - Seed ${seed}`);
  lines.push('');
  lines.push('## Overview');
  lines.push(`This test validates a complete game flow from lobby setup through gameplay to completion using seed ${seed}. The game demonstrates deterministic behavior with strategic tile placements that prioritize extending each player's flows.`);
  lines.push('');
  
  // Game Configuration
  lines.push('## Game Configuration');
  lines.push(`- **Seed**: ${seed}`);
  lines.push(`- **Players**: ${playerCount}`);
  
  const players = actions.filter(a => a.type === 'ADD_PLAYER');
  players.forEach((p, idx) => {
    lines.push(`  - Player ${idx + 1} - Color: ${p.payload.color}, Starting edge: ${p.payload.edge}`);
  });
  
  lines.push(`- **Total Actions**: ${actions.length}`);
  lines.push(`- **Tile Placements**: ${placeCount} moves`);
  lines.push(`- **Game Outcome**: ${finalState.phase}`);
  lines.push('');
  
  // Test Execution
  lines.push('## Test Execution');
  lines.push('');
  
  let stepCounter = 1;
  let screenshotCounter = 1;
  
  // Initial screenshot
  lines.push(`### Step ${stepCounter++}: Initial Screen`);
  lines.push(`![Initial Screen](screenshots/${screenshotCounter.toString().padStart(3, '0')}-initial-screen.png)`);
  lines.push('');
  lines.push('**Action**: Application loads');
  lines.push('**Expected State**: Game canvas visible, empty configuration screen ready for player setup');
  lines.push('');
  lines.push('---');
  lines.push('');
  screenshotCounter++;
  
  // Document each action
  for (const action of actions) {
    const screenshot = `${screenshotCounter.toString().padStart(3, '0')}-${action.type.toLowerCase()}.png`;
    
    lines.push(`### Step ${stepCounter++}: ${action.type}`);
    lines.push(`![${action.type}](screenshots/${screenshot})`);
    lines.push('');
    lines.push(`**Action**: \`${action.type}\``);
    
    // Add action-specific details
    if (action.type === 'ADD_PLAYER') {
      lines.push(`- Color: ${action.payload.color}`);
      lines.push(`- Edge: ${action.payload.edge}`);
      lines.push('');
      lines.push('**Expected State**: Player added to configuration');
    } else if (action.type === 'START_GAME') {
      lines.push('');
      lines.push('**Expected State**: Transition to seating phase');
    } else if (action.type === 'SELECT_EDGE') {
      lines.push(`- Player: ${action.payload.playerId}`);
      lines.push(`- Edge: ${action.payload.edgeNumber}`);
      lines.push('');
      lines.push('**Expected State**: Player edge selected, gameplay begins when all players seated');
    } else if (action.type === 'SHUFFLE_TILES') {
      lines.push('');
      lines.push('**Expected State**: Tile deck shuffled');
    } else if (action.type === 'DRAW_TILE') {
      lines.push('');
      lines.push('**Expected State**: Current player draws a new tile');
    } else if (action.type === 'PLACE_TILE') {
      lines.push(`- Position: (${action.payload.position.row}, ${action.payload.position.col})`);
      lines.push(`- Rotation: ${action.payload.rotation}`);
      lines.push('');
      lines.push('**Expected State**: Tile placed on board, flows updated');
    } else if (action.type === 'NEXT_PLAYER') {
      lines.push('');
      lines.push('**Expected State**: Turn advances to next player');
    }
    
    lines.push('');
    lines.push('---');
    lines.push('');
    screenshotCounter++;
  }
  
  // Final screenshot
  lines.push(`### Step ${stepCounter}: Final Game State`);
  lines.push(`![Final State](screenshots/final-state.png)`);
  lines.push('');
  lines.push(`**Game Phase**: ${finalState.phase}`);
  lines.push(`**Total Moves**: ${placeCount}`);
  lines.push('');
  
  // Validation checklist
  lines.push('## Validation Checklist');
  lines.push('');
  lines.push(`- [ ] All ${actions.length} actions executed successfully`);
  lines.push(`- [ ] ${placeCount} tiles placed on board`);
  lines.push('- [ ] No illegal moves attempted');
  lines.push('- [ ] Flow calculations correct at each step');
  lines.push('- [ ] Game state matches expectations file');
  lines.push(`- [ ] Final phase is "${finalState.phase}"`);
  lines.push(`- [ ] ${playerCount} players participated`);
  lines.push('- [ ] Screenshots captured for all actions');
  lines.push('- [ ] Test completes without errors');
  lines.push('- [ ] Deterministic behavior - same seed produces same game');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Generate a README.md file from clicks (for mouse-based tests)
 * This describes what the USER does (clicks), not backend actions
 */
export function generateReadmeFromClicks(
  seed: number,
  clicks: ClickAction[],
  actions: GameAction[],
  finalState: GameState
): string {
  const lines: string[] = [];
  const playerCount = actions.filter(a => a.type === 'ADD_PLAYER').length;
  const placeCount = actions.filter(a => a.type === 'PLACE_TILE').length;
  
  // Header
  lines.push(`# Complete Game Test - Seed ${seed}`);
  lines.push('');
  lines.push('## Overview');
  lines.push(`This test validates a complete game flow from lobby setup through gameplay to completion using seed ${seed}. The game demonstrates deterministic behavior with mouse click interactions.`);
  lines.push('');
  
  // Game Configuration
  lines.push('## Game Configuration');
  lines.push(`- **Seed**: ${seed}`);
  lines.push(`- **Players**: ${playerCount}`);
  
  const players = actions.filter(a => a.type === 'ADD_PLAYER');
  players.forEach((p, idx) => {
    lines.push(`  - Player ${idx + 1} - Color: ${p.payload.color}, Starting edge: ${p.payload.edge}`);
  });
  
  lines.push(`- **Total Clicks**: ${clicks.filter(c => c.type === 'click').length}`);
  lines.push(`- **Tile Placements**: ${placeCount} moves`);
  lines.push(`- **Game Outcome**: ${finalState.phase}`);
  lines.push('');
  
  // Test Execution
  lines.push('## Test Execution');
  lines.push('');
  lines.push('Each screenshot shows the result of a user click action.');
  lines.push('');
  
  let stepCounter = 1;
  let screenshotCounter = 1;
  
  // Initial screenshot
  lines.push(`### Step ${stepCounter++}: Initial Screen`);
  lines.push(`![Initial Screen](screenshots/${screenshotCounter.toString().padStart(4, '0')}-initial-screen.png)`);
  lines.push('');
  lines.push('**User Action**: Application loads');
  lines.push('**Expected State**: Game canvas visible, empty configuration screen ready for player setup');
  lines.push('');
  lines.push('---');
  lines.push('');
  screenshotCounter++;
  
  // Document each click
  for (const click of clicks) {
    if (click.type === 'click') {
      const screenshot = `${screenshotCounter.toString().padStart(4, '0')}-click.png`;
      
      lines.push(`### Step ${stepCounter++}: ${click.description}`);
      lines.push(`![${click.description}](screenshots/${screenshot})`);
      lines.push('');
      lines.push(`**User Action**: ${click.description}`);
      
      // Add more context based on the description
      if (click.description.includes('add player')) {
        lines.push('**Expected State**: Player added to configuration, color button appears');
      } else if (click.description.includes('START')) {
        lines.push('**Expected State**: Game transitions to seating phase, players choose board edges');
      } else if (click.description.includes('Select edge')) {
        lines.push('**Expected State**: Player seated at chosen edge, waiting for other players');
      } else if (click.description.includes('Rotate tile')) {
        lines.push('**Expected State**: Preview tile rotates to new orientation');
      } else if (click.description.includes('Click hex')) {
        lines.push('**Expected State**: Tile preview appears at selected hex position');
      } else if (click.description.includes('checkmark')) {
        lines.push('**Expected State**: Tile placed on board, flows updated, turn advances');
      }
      
      lines.push('');
      lines.push('---');
      lines.push('');
      screenshotCounter++;
    }
  }
  
  // Final screenshot
  lines.push(`### Step ${stepCounter}: Final Game State`);
  lines.push(`![Final State](screenshots/final-state.png)`);
  lines.push('');
  lines.push(`**Game Phase**: ${finalState.phase}`);
  lines.push(`**Total Moves**: ${placeCount}`);
  lines.push('');
  
  // Validation checklist
  lines.push('## Validation Checklist');
  lines.push('');
  lines.push(`- [ ] All ${clicks.filter(c => c.type === 'click').length} clicks executed successfully`);
  lines.push(`- [ ] ${placeCount} tiles placed on board`);
  lines.push('- [ ] No illegal moves attempted');
  lines.push('- [ ] Flow calculations correct at each step');
  lines.push('- [ ] Game state matches expectations file');
  lines.push(`- [ ] Final phase is "${finalState.phase}"`);
  lines.push(`- [ ] ${playerCount} players participated`);
  lines.push('- [ ] Screenshots captured for all clicks');
  lines.push('- [ ] Test completes without errors');
  lines.push('- [ ] Deterministic behavior - same seed produces same game');
  lines.push('');
  
  return lines.join('\n');
}
