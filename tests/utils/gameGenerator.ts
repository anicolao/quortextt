/**
 * Game Generator Utility
 * 
 * Generates a complete random game from a seed, producing all Redux actions
 * needed to play a full game from lobby to completion.
 */

import { GameAction } from '../../src/redux/actions';
import { gameReducer, initialState } from '../../src/redux/gameReducer';
import { GameState } from '../../src/redux/types';
import { getAllBoardPositions, positionToKey } from '../../src/game/board';
import { HexPosition, Rotation } from '../../src/game/types';
import { isLegalMove } from '../../src/game/legality';
import { traceFlow } from '../../src/game/flows';
import { getEdgePositionsWithDirections } from '../../src/game/board';

/**
 * Simple seeded random number generator (LCG)
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
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
 * Find all legal moves for the current player
 */
function findLegalMoves(
  state: GameState,
  currentTile: any
): Array<{ position: HexPosition; rotation: Rotation }> {
  const legalMoves: Array<{ position: HexPosition; rotation: Rotation }> = [];
  const currentPlayer = state.players[state.currentPlayerIndex];
  
  // Get all valid board positions
  const allPositions = getAllBoardPositions(state.boardRadius);
  
  // Check each position
  for (const position of allPositions) {
    const posKey = positionToKey(position);
    
    // Skip if position is already occupied
    if (state.board.has(posKey)) {
      continue;
    }
    
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
  }
  
  return legalMoves;
}

/**
 * Find legal moves adjacent to player's existing flows
 */
function findFlowAdjacentMoves(
  state: GameState,
  legalMoves: Array<{ position: HexPosition; rotation: Rotation }>
): Array<{ position: HexPosition; rotation: Rotation }> {
  const currentPlayer = state.players[state.currentPlayerIndex];
  const playerFlows = state.flows.get(currentPlayer.id);
  
  if (!playerFlows || playerFlows.size === 0) {
    // No flows yet, return all legal moves
    return legalMoves;
  }
  
  // Filter moves adjacent to existing flows
  const adjacentMoves = legalMoves.filter(move => {
    // Check if this position is adjacent to any flow position
    for (const flowPosKey of playerFlows) {
      const [flowRow, flowCol] = flowPosKey.split(',').map(Number);
      const rowDiff = Math.abs(flowRow - move.position.row);
      const colDiff = Math.abs(flowCol - move.position.col);
      
      // Check if adjacent (one of the six neighbor positions)
      if ((rowDiff === 1 && colDiff === 0) || 
          (rowDiff === 0 && colDiff === 1) ||
          (rowDiff === 1 && colDiff === 1)) {
        return true;
      }
    }
    return false;
  });
  
  return adjacentMoves.length > 0 ? adjacentMoves : legalMoves;
}

/**
 * Result of game generation including actions and final state
 */
export interface GeneratedGame {
  actions: GameAction[];
  finalState: GameState;
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
  actions.push({ type: 'START_GAME' });
  state = gameReducer(state, actions[actions.length - 1]);
  
  // Step 3: Complete seating phase
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
  // The game has already drawn the first tile and shuffled the deck
  
  // Step 4: Shuffle tiles with seed (need to do this before seating completes)
  // Actually, let's reshuffle after seating to ensure deterministic behavior
  actions.push({ type: 'SHUFFLE_TILES', payload: { seed } });
  state = gameReducer(state, actions[actions.length - 1]);
  
  // Step 5: Draw initial tile (replace the auto-drawn one)
  actions.push({ type: 'DRAW_TILE' });
  state = gameReducer(state, actions[actions.length - 1]);
  
  // Step 6: Play the game
  let moveCount = 0;
  while (moveCount < maxMoves && state.phase === 'playing') {
    // Draw tile for next move
    actions.push({ type: 'DRAW_TILE' });
    state = gameReducer(state, actions[actions.length - 1]);
    
    if (!state.currentTile) {
      // No more tiles
      break;
    }
    
    // Check if game ended after drawing
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
    
    // Choose a random move from preferred moves
    const move = preferredMoves[rng.nextInt(preferredMoves.length)];
    
    // Place the tile
    actions.push({
      type: 'PLACE_TILE',
      payload: { position: move.position, rotation: move.rotation }
    });
    state = gameReducer(state, actions[actions.length - 1]);
    
    moveCount++;
    
    // Check if game ended
    if (state.phase === 'finished') {
      break;
    }
    
    // Next player
    actions.push({ type: 'NEXT_PLAYER' });
    state = gameReducer(state, actions[actions.length - 1]);
  }
  
  return { actions, finalState: state };
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
