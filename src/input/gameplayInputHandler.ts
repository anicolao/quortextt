// Gameplay input handling for Phase 4

import { store } from '../redux/store';
import { setRotation, setSelectedPosition, placeTile, nextPlayer, drawTile, resetGame } from '../redux/actions';
import { GameplayRenderer } from '../rendering/gameplayRenderer';
import { pixelToHex, isPointInHex, hexToPixel, getPlayerEdgePosition } from '../rendering/hexLayout';
import { Rotation } from '../game/types';
import { isValidPosition } from '../game/board';
import { isLegalMove } from '../game/legality';

export class GameplayInputHandler {
  private renderer: GameplayRenderer;

  constructor(renderer: GameplayRenderer) {
    this.renderer = renderer;
  }

  handleClick(canvasX: number, canvasY: number): void {
    const state = store.getState();
    
    // Check if we're in gameplay mode
    if (state.game.screen !== 'gameplay') return;
    if (state.game.currentTile == null) return;

    const layout = this.renderer.getLayout();

    // Check if tile is already placed on board
    if (state.ui.selectedPosition) {
      // Check for checkmark button click (to the right of tile)
      const tileCenter = hexToPixel(state.ui.selectedPosition, layout);
      const buttonSize = layout.size * 0.8;
      const buttonSpacing = layout.size * 2;
      
      const checkPos = { x: tileCenter.x + buttonSpacing, y: tileCenter.y };
      const xPos = { x: tileCenter.x - buttonSpacing, y: tileCenter.y };
      
      // Check checkmark button
      const distToCheck = Math.sqrt(
        Math.pow(canvasX - checkPos.x, 2) + Math.pow(canvasY - checkPos.y, 2)
      );
      if (distToCheck < buttonSize / 2) {
        // Checkmark clicked - place the tile
        // Check if placement is legal first
        const placedTile = {
          type: state.game.currentTile,
          rotation: state.ui.currentRotation,
          position: state.ui.selectedPosition,
        };
        
        if (!isLegalMove(state.game.board, placedTile, state.game.players, state.game.teams)) {
          // Move is illegal - don't allow placement
          // The UI should already show the button as disabled
          return;
        }
        
        store.dispatch(placeTile(
          state.ui.selectedPosition,
          state.ui.currentRotation
        ));
        store.dispatch(setSelectedPosition(null));
        store.dispatch(setRotation(0));
        
        // Advance to next player and draw tile for them
        store.dispatch(nextPlayer());
        store.dispatch(drawTile());
        return;
      }
      
      // Check X button
      const distToX = Math.sqrt(
        Math.pow(canvasX - xPos.x, 2) + Math.pow(canvasY - xPos.y, 2)
      );
      if (distToX < buttonSize / 2) {
        // X clicked - cancel placement
        store.dispatch(setSelectedPosition(null));
        return;
      }
      
      // Check if clicking on the tile itself to rotate
      if (isPointInHex({ x: canvasX, y: canvasY }, tileCenter, layout.size)) {
        this.handleTileRotation(canvasX, tileCenter.x);
        return;
      }
    } else {
      // No tile placed - check if clicking on current tile preview to rotate
      const currentPlayer = state.game.players[state.game.currentPlayerIndex];
      if (currentPlayer) {
        const edgePos = getPlayerEdgePosition(currentPlayer.edgePosition, layout);
        
        if (isPointInHex({ x: canvasX, y: canvasY }, edgePos, layout.size)) {
          this.handleTileRotation(canvasX, edgePos.x);
          return;
        }
      }
    }

    // Check if clicking on a hex position to place tile
    const hexPos = pixelToHex({ x: canvasX, y: canvasY }, layout);
    
    // Verify this is a valid board position
    if (isValidPosition(hexPos)) {
      // Set the selected position
      store.dispatch(setSelectedPosition(hexPos));
      return;
    }

    // Check for exit button clicks in corners
    this.checkExitButtons(canvasX, canvasY, layout);
  }

  private handleTileRotation(clickX: number, tileCenterX: number): void {
    const state = store.getState();
    const currentRotation = state.ui.currentRotation;

    // Determine rotation direction based on which side was clicked
    let newRotation: Rotation;
    if (clickX < tileCenterX) {
      // Left side - rotate counter-clockwise
      newRotation = ((currentRotation + 5) % 6) as Rotation;
    } else {
      // Right side - rotate clockwise
      newRotation = ((currentRotation + 1) % 6) as Rotation;
    }

    store.dispatch(setRotation(newRotation));
  }

  private checkExitButtons(
    x: number,
    y: number,
    layout: { canvasWidth: number; canvasHeight: number }
  ): void {
    const cornerSize = 50;
    const margin = 10;

    const corners = [
      { x: margin, y: margin, width: cornerSize, height: cornerSize },
      {
        x: layout.canvasWidth - margin - cornerSize,
        y: margin,
        width: cornerSize,
        height: cornerSize,
      },
      {
        x: layout.canvasWidth - margin - cornerSize,
        y: layout.canvasHeight - margin - cornerSize,
        width: cornerSize,
        height: cornerSize,
      },
      {
        x: margin,
        y: layout.canvasHeight - margin - cornerSize,
        width: cornerSize,
        height: cornerSize,
      },
    ];

    for (const corner of corners) {
      if (
        x >= corner.x &&
        x <= corner.x + corner.width &&
        y >= corner.y &&
        y <= corner.y + corner.height
      ) {
        // Exit button clicked - reset game completely and return to lobby
        store.dispatch(resetGame());
        return;
      }
    }
  }
}
