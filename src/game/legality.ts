// Legal move validation for Quortex/Flows

import { PlacedTile, Player, Team, HexPosition, TileType, Rotation } from './types';
import {
  getAllBoardPositions,
  positionToKey,
  getEdgePositions,
  getOppositeEdge,
} from './board';
import { calculateFlows } from './flows';
import { checkFlowVictory } from './victory';

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
  const flows = calculateFlows(testBoard, players);
  
  // Check if this causes a victory
  const victory = checkFlowVictory(flows, players, teams);
  
  return victory.winner !== null;
}

// Check if a player/team still has a viable path to victory
// This is a simplified check - we verify that there's at least one empty position
// that could potentially complete a path
function hasViablePath(
  board: Map<string, PlacedTile>,
  player: Player,
  targetEdge: number
): boolean {
  const startEdge = player.edgePosition;
  const startPositions = getEdgePositions(startEdge);
  const targetPositions = getEdgePositions(targetEdge);
  
  // Get all empty positions
  const emptyPositions = getAllBoardPositions().filter(
    (pos) => !board.has(positionToKey(pos))
  );
  
  // If there are no empty positions, check current state
  if (emptyPositions.length === 0) {
    const flows = calculateFlows(board, [player]);
    const playerFlow = flows.get(player.id);
    if (!playerFlow) return false;
    
    const hasStart = startPositions.some((pos) => playerFlow.has(positionToKey(pos)));
    const hasTarget = targetPositions.some((pos) => playerFlow.has(positionToKey(pos)));
    
    return hasStart && hasTarget;
  }
  
  // Simplified check: if there are empty positions between edges, path is viable
  // A more sophisticated implementation would use pathfinding algorithms
  // For now, we assume viability unless the board is completely filled
  return true;
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
