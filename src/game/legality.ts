// Legal move validation for Quortex/Flows

import { PlacedTile, Player, Team, HexPosition, TileType, Rotation, Direction } from './types';
import {
  getAllBoardPositions,
  positionToKey,
  getEdgePositions,
  getOppositeEdge,
  getNeighborInDirection,
  getOppositeDirection,
  isValidPosition,
} from './board';
import { calculateFlows } from './flows';
import { checkFlowVictory } from './victory';
import { getFlowConnections } from './tiles';

// Check if placing a tile would result in a victory
function wouldCauseVictory(
  board: Map<string, PlacedTile>,
  tile: PlacedTile,
  players: Player[],
  teams: Team[]
): boolean {
  // Create a new board with the proposed tile
  const testBoard = new Map(board);
  testBoard.set(positionToKey(tile.position), tile);
  
  // Calculate flows with the new tile
  const { flows, flowEdges } = calculateFlows(testBoard, players);
  
  // Check if this causes a victory
  const victory = checkFlowVictory(flows, flowEdges, players, teams);
  
  return victory.winner !== null;
}

// Represents a node in the edge graph: a specific edge of a specific hex tile
interface EdgeNode {
  position: HexPosition;
  direction: Direction;
}

// Create a unique key for an edge node
function edgeNodeKey(node: EdgeNode): string {
  return `${node.position.row},${node.position.col},${node.direction}`;
}

// Get the opposite edge node (the edge on the neighboring tile that this edge connects to)
function getOppositeEdgeNode(node: EdgeNode): EdgeNode | null {
  const { position, direction } = node;
  const neighborPos = getNeighborInDirection(position, direction);
  
  if (!isValidPosition(neighborPos)) {
    return null;
  }
  
  const oppositeDir = getOppositeDirection(direction);
  return {
    position: neighborPos,
    direction: oppositeDir,
  };
}

// Result of path finding with debug information
interface PathFindingResult {
  hasPath: boolean;
  visitedPositions?: Set<HexPosition>;
  pathToTarget?: HexPosition[];
}

// Check if a player/team still has a viable path to victory
// Uses edge-based graph BFS: creates nodes for each tile edge and checks flow connectivity
function hasViablePath(
  board: Map<string, PlacedTile>,
  player: Player,
  targetEdge: number,
  returnDebugInfo = false
): boolean | PathFindingResult {
  const startEdge = player.edgePosition;
  const startPositions = getEdgePositions(startEdge);
  const targetPositions = getEdgePositions(targetEdge);
  
  // Build edge connectivity graph
  // For each tile position, we create nodes for each of its 6 edges
  // If the tile is occupied, we connect only the edges that the tile connects
  // If the tile is empty, we connect ALL edges (any tile could be placed)
  
  const allPositions = getAllBoardPositions();
  
  // Build adjacency list: for each edge node, which other edge nodes can it connect to?
  const adjacencyMap = new Map<string, Set<string>>();
  
  const addEdge = (from: EdgeNode, to: EdgeNode) => {
    const fromKey = edgeNodeKey(from);
    const toKey = edgeNodeKey(to);
    
    if (!adjacencyMap.has(fromKey)) {
      adjacencyMap.set(fromKey, new Set());
    }
    adjacencyMap.get(fromKey)!.add(toKey);
  };
  
  // For each board position, create edges
  for (const pos of allPositions) {
    const posKey = positionToKey(pos);
    const tile = board.get(posKey);
    
    if (tile) {
      // Occupied tile: connect only the edges that the tile's flow pattern connects
      const connections = getFlowConnections(tile.type, tile.rotation);
      
      for (const [dir1, dir2] of connections) {
        const edge1: EdgeNode = { position: pos, direction: dir1 };
        const edge2: EdgeNode = { position: pos, direction: dir2 };
        
        // Connect these two edges on this tile (bidirectional)
        addEdge(edge1, edge2);
        addEdge(edge2, edge1);
      }
      
      // Also connect each edge to its opposite edge on the neighboring tile
      for (let dir = 0; dir < 6; dir++) {
        const direction = dir as Direction;
        const edge: EdgeNode = { position: pos, direction };
        const oppositeEdge = getOppositeEdgeNode(edge);
        
        if (oppositeEdge) {
          addEdge(edge, oppositeEdge);
          addEdge(oppositeEdge, edge);
        }
      }
    } else {
      // Empty tile: all edges can connect to each other (any tile could be placed)
      // Connect all pairs of edges on this tile
      for (let dir1 = 0; dir1 < 6; dir1++) {
        for (let dir2 = dir1 + 1; dir2 < 6; dir2++) {
          const edge1: EdgeNode = { position: pos, direction: dir1 as Direction };
          const edge2: EdgeNode = { position: pos, direction: dir2 as Direction };
          
          addEdge(edge1, edge2);
          addEdge(edge2, edge1);
        }
        
        // Also connect to opposite edges on neighboring tiles
        const direction = dir1 as Direction;
        const edge: EdgeNode = { position: pos, direction };
        const oppositeEdge = getOppositeEdgeNode(edge);
        
        if (oppositeEdge) {
          addEdge(edge, oppositeEdge);
          addEdge(oppositeEdge, edge);
        }
      }
    }
  }
  
  // Now perform BFS from all start edge nodes to see if we can reach any target edge node
  const visited = new Set<string>();
  const parent = new Map<string, string>(); // For path reconstruction
  const queue: string[] = [];
  
  // Add all edges from start positions as starting points
  // For edge positions, we need to consider the inward-facing edges
  for (const pos of startPositions) {
    for (let dir = 0; dir < 6; dir++) {
      const direction = dir as Direction;
      const edgeNode: EdgeNode = { position: pos, direction };
      const key = edgeNodeKey(edgeNode);
      
      if (!visited.has(key)) {
        queue.push(key);
        visited.add(key);
        parent.set(key, ''); // Mark as starting node
      }
    }
  }
  
  let foundTargetKey: string | null = null;
  
  // BFS
  while (queue.length > 0) {
    const currentKey = queue.shift()!;
    
    // Parse current node
    const [rowStr, colStr, dirStr] = currentKey.split(',');
    const currentNode: EdgeNode = {
      position: { row: parseInt(rowStr), col: parseInt(colStr) },
      direction: parseInt(dirStr) as Direction,
    };
    
    // Check if we've reached any target position
    const isTarget = targetPositions.some(targetPos => 
      targetPos.row === currentNode.position.row && 
      targetPos.col === currentNode.position.col
    );
    
    if (isTarget) {
      foundTargetKey = currentKey;
      break;
    }
    
    // Explore neighbors
    const neighbors = adjacencyMap.get(currentKey);
    if (neighbors) {
      for (const neighborKey of neighbors) {
        if (!visited.has(neighborKey)) {
          visited.add(neighborKey);
          parent.set(neighborKey, currentKey);
          queue.push(neighborKey);
        }
      }
    }
  }
  
  const hasPath = foundTargetKey !== null;
  
  // If not returning debug info, just return boolean
  if (!returnDebugInfo) {
    return hasPath;
  }
  
  // Reconstruct path and get visited positions
  const visitedPositions = new Set<HexPosition>();
  for (const key of visited) {
    const [rowStr, colStr] = key.split(',');
    const pos: HexPosition = { row: parseInt(rowStr), col: parseInt(colStr) };
    visitedPositions.add(pos);
  }
  
  const pathToTarget: HexPosition[] = [];
  if (hasPath && foundTargetKey) {
    // Reconstruct path from target back to start
    let current: string | undefined = foundTargetKey;
    const pathKeys: string[] = [];
    
    while (current && parent.get(current) !== '') {
      pathKeys.push(current);
      current = parent.get(current);
    }
    
    // Convert to positions (reverse to get start-to-end order)
    pathKeys.reverse();
    for (const key of pathKeys) {
      const [rowStr, colStr] = key.split(',');
      const pos: HexPosition = { row: parseInt(rowStr), col: parseInt(colStr) };
      // Only add unique positions
      if (pathToTarget.length === 0 || 
          pathToTarget[pathToTarget.length - 1].row !== pos.row ||
          pathToTarget[pathToTarget.length - 1].col !== pos.col) {
        pathToTarget.push(pos);
      }
    }
  }
  
  return {
    hasPath,
    visitedPositions,
    pathToTarget,
  };
}

// Check if all players/teams have a viable path after placing a tile
function allPlayersHaveViablePath(
  board: Map<string, PlacedTile>,
  players: Player[],
  teams: Team[]
): boolean {
  // For team games
  if (teams.length > 0) {
    for (const team of teams) {
      const player1 = players.find((p) => p.id === team.player1Id);
      const player2 = players.find((p) => p.id === team.player2Id);
      
      if (!player1 || !player2) continue;
      
      // Check if team has a viable path (either player can complete it)
      const path1 = hasViablePath(board, player1, player2.edgePosition);
      const path2 = hasViablePath(board, player2, player1.edgePosition);
      
      if (!path1 && !path2) {
        return false;
      }
    }
  } else {
    // For individual games
    for (const player of players) {
      const targetEdge = getOppositeEdge(player.edgePosition);
      if (!hasViablePath(board, player, targetEdge)) {
        return false;
      }
    }
  }
  
  return true;
}

// Check if placing a tile at a position with a rotation is legal
export function isLegalMove(
  board: Map<string, PlacedTile>,
  tile: PlacedTile,
  players: Player[],
  teams: Team[]
): boolean {
  // A move is illegal if:
  // 1. The position is already occupied
  const posKey = positionToKey(tile.position);
  if (board.has(posKey)) {
    return false;
  }
  
  // 2. It would cause a victory - this is actually LEGAL and must be played
  // So we check this first
  if (wouldCauseVictory(board, tile, players, teams)) {
    return true; // Victory moves are always legal
  }
  
  // 3. It would block all paths for any player/team
  // Create temporary board with the new tile
  const testBoard = new Map(board);
  testBoard.set(posKey, tile);
  
  // Check if all players still have viable paths
  return allPlayersHaveViablePath(testBoard, players, teams);
}

// Get list of players/teams that would be blocked by placing a tile
// Returns an array of player IDs that would be blocked
export function getBlockedPlayers(
  board: Map<string, PlacedTile>,
  tile: PlacedTile,
  players: Player[],
  teams: Team[]
): string[] {
  const blockedPlayerIds: string[] = [];
  
  // If position is occupied, no one is blocked (move is invalid for other reasons)
  const posKey = positionToKey(tile.position);
  if (board.has(posKey)) {
    return blockedPlayerIds;
  }
  
  // If this causes a victory, no one is blocked (move is forced)
  if (wouldCauseVictory(board, tile, players, teams)) {
    return blockedPlayerIds;
  }
  
  // Create temporary board with the new tile
  const testBoard = new Map(board);
  testBoard.set(posKey, tile);
  
  // Check which players/teams would be blocked
  if (teams.length > 0) {
    // Team games - check each team
    for (const team of teams) {
      const player1 = players.find((p) => p.id === team.player1Id);
      const player2 = players.find((p) => p.id === team.player2Id);
      
      if (!player1 || !player2) continue;
      
      // Check if team has a viable path (either player can complete it)
      const path1 = hasViablePath(testBoard, player1, player2.edgePosition);
      const path2 = hasViablePath(testBoard, player2, player1.edgePosition);
      
      if (!path1 && !path2) {
        // Team is blocked - add both players
        blockedPlayerIds.push(player1.id);
        blockedPlayerIds.push(player2.id);
      }
    }
  } else {
    // Individual games - check each player
    for (const player of players) {
      const targetEdge = getOppositeEdge(player.edgePosition);
      if (!hasViablePath(testBoard, player, targetEdge)) {
        blockedPlayerIds.push(player.id);
      }
    }
  }
  
  return blockedPlayerIds;
}

// Find all legal positions for a given tile type and rotation
export function findLegalMoves(
  board: Map<string, PlacedTile>,
  tileType: TileType,
  rotation: Rotation,
  players: Player[],
  teams: Team[]
): HexPosition[] {
  const legalPositions: HexPosition[] = [];
  
  // Check all empty board positions
  const allPositions = getAllBoardPositions();
  
  for (const position of allPositions) {
    const tile: PlacedTile = {
      type: tileType,
      rotation,
      position,
    };
    
    if (isLegalMove(board, tile, players, teams)) {
      legalPositions.push(position);
    }
  }
  
  return legalPositions;
}

// Check if a tile can be placed legally anywhere on the board
// (used for constraint victory detection)
export function canTileBePlacedAnywhere(
  board: Map<string, PlacedTile>,
  tileType: TileType,
  players: Player[],
  teams: Team[]
): boolean {
  // Try all rotations
  for (let rotation = 0; rotation < 6; rotation++) {
    const legalMoves = findLegalMoves(board, tileType, rotation as Rotation, players, teams);
    if (legalMoves.length > 0) {
      return true;
    }
  }
  
  return false;
}

// Debug function to get path information for all players
// This is used by the debug UI visualization
export interface PlayerPathDebugInfo {
  playerId: string;
  playerColor: string;
  hasPath: boolean;
  visitedPositions: HexPosition[];
  pathToTarget: HexPosition[];
  startEdge: number;
  targetEdge: number;
}

export function getDebugPathInfo(
  board: Map<string, PlacedTile>,
  players: Player[],
  teams: Team[]
): PlayerPathDebugInfo[] {
  const debugInfo: PlayerPathDebugInfo[] = [];
  
  if (teams.length > 0) {
    // Team games - check paths for each player in teams
    for (const team of teams) {
      const player1 = players.find((p) => p.id === team.player1Id);
      const player2 = players.find((p) => p.id === team.player2Id);
      
      if (player1 && player2) {
        // Player 1 trying to reach player 2's edge
        const result1 = hasViablePath(board, player1, player2.edgePosition, true) as PathFindingResult;
        debugInfo.push({
          playerId: player1.id,
          playerColor: player1.color,
          hasPath: result1.hasPath,
          visitedPositions: Array.from(result1.visitedPositions || []),
          pathToTarget: result1.pathToTarget || [],
          startEdge: player1.edgePosition,
          targetEdge: player2.edgePosition,
        });
        
        // Player 2 trying to reach player 1's edge
        const result2 = hasViablePath(board, player2, player1.edgePosition, true) as PathFindingResult;
        debugInfo.push({
          playerId: player2.id,
          playerColor: player2.color,
          hasPath: result2.hasPath,
          visitedPositions: Array.from(result2.visitedPositions || []),
          pathToTarget: result2.pathToTarget || [],
          startEdge: player2.edgePosition,
          targetEdge: player1.edgePosition,
        });
      }
    }
  } else {
    // Individual games - each player to opposite edge
    for (const player of players) {
      const targetEdge = getOppositeEdge(player.edgePosition);
      const result = hasViablePath(board, player, targetEdge, true) as PathFindingResult;
      
      debugInfo.push({
        playerId: player.id,
        playerColor: player.color,
        hasPath: result.hasPath,
        visitedPositions: Array.from(result.visitedPositions || []),
        pathToTarget: result.pathToTarget || [],
        startEdge: player.edgePosition,
        targetEdge,
      });
    }
  }
  
  return debugInfo;
}
