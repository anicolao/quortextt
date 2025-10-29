// Flow propagation logic for Quortex/Flows

import { HexPosition, Direction, PlacedTile, Player } from './types';
import {
  positionToKey,
  getNeighborInDirection,
  getOppositeDirection,
  getEdgePositionsWithDirections,
  isValidPosition,
} from './board';
import { getFlowExit } from './tiles';

// Flow edge data: tracks which player's flow enters/exits each hex edge
export interface FlowEdgeData {
  position: string; // position key "row,col"
  direction: Direction;
  playerId: string;
}

// Trace a single flow from a starting position and direction
// Returns set of position keys that are part of this flow AND edge data
// Simplified: just trace the linear path from start edge to termination
export function traceFlow(
  board: Map<string, PlacedTile>,
  startPos: HexPosition,
  startDirection: Direction,
  playerId: string
): { positions: Set<string>; edges: FlowEdgeData[] } {
  const flowPositions = new Set<string>();
  const flowEdges: FlowEdgeData[] = [];
  
  let currentPos = startPos;
  let currentEntryDir = startDirection;
  let step = 0;
  
  const startKey = positionToKey(startPos);
  console.log(`>>> TRACE START: ${startKey} dir=${startDirection} player=${playerId}`);
  
  // Trace the flow forward until it terminates
  while (true) {
    const posKey = positionToKey(currentPos);
    
    // Check if there's a tile at this position
    const tile = board.get(posKey);
    if (!tile) {
      // Flow terminates at an empty position
      console.log(`  [${step}] ${posKey} - NO TILE, STOP`);
      break;
    }
    
    // Find where the flow exits this tile
    const exitDir = getFlowExit(tile, currentEntryDir);
    if (exitDir === null) {
      // Flow terminates - no connection for this entry direction
      console.log(`  [${step}] ${posKey} entry=${currentEntryDir} - NO EXIT, STOP`);
      break;
    }
    
    console.log(`  [${step}] ${posKey} type=${tile.type} rot=${tile.rotation} entry=${currentEntryDir} exit=${exitDir}`);
    
    // Add this position to the flow
    flowPositions.add(posKey);
    
    // Record that this player's flow enters and exits through these edges
    flowEdges.push({
      position: posKey,
      direction: currentEntryDir,
      playerId,
    });
    flowEdges.push({
      position: posKey,
      direction: exitDir,
      playerId,
    });
    
    // Move to the next tile in the exit direction
    const nextPos = getNeighborInDirection(currentPos, exitDir);
    if (!isValidPosition(nextPos)) {
      // Flow terminates at board boundary
      console.log(`  [${step}] Next pos invalid, STOP`);
      break;
    }
    
    // Continue tracing from the next position
    currentPos = nextPos;
    currentEntryDir = getOppositeDirection(exitDir);
    step++;
  }
  
  console.log(`<<< TRACE END: ${flowPositions.size} positions`);
  
  return { positions: flowPositions, edges: flowEdges };
}

// Calculate all flows for all players from the current board state
// Returns a map from player ID to set of position keys in their flow
// Also returns flow edge data for rendering
export function calculateFlows(
  board: Map<string, PlacedTile>,
  players: Player[]
): {
  flows: Map<string, Set<string>>;
  flowEdges: Map<string, Map<Direction, string>>; // position key -> direction -> player ID
} {
  const flows = new Map<string, Set<string>>();
  const flowEdges = new Map<string, Map<Direction, string>>();
  
  for (const player of players) {
    const playerFlow = new Set<string>();
    const playerEdges: FlowEdgeData[] = [];
    const visited = new Set<string>(); // Track position:direction pairs to avoid re-processing
    const queue: Array<{ pos: HexPosition; entryDir: Direction }> = [];
    
    // Get all edge positions with their specific hex edge directions for this player
    const edgeData = getEdgePositionsWithDirections(player.edgePosition);
    
    // Start BFS from all edge entry points
    for (const { pos, dir } of edgeData) {
      queue.push({ pos, entryDir: dir });
    }
    
    // BFS to explore all reachable tiles via all possible entry directions
    while (queue.length > 0) {
      const { pos, entryDir } = queue.shift()!;
      const posKey = positionToKey(pos);
      const visitKey = `${posKey}:${entryDir}`;
      
      // Skip if already processed this position+direction
      if (visited.has(visitKey)) {
        continue;
      }
      visited.add(visitKey);
      
      // Check if there's a tile at this position
      const tile = board.get(posKey);
      if (!tile) {
        continue;
      }
      
      // Find where the flow exits
      const exitDir = getFlowExit(tile, entryDir);
      if (exitDir === null) {
        continue;
      }
      
      // Add this position to the flow
      playerFlow.add(posKey);
      
      // Record edges
      playerEdges.push({ position: posKey, direction: entryDir, playerId: player.id });
      playerEdges.push({ position: posKey, direction: exitDir, playerId: player.id });
      
      // Queue the next position
      const nextPos = getNeighborInDirection(pos, exitDir);
      if (isValidPosition(nextPos)) {
        const nextEntryDir = getOppositeDirection(exitDir);
        queue.push({ pos: nextPos, entryDir: nextEntryDir });
      }
    }
    
    flows.set(player.id, playerFlow);
    
    // Record edge data
    for (const edge of playerEdges) {
      if (!flowEdges.has(edge.position)) {
        flowEdges.set(edge.position, new Map());
      }
      flowEdges.get(edge.position)!.set(edge.direction, edge.playerId);
    }
  }
  
  return { flows, flowEdges };
}

// Check if two positions are flow-connected for a specific player
export function areConnected(
  pos1: HexPosition,
  pos2: HexPosition,
  flows: Map<string, Set<string>>,
  playerId: string
): boolean {
  const playerFlow = flows.get(playerId);
  if (!playerFlow) {
    return false;
  }
  
  const key1 = positionToKey(pos1);
  const key2 = positionToKey(pos2);
  
  return playerFlow.has(key1) && playerFlow.has(key2);
}

// Check if any position from one set is flow-connected to any position from another set
export function areSetsConnected(
  positions1: HexPosition[],
  positions2: HexPosition[],
  flows: Map<string, Set<string>>,
  playerId: string
): boolean {
  const playerFlow = flows.get(playerId);
  if (!playerFlow) {
    return false;
  }
  
  // Check if any position from set1 is in the flow
  const hasFromSet1 = positions1.some((pos) => playerFlow.has(positionToKey(pos)));
  if (!hasFromSet1) {
    return false;
  }
  
  // Check if any position from set2 is in the flow
  const hasFromSet2 = positions2.some((pos) => playerFlow.has(positionToKey(pos)));
  if (!hasFromSet2) {
    return false;
  }
  
  return true;
}
