// Victory condition checking for Quortex/Flows

import { PlacedTile, Player, Team, TileType, Direction } from './types';
import { getEdgePositions, getOppositeEdge, positionToKey, getNeighborInDirection, isValidPosition } from './board';
import { canTileBePlacedAnywhere } from './legality';

export type WinType = 'flow' | 'constraint' | 'tie';

export interface VictoryResult {
  readonly winner: string | null; // Player ID or Team ID
  readonly winType: WinType | null;
}

// Check if a player's flow connects their edges (for 2-3 player games)
export function checkPlayerFlowVictory(
  flows: Map<string, Set<string>>,
  flowEdges: Map<string, Map<Direction, string>>,
  player: Player
): boolean {
  const playerEdge = player.edgePosition;
  const targetEdge = getOppositeEdge(playerEdge);
  
  const startPositions = getEdgePositions(playerEdge);
  
  // We need to check if the flow connects start to target
  const playerFlow = flows.get(player.id);
  if (!playerFlow) {
    return false;
  }
  
  // Check if any start position is in the flow
  const hasStart = startPositions.some((pos) => playerFlow.has(positionToKey(pos)));
  if (!hasStart) {
    return false;
  }
  
  // Check if flow exits off the board through any position on the target edge
  const targetPositions = getEdgePositions(targetEdge);
  
  for (const pos of targetPositions) {
    const posKey = positionToKey(pos);
    
    // First check if the player's flow includes this position
    if (!playerFlow.has(posKey)) {
      continue;
    }
    
    // Check if player has a flow edge in any direction that leads off the board
    const edgeMap = flowEdges.get(posKey);
    if (!edgeMap) {
      continue;
    }
    
    // Check all 6 directions to see if any lead off the board
    for (let dir = 0; dir < 6; dir++) {
      // Check if player has a flow edge in this direction
      if (!edgeMap.has(dir as Direction)) {
        continue;
      }
      
      // Check if this direction leads off the board
      const neighbor = getNeighborInDirection(pos, dir as Direction);
      if (!isValidPosition(neighbor)) {
        // Flow exits off the board in this direction - victory!
        return true;
      }
    }
  }
  
  return false;
}

// Check if a team's flows connect their two edges (for 4-6 player games)
export function checkTeamFlowVictory(
  flows: Map<string, Set<string>>,
  flowEdges: Map<string, Map<Direction, string>>,
  team: Team,
  players: Player[]
): boolean {
  const player1 = players.find((p) => p.id === team.player1Id);
  const player2 = players.find((p) => p.id === team.player2Id);
  
  if (!player1 || !player2) {
    return false;
  }
  
  // Get edge positions for both players
  const edge1Positions = getEdgePositions(player1.edgePosition);
  const edge2Positions = getEdgePositions(player2.edgePosition);
  
  // Check if player1's flow exits off the board through player2's edge
  const flow1 = flows.get(player1.id);
  if (flow1) {
    const hasEdge1 = edge1Positions.some((pos) => flow1.has(positionToKey(pos)));
    
    // Check if flow exits off the board from any position on player2's edge
    const exitsEdge2 = edge2Positions.some((pos) => {
      const posKey = positionToKey(pos);
      if (!flow1.has(posKey)) {
        return false;
      }
      
      const edgeMap = flowEdges.get(posKey);
      if (!edgeMap) {
        return false;
      }
      
      // Check all directions to see if any lead off the board
      for (let dir = 0; dir < 6; dir++) {
        if (edgeMap.has(dir as Direction)) {
          const neighbor = getNeighborInDirection(pos, dir as Direction);
          if (!isValidPosition(neighbor)) {
            return true;
          }
        }
      }
      return false;
    });
    
    if (hasEdge1 && exitsEdge2) {
      return true;
    }
  }
  
  // Check if player2's flow exits off the board through player1's edge
  const flow2 = flows.get(player2.id);
  if (flow2) {
    const hasEdge2 = edge2Positions.some((pos) => flow2.has(positionToKey(pos)));
    
    // Check if flow exits off the board from any position on player1's edge
    const exitsEdge1 = edge1Positions.some((pos) => {
      const posKey = positionToKey(pos);
      if (!flow2.has(posKey)) {
        return false;
      }
      
      const edgeMap = flowEdges.get(posKey);
      if (!edgeMap) {
        return false;
      }
      
      // Check all directions to see if any lead off the board
      for (let dir = 0; dir < 6; dir++) {
        if (edgeMap.has(dir as Direction)) {
          const neighbor = getNeighborInDirection(pos, dir as Direction);
          if (!isValidPosition(neighbor)) {
            return true;
          }
        }
      }
      return false;
    });
    
    if (hasEdge2 && exitsEdge1) {
      return true;
    }
  }
  
  return false;
}

// Check if any player/team has won by flow victory
export function checkFlowVictory(
  flows: Map<string, Set<string>>,
  flowEdges: Map<string, Map<Direction, string>>,
  players: Player[],
  teams: Team[]
): VictoryResult {
  const winners: string[] = [];
  
  // For team games (4-6 players)
  if (teams.length > 0) {
    for (const team of teams) {
      if (checkTeamFlowVictory(flows, flowEdges, team, players)) {
        winners.push(`team-${team.player1Id}-${team.player2Id}`);
      }
    }
  } else {
    // For individual games (2-3 players)
    for (const player of players) {
      if (checkPlayerFlowVictory(flows, flowEdges, player)) {
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
  flowEdges: Map<string, Map<Direction, string>>,
  players: Player[],
  teams: Team[],
  currentTile?: TileType
): VictoryResult {
  // First check for flow victory
  const flowVictory = checkFlowVictory(flows, flowEdges, players, teams);
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
