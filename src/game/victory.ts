// Victory condition checking for Quortex/Flows

import { PlacedTile, Player, Team, TileType, Direction } from './types';
import {
  getOppositeEdge,
  positionToKey,
  getNeighborInDirection,
  isValidPosition,
} from './board';
import { canTileBePlacedAnywhere, hasViablePath } from './legality';

export type WinType = 'flow' | 'constraint' | 'tie';

export interface VictoryResult {
  readonly winners: string[]; // Array of player IDs who won
  readonly winType: WinType | null;
}

// Check if a player's flow connects their edges (for 2-3 player games)
// Uses hasViablePath with allowEmptyHexes=false to check if there's a path using only placed tiles
export function checkPlayerFlowVictory(
  board: Map<string, PlacedTile>,
  player: Player
): boolean {
  const targetEdge = getOppositeEdge(player.edgePosition);
  // Use hasViablePath with allowEmptyHexes=false to check victory with only placed tiles
  return hasViablePath(board, player, targetEdge, false, false) as boolean;
}

// Check if a team's flows connect their two edges (for 4-6 player games)
// Uses hasViablePath with allowEmptyHexes=false to check if there's a path using only placed tiles
export function checkTeamFlowVictory(
  board: Map<string, PlacedTile>,
  team: Team,
  players: Player[]
): boolean {
  const player1 = players.find((p) => p.id === team.player1Id);
  const player2 = players.find((p) => p.id === team.player2Id);
  
  if (!player1 || !player2) {
    return false;
  }
  
  // Check if player1's flow connects from edge1 to edge2
  // Use hasViablePath with allowEmptyHexes=false to check victory with only placed tiles
  const path1 = hasViablePath(board, player1, player2.edgePosition, false, false) as boolean;
  if (path1) {
    return true;
  }
  
  // Check if player2's flow connects from edge2 to edge1
  const path2 = hasViablePath(board, player2, player1.edgePosition, false, false) as boolean;
  return path2;
}

// Check if any player/team has won by flow victory
export function checkFlowVictory(
  board: Map<string, PlacedTile>,
  players: Player[],
  teams: Team[]
): VictoryResult {
  const winners: string[] = [];
  
  // For team games (4-6 players)
  if (teams.length > 0) {
    for (const team of teams) {
      if (checkTeamFlowVictory(board, team, players)) {
        // Credit both players individually instead of the team
        winners.push(team.player1Id);
        winners.push(team.player2Id);
      }
    }
  } else {
    // For individual games (2-3 players)
    for (const player of players) {
      if (checkPlayerFlowVictory(board, player)) {
        winners.push(player.id);
      }
    }
  }
  
  if (winners.length === 0) {
    return { winners: [], winType: null };
  }
  
  // Return all winning players
  return { winners, winType: winners.length > players.length / 2 ? 'tie' : 'flow' };
}

// Check if current tile cannot be placed legally anywhere
export function checkConstraintVictory(
  board: Map<string, PlacedTile>,
  currentTile: TileType,
  players: Player[],
  teams: Team[]
): boolean {
  return !canTileBePlacedAnywhere(board, currentTile, players, teams);
}

// Check if any player/team has won
export function checkVictory(
  board: Map<string, PlacedTile>,
  players: Player[],
  teams: Team[],
  currentTile?: TileType
): VictoryResult {
  // First check for flow victory
  const flowVictory = checkFlowVictory(board, players, teams);
  if (flowVictory.winners.length > 0) {
    return flowVictory;
  }
  
  // Check for constraint victory if a current tile is provided
  if (currentTile !== undefined) {
    const constraintWin = checkConstraintVictory(board, currentTile, players, teams);
    if (constraintWin) {
      // In constraint victory, the current player wins
      // We'll need to pass current player info for this to work properly
      // For now, return a placeholder
      return { winners: ['constraint'], winType: 'constraint' };
    }
  }
  
  return { winners: [], winType: null };
}

// Check if a specific flow connection is part of the winning path
// A connection is part of the winning path if both directions lead to/from valid neighbors in the flow
export function isConnectionInWinningPath(
  position: { row: number; col: number },
  dir1: Direction,
  dir2: Direction,
  playerId: string,
  flows: Map<string, Set<string>>,
  flowEdges: Map<string, Map<Direction, string>>
): boolean {
  const posKey = positionToKey(position);
  const edgeMap = flowEdges.get(posKey);
  
  if (!edgeMap) return false;
  
  // Check if both directions belong to this player
  if (edgeMap.get(dir1) !== playerId || edgeMap.get(dir2) !== playerId) {
    return false;
  }
  
  const playerFlow = flows.get(playerId);
  if (!playerFlow) return false;
  
  // Check if at least one of the directions connects to another tile in the flow
  // or exits off the board (for edge tiles)
  const neighbor1 = getNeighborInDirection(position, dir1);
  const neighbor2 = getNeighborInDirection(position, dir2);
  
  const neighbor1Valid = isValidPosition(neighbor1);
  const neighbor2Valid = isValidPosition(neighbor2);
  
  // If neighbor1 is off-board but dir1 has the player's flow, it's part of the path
  const dir1ConnectsToFlow = !neighbor1Valid || 
    (neighbor1Valid && playerFlow.has(positionToKey(neighbor1)));
  
  // If neighbor2 is off-board but dir2 has the player's flow, it's part of the path  
  const dir2ConnectsToFlow = !neighbor2Valid || 
    (neighbor2Valid && playerFlow.has(positionToKey(neighbor2)));
  
  // The connection is in the winning path if both directions connect to the flow
  return dir1ConnectsToFlow && dir2ConnectsToFlow;
}
