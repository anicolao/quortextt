// Redux middleware to handle AI player actions

import { Middleware } from 'redux';
import { RootState } from './types';
import {
  GameAction,
  SELECT_EDGE,
  DRAW_TILE,
  REPLACE_TILE,
  placeTile,
  replaceTile,
  nextPlayer,
  drawTile,
  selectEdge,
  setAIScoringData,
  START_GAME,
} from './actions';
import { selectAIEdge, selectAIMove, generateMoveCandidates } from '../game/ai';
import { positionToKey } from '../game/board';

// Middleware to automatically handle AI player turns
export const aiMiddleware: Middleware<{}, RootState> = (store) => (next) => (action) => {
  // First, let the action pass through
  const result = next(action);
  
  // After the action has been processed, check if we need AI to act
  const state = store.getState();
  const gameAction = action as GameAction;
  
  // Handle AI edge selection during seating phase
  // Trigger on SELECT_EDGE (when a player selects and we move to next) or START_GAME (if AI goes first)
  if (gameAction.type === SELECT_EDGE || gameAction.type === START_GAME) {
    const { seatingPhase, configPlayers } = state.game;
    
    if (seatingPhase.active && seatingPhase.seatingIndex < seatingPhase.seatingOrder.length) {
      const currentPlayerId = seatingPhase.seatingOrder[seatingPhase.seatingIndex];
      const currentConfigPlayer = configPlayers.find((p: any) => p.id === currentPlayerId);
      
      if (currentConfigPlayer && currentConfigPlayer.isAI) {
        // AI player needs to select an edge
        // Find the human player's edge (assume there's one human player)
        const humanPlayer = configPlayers.find((p: any) => !p.isAI);
        let humanEdge = 0; // default
        
        if (humanPlayer) {
          // Find the human player's assigned edge
          const humanAssignedEdge = seatingPhase.edgeAssignments.get(humanPlayer.id);
          if (humanAssignedEdge !== undefined) {
            humanEdge = humanAssignedEdge;
          }
        }
        
        // Select an edge for AI that's not opposite to human
        const aiEdge = selectAIEdge(humanEdge, seatingPhase.availableEdges);
        
        if (aiEdge !== null) {
          // Dispatch edge selection for AI immediately (Redux is synchronous)
          store.dispatch(selectEdge(currentPlayerId, aiEdge) as any);
        }
      }
    }
  }
  
  // Handle AI move during gameplay - respond to DRAW_TILE or REPLACE_TILE (for supermoves)
  if (gameAction.type === DRAW_TILE || gameAction.type === REPLACE_TILE) {
    const { players, currentPlayerIndex, currentTile, board, teams, phase, supermoveInProgress } = state.game;
    
    // Only act if we're in playing phase and have a current tile
    if (phase !== 'playing' || currentTile === null) {
      // Clear AI scoring data if no tile
      if (state.ui.settings.debugAIScoring && state.game.aiScoringData) {
        store.dispatch(setAIScoringData(undefined) as any);
      }
      return result;
    }
    
    const currentPlayer = players[currentPlayerIndex];
    const supermoveEnabled = state.ui.settings.supermove;
    
    // Generate AI scoring data if debug mode is enabled (for any player)
    if (state.ui.settings.debugAIScoring && currentPlayer) {
      // Find an AI player to use for evaluation (or use current player if they're AI)
      const aiPlayer = currentPlayer.isAI ? currentPlayer : players.find(p => p.isAI);
      
      if (aiPlayer) {
        const candidates = generateMoveCandidates(
          board,
          currentTile,
          aiPlayer,
          players,
          teams,
          supermoveEnabled,
          state.game.boardRadius
        );
        
        // Group candidates by position
        const scoringData: Record<string, { rotation: number; score: number }[]> = {};
        for (const candidate of candidates) {
          const key = positionToKey(candidate.position);
          if (!scoringData[key]) {
            scoringData[key] = [];
          }
          scoringData[key].push({
            rotation: candidate.rotation,
            score: candidate.score,
          });
        }
        
        store.dispatch(setAIScoringData(scoringData) as any);
      }
    }
    
    // Check if current player is AI
    if (currentPlayer && currentPlayer.isAI) {
      // AI needs to make a move
      // If supermove is already in progress, disable supermove for this move to prevent infinite replacements
      const aiMove = selectAIMove(
        board,
        currentTile,
        currentPlayer,
        players,
        teams,
        supermoveEnabled && !supermoveInProgress, // Disable supermove if already in progress
        state.game.boardRadius
      );
      
      if (aiMove) {
        // Dispatch the move immediately (Redux is synchronous - no setTimeout needed)
        if (aiMove.isReplacement) {
          store.dispatch(replaceTile(aiMove.position, aiMove.rotation) as any);
          // After replacement, AI will have another turn to place the replaced tile
          // This will be handled by the next DRAW_TILE trigger
        } else {
          store.dispatch(placeTile(aiMove.position, aiMove.rotation) as any);
          
          // If this wasn't part of a supermove, advance to next player
          if (!supermoveInProgress) {
            store.dispatch(nextPlayer() as any);
            store.dispatch(drawTile() as any);
          }
        }
      }
    }
  }
  
  return result;
};
