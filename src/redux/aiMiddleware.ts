// Redux middleware to handle AI player actions

import { Middleware } from 'redux';
import { RootState } from './types';
import {
  GameAction,
  SELECT_EDGE,
  DRAW_TILE,
  NEXT_PLAYER,
  placeTile,
  replaceTile,
  nextPlayer,
  drawTile,
  selectEdge,
} from './actions';
import { selectAIEdge, selectAIMove } from '../game/ai';

// Middleware to automatically handle AI player turns
export const aiMiddleware: Middleware<{}, RootState> = (store) => (next) => (action) => {
  // First, let the action pass through
  const result = next(action);
  
  // After the action has been processed, check if we need AI to act
  const state = store.getState();
  const gameAction = action as GameAction;
  
  // Handle AI edge selection during seating phase
  if (gameAction.type === SELECT_EDGE) {
    const { seatingPhase, configPlayers } = state.game;
    
    if (seatingPhase.active && seatingPhase.seatingIndex < seatingPhase.seatingOrder.length) {
      const currentPlayerId = seatingPhase.seatingOrder[seatingPhase.seatingIndex];
      const currentConfigPlayer = configPlayers.find(p => p.id === currentPlayerId);
      
      if (currentConfigPlayer && currentConfigPlayer.isAI) {
        // AI player needs to select an edge
        // Find the human player's edge (assume there's one human player)
        const humanPlayer = configPlayers.find(p => !p.isAI);
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
          // Dispatch edge selection for AI (with a small delay for visual feedback)
          setTimeout(() => {
            store.dispatch(selectEdge(currentPlayerId, aiEdge) as any);
          }, 500);
        }
      }
    }
  }
  
  // Handle AI move during gameplay
  if (gameAction.type === DRAW_TILE || gameAction.type === NEXT_PLAYER) {
    const { players, currentPlayerIndex, currentTile, board, teams, phase, supermoveInProgress } = state.game;
    
    // Only act if we're in playing phase and have a current tile
    if (phase !== 'playing' || !currentTile) {
      return result;
    }
    
    const currentPlayer = players[currentPlayerIndex];
    
    // Check if current player is AI
    if (currentPlayer && currentPlayer.isAI) {
      // AI needs to make a move
      const supermoveEnabled = state.ui.settings.supermove;
      
      // Get AI's best move
      const aiMove = selectAIMove(
        board,
        currentTile,
        currentPlayer,
        players,
        teams,
        supermoveEnabled,
        state.game.boardRadius
      );
      
      if (aiMove) {
        // Dispatch the move (with a small delay for visual feedback)
        setTimeout(() => {
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
        }, 1000); // 1 second delay so human can see what AI is doing
      }
    }
  }
  
  return result;
};
