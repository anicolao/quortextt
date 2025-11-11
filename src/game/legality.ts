// Legal move validation for Quortex/Flows

import { PlacedTile, Player, Team, HexPosition, TileType, Rotation, Direction } from './types';
import {
  getAllBoardPositions,
  positionToKey,
  getOppositeEdge,
  getNeighborInDirection,
  getOppositeDirection,
  isValidPosition,
  getEdgePositionsWithDirections,
} from './board';
import { checkFlowVictory } from './victory';
import { getFlowConnections } from './tiles';

// Check if placing a tile would result in a victory
function wouldCauseVictory(
  board: Map<string, PlacedTile>,
  tile: PlacedTile,
  players: Player[],
  teams: Team[],
  boardRadius: number
): boolean {
  // Create a new board with the proposed tile
  const testBoard = new Map(board);
  testBoard.set(positionToKey(tile.position), tile);
  
  // Check if this causes a victory
  const victory = checkFlowVictory(testBoard, players, teams, boardRadius);
  
  return victory.winners.length > 0;
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
function getOppositeEdgeNode(node: EdgeNode, boardRadius: number): EdgeNode | null {
  const { position, direction } = node;
  const neighborPos = getNeighborInDirection(position, direction);
  
  if (!isValidPosition(neighborPos, boardRadius)) {
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
  visitedEdges?: EdgeNode[];
  pathEdges?: EdgeNode[];
}

// Check if a player/team still has a viable path to victory
// Uses edge-based graph BFS: creates nodes for each tile edge and checks flow connectivity
// allowEmptyHexes: if true, empty hexes are wildcards (for blocking detection); if false, empty hexes are dead ends (for victory detection)
export function hasViablePath(
  board: Map<string, PlacedTile>,
  player: Player,
  targetEdge: number,
  returnDebugInfo: boolean,
  allowEmptyHexes: boolean,
  boardRadius: number
): boolean | PathFindingResult {
  const startEdge = player.edgePosition;
  
  // Build edge connectivity graph
  // For each tile position, we create nodes for each of its 6 edges
  // If the tile is occupied, we connect only the edges that the tile connects
  // If the tile is empty, we connect ALL edges (any tile could be placed)
  
  const allPositions = getAllBoardPositions(boardRadius);
  
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
        const oppositeEdge = getOppositeEdgeNode(edge, boardRadius);
        
        if (oppositeEdge) {
          addEdge(edge, oppositeEdge);
          addEdge(oppositeEdge, edge);
        }
      }
    } else if (allowEmptyHexes) {
      // Empty tile: all edges can connect to each other (any tile could be placed)
      // This is only used for blocking detection (allowEmptyHexes=true)
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
        const oppositeEdge = getOppositeEdgeNode(edge, boardRadius);
        
        if (oppositeEdge) {
          addEdge(edge, oppositeEdge);
          addEdge(oppositeEdge, edge);
        }
      }
    }
    // else: Empty tile with allowEmptyHexes=false: don't connect any edges (dead end for victory detection)
  }
  
  // Now perform 0-1 BFS from all start edge nodes to see if we can reach any target edge node
  // This prioritizes paths through occupied tiles (cost 0) over empty tiles (cost 1)
  const visited = new Set<string>();
  const parent = new Map<string, string>(); // For path reconstruction
  const deque: string[] = []; // Deque for 0-1 BFS
  
  // Add only the specific inward-facing edges from the start edge as starting points
  // These are the hex edges that face inward from the board edge
  const startEdgeNodes = getEdgePositionsWithDirections(startEdge, boardRadius);
  
  for (const { pos, dir } of startEdgeNodes) {
    const edgeNode: EdgeNode = { position: pos, direction: dir };
    const key = edgeNodeKey(edgeNode);
    
    if (!visited.has(key)) {
      deque.push(key);
      visited.add(key);
      parent.set(key, ''); // Mark as starting node
    }
  }
  
  let foundTargetKey: string | null = null;
  
  // Get the specific outward-facing edges on the target edge
  const targetEdgeNodes = getEdgePositionsWithDirections(targetEdge, boardRadius);
  const targetEdgeKeys = new Set(
    targetEdgeNodes.map(({ pos, dir }) => edgeNodeKey({ position: pos, direction: dir }))
  );
  
  // 0-1 BFS: process nodes with cost 0 first (occupied tiles), then cost 1 (empty tiles)
  while (deque.length > 0) {
    const currentKey = deque.shift()!;
    
    // Check if we've reached any target edge node
    if (targetEdgeKeys.has(currentKey)) {
      foundTargetKey = currentKey;
      break;
    }
    
    // Explore neighbors
    const neighbors = adjacencyMap.get(currentKey);
    if (neighbors) {
      // Sort neighbors for deterministic BFS traversal
      const sortedNeighbors = Array.from(neighbors).sort();
      for (const neighborKey of sortedNeighbors) {
        if (!visited.has(neighborKey)) {
          visited.add(neighborKey);
          parent.set(neighborKey, currentKey);
          
          // Parse neighbor position to check if tile is occupied
          const [rowStr, colStr] = neighborKey.split(',');
          const neighborPos: HexPosition = { row: parseInt(rowStr), col: parseInt(colStr) };
          const neighborPosKey = positionToKey(neighborPos);
          const isOccupied = board.has(neighborPosKey);
          
          // 0-1 BFS: add to front if occupied (cost 0), back if empty (cost 1)
          if (isOccupied) {
            deque.unshift(neighborKey); // Add to front - prioritize occupied tiles
          } else {
            deque.push(neighborKey); // Add to back - deprioritize empty tiles
          }
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
  const visitedEdges: EdgeNode[] = [];
  
  for (const key of visited) {
    const [rowStr, colStr, dirStr] = key.split(',');
    const pos: HexPosition = { row: parseInt(rowStr), col: parseInt(colStr) };
    visitedPositions.add(pos);
    visitedEdges.push({
      position: pos,
      direction: parseInt(dirStr) as Direction,
    });
  }
  
  const pathToTarget: HexPosition[] = [];
  const pathEdges: EdgeNode[] = [];
  
  if (hasPath && foundTargetKey) {
    // Reconstruct path from target back to start
    let current: string | undefined = foundTargetKey;
    const pathKeys: string[] = [];
    
    while (current && parent.get(current) !== '') {
      pathKeys.push(current);
      current = parent.get(current);
    }
    
    // Add the starting node (which has parent === '')
    if (current) {
      pathKeys.push(current);
    }
    
    // Convert to positions and edges (reverse to get start-to-end order)
    pathKeys.reverse();
    for (const key of pathKeys) {
      const [rowStr, colStr, dirStr] = key.split(',');
      const pos: HexPosition = { row: parseInt(rowStr), col: parseInt(colStr) };
      const dir = parseInt(dirStr) as Direction;
      
      // Add edge node
      pathEdges.push({ position: pos, direction: dir });
      
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
    visitedEdges,
    pathEdges,
  };
}

// Check if all players/teams have a viable path after placing a tile
function allPlayersHaveViablePath(
  board: Map<string, PlacedTile>,
  players: Player[],
  teams: Team[],
  boardRadius: number
): boolean {
  // For team games
  if (teams.length > 0) {
    for (const team of teams) {
      const player1 = players.find((p) => p.id === team.player1Id);
      const player2 = players.find((p) => p.id === team.player2Id);
      
      if (!player1 || !player2) continue;
      
      // Check if team has a viable path (either player can complete it)
      const path1 = hasViablePath(board, player1, player2.edgePosition, false, true, boardRadius);
      const path2 = hasViablePath(board, player2, player1.edgePosition, false, true, boardRadius);
      
      if (!path1 && !path2) {
        return false;
      }
    }
  } else {
    // For individual games
    for (const player of players) {
      const targetEdge = getOppositeEdge(player.edgePosition);
      if (!hasViablePath(board, player, targetEdge, false, true, boardRadius)) {
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
  teams: Team[],
  boardRadius: number,
  supermoveEnabled: boolean
): boolean {
  // A move is illegal if:
  // 1. The position is already occupied
  const posKey = positionToKey(tile.position);
  if (board.has(posKey)) {
    return false;
  }
  
  // 2. It would cause a victory - this is actually LEGAL and must be played
  // So we check this first
  if (wouldCauseVictory(board, tile, players, teams, boardRadius)) {
    return true; // Victory moves are always legal
  }
  
  // 3. With supermove enabled, all non-blocking moves are legal
  // (blocking is allowed, player can use supermove to unblock)
  if (supermoveEnabled) {
    return true;
  }
  
  // 4. It would block all paths for any player/team (standard rules)
  // Create temporary board with the new tile
  const testBoard = new Map(board);
  testBoard.set(posKey, tile);
  
  // Check if all players still have viable paths
  return allPlayersHaveViablePath(testBoard, players, teams, boardRadius);
}

// Get list of players/teams that would be blocked by placing a tile
// Returns an array of player IDs that would be blocked
export function getBlockedPlayers(
  board: Map<string, PlacedTile>,
  tile: PlacedTile,
  players: Player[],
  teams: Team[],
  boardRadius: number
): string[] {
  const blockedPlayerIds: string[] = [];
  
  // If position is occupied, no one is blocked (move is invalid for other reasons)
  const posKey = positionToKey(tile.position);
  if (board.has(posKey)) {
    return blockedPlayerIds;
  }
  
  // If this causes a victory, no one is blocked (move is forced)
  if (wouldCauseVictory(board, tile, players, teams, boardRadius)) {
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
      const path1 = hasViablePath(testBoard, player1, player2.edgePosition, false, true, boardRadius);
      const path2 = hasViablePath(testBoard, player2, player1.edgePosition, false, true, boardRadius);
      
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
      if (!hasViablePath(testBoard, player, targetEdge, false, true, boardRadius)) {
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
  teams: Team[],
  boardRadius: number,
  supermoveEnabled: boolean
): HexPosition[] {
  const legalPositions: HexPosition[] = [];
  
  // Check all empty board positions
  const allPositions = getAllBoardPositions(boardRadius);
  
  for (const position of allPositions) {
    const tile: PlacedTile = {
      type: tileType,
      rotation,
      position,
    };
    
    if (isLegalMove(board, tile, players, teams, boardRadius, supermoveEnabled)) {
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
  teams: Team[],
  boardRadius: number,
  supermoveEnabled: boolean
): boolean {
  // Try all rotations
  for (let rotation = 0; rotation < 6; rotation++) {
    const legalMoves = findLegalMoves(board, tileType, rotation as Rotation, players, teams, boardRadius, supermoveEnabled);
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
  visitedEdges: EdgeNode[];
  pathEdges: EdgeNode[];
  startEdge: number;
  targetEdge: number;
}

// Export EdgeNode for use in rendering
export interface EdgeNodeInfo {
  position: HexPosition;
  direction: Direction;
}

export function getDebugPathInfo(
  board: Map<string, PlacedTile>,
  players: Player[],
  teams: Team[],
  boardRadius: number
): PlayerPathDebugInfo[] {
  const debugInfo: PlayerPathDebugInfo[] = [];
  
  if (teams.length > 0) {
    // Team games - check paths for each player in teams
    for (const team of teams) {
      const player1 = players.find((p) => p.id === team.player1Id);
      const player2 = players.find((p) => p.id === team.player2Id);
      
      if (player1 && player2) {
        // Player 1 trying to reach player 2's edge
        const result1 = hasViablePath(board, player1, player2.edgePosition, true, true, boardRadius) as PathFindingResult;
        debugInfo.push({
          playerId: player1.id,
          playerColor: player1.color,
          hasPath: result1.hasPath,
          visitedPositions: Array.from(result1.visitedPositions || []),
          pathToTarget: result1.pathToTarget || [],
          visitedEdges: result1.visitedEdges || [],
          pathEdges: result1.pathEdges || [],
          startEdge: player1.edgePosition,
          targetEdge: player2.edgePosition,
        });
        
        // Player 2 trying to reach player 1's edge
        const result2 = hasViablePath(board, player2, player1.edgePosition, true, true, boardRadius) as PathFindingResult;
        debugInfo.push({
          playerId: player2.id,
          playerColor: player2.color,
          hasPath: result2.hasPath,
          visitedPositions: Array.from(result2.visitedPositions || []),
          pathToTarget: result2.pathToTarget || [],
          visitedEdges: result2.visitedEdges || [],
          pathEdges: result2.pathEdges || [],
          startEdge: player2.edgePosition,
          targetEdge: player1.edgePosition,
        });
      }
    }
  } else {
    // Individual games - each player to opposite edge
    for (const player of players) {
      const targetEdge = getOppositeEdge(player.edgePosition);
      const result = hasViablePath(board, player, targetEdge, true, true, boardRadius) as PathFindingResult;
      
      debugInfo.push({
        playerId: player.id,
        playerColor: player.color,
        hasPath: result.hasPath,
        visitedPositions: Array.from(result.visitedPositions || []),
        pathToTarget: result.pathToTarget || [],
        visitedEdges: result.visitedEdges || [],
        pathEdges: result.pathEdges || [],
        startEdge: player.edgePosition,
        targetEdge,
      });
    }
  }
  
  return debugInfo;
}

// Check if a specific player is currently blocked (has no viable path)
export function isPlayerBlocked(
  board: Map<string, PlacedTile>,
  player: Player,
  players: Player[],
  teams: Team[],
  boardRadius: number
): boolean {
  // For team games, check if the player's team is blocked
  if (teams.length > 0) {
    // Find the team this player is on
    const team = teams.find(t => t.player1Id === player.id || t.player2Id === player.id);
    if (!team) return false;
    
    const player1 = players.find(p => p.id === team.player1Id);
    const player2 = players.find(p => p.id === team.player2Id);
    
    if (!player1 || !player2) return false;
    
    // Team is blocked if neither player can reach the other
    const path1 = hasViablePath(board, player1, player2.edgePosition, false, true, boardRadius);
    const path2 = hasViablePath(board, player2, player1.edgePosition, false, true, boardRadius);
    
    return !path1 && !path2;
  } else {
    // Individual game - check if player can reach opposite edge
    const targetEdge = getOppositeEdge(player.edgePosition);
    return !hasViablePath(board, player, targetEdge, false, true, boardRadius);
  }
}

// Check if replacing a tile at a position would unblock a specific player
export function wouldReplacementUnblock(
  board: Map<string, PlacedTile>,
  replacementPosition: HexPosition,
  newTile: PlacedTile,
  player: Player,
  players: Player[],
  teams: Team[],
  boardRadius: number
): boolean {
  // First, check if player is currently blocked
  if (!isPlayerBlocked(board, player, players, teams, boardRadius)) {
    return false; // Player is not blocked, replacement not needed
  }
  
  // Create a board with the replacement
  const testBoard = new Map(board);
  const posKey = positionToKey(replacementPosition);
  
  // Remove the old tile and place the new one
  testBoard.set(posKey, newTile);
  
  // Check if the player is no longer blocked after replacement
  return !isPlayerBlocked(testBoard, player, players, teams, boardRadius);
}

// Check if a replacement move is valid for supermove
// A replacement is valid if:
// 1. The player is currently blocked
// 2. The replacement would unblock them
// 3. The new tile being placed at the replacement position is valid
export function isValidReplacementMove(
  board: Map<string, PlacedTile>,
  replacementPosition: HexPosition,
  newTileType: TileType,
  newRotation: Rotation,
  currentPlayer: Player,
  players: Player[],
  teams: Team[],
  boardRadius: number
): boolean {
  const posKey = positionToKey(replacementPosition);
  
  // Position must be occupied
  if (!board.has(posKey)) {
    return false;
  }
  
  // Player must be blocked
  if (!isPlayerBlocked(board, currentPlayer, players, teams, boardRadius)) {
    return false;
  }
  
  // Create the new tile
  const newTile: PlacedTile = {
    type: newTileType,
    rotation: newRotation,
    position: replacementPosition,
  };
  
  // Check if this replacement would unblock the player
  return wouldReplacementUnblock(board, replacementPosition, newTile, currentPlayer, players, teams, boardRadius);
}
