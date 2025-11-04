// Memoized selectors for derived state

import { RootState } from './types';
import { HexPosition, Player } from '../game/types';
import { getAllBoardPositions } from '../game/board';
import { isLegalMove, getBlockedPlayers } from '../game/legality';

// Get current player
export const selectCurrentPlayer = (state: RootState): Player | null => {
  const { players, currentPlayerIndex } = state.game;
  if (players.length === 0) {
    return null;
  }
  return players[currentPlayerIndex];
};

// Get legal positions for current tile
export const selectLegalPositions = (state: RootState): HexPosition[] => {
  const { board, currentTile, players, teams } = state.game;
  const { currentRotation } = state.ui;

  if (currentTile === null) {
    return [];
  }

  // Get all valid board positions
  const allPositions = getAllBoardPositions();

  // Filter to positions that are empty and legal
  return allPositions.filter((position) => {
    // Check if position is already occupied
    const key = `${position.row},${position.col}`;
    if (board.has(key)) {
      return false;
    }

    // Check if move is legal
    const placedTile = {
      type: currentTile,
      rotation: currentRotation,
      position,
    };

    return isLegalMove(board, placedTile, players, teams);
  });
};

// Get flows for rendering (convert Map to array format)
export const selectFlowsForRendering = (state: RootState): Array<{
  playerId: string;
  color: string;
  positions: HexPosition[];
}> => {
  const { flows, players } = state.game;

  return players.map((player) => {
    const playerFlows = flows.get(player.id) || new Set<string>();
    const positions: HexPosition[] = [];

    playerFlows.forEach((posKey) => {
      const [row, col] = posKey.split(',').map(Number);
      positions.push({ row, col });
    });

    return {
      playerId: player.id,
      color: player.color,
      positions,
    };
  });
};

// Check if a position is hovered
export const selectIsPositionHovered = (state: RootState, position: HexPosition): boolean => {
  const { hoveredPosition } = state.ui;
  if (!hoveredPosition) {
    return false;
  }
  return hoveredPosition.row === position.row && hoveredPosition.col === position.col;
};

// Get game status information
export const selectGameStatus = (state: RootState) => {
  const { phase, winners, winType, players, currentPlayerIndex } = state.game;
  
  return {
    phase,
    winners,
    winType,
    currentPlayer: players[currentPlayerIndex] || null,
    isGameOver: phase === 'finished',
  };
};

// Get remaining tile counts
export const selectRemainingTileCounts = (state: RootState) => {
  const { availableTiles } = state.game;
  
  const counts = {
    total: availableTiles.length,
    noSharps: 0,
    oneSharp: 0,
    twoSharps: 0,
    threeSharps: 0,
  };

  availableTiles.forEach((tile) => {
    switch (tile) {
      case 0:
        counts.noSharps++;
        break;
      case 1:
        counts.oneSharp++;
        break;
      case 2:
        counts.twoSharps++;
        break;
      case 3:
        counts.threeSharps++;
        break;
    }
  });

  return counts;
};

// Check if the current selected position would block any players
export const selectBlockedPlayers = (state: RootState): Player[] => {
  const { board, currentTile, players, teams } = state.game;
  const { selectedPosition, currentRotation } = state.ui;

  if (!selectedPosition || currentTile === null) {
    return [];
  }

  const placedTile = {
    type: currentTile,
    rotation: currentRotation,
    position: selectedPosition,
  };

  const blockedPlayerIds = getBlockedPlayers(board, placedTile, players, teams);
  
  // Return the actual Player objects for the blocked players
  return players.filter(player => blockedPlayerIds.includes(player.id));
};
