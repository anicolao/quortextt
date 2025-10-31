// Seating phase renderer

import { GameState, ConfigPlayer } from '../redux/types';
import { calculateHexLayout, HexLayout, Point } from './hexLayout';

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

  render(canvasWidth: number, canvasHeight: number, state: GameState): SeatingLayout {
    const hexLayout = calculateHexLayout(canvasWidth, canvasHeight);
    
    // Calculate edge button positions
    const edgeButtons = this.calculateEdgeButtons(hexLayout, state.seatingPhase.availableEdges);
    
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
    this.drawBoard(hexLayout);
    
    // Draw selected edge borders
    this.drawSelectedEdges(hexLayout, selectedEdges);
    
    // Draw edge buttons for available edges
    if (state.seatingPhase.active && state.seatingPhase.seatingIndex < state.seatingPhase.seatingOrder.length) {
      const currentPlayerId = state.seatingPhase.seatingOrder[state.seatingPhase.seatingIndex];
      const currentPlayer = state.configPlayers.find(cp => cp.id === currentPlayerId);
      if (currentPlayer) {
        this.drawEdgeButtons(edgeButtons, currentPlayer, state.seatingPhase.seatingIndex + 1);
      }
    }

    return this.layout;
  }

  getLayout(): SeatingLayout | null {
    return this.layout;
  }

  private calculateEdgeButtons(hexLayout: HexLayout, availableEdges: number[]): EdgeButton[] {
    const buttons: EdgeButton[] = [];
    const boardRadius = hexLayout.size * 3.5; // Distance from center to edge buttons
    const buttonRadius = 25; // Button size (half of original 50px)
    
    // Edge midpoint angles for pointy-top hexagon (centered on each edge, not corners)
    // Edge 0: NorthWest (180°)
    // Edge 1: West (240°)
    // Edge 2: SouthWest (300°)
    // Edge 3: SouthEast (0°/360°)
    // Edge 4: East (60°)
    // Edge 5: NorthEast (120°)
    const edgeAngles = [180, 240, 300, 0, 60, 120];
    
    // Text rotation to make numbers upright when viewed from that edge
    // For a player sitting at edge angle θ looking at the center, rotate text by -θ
    const textRotations = [-180, -240, -300, 0, -60, -120];
    
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

  private drawBoard(hexLayout: HexLayout): void {
    // Draw a large black hexagon representing the board
    this.ctx.save();
    
    const centerX = hexLayout.origin.x;
    const centerY = hexLayout.origin.y;
    const size = hexLayout.size * 3;
    
    this.ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6; // Start from top vertex
      const x = centerX + size * Math.cos(angle);
      const y = centerY + size * Math.sin(angle);
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.closePath();
    
    this.ctx.fillStyle = '#000000';
    this.ctx.fill();
    
    this.ctx.strokeStyle = '#333333';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    
    this.ctx.restore();
  }

  private drawSelectedEdges(hexLayout: HexLayout, selectedEdges: Map<number, string>): void {
    // Draw colored borders for edges that have been selected
    const centerX = hexLayout.origin.x;
    const centerY = hexLayout.origin.y;
    const size = hexLayout.size * 3;
    
    selectedEdges.forEach((color, edge) => {
      this.ctx.save();
      
      // Calculate the two vertices for this edge
      // Edges are numbered 0-5, starting from NorthWest edge
      // For pointy-top hexagon, edges correspond to pairs of vertices
      const edgeVertexPairs = [
        [5, 0], // Edge 0: NorthWest
        [4, 5], // Edge 1: West
        [3, 4], // Edge 2: SouthWest
        [2, 3], // Edge 3: SouthEast
        [1, 2], // Edge 4: East
        [0, 1], // Edge 5: NorthEast
      ];
      
      const [v1, v2] = edgeVertexPairs[edge];
      
      const angle1 = (Math.PI / 3) * v1 - Math.PI / 6;
      const angle2 = (Math.PI / 3) * v2 - Math.PI / 6;
      
      const x1 = centerX + size * Math.cos(angle1);
      const y1 = centerY + size * Math.sin(angle1);
      const x2 = centerX + size * Math.cos(angle2);
      const y2 = centerY + size * Math.sin(angle2);
      
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 8;
      this.ctx.lineCap = 'round';
      this.ctx.stroke();
      
      this.ctx.restore();
    });
  }

  private drawEdgeButtons(buttons: EdgeButton[], currentPlayer: ConfigPlayer, playerNumber: number): void {
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
      this.ctx.restore();
    });
  }
}
