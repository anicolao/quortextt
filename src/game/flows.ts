// Flow propagation logic for Quortex/Flows

import { HexPosition, Direction, PlacedTile, Player } from "./types";
import {
  positionToKey,
  getNeighborInDirection,
  getOppositeDirection,
  getEdgePositionsWithDirections,
  isValidPosition,
} from "./board";
import { getFlowExit } from "./tiles";

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
  playerId: string,
): { positions: Set<string>; edges: FlowEdgeData[] } {
  const flowPositions = new Set<string>();
  const flowEdges: FlowEdgeData[] = [];

  // Simply follow the linear flow path from start to finish
  let currentPos = startPos;
  let entryDir = startDirection;
  
  // Track visited positions to prevent infinite loops in circular flows
  const visited = new Set<string>();

  while (true) {
    const posKey = positionToKey(currentPos);
    
    // Check if we've already visited this position (circular flow)
    if (visited.has(posKey)) {
      break;
    }
    visited.add(posKey);

    // Check if there's a tile at this position
    const tile = board.get(posKey);
    if (!tile) {
      break;
    }

    // Find where the flow exits this tile
    const exitDir = getFlowExit(tile, entryDir);
    if (exitDir === null) {
      break;
    }

    // Add this position to the flow only if there's a valid flow connection
    flowPositions.add(posKey);

    // Record that this player's flow enters and exits through these edges
    flowEdges.push({
      position: posKey,
      direction: entryDir,
      playerId,
    });
    flowEdges.push({
      position: posKey,
      direction: exitDir,
      playerId,
    });

    // Move to the next position
    const nextPos = getNeighborInDirection(currentPos, exitDir);
    if (!isValidPosition(nextPos)) {
      break;
    }

    currentPos = nextPos;
    entryDir = getOppositeDirection(exitDir);
  }

  return { positions: flowPositions, edges: flowEdges };
}

// Calculate all flows for all players from the current board state
// Returns a map from player ID to set of position keys in their flow
// Also returns flow edge data for rendering
export function calculateFlows(
  board: Map<string, PlacedTile>,
  players: Player[],
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
  playerId: string,
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
  playerId: string,
): boolean {
  const playerFlow = flows.get(playerId);
  if (!playerFlow) {
    return false;
  }

  // Check if any position from set1 is in the flow
  const hasFromSet1 = positions1.some((pos) =>
    playerFlow.has(positionToKey(pos)),
  );
  if (!hasFromSet1) {
    return false;
  }

  // Check if any position from set2 is in the flow
  const hasFromSet2 = positions2.some((pos) =>
    playerFlow.has(positionToKey(pos)),
  );
  if (!hasFromSet2) {
    return false;
  }

  return true;
}
