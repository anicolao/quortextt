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
  delay?: number;  // Milliseconds to wait
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
 * Get coordinates for edge button in lobby
 */
function getEdgeButtonCoords(
  colorIndex: number,
  edge: number,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  const minDim = Math.min(canvasWidth, canvasHeight);
  const buttonSize = Math.max(60, minDim * 0.08);
  const edgeMargin = minDim * 0.05;
  const buttonSpacing = buttonSize * 0.3;
  
  // Calculate position based on edge
  let x: number, y: number;
  
  if (edge === 0) { // Bottom
    const totalWidth = 6 * buttonSize + 5 * buttonSpacing;
    const startX = (canvasWidth - totalWidth) / 2;
    x = startX + colorIndex * (buttonSize + buttonSpacing) + buttonSize / 2;
    y = canvasHeight - edgeMargin - buttonSize / 2;
  } else if (edge === 1) { // Right
    const totalHeight = 6 * buttonSize + 5 * buttonSpacing;
    const startY = (canvasHeight - totalHeight) / 2;
    x = canvasWidth - edgeMargin - buttonSize / 2;
    y = startY + colorIndex * (buttonSize + buttonSpacing) + buttonSize / 2;
  } else if (edge === 2) { // Top
    const totalWidth = 6 * buttonSize + 5 * buttonSpacing;
    const startX = (canvasWidth - totalWidth) / 2;
    x = startX + colorIndex * (buttonSize + buttonSpacing) + buttonSize / 2;
    y = edgeMargin + buttonSize / 2;
  } else { // Left (edge === 3)
    const totalHeight = 6 * buttonSize + 5 * buttonSpacing;
    const startY = (canvasHeight - totalHeight) / 2;
    x = edgeMargin + buttonSize / 2;
    y = startY + colorIndex * (buttonSize + buttonSpacing) + buttonSize / 2;
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
  
  // Color mapping
  const colorMap: Record<string, number> = {
    '#0173B2': 0, // Blue
    '#DE8F05': 1, // Orange
    '#029E73': 2, // Green
    '#ECE133': 3, // Yellow
    '#CC78BC': 4, // Purple
    '#CA5127': 5, // Red
  };
  
  for (const action of actions) {
    switch (action.type) {
      case 'ADD_PLAYER': {
        const colorIndex = colorMap[action.payload?.color || '#0173B2'];
        const edge = action.payload?.edge || 0;
        const coords = getEdgeButtonCoords(colorIndex, edge, canvasWidth, canvasHeight);
        
        clicks.push({
          type: 'click',
          target: 'edge-button',
          x: coords.x,
          y: coords.y,
          description: `Click to add player (${action.payload?.color} at edge ${edge})`
        });
        clicks.push({ type: 'wait', delay: 200, description: 'Wait for player addition' });
        break;
      }
      
      case 'START_GAME': {
        clicks.push({
          type: 'click',
          target: 'start-button',
          x: canvasWidth / 2,
          y: canvasHeight / 2,
          description: 'Click START button'
        });
        clicks.push({ type: 'wait', delay: 200, description: 'Wait for game start' });
        break;
      }
      
      case 'SELECT_EDGE': {
        // This requires clicking on an edge hexagon in the seating phase
        // For simplicity, we'll note this as a programmatic action
        clicks.push({
          type: 'click',
          target: 'edge-hex',
          description: `Select edge ${action.payload.edgeNumber} for player ${action.payload.playerId}`
        });
        clicks.push({ type: 'wait', delay: 200, description: 'Wait for edge selection' });
        break;
      }
      
      case 'PLACE_TILE': {
        const { position, rotation } = action.payload;
        
        // Rotate tile to desired rotation
        const rotationsNeeded = (rotation - currentRotation + 6) % 6;
        for (let i = 0; i < rotationsNeeded; i++) {
          const rotateCoords = getTileRotationCoords(canvasWidth, canvasHeight);
          clicks.push({
            type: 'click',
            target: 'tile-rotate',
            x: rotateCoords.x,
            y: rotateCoords.y,
            description: `Rotate tile (rotation ${(currentRotation + i + 1) % 6})`
          });
          clicks.push({ type: 'wait', delay: 200, description: 'Wait for rotation' });
        }
        currentRotation = rotation;
        
        // Click on hex position to place tile
        const hexCoords = getHexPixelCoords(position, canvasWidth, canvasHeight);
        clicks.push({
          type: 'click',
          target: 'hex-position',
          x: hexCoords.x,
          y: hexCoords.y,
          description: `Click hex at (${position.row}, ${position.col})`
        });
        clicks.push({ type: 'wait', delay: 300, description: 'Wait for tile placement' });
        
        // Click checkmark to confirm
        const checkCoords = getCheckmarkCoords(position, canvasWidth, canvasHeight);
        clicks.push({
          type: 'click',
          target: 'checkmark',
          x: checkCoords.x,
          y: checkCoords.y,
          description: 'Click checkmark to confirm'
        });
        clicks.push({ type: 'wait', delay: 400, description: 'Wait for confirmation' });
        
        // Reset rotation after placement
        currentRotation = 0;
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
