// Victory condition checking for Quortex/Flows

import { PlacedTile, Player, Team, TileType } from './types';
import { getEdgePositions, getOppositeEdge, positionToKey } from './board';
import { canTileBePlacedAnywhere } from './legality';

export type WinType = 'flow' | 'constraint' | 'tie';

export interface VictoryResult {
  readonly winner: string | null; // Player ID or Team ID
  readonly winType: WinType | null;
}

// Check if a player's flow connects their edges (for 2-3 player games)
export function checkPlayerFlowVictory(
  flows: Map<string, Set<string>>,
  player: Player
): boolean {
  const playerEdge = player.edgePosition;
  const targetEdge = getOppositeEdge(playerEdge);
  
  const startPositions = getEdgePositions(playerEdge);
  const targetPositions = getEdgePositions(targetEdge);
  
  // We need to check if the flow connects start to target
  // This is a simplified version - we'll use the flows map directly
  const playerFlow = flows.get(player.id);
  if (!playerFlow) {
    return false;
  }
  
  // Check if any start position is in the flow
  const hasStart = startPositions.some((pos) => playerFlow.has(positionToKey(pos)));
  if (!hasStart) {
    return false;
  }
  
  // Check if any target position is in the flow
  const hasTarget = targetPositions.some((pos) => playerFlow.has(positionToKey(pos)));
  
  return hasTarget;
}

// Check if a team's flows connect their two edges (for 4-6 player games)
export function checkTeamFlowVictory(
  flows: Map<string, Set<string>>,
  team: Team,
  players: Player[]
): boolean {
  const player1 = players.find((p) => p.id === team.player1Id);
  const player2 = players.find((p) => p.id === team.player2Id);
  
  if (!player1 || !player2) {
    return false;
  }
  
  const edge1Positions = getEdgePositions(player1.edgePosition);
  const edge2Positions = getEdgePositions(player2.edgePosition);
  
  // Check if player1's flow connects both edges
  const flow1 = flows.get(player1.id);
  if (flow1) {
    const hasEdge1 = edge1Positions.some((pos) => flow1.has(positionToKey(pos)));
    const hasEdge2 = edge2Positions.some((pos) => flow1.has(positionToKey(pos)));
    if (hasEdge1 && hasEdge2) {
      return true;
    }
  }
  
  // Check if player2's flow connects both edges
  const flow2 = flows.get(player2.id);
  if (flow2) {
    const hasEdge1 = edge1Positions.some((pos) => flow2.has(positionToKey(pos)));
    const hasEdge2 = edge2Positions.some((pos) => flow2.has(positionToKey(pos)));
    if (hasEdge1 && hasEdge2) {
      return true;
    }
  }
  
  return false;
}

// Check if any player/team has won by flow victory
export function checkFlowVictory(
  flows: Map<string, Set<string>>,
  players: Player[],
  teams: Team[]
): VictoryResult {
  const winners: string[] = [];
  
  // For team games (4-6 players)
  if (teams.length > 0) {
    for (const team of teams) {
      if (checkTeamFlowVictory(flows, team, players)) {
        winners.push(`team-${team.player1Id}-${team.player2Id}`);
      }
    }
  } else {
    // For individual games (2-3 players)
    for (const player of players) {
      if (checkPlayerFlowVictory(flows, player)) {
        winners.push(player.id);
      }
    }
  }
  
  if (winners.length === 0) {
    return { winner: null, winType: null };
  }
  
  if (winners.length === 1) {
    return { winner: winners[0], winType: 'flow' };
  }
  
  // Multiple winners = tie
  return { winner: winners.join(','), winType: 'tie' };
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
  flows: Map<string, Set<string>>,
  players: Player[],
  teams: Team[],
  currentTile?: TileType
): VictoryResult {
  // First check for flow victory
  const flowVictory = checkFlowVictory(flows, players, teams);
  if (flowVictory.winner) {
    return flowVictory;
  }
  
  // Check for constraint victory if a current tile is provided
  if (currentTile !== undefined) {
    const constraintWin = checkConstraintVictory(board, currentTile, players, teams);
    if (constraintWin) {
      // In constraint victory, the current player wins
      // We'll need to pass current player info for this to work properly
      // For now, return a placeholder
      return { winner: 'constraint', winType: 'constraint' };
    }
  }
  
  return { winner: null, winType: null };
}
