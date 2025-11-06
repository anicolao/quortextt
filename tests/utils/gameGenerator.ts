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
import { isLegalMove } from '../../src/game/legality';
import { traceFlow } from '../../src/game/flows';
import { getEdgePositionsWithDirections } from '../../src/game/board';
import { getFlowExit } from '../../src/game/tiles';

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
 * Find legal moves that will extend the current player's existing flows
 * Checks if placing the tile will actually create a flow connection
 */
/**
 * Find moves that would actually extend the player's flows
 * A move extends a flow if the placed tile connects to a flow edge:
 * - The tile must be adjacent to a position with a flow
 * - The tile must have a matching flow entry/exit that connects to the adjacent flow
 */
function findFlowAdjacentMoves(
  state: GameState,
  legalMoves: Array<{ position: HexPosition; rotation: Rotation }>
): Array<{ position: HexPosition; rotation: Rotation }> {
  const currentPlayer = state.players[state.currentPlayerIndex];
  const playerFlows = state.flows.get(currentPlayer.id);
  
  if (!playerFlows || playerFlows.size === 0) {
    // No flows yet, choose a position adjacent to the player's starting edge
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
    
    return adjacentToEdge.length > 0 ? adjacentToEdge : legalMoves;
  }
  
  // Build a map of flow edges: which direction a flow exits each position
  const flowEdges = new Map<string, Set<Direction>>();
  
  for (const flowPosKey of playerFlows) {
    const [flowRow, flowCol] = flowPosKey.split(',').map(Number);
    const flowPos: HexPosition = { row: flowRow, col: flowCol };
    const tile = state.board.get(flowPosKey);
    
    if (!tile) continue;
    
    if (!flowEdges.has(flowPosKey)) {
      flowEdges.set(flowPosKey, new Set());
    }
    
    // Check all 6 directions to see which ones have flow connections
    for (let dir = 0; dir < 6; dir++) {
      const direction = dir as Direction;
      const exitDir = getFlowExit(tile, direction);
      
      if (exitDir !== null) {
        // Flow enters from this direction and exits somewhere
        flowEdges.get(flowPosKey)!.add(direction);
        flowEdges.get(flowPosKey)!.add(exitDir);
      }
    }
  }
  
  // Filter moves that would connect to an existing flow edge
  const flowExtendingMoves = legalMoves.filter(move => {
    const { position, rotation } = move;
    
    // Get the tile type at current tile (we know it's legal, so there's a currentTile)
    if (state.currentTile === null) return false;
    
    const proposedTile = { type: state.currentTile, rotation };
    
    // Check all 6 neighbors of this position
    const directions: Direction[] = [0, 1, 2, 3, 4, 5];
    
    for (const dir of directions) {
      const neighbor = getNeighborInDirection(position, dir);
      const neighborKey = positionToKey(neighbor);
      
      // Is this neighbor part of the player's flow?
      if (!playerFlows.has(neighborKey)) continue;
      
      // Get the flow edges at the neighbor
      const neighborFlowDirs = flowEdges.get(neighborKey);
      if (!neighborFlowDirs) continue;
      
      // What direction does the neighbor's flow point toward our position?
      // If we're at direction `dir` from neighbor, neighbor sees us at opposite direction
      const oppositeDir = getOppositeDirection(dir);
      
      // Does the neighbor have a flow edge pointing toward us?
      if (!neighborFlowDirs.has(oppositeDir)) continue;
      
      // Does our proposed tile have a flow entry from direction `dir`?
      const exitFromOurEntry = getFlowExit(proposedTile, dir);
      if (exitFromOurEntry !== null) {
        // Yes! This tile would connect to the flow
        return true;
      }
    }
    
    return false;
  });
  
  return flowExtendingMoves.length > 0 ? flowExtendingMoves : legalMoves;
}

/**
 * Move prefix data for validation
 */
export interface MovePrefix {
  move: number;
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
  actions.push({ type: 'START_GAME' });
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
  // The game has already drawn the first tile from the seeded deck
  
  // Step 5: Draw initial tile (already seeded from SHUFFLE_TILES before edge selection)
  actions.push({ type: 'DRAW_TILE' });
  state = gameReducer(state, actions[actions.length - 1]);
  
  if (state.currentTile === null) {
    throw new Error(`No current tile after DRAW_TILE - availableTiles: ${state.availableTiles.length}`);
  }
  
  // Step 6: Play the game
  let moveCount = 0;
  const movePrefixes: MovePrefix[] = [];
  
  while (moveCount < maxMoves && state.phase === 'playing') {
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
      console.warn(`No legal moves found for tile type ${state.currentTile} at move ${moveCount + 1}`);
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
    
    // After placing tile, record flow lengths for move prefix tracking
    const movePrefix = generateMovePrefix(state, moveCount, player1Id, player2Id);
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
  player2Id: string
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
