// Seating phase renderer

import { GameState, ConfigPlayer } from '../redux/types';
import { calculateHexLayout, HexLayout, Point, calculateBoardRadiusMultiplier } from './hexLayout';

// Edge button information for seating phase
export interface EdgeButton {
  edge: number;           // 0-5
  position: Point;        // Screen position
  rotation: number;       // Rotation in degrees
  radius: number;         // Button radius
}

// Seating layout information
export interface SeatingLayout {
  edgeButtons: EdgeButton[];
  hexLayout: HexLayout;
  selectedEdges: Map<number, string>; // edge -> player color
}

export class SeatingRenderer {
  private ctx: CanvasRenderingContext2D;
  private layout: SeatingLayout | null = null;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  render(canvasWidth: number, canvasHeight: number, state: GameState, disconnectedPlayers: Set<string>): SeatingLayout {
    const hexLayout = calculateHexLayout(canvasWidth, canvasHeight, state.boardRadius);
    
    // Calculate edge button positions
    const edgeButtons = this.calculateEdgeButtons(hexLayout, state.seatingPhase.availableEdges, state.boardRadius);
    
    // Get selected edges with player colors
    const selectedEdges = new Map<number, string>();
    state.seatingPhase.edgeAssignments.forEach((edge, playerId) => {
      const configPlayer = state.configPlayers.find(cp => cp.id === playerId);
      if (configPlayer) {
        selectedEdges.set(edge, configPlayer.color);
      }
    });
    
    this.layout = {
      edgeButtons,
      hexLayout,
      selectedEdges,
    };

    // Clear canvas
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw the central hexagon board
    this.drawBoard(hexLayout, state.boardRadius);
    
    // Draw selected edge borders
    this.drawSelectedEdges(hexLayout, selectedEdges, state.boardRadius);
    
    // Draw edge buttons for available edges
    if (state.seatingPhase.active && state.seatingPhase.seatingIndex < state.seatingPhase.seatingOrder.length) {
      const currentPlayerId = state.seatingPhase.seatingOrder[state.seatingPhase.seatingIndex];
      const currentPlayer = state.configPlayers.find(cp => cp.id === currentPlayerId);
      if (currentPlayer) {
        const isDisconnected = disconnectedPlayers.has(currentPlayerId);
        console.log('🪑 [SEATING] Drawing edge buttons - Player:', currentPlayerId, 'Disconnected:', isDisconnected, 'All disconnected:', Array.from(disconnectedPlayers));
        this.drawEdgeButtons(edgeButtons, currentPlayer, state.seatingPhase.seatingIndex + 1, isDisconnected);
      }
    }

    return this.layout;
  }

  getLayout(): SeatingLayout | null {
    return this.layout;
  }

  private calculateEdgeButtons(hexLayout: HexLayout, availableEdges: number[], boardSizeRadius: number): EdgeButton[] {
    const buttons: EdgeButton[] = [];
    const boardRadius = hexLayout.size * calculateBoardRadiusMultiplier(boardSizeRadius) + hexLayout.size * 0.8; // Board radius plus offset for buttons
    const buttonRadius = 25; // Button size (half of original 50px)
    
    // Edge midpoint angles for flat-topped hexagon
    // Matches Direction enum and GameplayRenderer's edge mapping:
    // Edge 0: Bottom (270°)
    // Edge 1: Bottom-right (330°)
    // Edge 2: Top-right (30°)
    // Edge 3: Top (90°)
    // Edge 4: Top-left (150°)
    // Edge 5: Bottom-left (210°)
    const edgeAngles = [270, 330, 30, 90, 150, 210];

    // Text rotation to make numbers upright when viewed from that edge
    // For edge pointing outward at angle θ, rotate text 90° clockwise: θ + 90°
    const textRotations = edgeAngles.map((angle) => (angle + 90) % 360);
    
    for (const edge of availableEdges) {
      const angle = edgeAngles[edge];
      const angleRad = (angle * Math.PI) / 180;
      
      const position: Point = {
        x: hexLayout.origin.x + boardRadius * Math.cos(angleRad),
        y: hexLayout.origin.y + boardRadius * Math.sin(angleRad),
      };
      
      buttons.push({
        edge,
        position,
        rotation: textRotations[edge],
        radius: buttonRadius,
      });
    }
    
    return buttons;
  }

  private drawBoard(hexLayout: HexLayout, boardSizeRadius: number): void {
    // Draw the actual game board (flat-topped hexagon matching GameplayRenderer)
    this.ctx.save();
    
    const center = hexLayout.origin;
    const boardRadius = hexLayout.size * calculateBoardRadiusMultiplier(boardSizeRadius);
    
    // Draw board as a large hexagon with flat-top orientation
    this.ctx.fillStyle = '#000000';
    this.ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i; // Flat-topped hexagon - vertices at 0°, 60°, 120°, 180°, 240°, 300°
      const x = center.x + boardRadius * Math.cos(angle);
      const y = center.y + boardRadius * Math.sin(angle);
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.closePath();
    this.ctx.fill();
    
    this.ctx.restore();
  }

  private drawSelectedEdges(hexLayout: HexLayout, selectedEdges: Map<number, string>, boardSizeRadius: number): void {
    // Draw colored borders for edges that have been selected (matching GameplayRenderer)
    const centerX = hexLayout.origin.x;
    const centerY = hexLayout.origin.y;
    const boardRadius = hexLayout.size * calculateBoardRadiusMultiplier(boardSizeRadius);
    
    selectedEdges.forEach((color, edge) => {
      this.ctx.save();
      
      // Calculate the two vertices for this edge
      // Matches GameplayRenderer's edge mapping for flat-topped hexagon
      // Vertices are at 0°, 60°, 120°, 180°, 240°, 300° (indices 0-5)
      // Edge 0: Bottom (270°) - between vertices 4 and 5
      // Edge 1: Bottom-right (330°) - between vertices 5 and 0
      // Edge 2: Top-right (30°) - between vertices 0 and 1
      // Edge 3: Top (90°) - between vertices 1 and 2
      // Edge 4: Top-left (150°) - between vertices 2 and 3
      // Edge 5: Bottom-left (210°) - between vertices 3 and 4
      const edgeVertexPairs = [
        [4, 5], // Edge 0: Bottom
        [5, 0], // Edge 1: Bottom-right
        [0, 1], // Edge 2: Top-right
        [1, 2], // Edge 3: Top
        [2, 3], // Edge 4: Top-left
        [3, 4], // Edge 5: Bottom-left
      ];
      
      const [v1, v2] = edgeVertexPairs[edge];
      
      const angle1 = (Math.PI / 3) * v1;
      const angle2 = (Math.PI / 3) * v2;
      
      const x1 = centerX + boardRadius * Math.cos(angle1);
      const y1 = centerY + boardRadius * Math.sin(angle1);
      const x2 = centerX + boardRadius * Math.cos(angle2);
      const y2 = centerY + boardRadius * Math.sin(angle2);
      
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = hexLayout.size * 0.3; // Match GameplayRenderer's edge thickness
      this.ctx.lineCap = 'round';
      this.ctx.stroke();
      
      this.ctx.restore();
    });
  }

  private drawEdgeButtons(buttons: EdgeButton[], currentPlayer: ConfigPlayer, playerNumber: number, isDisconnected: boolean): void {
    buttons.forEach(button => {
      this.ctx.save();
      
      // Draw circular button background
      this.ctx.fillStyle = currentPlayer.color;
      this.ctx.beginPath();
      this.ctx.arc(button.position.x, button.position.y, button.radius, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Draw border
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      
      // Draw player number
      this.ctx.save();
      this.ctx.translate(button.position.x, button.position.y);
      this.ctx.rotate((button.rotation * Math.PI) / 180);
      
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 18px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(playerNumber.toString(), 0, 0);
      
      this.ctx.restore();
      
      // If player is disconnected, draw a red dot indicator
      if (isDisconnected) {
        console.log('🔴 [SEATING] Drawing red dot on edge button');
        this.ctx.fillStyle = '#FF0000';
        this.ctx.shadowBlur = 6;
        this.ctx.shadowColor = '#FF0000';
        this.ctx.beginPath();
        this.ctx.arc(button.position.x + button.radius * 0.6, button.position.y - button.radius * 0.6, button.radius * 0.3, 0, Math.PI * 2);
        this.ctx.fill();
      }
      
      this.ctx.restore();
    });
  }
}
