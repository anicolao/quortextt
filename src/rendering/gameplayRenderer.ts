// Gameplay screen renderer for Phase 3

import { RootState } from "../redux/types";
import {
  HexLayout,
  Point,
  calculateHexLayout,
  hexToPixel,
  getHexVertices,
  getEdgeMidpoint,
  getPerpendicularVector,
  getPlayerEdgePosition,
} from "./hexLayout";
import {
  getAllBoardPositions,
  getEdgePositionsWithDirections,
  getOppositeEdge,
  getOppositeDirection,
} from "../game/board";
import { TileType, PlacedTile } from "../game/types";
import { getFlowConnections } from "../game/tiles";

// UI Colors from design spec
const CANVAS_BG = "#e8e8e8"; // Light gray "table"
const BOARD_HEX_BG = "#000000"; // Black
const TILE_BG = "#2a2a2a"; // Dark gray
const TILE_BORDER = "#444444"; // Slightly lighter gray
const BUTTON_ICON = "#ffffff"; // White

// Debug configuration
const DEBUG_SHOW_EDGE_LABELS = false; // Show edge direction labels (0-5) on each hexagon
const DEBUG_SHOW_VICTORY_EDGES = true; // Highlight victory condition edges for each player

export class GameplayRenderer {
  private ctx: CanvasRenderingContext2D;
  private layout: HexLayout;

  constructor(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
  ) {
    this.ctx = ctx;
    this.layout = calculateHexLayout(canvasWidth, canvasHeight);
  }

  updateLayout(canvasWidth: number, canvasHeight: number): void {
    this.layout = calculateHexLayout(canvasWidth, canvasHeight);
  }

  render(state: RootState): void {
    // Layer 1: Background
    this.renderBackground();

    // Layer 2: Board hexagon with colored edges
    this.renderBoardHexagon(state);

    // Layer 2.5: Render all 37 hex positions (for debugging/visibility)
    this.renderHexPositions();

    // Layer 2.6: Color source hexagon edges with player colors
    this.renderSourceHexagonEdges(state);

    // Layer 2.7: Debug - Draw edge direction labels (0-5) inside each hexagon
    if (DEBUG_SHOW_EDGE_LABELS) {
      this.renderEdgeDirectionLabels();
    }

    // Layer 2.8: Debug - Highlight victory condition edges
    if (DEBUG_SHOW_VICTORY_EDGES) {
      this.renderVictoryConditionEdges(state);
    }

    // Layer 3: Placed tiles
    this.renderPlacedTiles(state);

    // Layer 4: Current tile preview
    this.renderCurrentTilePreview(state);

    // Layer 5: Action buttons (checkmark and X)
    this.renderActionButtons(state);

    // Layer 6: Exit buttons in corners
    this.renderExitButtons();
  }

  private renderBackground(): void {
    this.ctx.fillStyle = CANVAS_BG;
    this.ctx.fillRect(0, 0, this.layout.canvasWidth, this.layout.canvasHeight);
  }

  private renderBoardHexagon(state: RootState): void {
    const center = this.layout.origin;
    const boardRadius = this.layout.size * 7.2;

    // Draw board as a large hexagon with flat-top orientation (rotated 30° from pointy-top)
    this.ctx.fillStyle = BOARD_HEX_BG;
    this.drawFlatTopHexagon(center, boardRadius, true);

    // Draw colored edges for each player
    // Each player owns one edge of the board hexagon
    if (state.game.players.length > 0) {
      state.game.players.forEach((player) => {
        this.renderPlayerEdge(
          center,
          boardRadius,
          player.edgePosition,
          player.color,
        );
      });
    }
  }

  private renderPlayerEdge(
    center: Point,
    radius: number,
    edgePosition: number,
    color: string,
  ): void {
    // Get the two vertices that define this edge for flat-top hexagon
    const vertices = this.getFlatTopHexVertices(center, radius);

    // For flat-top hexagon with vertex 0 at right (0°):
    // Edge 0: Bottom (270°) - between vertices 4 and 5
    // Edge 1: Bottom-right (330°) - between vertices 5 and 0
    // Edge 2: Top-right (30°) - between vertices 0 and 1
    // Edge 3: Top (90°) - between vertices 1 and 2
    // Edge 4: Top-left (150°) - between vertices 2 and 3
    // Edge 5: Bottom-left (210°) - between vertices 3 and 4

    const vertexMap = [
      [4, 5], // Edge 0: Bottom
      [5, 0], // Edge 1: Bottom-right
      [0, 1], // Edge 2: Top-right
      [1, 2], // Edge 3: Top
      [2, 3], // Edge 4: Top-left
      [3, 4], // Edge 5: Bottom-left
    ];

    const [v1Index, v2Index] = vertexMap[edgePosition];
    const v1 = vertices[v1Index];
    const v2 = vertices[v2Index];

    // Draw a thick colored line for this edge
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = this.layout.size * 0.3; // Thick edge
    this.ctx.lineCap = "round";

    this.ctx.beginPath();
    this.ctx.moveTo(v1.x, v1.y);
    this.ctx.lineTo(v2.x, v2.y);
    this.ctx.stroke();
  }

  private renderHexPositions(): void {
    // Render all 37 hex positions with subtle outlines
    const positions = getAllBoardPositions();

    this.ctx.strokeStyle = "#666666"; // Dark gray outline
    this.ctx.lineWidth = 1;

    positions.forEach((pos) => {
      const center = hexToPixel(pos, this.layout);
      this.drawHexagon(center, this.layout.size, false);
    });
  }

  private renderSourceHexagonEdges(state: RootState): void {
    // For each player, color the edges of their source hexagons
    if (state.game.players.length === 0) return;

    state.game.players.forEach((player) => {
      // Get all source edge positions and directions for this player
      const sourceEdges = getEdgePositionsWithDirections(player.edgePosition);

      // For each source edge, draw a colored line on the hexagon edge
      sourceEdges.forEach(({ pos, dir }) => {
        const center = hexToPixel(pos, this.layout);

        // Get the two vertices that define this edge
        const vertices = getHexVertices(center, this.layout.size);

        // Map direction to vertex pairs for pointy-top hexagons
        // Direction enum: SouthWest=0, West=1, NorthWest=2, NorthEast=3, East=4, SouthEast=5
        const vertexPairs = [
          [4, 5], // SouthWest (240°)
          [3, 4], // West (180°)
          [2, 3], // NorthWest (120°)
          [1, 2], // NorthEast (60°)
          [0, 1], // East (0°)
          [5, 0], // SouthEast (300°)
        ];

        const [v1Index, v2Index] = vertexPairs[dir];
        const v1 = vertices[v1Index];
        const v2 = vertices[v2Index];

        // Draw a thick colored line for this edge
        this.ctx.strokeStyle = player.color;
        this.ctx.lineWidth = this.layout.size * 0.2; // Thick edge
        this.ctx.lineCap = "round";

        this.ctx.beginPath();
        this.ctx.moveTo(v1.x, v1.y);
        this.ctx.lineTo(v2.x, v2.y);
        this.ctx.stroke();
      });
    });
  }

  private renderVictoryConditionEdges(state: RootState): void {
    // Debug rendering: Highlight the outward-facing edges on the opposite side that are victory conditions
    if (state.game.players.length === 0) return;

    state.game.players.forEach((player) => {
      const targetEdge = getOppositeEdge(player.edgePosition);
      const targetEdgeData = getEdgePositionsWithDirections(targetEdge);

      // For each position on the target edge, highlight the outward-facing edge
      targetEdgeData.forEach(({ pos, dir }) => {
        const center = hexToPixel(pos, this.layout);
        const outwardDir = getOppositeDirection(dir);

        // Get the two vertices that define the outward-facing edge
        const vertices = getHexVertices(center, this.layout.size);

        // Map direction to vertex pairs for pointy-top hexagons
        const vertexPairs = [
          [4, 5], // SouthWest (240°)
          [3, 4], // West (180°)
          [2, 3], // NorthWest (120°)
          [1, 2], // NorthEast (60°)
          [0, 1], // East (0°)
          [5, 0], // SouthEast (300°)
        ];

        const [v1Index, v2Index] = vertexPairs[outwardDir];
        const v1 = vertices[v1Index];
        const v2 = vertices[v2Index];

        // Draw a dashed line in the player's color to indicate victory edge
        this.ctx.strokeStyle = player.color;
        this.ctx.lineWidth = this.layout.size * 0.15;
        this.ctx.lineCap = "round";
        this.ctx.setLineDash([5, 5]); // Dashed pattern

        this.ctx.beginPath();
        this.ctx.moveTo(v1.x, v1.y);
        this.ctx.lineTo(v2.x, v2.y);
        this.ctx.stroke();

        // Reset dash pattern
        this.ctx.setLineDash([]);
      });
    });
  }

  private renderEdgeDirectionLabels(): void {
    // Debug rendering: Label each edge with its direction number (0-5) inside each hexagon
    const positions = getAllBoardPositions();

    this.ctx.fillStyle = "#ffffff"; // White for visibility
    this.ctx.font = `${this.layout.size * 0.25}px sans-serif`;
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";

    positions.forEach((pos) => {
      const center = hexToPixel(pos, this.layout);

      // Draw labels for each of the 6 directions (0-5)
      for (let dir = 0; dir < 6; dir++) {
        // Get the edge midpoint for this direction
        const edgeMidpoint = getEdgeMidpoint(center, this.layout.size, dir);

        // Position the label slightly inward from the edge (70% of the way from center to edge)
        const labelX = center.x + (edgeMidpoint.x - center.x) * 0.7;
        const labelY = center.y + (edgeMidpoint.y - center.y) * 0.7;

        // Draw the direction number
        this.ctx.fillText(dir.toString(), labelX, labelY);
      }
    });
  }

  private renderPlacedTiles(state: RootState): void {
    // Render each placed tile on the board
    state.game.board.forEach((tile) => {
      this.renderTile(tile, state, 1.0); // Full opacity for placed tiles
    });
  }

  private renderTile(
    tile: PlacedTile,
    state: RootState,
    opacity: number,
  ): void {
    const center = hexToPixel(tile.position, this.layout);

    // Fill tile background
    this.ctx.globalAlpha = opacity;
    this.ctx.fillStyle = TILE_BG;
    this.drawHexagon(center, this.layout.size, true);

    // Draw tile border
    this.ctx.strokeStyle = TILE_BORDER;
    this.ctx.lineWidth = 1;
    this.drawHexagon(center, this.layout.size, false);

    // Draw flow paths
    this.renderFlowPaths(tile, state, center);

    this.ctx.globalAlpha = 1.0;
  }

  private renderFlowPaths(
    tile: PlacedTile,
    state: RootState,
    center: Point,
  ): void {
    const connections = getFlowConnections(tile.type, tile.rotation);
    const tileKey = `${tile.position.row},${tile.position.col}`;
    const tileFlowEdges = state.game.flowEdges.get(tileKey);

    // For each flow connection, draw a Bézier curve
    connections.forEach(([dir1, dir2]) => {
      // Determine the color for THIS specific path based on flow edges
      let pathColor = "#888888"; // Default neutral grey

      // Check if both ends of this path have flow from the same player
      if (tileFlowEdges) {
        const player1 = tileFlowEdges.get(dir1);
        const player2 = tileFlowEdges.get(dir2);

        // Only color the path if BOTH ends have the same player's flow
        if (player1 && player1 === player2) {
          // Find the player's color
          const player = state.game.players.find((p) => p.id === player1);
          if (player) {
            pathColor = player.color;
          }
        }
      }

      // Get edge midpoints
      const start = getEdgeMidpoint(center, this.layout.size, dir1);
      const end = getEdgeMidpoint(center, this.layout.size, dir2);

      // Get control points (perpendicular to edges)
      const control1Vec = getPerpendicularVector(dir1, this.layout.size);
      const control2Vec = getPerpendicularVector(dir2, this.layout.size);

      const control1 = {
        x: start.x + control1Vec.x,
        y: start.y + control1Vec.y,
      };
      const control2 = {
        x: end.x + control2Vec.x,
        y: end.y + control2Vec.y,
      };

      // Use the determined color for this path
      this.ctx.strokeStyle = pathColor;
      this.ctx.lineWidth = this.layout.size * 0.15; // 15% of hex radius
      this.ctx.lineCap = "round";

      // Draw Bézier curve
      this.ctx.beginPath();
      this.ctx.moveTo(start.x, start.y);
      this.ctx.bezierCurveTo(
        control1.x,
        control1.y,
        control2.x,
        control2.y,
        end.x,
        end.y,
      );
      this.ctx.stroke();
    });
  }

  private renderCurrentTilePreview(state: RootState): void {
    if (state.game.currentTile == null) return;

    const currentPlayer = state.game.players[state.game.currentPlayerIndex];
    if (!currentPlayer) return;

    // Check if tile is placed on board (being previewed)
    if (state.ui.selectedPosition) {
      // Render preview at selected position
      const tile: PlacedTile = {
        type: state.game.currentTile,
        rotation: state.ui.currentRotation,
        position: state.ui.selectedPosition,
      };

      this.renderTile(tile, state, 0.7); // 70% opacity

      // TODO: Add red border if illegal placement
      // TODO: Show checkmark and X buttons
    } else {
      // Render tile by player's edge (beyond the board edge)
      const edgePos = getPlayerEdgePosition(
        currentPlayer.edgePosition,
        this.layout,
      );
      // Use grey for preview flows (not yet placed on board)
      this.renderTileAtPosition(
        state.game.currentTile,
        state.ui.currentRotation,
        edgePos,
        "#888888", // Neutral grey for unplaced tiles
        1.0,
      );
    }
  }

  private renderTileAtPosition(
    tileType: TileType,
    rotation: number,
    center: Point,
    playerColor: string,
    opacity: number,
  ): void {
    // Render a tile at an arbitrary position (for edge preview)
    this.ctx.globalAlpha = opacity;
    this.ctx.fillStyle = TILE_BG;
    this.drawHexagon(center, this.layout.size, true);

    this.ctx.strokeStyle = TILE_BORDER;
    this.ctx.lineWidth = 1;
    this.drawHexagon(center, this.layout.size, false);

    // Draw flow paths in player color
    const connections = getFlowConnections(tileType, rotation as any);
    connections.forEach(([dir1, dir2]) => {
      const start = getEdgeMidpoint(center, this.layout.size, dir1);
      const end = getEdgeMidpoint(center, this.layout.size, dir2);

      const control1Vec = getPerpendicularVector(dir1, this.layout.size);
      const control2Vec = getPerpendicularVector(dir2, this.layout.size);

      const control1 = {
        x: start.x + control1Vec.x,
        y: start.y + control1Vec.y,
      };
      const control2 = { x: end.x + control2Vec.x, y: end.y + control2Vec.y };

      this.ctx.strokeStyle = playerColor;
      this.ctx.lineWidth = this.layout.size * 0.15;
      this.ctx.lineCap = "round";

      this.ctx.beginPath();
      this.ctx.moveTo(start.x, start.y);
      this.ctx.bezierCurveTo(
        control1.x,
        control1.y,
        control2.x,
        control2.y,
        end.x,
        end.y,
      );
      this.ctx.stroke();
    });

    this.ctx.globalAlpha = 1.0;
  }

  private renderActionButtons(state: RootState): void {
    // TODO: Render checkmark and X buttons when tile is placed on board
    if (!state.ui.selectedPosition) return;

    // Calculate button positions relative to selected hex
    const center = hexToPixel(state.ui.selectedPosition, this.layout);
    const buttonSize = this.layout.size * 0.8;
    const buttonSpacing = this.layout.size * 2;

    // Checkmark button (to the right)
    const checkPos = { x: center.x + buttonSpacing, y: center.y };
    this.renderCheckmarkButton(checkPos, buttonSize, true); // TODO: determine if enabled

    // X button (to the left)
    const xPos = { x: center.x - buttonSpacing, y: center.y };
    this.renderXButton(xPos, buttonSize);
  }

  private renderCheckmarkButton(
    center: Point,
    size: number,
    enabled: boolean,
  ): void {
    // Draw button background
    this.ctx.fillStyle = enabled
      ? "rgba(76, 175, 80, 0.8)"
      : "rgba(85, 85, 85, 0.8)";
    this.ctx.beginPath();
    this.ctx.arc(center.x, center.y, size / 2, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw checkmark icon
    this.ctx.strokeStyle = enabled ? BUTTON_ICON : "#999999";
    this.ctx.lineWidth = size * 0.15;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    this.ctx.beginPath();
    this.ctx.moveTo(center.x - size * 0.25, center.y);
    this.ctx.lineTo(center.x - size * 0.05, center.y + size * 0.2);
    this.ctx.lineTo(center.x + size * 0.3, center.y - size * 0.2);
    this.ctx.stroke();
  }

  private renderXButton(center: Point, size: number): void {
    // Draw button background
    this.ctx.fillStyle = "rgba(211, 47, 47, 0.8)";
    this.ctx.beginPath();
    this.ctx.arc(center.x, center.y, size / 2, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw X icon
    this.ctx.strokeStyle = BUTTON_ICON;
    this.ctx.lineWidth = size * 0.15;
    this.ctx.lineCap = "round";

    const offset = size * 0.2;
    this.ctx.beginPath();
    this.ctx.moveTo(center.x - offset, center.y - offset);
    this.ctx.lineTo(center.x + offset, center.y + offset);
    this.ctx.moveTo(center.x + offset, center.y - offset);
    this.ctx.lineTo(center.x - offset, center.y + offset);
    this.ctx.stroke();
  }

  private renderExitButtons(): void {
    // Render X buttons in each corner
    const cornerSize = 50;
    const margin = 10;

    const corners = [
      { x: margin + cornerSize / 2, y: margin + cornerSize / 2, rotation: 0 },
      {
        x: this.layout.canvasWidth - margin - cornerSize / 2,
        y: margin + cornerSize / 2,
        rotation: 90,
      },
      {
        x: this.layout.canvasWidth - margin - cornerSize / 2,
        y: this.layout.canvasHeight - margin - cornerSize / 2,
        rotation: 180,
      },
      {
        x: margin + cornerSize / 2,
        y: this.layout.canvasHeight - margin - cornerSize / 2,
        rotation: 270,
      },
    ];

    corners.forEach((corner) => {
      this.ctx.save();
      this.ctx.translate(corner.x, corner.y);
      this.ctx.rotate((corner.rotation * Math.PI) / 180);

      // Draw semi-transparent background
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      this.ctx.fillRect(
        -cornerSize / 2,
        -cornerSize / 2,
        cornerSize,
        cornerSize,
      );

      // Draw X
      this.ctx.strokeStyle = BUTTON_ICON;
      this.ctx.lineWidth = 3;
      this.ctx.lineCap = "round";

      const offset = cornerSize * 0.25;
      this.ctx.beginPath();
      this.ctx.moveTo(-offset, -offset);
      this.ctx.lineTo(offset, offset);
      this.ctx.moveTo(offset, -offset);
      this.ctx.lineTo(-offset, offset);
      this.ctx.stroke();

      this.ctx.restore();
    });
  }

  private drawHexagon(center: Point, size: number, fill: boolean): void {
    const vertices = getHexVertices(center, size);

    this.ctx.beginPath();
    this.ctx.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) {
      this.ctx.lineTo(vertices[i].x, vertices[i].y);
    }
    this.ctx.closePath();

    if (fill) {
      this.ctx.fill();
    } else {
      this.ctx.stroke();
    }
  }

  // Draw a flat-top hexagon (rotated 30° from pointy-top)
  private drawFlatTopHexagon(center: Point, size: number, fill: boolean): void {
    const vertices = this.getFlatTopHexVertices(center, size);

    this.ctx.beginPath();
    this.ctx.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) {
      this.ctx.lineTo(vertices[i].x, vertices[i].y);
    }
    this.ctx.closePath();

    if (fill) {
      this.ctx.fill();
    } else {
      this.ctx.stroke();
    }
  }

  // Get vertices for a flat-top hexagon (rotated 30° from pointy-top)
  private getFlatTopHexVertices(center: Point, size: number): Point[] {
    const vertices: Point[] = [];
    for (let i = 0; i < 6; i++) {
      const angleDeg = 60 * i; // No offset for flat-top
      const angleRad = (Math.PI / 180) * angleDeg;
      vertices.push({
        x: center.x + size * Math.cos(angleRad),
        y: center.y + size * Math.sin(angleRad),
      });
    }
    return vertices;
  }

  getLayout(): HexLayout {
    return this.layout;
  }
}
