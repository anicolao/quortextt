// AI logic for Quortex/Flows - 1-ply evaluation

import {
  PlacedTile,
  Player,
  Team,
  HexPosition,
  TileType,
  Rotation,
  Direction,
} from "./types";
import {
  findLegalMoves,
  hasViablePath,
  isValidReplacementMove,
} from "./legality";
import {
  getAllBoardPositions,
  positionToKey,
  getOppositeEdge,
  getNeighborInDirection,
  isValidPosition,
  getEdgePositionsWithDirections,
} from "./board";
import { checkVictory } from "./victory";

// Evaluation constants
const WIN_SCORE = 100000;
const LOSS_SCORE = -200000; // Huge penalty when enemy wins - worse than blocking self
const SELF_BLOCK_BONUS = 16; // Bonus when AI blocks itself WITH supermove enabled (strategic advantage)
const OWN_PATH_WEIGHT = -2;
const ENEMY_PATH_WEIGHT = 1;
const BLOCK_THREAT_PENALTY = -50000; // Large penalty when enemy is 1 move from victory (urgent to block)
const BLOCKING_PENALTY = -75000; // Heavy penalty for blocking the opponent completely

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
  boardRadius = 3,
): number {
  // Use allowEmptyHexes=true to find potential path through empty positions
  const result = hasViablePath(
    board,
    player,
    targetEdge,
    true,
    true,
    boardRadius,
  );

  if (typeof result === "boolean") {
    // No path exists
    return result ? 0 : Infinity;
  }

  if (!result.hasPath || !result.pathToTarget) {
    return Infinity;
  }

  // Count only the EMPTY tiles in the path (tiles that need to be placed)
  // Occupied tiles don't count toward the "distance" since they're already placed
  let emptyTileCount = 0;
  for (const pos of result.pathToTarget) {
    const posKey = positionToKey(pos);
    if (!board.has(posKey)) {
      emptyTileCount++;
    }
  }

  // Return number of empty tiles (tiles needed to complete the path)
  // If all tiles are occupied, the path is complete (distance = 0)
  return emptyTileCount;
}

// Evaluate a board position for the AI player
// Returns a score where higher is better for the AI
function evaluatePosition(
  board: Map<string, PlacedTile>,
  aiPlayer: Player,
  players: Player[],
  teams: Team[],
  boardRadius = 3,
  supermoveEnabled = false,
): number {
  // Check if this is a winning position for the AI
  const victoryResult = checkVictory(
    board,
    players,
    teams,
    undefined,
    boardRadius,
  );

  if (victoryResult.winners.includes(aiPlayer.id)) {
    return WIN_SCORE;
  }

  // Check if any enemy wins - this is VERY BAD (worse than blocking ourselves)
  const enemyWins = victoryResult.winners.some(
    (winnerId) => winnerId !== aiPlayer.id,
  );
  if (enemyWins) {
    return LOSS_SCORE;
  }

  // Calculate shortest path for AI
  const aiTargetEdge = getOppositeEdge(aiPlayer.edgePosition);
  const aiPathLength = getShortestPathLength(
    board,
    aiPlayer,
    aiTargetEdge,
    boardRadius,
  );

  // Calculate shortest path for enemies (take the minimum among all enemies)
  let enemyMinPathLength = Infinity;

  for (const player of players) {
    if (player.id === aiPlayer.id) continue;

    const targetEdge = getOppositeEdge(player.edgePosition);
    const pathLength = getShortestPathLength(
      board,
      player,
      targetEdge,
      boardRadius,
    );

    if (pathLength < enemyMinPathLength) {
      enemyMinPathLength = pathLength;
    }
  }

  // Evaluation: -A * (AI path length)^2 + B * (enemy min path length)^2
  // We want to minimize our path and maximize enemy's path
  // Plus special bonuses/penalties for critical situations

  // Handle infinite path lengths (no viable path)
  if (aiPathLength === Infinity && enemyMinPathLength === Infinity) {
    // Neither player can win - neutral score
    return 0;
  }

  if (aiPathLength === Infinity) {
    // AI cannot win immediately
    if (supermoveEnabled) {
      // With supermove, blocking ourselves is actually strategic!
      // We can use supermove to unblock, and this often leads to victory
      return SELF_BLOCK_BONUS;
    } else {
      // Without supermove, blocking ourselves is very bad
      return -100000;
    }
  }

  // Special case: Enemy is blocked (no viable path)
  if (enemyMinPathLength === Infinity) {
    // Blocking the opponent is very bad - we want a competitive game
    // Apply a heavy penalty to discourage blocking
    return BLOCKING_PENALTY;
  }

  const aiScore = OWN_PATH_WEIGHT * (aiPathLength * aiPathLength);
  const enemyScore =
    ENEMY_PATH_WEIGHT * (enemyMinPathLength * enemyMinPathLength);

  // Special case: Enemy is 1 move away from victory
  // Apply a large penalty to make this situation very undesirable
  // This motivates the AI to prevent/block the enemy from reaching this state
  let blockThreatPenalty = 0;
  if (enemyMinPathLength === 1) {
    blockThreatPenalty = BLOCK_THREAT_PENALTY;
  }

  return aiScore + enemyScore + blockThreatPenalty;
}

// Check if a position is adjacent to any flow or starting edge for any player
// OR if the position itself is a starting edge position
function isAdjacentToFlowOrEdge(
  position: HexPosition,
  board: Map<string, PlacedTile>,
  players: Player[],
  boardRadius = 3,
): boolean {
  // First, check if this position itself is a starting edge for any player
  for (const player of players) {
    const edgeData = getEdgePositionsWithDirections(
      player.edgePosition,
      boardRadius,
    );
    const isEdgePos = edgeData.some(
      ({ pos }) => pos.row === position.row && pos.col === position.col,
    );
    if (isEdgePos) {
      return true;
    }
  }

  // Check all 6 neighbors
  for (let dir = 0; dir < 6; dir++) {
    const neighbor = getNeighborInDirection(position, dir as Direction);

    // Check if neighbor is a valid position
    if (!isValidPosition(neighbor, boardRadius)) {
      continue;
    }

    const neighborKey = positionToKey(neighbor);

    // Check if neighbor has a tile (adjacent to existing tile/flow)
    if (board.has(neighborKey)) {
      return true;
    }

    // Check if neighbor is a starting edge position for any player
    for (const player of players) {
      const edgeData = getEdgePositionsWithDirections(
        player.edgePosition,
        boardRadius,
      );
      const isEdgePos = edgeData.some(
        ({ pos }) => pos.row === neighbor.row && pos.col === neighbor.col,
      );
      if (isEdgePos) {
        return true;
      }
    }
  }

  return false;
}

// Generate all move candidates for the AI
export function generateMoveCandidates(
  board: Map<string, PlacedTile>,
  tileType: TileType,
  aiPlayer: Player,
  players: Player[],
  teams: Team[],
  supermoveEnabled: boolean,
  boardRadius = 3,
): MoveCandidate[] {
  const candidates: MoveCandidate[] = [];

  // Try all rotations
  for (let rotation = 0; rotation < 6; rotation++) {
    const rot = rotation as Rotation;

    // 1. Regular placements - only positions adjacent to flows or starting edges
    const allLegalPositions = findLegalMoves(
      board,
      tileType,
      rot,
      players,
      teams,
      boardRadius,
      supermoveEnabled,
    );

    // Filter to only positions adjacent to flows or starting edges
    const legalPositions = allLegalPositions.filter((pos) =>
      isAdjacentToFlowOrEdge(pos, board, players, boardRadius),
    );

    for (const position of legalPositions) {
      // Create test board with this move
      const testBoard = new Map(board);
      const tile: PlacedTile = {
        type: tileType,
        rotation: rot,
        position,
      };
      testBoard.set(positionToKey(position), tile);

      // Evaluate this position
      const score = evaluatePosition(
        testBoard,
        aiPlayer,
        players,
        teams,
        boardRadius,
        supermoveEnabled,
      );
      const isWinning = score >= WIN_SCORE;

      candidates.push({
        position,
        rotation: rot,
        score,
        isReplacement: false,
        isWinningMove: isWinning,
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
        if (
          !isValidReplacementMove(
            board,
            position,
            tileType,
            rot,
            aiPlayer,
            players,
            teams,
            boardRadius,
          )
        ) {
          continue;
        }

        // Create test board with replacement
        const testBoard = new Map(board);
        const newTile: PlacedTile = {
          type: tileType,
          rotation: rot,
          position,
        };
        testBoard.set(posKey, newTile);

        // Check if the replacement itself causes victory
        let replacementScore = evaluatePosition(
          testBoard,
          aiPlayer,
          players,
          teams,
          boardRadius,
          supermoveEnabled,
        );
        const replacementWins = replacementScore >= WIN_SCORE;

        // If replacement wins, that's the score
        if (replacementWins) {
          candidates.push({
            position,
            rotation: rot,
            score: replacementScore,
            isReplacement: true,
            isWinningMove: true,
          });
          continue;
        }

        // Otherwise, consider the follow-up placement with the replaced tile
        // The replaced tile goes into hand and must be placed
        const replacedTileType = existingTile.type;

        // Find best follow-up move with the replaced tile
        let bestFollowupScore = -Infinity;

        for (
          let followupRotation = 0;
          followupRotation < 6;
          followupRotation++
        ) {
          const followupRot = followupRotation as Rotation;
          const followupPositions = findLegalMoves(
            testBoard,
            replacedTileType,
            followupRot,
            players,
            teams,
            boardRadius,
            supermoveEnabled,
          );

          for (const followupPosition of followupPositions) {
            // Create test board with follow-up move
            const followupBoard = new Map(testBoard);
            const followupTile: PlacedTile = {
              type: replacedTileType,
              rotation: followupRot,
              position: followupPosition,
            };
            followupBoard.set(positionToKey(followupPosition), followupTile);

            // Evaluate the final position after both moves
            const followupScore = evaluatePosition(
              followupBoard,
              aiPlayer,
              players,
              teams,
              boardRadius,
              supermoveEnabled,
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
          isWinningMove: bestFollowupScore >= WIN_SCORE,
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
  boardRadius = 3,
): MoveCandidate | null {
  const candidates = generateMoveCandidates(
    board,
    tileType,
    aiPlayer,
    players,
    teams,
    supermoveEnabled,
    boardRadius,
  );

  if (candidates.length === 0) {
    return null;
  }

  // If there's a winning move, take it immediately
  const winningMoves = candidates.filter((c) => c.isWinningMove);
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
  availableEdges: number[],
): number | null {
  const oppositeEdge = getOppositeEdge(playerEdge);

  // Filter out the opposite edge
  const validEdges = availableEdges.filter((edge) => edge !== oppositeEdge);

  if (validEdges.length === 0) {
    // No valid edges available, fall back to any available edge
    return availableEdges.length > 0 ? availableEdges[0] : null;
  }

  // Pick the first valid edge (could randomize if desired)
  return validEdges[0];
}
