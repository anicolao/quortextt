// AI logic for Quortex/Flows - 1-ply evaluation

import { 
  PlacedTile, 
  Player, 
  Team, 
  HexPosition, 
  TileType, 
  Rotation
} from './types';
import { 
  findLegalMoves, 
  hasViablePath,
  isValidReplacementMove
} from './legality';
import { 
  getAllBoardPositions,
  positionToKey,
  getOppositeEdge
} from './board';
import { checkVictory } from './victory';

// Evaluation constants
const WIN_SCORE = 100000;
const OWN_PATH_WEIGHT = -2;
const ENEMY_PATH_WEIGHT = 1;

// Move candidate with evaluation score
export interface MoveCandidate {
  position: HexPosition;
  rotation: Rotation;
  score: number;
  isReplacement: boolean;
  isWinningMove: boolean;
}

// Get shortest path length for a player to their target edge
// Uses BFS on the edge graph similar to hasViablePath but returns path length
function getShortestPathLength(
  board: Map<string, PlacedTile>,
  player: Player,
  targetEdge: number,
  boardRadius = 3
): number {
  const result = hasViablePath(board, player, targetEdge, true, false, boardRadius);
  
  if (typeof result === 'boolean') {
    // No path exists
    return result ? 0 : Infinity;
  }
  
  if (!result.hasPath || !result.pathToTarget) {
    return Infinity;
  }
  
  // Return the number of tiles in the path
  return result.pathToTarget.length;
}

// Evaluate a board position for the AI player
// Returns a score where higher is better for the AI
function evaluatePosition(
  board: Map<string, PlacedTile>,
  aiPlayer: Player,
  players: Player[],
  teams: Team[],
  boardRadius = 3
): number {
  // Check if this is a winning position for the AI
  const victoryResult = checkVictory(board, players, teams, undefined, boardRadius);
  
  if (victoryResult.winners.includes(aiPlayer.id)) {
    return WIN_SCORE;
  }
  
  // Calculate shortest path for AI
  const aiTargetEdge = getOppositeEdge(aiPlayer.edgePosition);
  const aiPathLength = getShortestPathLength(board, aiPlayer, aiTargetEdge, boardRadius);
  
  // Calculate shortest path for enemies (take the minimum among all enemies)
  let enemyMinPathLength = Infinity;
  
  for (const player of players) {
    if (player.id === aiPlayer.id) continue;
    
    const targetEdge = getOppositeEdge(player.edgePosition);
    const pathLength = getShortestPathLength(board, player, targetEdge, boardRadius);
    
    if (pathLength < enemyMinPathLength) {
      enemyMinPathLength = pathLength;
    }
  }
  
  // Evaluation: -A * (AI path length)^2 + B * (enemy min path length)^2
  // We want to minimize our path and maximize enemy's path
  const aiScore = OWN_PATH_WEIGHT * (aiPathLength * aiPathLength);
  const enemyScore = ENEMY_PATH_WEIGHT * (enemyMinPathLength * enemyMinPathLength);
  
  return aiScore + enemyScore;
}

// Generate all move candidates for the AI
export function generateMoveCandidates(
  board: Map<string, PlacedTile>,
  tileType: TileType,
  aiPlayer: Player,
  players: Player[],
  teams: Team[],
  supermoveEnabled: boolean,
  boardRadius = 3
): MoveCandidate[] {
  const candidates: MoveCandidate[] = [];
  
  // Try all rotations
  for (let rotation = 0; rotation < 6; rotation++) {
    const rot = rotation as Rotation;
    
    // 1. Regular placements - all legal moves
    const legalPositions = findLegalMoves(board, tileType, rot, players, teams, boardRadius);
    
    for (const position of legalPositions) {
      // Create test board with this move
      const testBoard = new Map(board);
      const tile: PlacedTile = {
        type: tileType,
        rotation: rot,
        position
      };
      testBoard.set(positionToKey(position), tile);
      
      // Evaluate this position
      const score = evaluatePosition(testBoard, aiPlayer, players, teams, boardRadius);
      const isWinning = score >= WIN_SCORE;
      
      candidates.push({
        position,
        rotation: rot,
        score,
        isReplacement: false,
        isWinningMove: isWinning
      });
    }
    
    // 2. Supermove placements (tile replacements) if enabled
    if (supermoveEnabled) {
      const allPositions = getAllBoardPositions(boardRadius);
      
      for (const position of allPositions) {
        const posKey = positionToKey(position);
        const existingTile = board.get(posKey);
        
        // Can only replace existing tiles
        if (!existingTile) continue;
        
        // Check if this is a valid replacement (doesn't block anyone)
        if (!isValidReplacementMove(board, position, tileType, rot, aiPlayer, players, teams, boardRadius)) {
          continue;
        }
        
        // Create test board with replacement
        const testBoard = new Map(board);
        const newTile: PlacedTile = {
          type: tileType,
          rotation: rot,
          position
        };
        testBoard.set(posKey, newTile);
        
        // Check if the replacement itself causes victory
        let replacementScore = evaluatePosition(testBoard, aiPlayer, players, teams, boardRadius);
        const replacementWins = replacementScore >= WIN_SCORE;
        
        // If replacement wins, that's the score
        if (replacementWins) {
          candidates.push({
            position,
            rotation: rot,
            score: replacementScore,
            isReplacement: true,
            isWinningMove: true
          });
          continue;
        }
        
        // Otherwise, consider the follow-up placement with the replaced tile
        // The replaced tile goes into hand and must be placed
        const replacedTileType = existingTile.type;
        
        // Find best follow-up move with the replaced tile
        let bestFollowupScore = -Infinity;
        
        for (let followupRotation = 0; followupRotation < 6; followupRotation++) {
          const followupRot = followupRotation as Rotation;
          const followupPositions = findLegalMoves(
            testBoard, 
            replacedTileType, 
            followupRot, 
            players, 
            teams, 
            boardRadius
          );
          
          for (const followupPosition of followupPositions) {
            // Create test board with follow-up move
            const followupBoard = new Map(testBoard);
            const followupTile: PlacedTile = {
              type: replacedTileType,
              rotation: followupRot,
              position: followupPosition
            };
            followupBoard.set(positionToKey(followupPosition), followupTile);
            
            // Evaluate the final position after both moves
            const followupScore = evaluatePosition(
              followupBoard, 
              aiPlayer, 
              players, 
              teams, 
              boardRadius
            );
            
            if (followupScore > bestFollowupScore) {
              bestFollowupScore = followupScore;
            }
          }
        }
        
        // Use the best follow-up score as the score for this replacement
        candidates.push({
          position,
          rotation: rot,
          score: bestFollowupScore,
          isReplacement: true,
          isWinningMove: bestFollowupScore >= WIN_SCORE
        });
      }
    }
  }
  
  return candidates;
}

// Select the best move for the AI
export function selectAIMove(
  board: Map<string, PlacedTile>,
  tileType: TileType,
  aiPlayer: Player,
  players: Player[],
  teams: Team[],
  supermoveEnabled: boolean,
  boardRadius = 3
): MoveCandidate | null {
  const candidates = generateMoveCandidates(
    board,
    tileType,
    aiPlayer,
    players,
    teams,
    supermoveEnabled,
    boardRadius
  );
  
  if (candidates.length === 0) {
    return null;
  }
  
  // If there's a winning move, take it immediately
  const winningMoves = candidates.filter(c => c.isWinningMove);
  if (winningMoves.length > 0) {
    // Return the first winning move (could randomize if desired)
    return winningMoves[0];
  }
  
  // Otherwise, select the move with the highest score
  candidates.sort((a, b) => b.score - a.score);
  
  return candidates[0];
}

// Select an edge for the AI during the seating phase
// The AI should pick any edge that is NOT opposite the player's edge
export function selectAIEdge(
  playerEdge: number,
  availableEdges: number[]
): number | null {
  const oppositeEdge = getOppositeEdge(playerEdge);
  
  // Filter out the opposite edge
  const validEdges = availableEdges.filter(edge => edge !== oppositeEdge);
  
  if (validEdges.length === 0) {
    // No valid edges available, fall back to any available edge
    return availableEdges.length > 0 ? availableEdges[0] : null;
  }
  
  // Pick the first valid edge (could randomize if desired)
  return validEdges[0];
}
