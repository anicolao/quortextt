/**
 * Game Generator Utility
 * 
 * Generates a complete random game from a seed, producing all Redux actions
 * needed to play a full game from lobby to completion.
 */

import { GameAction } from '../../src/redux/actions';
import { gameReducer, initialState } from '../../src/redux/gameReducer';
import { GameState } from '../../src/redux/types';
import { getAllBoardPositions, positionToKey, getEdgePositions, getNeighborInDirection, getOppositeDirection } from '../../src/game/board';
import { HexPosition, Rotation, Direction } from '../../src/game/types';
import { isLegalMove, hasViablePath } from '../../src/game/legality';
import { traceFlow } from '../../src/game/flows';
import { getEdgePositionsWithDirections } from '../../src/game/board';
import { getFlowExit } from '../../src/game/tiles';

/**
 * Simple seeded random number generator (LCG)
 * Uses same algorithm as gameReducer's seededRandom for consistency
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

/**
 * Find legal moves for the current player
 * Optimized to find good moves quickly without checking all possibilities
 */
function findLegalMoves(
  state: GameState,
  currentTile: any
): Array<{ position: HexPosition; rotation: Rotation }> {
  const legalMoves: Array<{ position: HexPosition; rotation: Rotation }> = [];
  const currentPlayer = state.players[state.currentPlayerIndex];
  const playerFlows = state.flows.get(currentPlayer.id);
  
  // Get all valid board positions
  const allPositions = getAllBoardPositions(state.boardRadius);
  
  // Sort positions by priority: prefer positions adjacent to existing flows
  const positionsByPriority: HexPosition[] = [];
  const adjacentPositions: HexPosition[] = [];
  const otherPositions: HexPosition[] = [];
  
  for (const position of allPositions) {
    const posKey = positionToKey(position);
    
    // Skip if position is already occupied
    if (state.board.has(posKey)) {
      continue;
    }
    
    // Check if adjacent to player's flows
    let isAdjacent = false;
    if (playerFlows && playerFlows.size > 0) {
      const directions: Direction[] = [0, 1, 2, 3, 4, 5];
      isAdjacent = directions.some(dir => {
        const neighbor = getNeighborInDirection(position, dir);
        const neighborKey = positionToKey(neighbor);
        return playerFlows.has(neighborKey);
      });
    } else {
      // No flows yet, check if adjacent to starting edge
      const edgePositions = getEdgePositions(currentPlayer.edgePosition, 3);
      isAdjacent = edgePositions.some(edgePos => {
        const deltaRow = position.row - edgePos.row;
        const deltaCol = position.col - edgePos.col;
        
        // Check if adjacent using hex grid vectors
        return (
          (deltaRow === -1 && deltaCol === 0) ||   // SouthWest
          (deltaRow === 0 && deltaCol === -1) ||   // West
          (deltaRow === 1 && deltaCol === -1) ||   // NorthWest
          (deltaRow === 1 && deltaCol === 0) ||    // NorthEast
          (deltaRow === 0 && deltaCol === 1) ||    // East
          (deltaRow === -1 && deltaCol === 1)      // SouthEast
        );
      });
    }
    
    if (isAdjacent) {
      adjacentPositions.push(position);
    } else {
      otherPositions.push(position);
    }
  }
  
  // Sort each group for determinism
  const sortPositions = (positions: HexPosition[]) => {
    positions.sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row;
      if (a.col !== b.col) return a.col - b.col;
      return 0;
    });
  };
  
  sortPositions(adjacentPositions);
  sortPositions(otherPositions);
  
  // Check adjacent positions first, then others
  positionsByPriority.push(...adjacentPositions, ...otherPositions);
  
  // Check each position in priority order
  // Stop early if we find enough legal moves (optimization for test generation)
  const MIN_LEGAL_MOVES = 5; // Find at least 5 legal moves for variety
  
  for (const position of positionsByPriority) {
    // Try all rotations
    for (let rotation = 0; rotation < 6; rotation++) {
      const testTile = {
        type: currentTile,
        position,
        rotation: rotation as Rotation,
        playedBy: currentPlayer.id,
      };
      
      if (isLegalMove(state.board, testTile, state.players, state.teams, state.boardRadius)) {
        legalMoves.push({ position, rotation: rotation as Rotation });
      }
    }
    
    // Early exit optimization: if we found enough moves from adjacent positions, we can stop
    if (legalMoves.length >= MIN_LEGAL_MOVES && position === adjacentPositions[adjacentPositions.length - 1]) {
      break;
    }
  }
  
  // Sort for deterministic ordering
  legalMoves.sort((a, b) => {
    if (a.position.row !== b.position.row) {
      return a.position.row - b.position.row;
    }
    if (a.position.col !== b.position.col) {
      return a.position.col - b.position.col;
    }
    return a.rotation - b.rotation;
  });
  
  return legalMoves;
}

/**
 * Find best moves using path-based scoring on filtered adjacent moves
 * Strategy:
 * 1. Identify legal moves adjacent to tiles where we have flows
 * 2. For the filtered set, call hasViablePath with debug on to score each move
 * 3. Score: +1 per occupied hex, -2 per empty hex in pathToTarget
 * 4. Play the option with the highest score (deterministic among ties)
 * 
 * This applies the expensive scoring only to the already-filtered adjacent moves,
 * providing better move quality while maintaining good performance.
 */
function findFlowAdjacentMoves(
  state: GameState,
  legalMoves: Array<{ position: HexPosition; rotation: Rotation }>
): Array<{ position: HexPosition; rotation: Rotation }> {
  const currentPlayer = state.players[state.currentPlayerIndex];
  const playerFlows = state.flows.get(currentPlayer.id);
  
  // Define moves to consider based on whether we have flows
  let movesToConsider: Array<{ position: HexPosition; rotation: Rotation }>;
  
  if (!playerFlows || playerFlows.size === 0) {
    // No flows yet, consider moves adjacent to the player's starting edge
    const edgePositions = getEdgePositions(currentPlayer.edgePosition, 3);
    const adjacentToEdge = legalMoves.filter(move => {
      return edgePositions.some(edgePos => {
        const deltaRow = move.position.row - edgePos.row;
        const deltaCol = move.position.col - edgePos.col;
        
        // Check if adjacent using hex grid vectors
        const isAdjacent = 
          (deltaRow === -1 && deltaCol === 0) ||   // SouthWest
          (deltaRow === 0 && deltaCol === -1) ||   // West
          (deltaRow === 1 && deltaCol === -1) ||   // NorthWest
          (deltaRow === 1 && deltaCol === 0) ||    // NorthEast
          (deltaRow === 0 && deltaCol === 1) ||    // East
          (deltaRow === -1 && deltaCol === 1);     // SouthEast
        
        return isAdjacent;
      });
    });
    
    movesToConsider = adjacentToEdge.length > 0 ? adjacentToEdge : legalMoves;
  } else {
    // Find legal moves adjacent to positions where we have flows
    const adjacentMoves = legalMoves.filter(move => {
      const directions: Direction[] = [0, 1, 2, 3, 4, 5];
      return directions.some(dir => {
        const neighbor = getNeighborInDirection(move.position, dir);
        const neighborKey = positionToKey(neighbor);
        return playerFlows.has(neighborKey);
      });
    });
    
    movesToConsider = adjacentMoves.length > 0 ? adjacentMoves : legalMoves;
  }
  
  // Score each move by testing with hasViablePath
  // This is applied only to the filtered set of adjacent moves
  interface ScoredMove {
    position: HexPosition;
    rotation: Rotation;
    score: number;
  }
  
  const scoredMoves: ScoredMove[] = [];
  
  for (const move of movesToConsider) {
    if (state.currentTile === null) continue;
    
    // Create a simulated board with this move placed
    const simulatedBoard = new Map(state.board);
    const posKey = positionToKey(move.position);
    simulatedBoard.set(posKey, {
      type: state.currentTile,
      rotation: move.rotation,
    });
    
    // Find the target edge (opposite of player's starting edge)
    const targetEdge = (currentPlayer.edgePosition + 3) % 6;
    
    // Call hasViablePath with debug info
    const result = hasViablePath(
      simulatedBoard,
      currentPlayer,
      targetEdge,
      true, // returnDebugInfo
      true, // allowEmptyHexes
      3 // boardRadius
    );
    
    if (typeof result === 'boolean') {
      // No debug info returned, skip
      continue;
    }
    
    // Score based on pathToTarget
    let score = 0;
    if (result.hasPath && result.pathToTarget) {
      for (const pos of result.pathToTarget) {
        const key = positionToKey(pos);
        if (simulatedBoard.has(key)) {
          score += 1; // +1 for occupied hex
        } else {
          score -= 2; // -2 for empty hex
        }
      }
    }
    
    scoredMoves.push({
      position: move.position,
      rotation: move.rotation,
      score,
    });
  }
  
  if (scoredMoves.length === 0) {
    return movesToConsider;
  }
  
  // Find the highest score
  const maxScore = Math.max(...scoredMoves.map(m => m.score));
  
  // Get all moves with the highest score
  const bestMoves = scoredMoves.filter(m => m.score === maxScore);
  
  // Sort moves for deterministic selection (when multiple have same score)
  // Sort by row, then col, then rotation
  bestMoves.sort((a, b) => {
    if (a.position.row !== b.position.row) {
      return a.position.row - b.position.row;
    }
    if (a.position.col !== b.position.col) {
      return a.position.col - b.position.col;
    }
    return a.rotation - b.rotation;
  });
  
  return bestMoves;
}

/**
 * Move prefix data for validation
 */
export interface MovePrefix {
  move: number;
  tileType: number; // 0-3 representing TileType
  rotation: number; // 0-5
  position: HexPosition;
  p1FlowLengths: Record<number, number>;
  p2FlowLengths: Record<number, number>;
}

/**
 * Result of game generation including actions and final state
 */
export interface GeneratedGame {
  actions: GameAction[];
  finalState: GameState;
  movePrefixes: MovePrefix[];
}

/**
 * Generate a complete game from a seed
 * Returns both the actions and the final game state
 */
export function generateRandomGameWithState(seed: number, maxMoves = 50): GeneratedGame {
  const actions: GameAction[] = [];
  const rng = new SeededRandom(seed);
  
  let state: GameState = initialState;
  
  // Step 1: Add two players
  actions.push({ type: 'ADD_PLAYER', payload: { color: '#0173B2', edge: 0 } });
  state = gameReducer(state, actions[actions.length - 1]);
  
  actions.push({ type: 'ADD_PLAYER', payload: { color: '#DE8F05', edge: 1 } });
  state = gameReducer(state, actions[actions.length - 1]);
  
  // Step 2: Start game (goes to seating phase)
  actions.push({ type: 'START_GAME', payload: { seed } });
  state = gameReducer(state, actions[actions.length - 1]);
  
  // Step 3: Shuffle tiles with seed BEFORE edge selection to ensure deterministic behavior
  actions.push({ type: 'SHUFFLE_TILES', payload: { seed } });
  state = gameReducer(state, actions[actions.length - 1]);
  
  // Step 4: Complete seating phase
  // Note: seatingOrder is randomized, so we need to select edges in that order
  const player1Id = state.seatingPhase.seatingOrder[0];
  const player2Id = state.seatingPhase.seatingOrder[1];
  
  // Select edges for players in seating order
  actions.push({ type: 'SELECT_EDGE', payload: { playerId: player1Id, edgeNumber: 0 } });
  state = gameReducer(state, actions[actions.length - 1]);
  
  // After first selection, state should still be in seating phase
  if (state.phase !== 'seating') {
    throw new Error(`Expected seating phase after first edge selection, got ${state.phase}`);
  }
  
  actions.push({ type: 'SELECT_EDGE', payload: { playerId: player2Id, edgeNumber: 3 } });
  state = gameReducer(state, actions[actions.length - 1]);
  
  // After second selection, seating should be complete and we should be in gameplay
  if (state.phase !== 'playing' || state.players.length !== 2) {
    throw new Error(`Expected gameplay phase with 2 players after seating, got phase=${state.phase}, players=${state.players.length}`);
  }
  
  // At this point, seating is complete and we're in gameplay mode
  // The SELECT_EDGE transition has already drawn the first tile from the seeded deck
  // so we don't need to call DRAW_TILE here
  
  // Step 5: Play the game
  let moveCount = 0;
  const movePrefixes: MovePrefix[] = [];
  
  while (moveCount < maxMoves && state.phase === 'playing') {
    // Check we have a tile to place
    if (state.currentTile === null) {
      // No more tiles
      break;
    }
    
    // Check we have a tile to place
    if (state.currentTile === null) {
      // No more tiles
      break;
    }
    
    // Check if game ended
    if (state.phase === 'finished') {
      break;
    }
    
    // Find legal moves
    const legalMoves = findLegalMoves(state, state.currentTile);
    
    if (legalMoves.length === 0) {
      // No legal moves, game ends
      break;
    }
    
    // Prefer moves adjacent to player's flows
    const preferredMoves = findFlowAdjacentMoves(state, legalMoves);
    
    // Choose the first move from preferred moves (deterministic after sorting)
    const move = preferredMoves[0];
    
    // Save tile type and rotation before placing (currentTile is cleared after placement)
    const placedTileType = state.currentTile;
    const placedPosition = move.position;
    const placedRotation = move.rotation;
    
    // Place the tile
    actions.push({
      type: 'PLACE_TILE',
      payload: { position: move.position, rotation: move.rotation }
    });
    state = gameReducer(state, actions[actions.length - 1]);
    
    moveCount++;
    
    // After placing tile, record flow lengths for move prefix tracking
    const movePrefix = generateMovePrefix(state, moveCount, player1Id, player2Id, placedTileType, placedRotation, placedPosition);
    movePrefixes.push(movePrefix);
    
    // Check if game ended
    if (state.phase === 'finished') {
      break;
    }
    
    // Next player
    actions.push({ type: 'NEXT_PLAYER' });
    state = gameReducer(state, actions[actions.length - 1]);
    
    // Draw tile for next move
    actions.push({ type: 'DRAW_TILE' });
    state = gameReducer(state, actions[actions.length - 1]);
  }
  
  return { actions, finalState: state, movePrefixes };
}

/**
 * Generate move prefix data for a given game state after a PLACE_TILE action
 */
function generateMovePrefix(
  state: GameState,
  moveNumber: number,
  player1Id: string,
  player2Id: string,
  tileType: number,
  rotation: number,
  position: HexPosition
): MovePrefix {
  const p1FlowLengths: Record<number, number> = {};
  const p2FlowLengths: Record<number, number> = {};
  
  // Trace flows for each player from their edge
  for (const player of state.players) {
    const edgeData = getEdgePositionsWithDirections(player.edgePosition);
    let flowIndex = 0;
    
    for (const { pos, dir } of edgeData) {
      const posKey = positionToKey(pos);
      const tile = state.board.get(posKey);
      
      if (!tile) {
        continue;
      }
      
      const { edges } = traceFlow(state.board, pos, dir, player.id);
      
      if (edges.length > 0) {
        if (player.id === player1Id) {
          p1FlowLengths[flowIndex] = edges.length;
        } else if (player.id === player2Id) {
          p2FlowLengths[flowIndex] = edges.length;
        }
        flowIndex++;
      }
    }
  }
  
  return {
    move: moveNumber,
    tileType,
    rotation,
    position,
    p1FlowLengths,
    p2FlowLengths,
  };
}

/**
 * Generate a complete game from a seed (returns only actions for compatibility)
 */
export function generateRandomGame(seed: number, maxMoves = 50): GameAction[] {
  return generateRandomGameWithState(seed, maxMoves).actions;
}

/**
 * Save actions to a .jsonl file (one action per line)
 */
export function saveActionsToFile(actions: GameAction[], filename: string): string {
  return actions.map(action => JSON.stringify(action)).join('\n');
}

/**
 * Load actions from a .jsonl file
 */
export function loadActionsFromFile(content: string): GameAction[] {
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line) as GameAction);
}
