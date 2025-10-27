// Gameplay input handling for Phase 4

import { store } from '../redux/store';
import { setRotation, setSelectedPosition } from '../redux/actions';
import { GameplayRenderer } from '../rendering/gameplayRenderer';
import { pixelToHex, isPointInHex, hexToPixel, getPlayerEdgePosition } from '../rendering/hexLayout';
import { Rotation } from '../game/types';
import { isValidPosition } from '../game/board';

export class GameplayInputHandler {
  private renderer: GameplayRenderer;

  constructor(renderer: GameplayRenderer) {
    this.renderer = renderer;
  }

  handleClick(canvasX: number, canvasY: number): void {
    const state = store.getState();
    
    // Check if we're in gameplay mode
    if (state.game.screen !== 'gameplay') return;
    if (!state.game.currentTile) return;

    const layout = this.renderer.getLayout();

    // Check if tile is already placed on board
    if (state.ui.selectedPosition) {
      // Check for checkmark/X button clicks
      // TODO: Implement action button hit detection
      
      // Check if clicking on the tile itself to rotate
      const tileCenter = hexToPixel(state.ui.selectedPosition, layout);
      
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
        // Exit button clicked
        // TODO: Show exit confirmation dialog
        console.log('Exit button clicked');
        return;
      }
    }
  }
}
