// Gameplay input handling for Phase 4

import { store } from '../redux/store';
import { setRotation, setSelectedPosition, setHoveredElement, placeTile, replaceTile, nextPlayer, drawTile, resetGame, showHelp, hideHelp, showMoveList, hideMoveList, navigateMoveList } from '../redux/actions';
import { GameplayRenderer } from '../rendering/gameplayRenderer';
import { pixelToHex, isPointInHex, hexToPixel, getPlayerEdgePosition } from '../rendering/hexLayout';
import { Rotation } from '../game/types';
import { isValidPosition, positionToKey } from '../game/board';
import { isLegalMove, isValidReplacementMove } from '../game/legality';
import { HoveredElementType } from '../redux/types';

export class GameplayInputHandler {
  private renderer: GameplayRenderer;

  constructor(renderer: GameplayRenderer) {
    this.renderer = renderer;
  }

  handleClick(canvasX: number, canvasY: number): void {
    const state = store.getState();
    
    // If help dialog is open, close it on any click (use original coordinates)
    if (state.ui.showHelp) {
      store.dispatch(hideHelp());
      return;
    }

    // If move list dialog is open, check if clicking on a move or outside (use original coordinates)
    if (state.ui.showMoveList) {
      const moveClicked = this.checkMoveListItemClick(canvasX, canvasY);
      if (!moveClicked) {
        // Click outside move list or not on a move - close and return to present
        store.dispatch(hideMoveList());
      }
      return;
    }

    // Check if we're in gameplay mode
    if (state.game.screen !== 'gameplay') return;
    if (state.game.currentTile == null) return;

    const layout = this.renderer.getLayout();

    // Check for corner UI buttons first with UNTRANSFORMED coordinates
    // (these are in screen space, not board space)
    if (this.checkHelpButtons(canvasX, canvasY, layout)) {
      return;
    }

    if (this.checkMoveListButtons(canvasX, canvasY, layout)) {
      return;
    }

    // Check for exit button clicks in corners with UNTRANSFORMED coordinates
    this.checkExitButtons(canvasX, canvasY, layout);
    
    // After corner buttons, check if we already handled the click
    // (checkExitButtons dispatches resetGame which will change the state)
    const stateAfterExit = store.getState();
    if (stateAfterExit.game.screen !== 'gameplay') {
      return;
    }

    // Transform coordinates for board interactions ONLY
    const transformed = this.renderer.transformInputCoordinates(canvasX, canvasY, state);
    const x = transformed.x;
    const y = transformed.y;

    // Check if tile is already placed on board
    if (state.ui.selectedPosition) {
      // Check for button clicks when tile is placed on board
      const tileCenter = hexToPixel(state.ui.selectedPosition, layout);
      const buttonSize = layout.size * 0.8 * 1.5; // 1.5x larger radius to match visual size
      const buttonSpacing = layout.size * 2;
      const currentPlayer = state.game.players[state.game.currentPlayerIndex];
      const playerEdge = currentPlayer ? currentPlayer.edgePosition : 0;
      
      // Get oriented button positions (same as renderer)
      const buttonPositions = this.getOrientedButtonPositions(
        tileCenter,
        buttonSpacing,
        playerEdge
      );
      
      // Check checkmark button
      const distToCheck = Math.sqrt(
        Math.pow(x - buttonPositions.checkmark.x, 2) + 
        Math.pow(y - buttonPositions.checkmark.y, 2)
      );
      if (distToCheck < buttonSize / 2) {
        // Checkmark clicked - place or replace the tile
        const posKey = positionToKey(state.ui.selectedPosition);
        const isOccupied = state.game.board.has(posKey);
        
        // Check if this is a replacement move (for supermove)
        if (isOccupied && state.game.supermove && currentPlayer) {
          // Validate replacement move
          if (!isValidReplacementMove(
            state.game.board,
            state.ui.selectedPosition,
            state.game.currentTile,
            state.ui.currentRotation,
            currentPlayer,
            state.game.players,
            state.game.teams,
            state.game.boardRadius,
            state.game.supermoveAnyPlayer
          )) {
            // Replacement is not valid
            return;
          }
          
          // Check if this is a single supermove
          const isSingleSupermove = state.game.singleSupermove;
          
          // Perform replacement
          store.dispatch(replaceTile(
            state.ui.selectedPosition,
            state.ui.currentRotation,
            isSingleSupermove
          ));
          store.dispatch(setSelectedPosition(null));
          store.dispatch(setRotation(0));
          
          // If single supermove, advance to next player and draw a tile
          if (isSingleSupermove) {
            store.dispatch(nextPlayer());
            store.dispatch(drawTile());
          }
          // Otherwise, don't advance to next player - they get to place the replaced tile
          return;
        }
        
        // Normal placement (not a replacement)
        const placedTile = {
          type: state.game.currentTile,
          rotation: state.ui.currentRotation,
          position: state.ui.selectedPosition,
        };
        
        if (!isLegalMove(state.game.board, placedTile, state.game.players, state.game.teams, state.game.boardRadius, state.game.supermove)) {
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
        
        // Always advance to next player after placing a tile
        // (even when completing supermove)
        store.dispatch(nextPlayer());
        store.dispatch(drawTile());
        return;
      }
      
      // Check X button
      const distToX = Math.sqrt(
        Math.pow(x - buttonPositions.cancel.x, 2) + 
        Math.pow(y - buttonPositions.cancel.y, 2)
      );
      if (distToX < buttonSize / 2) {
        // X clicked - cancel placement
        store.dispatch(setSelectedPosition(null));
        return;
      }
      
      // Check rotation buttons
      const rotationButtonSize = buttonSize * 0.6 * 1.5; // 1.5x larger size to match visual size
      const distToRotateNE = Math.sqrt(
        Math.pow(x - buttonPositions.rotateNE.x, 2) + 
        Math.pow(y - buttonPositions.rotateNE.y, 2)
      );
      const distToRotateNW = Math.sqrt(
        Math.pow(x - buttonPositions.rotateNW.x, 2) + 
        Math.pow(y - buttonPositions.rotateNW.y, 2)
      );
      
      if (distToRotateNE < rotationButtonSize / 2) {
        // NE button: Rotate clockwise
        const currentRotation = state.ui.currentRotation;
        const newRotation = ((currentRotation + 1) % 6) as Rotation;
        store.dispatch(setRotation(newRotation));
        return;
      }
      
      if (distToRotateNW < rotationButtonSize / 2) {
        // NW button: Rotate counter-clockwise
        const currentRotation = state.ui.currentRotation;
        const newRotation = ((currentRotation + 5) % 6) as Rotation;
        store.dispatch(setRotation(newRotation));
        return;
      }
      
      // Check if clicking on the tile itself to rotate (preserve existing functionality)
      if (isPointInHex({ x: x, y: y }, tileCenter, layout.size)) {
        this.handleTileRotation(x, y, tileCenter.x, tileCenter.y, playerEdge);
        return;
      }
    } else {
      // No tile placed - check if clicking on current tile preview to rotate
      const currentPlayer = state.game.players[state.game.currentPlayerIndex];
      if (currentPlayer) {
        const edgePos = getPlayerEdgePosition(currentPlayer.edgePosition, layout, state.game.boardRadius);
        
        if (isPointInHex({ x: x, y: y }, edgePos, layout.size)) {
          this.handleTileRotation(x, y, edgePos.x, edgePos.y, currentPlayer.edgePosition);
          return;
        }
      }
    }

    // Check if clicking on a hex position to place tile
    const hexPos = pixelToHex({ x: x, y: y }, layout);
    
    // Verify this is a valid board position
    if (isValidPosition(hexPos, state.game.boardRadius)) {
      const posKey = positionToKey(hexPos);
      const isOccupied = state.game.board.has(posKey);
      
      // Allow selecting occupied positions only if supermove is enabled and player is blocked
      if (isOccupied && !state.game.supermove) {
        // Can't select occupied positions in standard mode
        return;
      }
      
      // Set the selected position
      store.dispatch(setSelectedPosition(hexPos));
      return;
    }
  }

  // Calculate button positions oriented toward the player's edge
  // This matches the same calculation in gameplayRenderer.ts
  private getOrientedButtonPositions(
    tileCenter: { x: number; y: number },
    spacing: number,
    playerEdge: number,
  ): {
    checkmark: { x: number; y: number };
    cancel: { x: number; y: number };
    rotateNE: { x: number; y: number };
    rotateNW: { x: number; y: number };
  } {
    // Map edge positions to rotation angles (in degrees)
    const edgeAngles = [0, 60, 120, 180, 240, 300];
    const rotationAngle = edgeAngles[playerEdge];
    const rotationRad = (rotationAngle * Math.PI) / 180;

    // Define button positions relative to tile center for edge 0 (bottom player)
    const rotationButtonDistance = spacing * 0.75;
    const basePositions = {
      checkmark: { x: spacing, y: 0 },
      cancel: { x: -spacing, y: 0 },
      // Rotation buttons at NE (60°) and NW (120°) positions
      // Use direct angle calculation instead of getEdgeMidpointRelative
      rotateNE: { 
        x: rotationButtonDistance * Math.cos(60 * Math.PI / 180), 
        y: rotationButtonDistance * Math.sin(60 * Math.PI / 180) 
      },
      rotateNW: { 
        x: rotationButtonDistance * Math.cos(120 * Math.PI / 180), 
        y: rotationButtonDistance * Math.sin(120 * Math.PI / 180) 
      },
    };

    // Rotate each position and translate to tile center
    const rotatePoint = (p: { x: number; y: number }): { x: number; y: number } => {
      const cos = Math.cos(rotationRad);
      const sin = Math.sin(rotationRad);
      return {
        x: tileCenter.x + (p.x * cos - p.y * sin),
        y: tileCenter.y + (p.x * sin + p.y * cos),
      };
    };

    return {
      checkmark: rotatePoint(basePositions.checkmark),
      cancel: rotatePoint(basePositions.cancel),
      rotateNE: rotatePoint(basePositions.rotateNE),
      rotateNW: rotatePoint(basePositions.rotateNW),
    };
  }

  private handleTileRotation(clickX: number, clickY: number, tileCenterX: number, tileCenterY: number, playerEdge: number): void {
    const state = store.getState();
    const currentRotation = state.ui.currentRotation;
    const layout = this.renderer.getLayout();

    // Get the apex of the hexagon (the vertex pointing toward the player)
    // Map edge positions to the vertex index that points toward that edge
    // getPlayerEdgePosition uses screen coordinates (0°=right, 90°=down, 180°=left, 270°=up)
    // getHexVertex uses math coordinates (0°=right, 90°=up, 180°=left, 270°=down)
    // Edge angles in screen coords: [270°, 330°, 30°, 90°, 150°, 210°]
    // Reversed vertex mapping based on user feedback (bottom/top were correct, sides needed reversal)
    const edgeToApexVertex = [3, 4, 5, 0, 1, 2]; // Maps player edge to apex vertex
    const apexVertexIndex = edgeToApexVertex[playerEdge];
    
    // Get apex position in pixel coordinates
    const tileCenter = { x: tileCenterX, y: tileCenterY };
    const apex = this.getHexVertex(tileCenter, layout.size, apexVertexIndex);

    // Calculate vectors from apex to click location and from apex to center
    const apexToClick = {
      x: clickX - apex.x,
      y: clickY - apex.y,
    };
    const apexToCenter = {
      x: tileCenterX - apex.x,
      y: tileCenterY - apex.y,
    };

    // Calculate 2D cross product (z component of 3D cross product)
    // Cross product = apexToClick.x * apexToCenter.y - apexToClick.y * apexToCenter.x
    const crossProduct = apexToClick.x * apexToCenter.y - apexToClick.y * apexToCenter.x;

    // Apply right-hand rule: positive = counter-clockwise, negative = clockwise
    let newRotation: Rotation;
    if (crossProduct > 0) {
      // Counter-clockwise
      newRotation = ((currentRotation + 5) % 6) as Rotation;
    } else {
      // Clockwise
      newRotation = ((currentRotation + 1) % 6) as Rotation;
    }

    store.dispatch(setRotation(newRotation));
  }

  // Helper to get hex vertex position
  private getHexVertex(center: { x: number; y: number }, size: number, vertex: number): { x: number; y: number } {
    const angleDeg = 60 * vertex - 30; // Offset by -30 for pointy-top
    const angleRad = (Math.PI / 180) * angleDeg;
    return {
      x: center.x + size * Math.cos(angleRad),
      y: center.y + size * Math.sin(angleRad),
    };
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
        const state = store.getState();
        
        // Check if in multiplayer mode and spectating
        if (state.ui.gameMode === 'multiplayer' && state.ui.isSpectator) {
          // Spectator: dispatch custom event for multiplayer layer to handle
          window.dispatchEvent(new CustomEvent('multiplayer:spectator-exit'));
        } else {
          // Player or tabletop: reset game and return to setup
          store.dispatch(resetGame());
        }
        return;
      }
    }
  }

  private checkHelpButtons(
    x: number,
    y: number,
    layout: { canvasWidth: number; canvasHeight: number }
  ): boolean {
    const cornerSize = 50;
    const margin = 10;
    const spacing = cornerSize * 0.15;

    const helpButtons = [
      { 
        // Edge 0 (bottom): bottom-left, next to exit
        centerX: margin + cornerSize / 2 + cornerSize + spacing, 
        centerY: layout.canvasHeight - margin - cornerSize / 2,
        corner: 0,
      },
      {
        // Edge 1 (right): bottom-right, next to exit
        centerX: layout.canvasWidth - margin - cornerSize / 2,
        centerY: layout.canvasHeight - margin - cornerSize / 2 - cornerSize - spacing,
        corner: 1,
      },
      {
        // Edge 2 (top): top-right, next to exit
        centerX: layout.canvasWidth - margin - cornerSize / 2 - cornerSize - spacing,
        centerY: margin + cornerSize / 2,
        corner: 2,
      },
      {
        // Edge 3 (left): top-left, next to exit
        centerX: margin + cornerSize / 2,
        centerY: margin + cornerSize / 2 + cornerSize + spacing,
        corner: 3,
      },
    ];

    const radius = cornerSize / 2;

    for (const button of helpButtons) {
      const dist = Math.sqrt(
        Math.pow(x - button.centerX, 2) + Math.pow(y - button.centerY, 2)
      );
      if (dist <= radius) {
        // Help button clicked
        store.dispatch(showHelp(button.corner as 0 | 1 | 2 | 3));
        return true;
      }
    }

    return false;
  }

  handleMouseMove(canvasX: number, canvasY: number): void {
    const state = store.getState();
    
    // Only track hover if debug mode is enabled
    if (!state.ui.settings.debugHitTest) {
      store.dispatch(setHoveredElement(null));
      return;
    }

    // If move list is open, check for move list item hover (use original coordinates)
    if (state.ui.showMoveList) {
      const moveListHover = this.checkMoveListItemHover(canvasX, canvasY);
      store.dispatch(setHoveredElement(moveListHover));
      return;
    }

    // Check if we're in gameplay mode
    if (state.game.screen !== 'gameplay') return;
    if (state.game.currentTile == null) return;

    const layout = this.renderer.getLayout();
    let hoveredElement: HoveredElementType = null;

    // Check for exit button hovers first with UNTRANSFORMED coordinates
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
        canvasX >= corner.x &&
        canvasX <= corner.x + corner.width &&
        canvasY >= corner.y &&
        canvasY <= corner.y + corner.height
      ) {
        hoveredElement = {
          type: 'exit-button',
          x: corner.x,
          y: corner.y,
          width: corner.width,
          height: corner.height,
        };
        break;
      }
    }

    // If hovering over exit button, we're done
    if (hoveredElement) {
      store.dispatch(setHoveredElement(hoveredElement));
      return;
    }

    // Transform coordinates for board interactions ONLY
    const transformed = this.renderer.transformInputCoordinates(canvasX, canvasY, state);
    const x = transformed.x;
    const y = transformed.y;

    // Check if tile is already placed on board
    if (state.ui.selectedPosition) {
      // Check for button hovers when tile is placed on board
      const tileCenter = hexToPixel(state.ui.selectedPosition, layout);
      const buttonSize = layout.size * 0.8 * 1.5; // 1.5x larger radius to match visual size
      const buttonSpacing = layout.size * 2;
      const currentPlayer = state.game.players[state.game.currentPlayerIndex];
      const playerEdge = currentPlayer ? currentPlayer.edgePosition : 0;
      
      // Get oriented button positions
      const buttonPositions = this.getOrientedButtonPositions(
        tileCenter,
        buttonSpacing,
        playerEdge
      );
      
      // Check rotation buttons first (smaller)
      const rotationButtonSize = buttonSize * 0.6 * 1.5; // 1.5x larger size to match visual size
      const distToRotateNE = Math.sqrt(
        Math.pow(x - buttonPositions.rotateNE.x, 2) + 
        Math.pow(y - buttonPositions.rotateNE.y, 2)
      );
      const distToRotateNW = Math.sqrt(
        Math.pow(x - buttonPositions.rotateNW.x, 2) + 
        Math.pow(y - buttonPositions.rotateNW.y, 2)
      );
      
      if (distToRotateNE < rotationButtonSize / 2) {
        hoveredElement = {
          type: 'rotation-button',
          position: buttonPositions.rotateNE,
          radius: rotationButtonSize / 2,
          clockwise: true,
        };
      } else if (distToRotateNW < rotationButtonSize / 2) {
        hoveredElement = {
          type: 'rotation-button',
          position: buttonPositions.rotateNW,
          radius: rotationButtonSize / 2,
          clockwise: false,
        };
      } else {
        // Check checkmark button
        const distToCheck = Math.sqrt(
          Math.pow(x - buttonPositions.checkmark.x, 2) + 
          Math.pow(y - buttonPositions.checkmark.y, 2)
        );
        if (distToCheck < buttonSize / 2) {
          hoveredElement = {
            type: 'action-button',
            position: buttonPositions.checkmark,
            radius: buttonSize / 2,
            action: 'checkmark',
          };
        } else {
          // Check X button
          const distToX = Math.sqrt(
            Math.pow(x - buttonPositions.cancel.x, 2) + 
            Math.pow(y - buttonPositions.cancel.y, 2)
          );
          if (distToX < buttonSize / 2) {
            hoveredElement = {
              type: 'action-button',
              position: buttonPositions.cancel,
              radius: buttonSize / 2,
              action: 'cancel',
            };
          }
        }
      }
    }

    // If not hovering over a button, check if hovering over a hex position
    if (!hoveredElement) {
      const hexPos = pixelToHex({ x: x, y: y }, layout);
      
      // Verify this is a valid board position
      if (isValidPosition(hexPos, state.game.boardRadius)) {
        hoveredElement = {
          type: 'hexagon',
          position: hexPos,
        };
      }
    }

    store.dispatch(setHoveredElement(hoveredElement));
  }

  private checkMoveListButtons(
    x: number,
    y: number,
    layout: { canvasWidth: number; canvasHeight: number }
  ): boolean {
    const cornerSize = 50;
    const margin = 10;
    const spacing = cornerSize * 0.15;
    const doubleSpacing = 2 * (cornerSize + spacing);

    const moveListButtons = [
      { 
        // Edge 0 (bottom): positioned after exit and help buttons
        centerX: margin + cornerSize / 2 + doubleSpacing, 
        centerY: layout.canvasHeight - margin - cornerSize / 2,
        corner: 0,
      },
      {
        // Edge 1 (right): positioned after exit and help buttons
        centerX: layout.canvasWidth - margin - cornerSize / 2,
        centerY: layout.canvasHeight - margin - cornerSize / 2 - doubleSpacing,
        corner: 1,
      },
      {
        // Edge 2 (top): positioned after exit and help buttons
        centerX: layout.canvasWidth - margin - cornerSize / 2 - doubleSpacing,
        centerY: margin + cornerSize / 2,
        corner: 2,
      },
      {
        // Edge 3 (left): positioned after exit and help buttons
        centerX: margin + cornerSize / 2,
        centerY: margin + cornerSize / 2 + doubleSpacing,
        corner: 3,
      },
    ];

    const radius = cornerSize / 2;

    for (const button of moveListButtons) {
      const dist = Math.sqrt(
        Math.pow(x - button.centerX, 2) + Math.pow(y - button.centerY, 2)
      );
      if (dist <= radius) {
        // Move list button clicked
        store.dispatch(showMoveList(button.corner as 0 | 1 | 2 | 3));
        return true;
      }
    }

    return false;
  }

  private checkMoveListItemClick(canvasX: number, canvasY: number): boolean {
    const state = store.getState();
    const layout = this.renderer.getLayout();
    
    if (state.ui.moveListCorner === null) return false;
    
    const corner = state.ui.moveListCorner;
    
    // Calculate rotation based on corner
    let rotation = 0;
    if (corner === 1) rotation = 270;
    else if (corner === 2) rotation = 180;
    else if (corner === 3) rotation = 90;
    
    // Transform click coordinates to rotated space
    const centerX = layout.canvasWidth / 2;
    const centerY = layout.canvasHeight / 2;
    
    // Translate to origin
    let x = canvasX - centerX;
    let y = canvasY - centerY;
    
    // Rotate back to match how dialog is drawn
    const rad = -(rotation * Math.PI / 180);
    const rotatedX = x * Math.cos(rad) - y * Math.sin(rad);
    const rotatedY = x * Math.sin(rad) + y * Math.cos(rad);
    
    // Now rotatedX and rotatedY are in the rotated coordinate space (origin at center)
    // Dialog bounds are also in this space
    
    // Calculate dialog dimensions in rotated space
    const rotatedWidth = (rotation === 90 || rotation === 270) ? layout.canvasHeight : layout.canvasWidth;
    const rotatedHeight = (rotation === 90 || rotation === 270) ? layout.canvasWidth : layout.canvasHeight;
    const dialogWidth = Math.min(300, rotatedWidth * 0.5);
    const dialogHeight = Math.min(350, rotatedHeight * 0.4); // Match rendering
    const margin = 20;
    
    const dialogX = -rotatedWidth / 2 + margin;
    const dialogY = rotatedHeight / 2 - dialogHeight - margin;
    
    // Check if click is inside dialog (both in rotated space)
    if (rotatedX < dialogX || rotatedX > dialogX + dialogWidth || rotatedY < dialogY || rotatedY > dialogY + dialogHeight) {
      return false; // Click outside dialog
    }
    
    // Check for navigation buttons at bottom
    const buttonY = dialogY + dialogHeight - 55;
    const buttonHeight = 30;
    if (rotatedY >= buttonY && rotatedY <= buttonY + buttonHeight) {
      const buttonWidth = 40;
      const buttonSpacing = 10;
      const totalWidth = 4 * buttonWidth + 3 * buttonSpacing;
      const buttonsX = dialogX + dialogWidth / 2 - totalWidth / 2;
      
      // Check which button was clicked
      if (rotatedX >= buttonsX && rotatedX < buttonsX + buttonWidth) {
        store.dispatch(navigateMoveList('first'));
        return true;
      } else if (rotatedX >= buttonsX + buttonWidth + buttonSpacing && rotatedX < buttonsX + 2 * buttonWidth + buttonSpacing) {
        store.dispatch(navigateMoveList('prev'));
        return true;
      } else if (rotatedX >= buttonsX + 2 * (buttonWidth + buttonSpacing) && rotatedX < buttonsX + 3 * buttonWidth + 2 * buttonSpacing) {
        store.dispatch(navigateMoveList('next'));
        return true;
      } else if (rotatedX >= buttonsX + 3 * (buttonWidth + buttonSpacing) && rotatedX < buttonsX + 4 * buttonWidth + 3 * buttonSpacing) {
        store.dispatch(navigateMoveList('last'));
        return true;
      }
    }
    
    // Calculate move list area
    const controlsY = dialogY + 60;
    const controlsHeight = 40;
    const contentY = controlsY + controlsHeight + 10;
    const lineHeight = 44; // Match rendering: increased to prevent overlap
    const bottomMargin = 85; // Increased to accommodate navigation buttons
    const maxLines = Math.floor((dialogHeight - (contentY - dialogY) - bottomMargin) / lineHeight);
    
    const moves = state.game.moveHistory;
    const currentMoveIndex = state.ui.moveListIndex === -1 ? moves.length : state.ui.moveListIndex;
    
    // Center the current move in the view when possible (match rendering logic)
    let startIndex = currentMoveIndex - Math.floor(maxLines / 2);
    startIndex = Math.max(0, Math.min(startIndex, moves.length - maxLines));
    
    // Check which move line was clicked
    // Each line is lineHeight pixels tall, starting from contentY
    const endY = contentY + Math.min(moves.length - startIndex, maxLines) * lineHeight;
    if (rotatedY >= contentY && rotatedY < endY) {
      const clickedIndex = Math.floor((rotatedY - contentY) / lineHeight);
      const moveNumber = startIndex + clickedIndex + 1;
      
      if (moveNumber >= 1 && moveNumber <= moves.length) {
        // Navigate to this move
        if (moveNumber === moves.length) {
          store.dispatch(navigateMoveList('last'));
        } else {
          // Set to specific move by dispatching a single action with the target index
          store.dispatch(navigateMoveList('first'));
          for (let i = 0; i < moveNumber - 1; i++) {
            store.dispatch(navigateMoveList('next'));
          }
        }
        return true;
      }
    }
    
    return true; // Click inside dialog but not on a move
  }

  private checkMoveListItemHover(canvasX: number, canvasY: number): HoveredElementType {
    const state = store.getState();
    const layout = this.renderer.getLayout();
    
    if (state.ui.moveListCorner === null) return null;
    
    const corner = state.ui.moveListCorner;
    
    // Calculate rotation based on corner
    let rotation = 0;
    if (corner === 1) rotation = 270;
    else if (corner === 2) rotation = 180;
    else if (corner === 3) rotation = 90;
    
    // Transform click coordinates to rotated space
    const centerX = layout.canvasWidth / 2;
    const centerY = layout.canvasHeight / 2;
    
    // Translate to origin
    let x = canvasX - centerX;
    let y = canvasY - centerY;
    
    // Rotate back to match how dialog is drawn
    const rad = -(rotation * Math.PI / 180);
    const rotatedX = x * Math.cos(rad) - y * Math.sin(rad);
    const rotatedY = x * Math.sin(rad) + y * Math.cos(rad);
    
    // Now rotatedX and rotatedY are in the rotated coordinate space (origin at center)
    // Dialog bounds are also in this space
    
    // Calculate dialog dimensions in rotated space
    const rotatedWidth = (rotation === 90 || rotation === 270) ? layout.canvasHeight : layout.canvasWidth;
    const rotatedHeight = (rotation === 90 || rotation === 270) ? layout.canvasWidth : layout.canvasHeight;
    const dialogWidth = Math.min(300, rotatedWidth * 0.5);
    const dialogHeight = Math.min(350, rotatedHeight * 0.4);
    const margin = 20;
    const contentX = 20; // Match click detection
    
    const dialogX = -rotatedWidth / 2 + margin;
    const dialogY = rotatedHeight / 2 - dialogHeight - margin;
    
    // Check if hover is inside dialog (both in rotated space)
    if (rotatedX < dialogX || rotatedX > dialogX + dialogWidth || rotatedY < dialogY || rotatedY > dialogY + dialogHeight) {
      return null;
    }
    
    // Calculate move list area
    const controlsY = dialogY + 60;
    const controlsHeight = 40;
    const contentY = controlsY + controlsHeight + 10;
    const lineHeight = 44; // Match click detection and rendering
    const bottomMargin = 85; // Match click detection
    const maxLines = Math.floor((dialogHeight - (contentY - dialogY) - bottomMargin) / lineHeight);
    
    const moves = state.game.moveHistory;
    const currentMoveIndex = state.ui.moveListIndex === -1 ? moves.length : state.ui.moveListIndex;
    
    // Center the current move in the view when possible (match rendering logic)
    let startIndex = currentMoveIndex - Math.floor(maxLines / 2);
    startIndex = Math.max(0, Math.min(startIndex, moves.length - maxLines));
    
    // Check which move line is being hovered
    const endY = contentY + Math.min(moves.length - startIndex, maxLines) * lineHeight;
    if (rotatedY >= contentY && rotatedY < endY) {
      const hoveredIndex = Math.floor((rotatedY - contentY) / lineHeight);
      const moveNumber = startIndex + hoveredIndex + 1;
      
      if (moveNumber >= 1 && moveNumber <= moves.length) {
        return {
          type: 'move-list-item',
          moveNumber: moveNumber,
          bounds: {
            x: dialogX + contentX - 5,
            y: contentY + hoveredIndex * lineHeight + 2, // Match highlight position
            width: dialogWidth - 40,
            height: lineHeight - 4, // Match highlight height
          },
        };
      }
    }
    
    return null;
  }
}
