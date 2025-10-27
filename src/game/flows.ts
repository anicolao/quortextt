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

// Trace a single flow from a starting position and direction
// Returns set of position keys that are part of this flow
export function traceFlow(
  board: Map<string, PlacedTile>,
  startPos: HexPosition,
  startDirection: Direction
): Set<string> {
  const flowPositions = new Set<string>();
  const visited = new Set<string>();
  
  // Queue of positions to explore: [position, direction entering the tile]
  const queue: Array<{ pos: HexPosition; entryDir: Direction }> = [
    { pos: startPos, entryDir: startDirection },
  ];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    const posKey = positionToKey(current.pos);
    
    // Skip if already visited this position from this direction
    const visitKey = `${posKey}:${current.entryDir}`;
    if (visited.has(visitKey)) {
      continue;
    }
    visited.add(visitKey);
    
    // Check if there's a tile at this position
    const tile = board.get(posKey);
    if (!tile) {
      continue;
    }
    
    // Find where the flow exits this tile
    const exitDir = getFlowExit(tile, current.entryDir);
    if (exitDir === null) {
      continue;
    }
    
    // Add this position to the flow only if there's a valid flow connection
    flowPositions.add(posKey);
    
    // Move to the next tile in the exit direction
    const nextPos = getNeighborInDirection(current.pos, exitDir);
    if (!isValidPosition(nextPos)) {
      continue;
    }
    
    // The flow enters the next tile from the opposite direction
    const nextEntryDir = getOppositeDirection(exitDir);
    queue.push({ pos: nextPos, entryDir: nextEntryDir });
  }
  
  return flowPositions;
}

// Calculate all flows for all players from the current board state
// Returns a map from player ID to set of position keys in their flow
export function calculateFlows(
  board: Map<string, PlacedTile>,
  players: Player[]
): Map<string, Set<string>> {
  const flows = new Map<string, Set<string>>();
  
  for (const player of players) {
    const playerFlow = new Set<string>();
    
    // Get all edge positions with their specific hex edge directions for this player
    const edgeData = getEdgePositionsWithDirections(player.edgePosition);
    
    // For each edge position and direction pair, trace the flow
    for (const { pos, dir } of edgeData) {
      const posKey = positionToKey(pos);
      const tile = board.get(posKey);
      
      if (!tile) {
        continue;
      }
      
      // Trace flow starting from this specific hex edge direction
      const flow = traceFlow(board, pos, dir);
      
      // Merge this flow into the player's total flow
      for (const flowPos of flow) {
        playerFlow.add(flowPos);
      }
    }
    
    flows.set(player.id, playerFlow);
  }
  
  return flows;
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
