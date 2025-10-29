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
// Flows are bidirectional - connections work both ways
export function traceFlow(
  board: Map<string, PlacedTile>,
  startPos: HexPosition,
  startDirection: Direction,
  playerId: string
): { positions: Set<string>; edges: FlowEdgeData[] } {
  const flowPositions = new Set<string>();
  const flowEdges: FlowEdgeData[] = [];
  const visited = new Set<string>();
  const edgesRecorded = new Set<string>(); // Track which tiles have flow edges recorded
  const startPosKey = positionToKey(startPos); // For validation
  
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
    
    // Record flow edges for this tile - exactly once per tile
    // For each tile with flow, record exactly ONE connection (both directions)
    if (!edgesRecorded.has(posKey)) {
      edgesRecorded.add(posKey);
      
      // VALIDATION: At least one end of the flow edge must point to a tile or board edge
      // Exception: if this is the start position, entry direction comes from board edge
      const isStartPosition = posKey === startPosKey;
      
      const entryNeighbor = getNeighborInDirection(current.pos, current.entryDir);
      const exitNeighbor = getNeighborInDirection(current.pos, exitDir);
      const entryNeighborKey = isValidPosition(entryNeighbor) ? positionToKey(entryNeighbor) : null;
      const exitNeighborKey = isValidPosition(exitNeighbor) ? positionToKey(exitNeighbor) : null;
      
      const entryPointsToTile = entryNeighborKey && board.has(entryNeighborKey);
      const exitPointsToTile = exitNeighborKey && board.has(exitNeighborKey);
      
      // DEBUG: Log for tile 5
      if (posKey === '-2,-1') {
        console.log(`[VALIDATION] Tile at ${posKey}:`);
        console.log(`  Entry dir ${current.entryDir} → ${entryNeighborKey} (hasTile: ${entryPointsToTile})`);
        console.log(`  Exit dir ${exitDir} → ${exitNeighborKey} (hasTile: ${exitPointsToTile})`);
        console.log(`  Is start: ${isStartPosition}`);
      }
      
      // For start position, entry comes from board edge (valid)
      // For other positions, at least one direction must point to a tile
      if (!isStartPosition && !entryPointsToTile && !exitPointsToTile) {
        throw new Error(
          `Flow edge validation failed at ${posKey}! ` +
          `Entry dir ${current.entryDir} points to ${entryNeighborKey || 'off-board'} (hasTile: ${entryPointsToTile}), ` +
          `Exit dir ${exitDir} points to ${exitNeighborKey || 'off-board'} (hasTile: ${exitPointsToTile}). ` +
          `At least one direction must point to a tile.`
        );
      }
      
      // Always record both entry and exit directions
      // This represents the complete flow connection through this tile
      flowEdges.push({
        position: posKey,
        direction: current.entryDir,
        playerId,
      });
      flowEdges.push({
        position: posKey,
        direction: exitDir,
        playerId,
      });
    }
    
    // Continue flow in the exit direction
    const nextPos = getNeighborInDirection(current.pos, exitDir);
    if (isValidPosition(nextPos)) {
      const nextEntryDir = getOppositeDirection(exitDir);
      queue.push({ pos: nextPos, entryDir: nextEntryDir });
    }
    
    // BIDIRECTIONAL: Tile connections work both ways
    // Re-explore this tile from the opposite direction
    queue.push({ pos: current.pos, entryDir: exitDir });
  }
  
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
      const { positions, edges } = traceFlow(board, pos, dir, player.id);
      
      // Merge this flow into the player's total flow
      for (const flowPos of positions) {
        playerFlow.add(flowPos);
      }
      
      // Record edge data
      for (const edge of edges) {
        if (!flowEdges.has(edge.position)) {
          flowEdges.set(edge.position, new Map());
        }
        flowEdges.get(edge.position)!.set(edge.direction, edge.playerId);
      }
    }
    
    flows.set(player.id, playerFlow);
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
