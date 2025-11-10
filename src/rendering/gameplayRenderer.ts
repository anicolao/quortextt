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
  calculateBoardRadiusMultiplier,
} from "./hexLayout";
import {
  getAllBoardPositions,
  getEdgePositionsWithDirections,
  getOppositeEdge,
  positionToKey,
} from "../game/board";
import { victoryAnimationState } from "../animation/victoryAnimations";
import { isConnectionInWinningPath } from "../game/victory";
import { TileType, PlacedTile, Direction } from "../game/types";
import { getFlowConnections } from "../game/tiles";
import { getFlowPreviewData } from "../animation/flowPreview";
import {
  isLegalMove,
  getBlockedPlayers,
  getDebugPathInfo,
  isPlayerBlocked,
} from "../game/legality";

// UI Colors from design spec
const CANVAS_BG = "#e8e8e8"; // Light gray "table"
const BOARD_HEX_BG = "#000000"; // Black
const TILE_BG = "#2a2a2a"; // Dark gray
const TILE_BORDER = "#444444"; // Slightly lighter gray
const BUTTON_ICON = "#ffffff"; // White

export class GameplayRenderer {
  private ctx: CanvasRenderingContext2D;
  private layout: HexLayout;
  private bezierLengthCache: Map<string, number> = new Map();
  private boardRadius: number;

  constructor(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    boardRadius: number,
  ) {
    this.ctx = ctx;
    this.boardRadius = boardRadius;
    this.layout = calculateHexLayout(canvasWidth, canvasHeight, boardRadius);
  }

  updateLayout(canvasWidth: number, canvasHeight: number): void {
    this.layout = calculateHexLayout(canvasWidth, canvasHeight, this.boardRadius);
    // Clear cache when layout changes
    this.bezierLengthCache.clear();
  }

  render(state: RootState): void {
    // Layer 1: Background
    this.renderBackground();

    // Layer 2: Board hexagon with colored edges
    this.renderBoardHexagon(state);

    // Layer 2.5: Render all hex positions (for debugging/visibility)
    this.renderHexPositions(state.game.boardRadius);

    // Layer 2.6: Color source hexagon edges with player colors
    //this.renderSourceHexagonEdges(state);

    // Layer 2.7: Debug - Draw edge direction labels (0-5) inside each hexagon
    if (state.ui.settings.debugShowEdgeLabels) {
      this.renderEdgeDirectionLabels(state.game.boardRadius);
    }

    // Layer 2.8: Debug - Highlight victory condition edges
    if (state.ui.settings.debugShowVictoryEdges) {
      this.renderVictoryConditionEdges(state);
    }

    // Layer 2.9: Debug - Show AI scoring data
    if (state.ui.settings.debugAIScoring && state.game.aiScoringData) {
      this.renderAIScoring(state);
    }

    // Layer 3: Placed tiles
    this.renderPlacedTiles(state);

    // Layer 4: Current tile preview
    this.renderCurrentTilePreview(state);

    // Layer 5: Action buttons (checkmark and X)
    this.renderActionButtons(state);

    // Layer 5.5: Victory stars at player edges (if game is over)
    if (state.game.screen === "game-over") {
      this.renderVictoryStars(state);
    }

    // Layer 6: Exit buttons in corners
    this.renderExitButtons();

    // Layer 7: Debug legality test - show winning paths
    if (state.ui.settings.debugLegalityTest) {
      this.renderDebugLegalityPaths(state);
    }
  }

  private renderBackground(): void {
    this.ctx.fillStyle = CANVAS_BG;
    this.ctx.fillRect(0, 0, this.layout.canvasWidth, this.layout.canvasHeight);
  }

  private renderBoardHexagon(state: RootState): void {
    const center = this.layout.origin;
    // Calculate board radius based on the game's board radius setting
    // The board background should be boardRadius * 2 + 1.2 times the hex size
    const boardRadius = this.layout.size * calculateBoardRadiusMultiplier(state.game.boardRadius);

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
          state.game.boardRadius,
        );
      });
    }
  }

  private renderPlayerEdge(
    center: Point,
    radius: number,
    edgePosition: number,
    color: string,
    boardRadius: number,
  ): void {
    // Create a polygon from the zig-zag of source edges plus perpendiculars to board boundary

    // Get all source edge positions and their vertices (the zig-zag)
    const sourceEdges = getEdgePositionsWithDirections(edgePosition, boardRadius);
    if (sourceEdges.length === 0) return;

    // Collect all the edge vertices that form the zig-zag pattern
    // Build an ordered list of edge segments (pairs of vertices)
    const zigzagEdges: Array<[Point, Point]> = [];

    // Map direction to vertex pairs for pointy-top hexagons
    const vertexPairs = [
      [4, 5], // SouthWest (240°)
      [3, 4], // West (180°)
      [2, 3], // NorthWest (120°)
      [1, 2], // NorthEast (60°)
      [0, 1], // East (0°)
      [5, 0], // SouthEast (300°)
    ];

    sourceEdges.forEach(({ pos, dir }) => {
      const hexCenter = hexToPixel(pos, this.layout);
      const vertices = getHexVertices(hexCenter, this.layout.size);

      const [v1Index, v2Index] = vertexPairs[dir];
      const v1 = vertices[v1Index];
      const v2 = vertices[v2Index];

      zigzagEdges.push([v1, v2]);
    });

    // Build a continuous path through the edges
    // Determine the correct orientation of the first edge by checking which vertex
    // would connect to the second edge (if there is one)
    const [firstV1, firstV2] = zigzagEdges[0];

    let zigzagVertices: Point[];

    if (zigzagEdges.length > 1) {
      // Check which vertex of the first edge connects to the second edge
      const [secondV1, secondV2] = zigzagEdges[1];

      // Check distances from firstV2 to second edge vertices
      const distFirstV2ToSecondV1 = this.distance(firstV2, secondV1);
      const distFirstV2ToSecondV2 = this.distance(firstV2, secondV2);

      // Check distances from firstV1 to second edge vertices
      const distFirstV1ToSecondV1 = this.distance(firstV1, secondV1);
      const distFirstV1ToSecondV2 = this.distance(firstV1, secondV2);

      // Determine which end of first edge connects to second edge
      const firstV2ConnectsToSecond =
        Math.min(distFirstV2ToSecondV1, distFirstV2ToSecondV2) <
        Math.min(distFirstV1ToSecondV1, distFirstV1ToSecondV2);

      // If firstV2 connects to second edge, start with [firstV1, firstV2]
      // If firstV1 connects to second edge, start with [firstV2, firstV1]
      zigzagVertices = firstV2ConnectsToSecond
        ? [firstV1, firstV2]
        : [firstV2, firstV1];
    } else {
      // Only one edge, use default order
      zigzagVertices = [firstV1, firstV2];
    }

    // Connect subsequent edges
    for (let i = 1; i < zigzagEdges.length; i++) {
      const [v1, v2] = zigzagEdges[i];
      const lastVertex = zigzagVertices[zigzagVertices.length - 1];

      // Check which vertex of this edge is closer to the last vertex
      const distToV1 = this.distance(lastVertex, v1);
      const distToV2 = this.distance(lastVertex, v2);

      if (distToV1 < distToV2) {
        // v1 is closer, so the edge goes v1 -> v2
        if (distToV1 > 0.1) {
          // Not the same point, add both
          zigzagVertices.push(v1);
          zigzagVertices.push(v2);
        } else {
          // Same point (shared vertex), just add v2
          zigzagVertices.push(v2);
        }
      } else {
        // v2 is closer, so the edge goes v2 -> v1
        if (distToV2 > 0.1) {
          // Not the same point, add both
          zigzagVertices.push(v2);
          zigzagVertices.push(v1);
        } else {
          // Same point (shared vertex), just add v1
          zigzagVertices.push(v1);
        }
      }
    }

    // Get endpoints of the zig-zag (first and last vertices)
    const firstEndpoint = zigzagVertices[0];
    const lastEndpoint = zigzagVertices[zigzagVertices.length - 1];

    // Get the board hexagon vertices and edge
    const boardVertices = this.getFlatTopHexVertices(center, radius);
    const vertexMap = [
      [4, 5], // Edge 0: Bottom
      [5, 0], // Edge 1: Bottom-right
      [0, 1], // Edge 2: Top-right
      [1, 2], // Edge 3: Top
      [2, 3], // Edge 4: Top-left
      [3, 4], // Edge 5: Bottom-left
    ];

    const [v1Index, v2Index] = vertexMap[edgePosition];
    const boardV1 = boardVertices[v1Index];
    const boardV2 = boardVertices[v2Index];

    // Find closest point on board edge to each endpoint
    const closestToFirst = this.closestPointOnLineSegment(
      firstEndpoint,
      boardV1,
      boardV2,
    );
    const closestToLast = this.closestPointOnLineSegment(
      lastEndpoint,
      boardV1,
      boardV2,
    );

    // Determine which endpoint is closer to the boundary
    const distFirstToBoard = this.distance(firstEndpoint, closestToFirst);
    const distLastToBoard = this.distance(lastEndpoint, closestToLast);

    // The closer endpoint connects to its closest point, then to the further corner
    // The farther endpoint connects to a 60° rotated version of the closest point
    let closerEndpoint: Point;
    let closestPoint: Point;
    let fartherCorner: Point;

    if (distFirstToBoard < distLastToBoard) {
      closerEndpoint = firstEndpoint;
      closestPoint = closestToFirst;

      // Determine which corner is farther from the closest point
      const distToV1 = this.distance(closestPoint, boardV1);
      const distToV2 = this.distance(closestPoint, boardV2);
      if (distToV1 > distToV2) {
        fartherCorner = boardV1;
      } else {
        fartherCorner = boardV2;
      }
    } else {
      closerEndpoint = lastEndpoint;
      closestPoint = closestToLast;

      const distToV1 = this.distance(closestPoint, boardV1);
      const distToV2 = this.distance(closestPoint, boardV2);
      if (distToV1 > distToV2) {
        fartherCorner = boardV1;
      } else {
        fartherCorner = boardV2;
      }
    }

    // Calculate the 60° rotated point for the farther endpoint
    // Rotate the closest point 60° around the board center
    const rotatedPoint = this.rotatePointAround(
      closestPoint,
      center,
      -Math.PI / 3,
    ); // 60° in radians

    // Build the polygon
    this.ctx.beginPath();

    // Start from the farther corner
    this.ctx.moveTo(fartherCorner.x, fartherCorner.y);

    // Go to the closest point
    this.ctx.lineTo(closestPoint.x, closestPoint.y);

    // Connect to the closer endpoint
    this.ctx.lineTo(closerEndpoint.x, closerEndpoint.y);

    // Draw all the zig-zag vertices
    if (closerEndpoint === firstEndpoint) {
      // Draw forward through the zig-zag
      for (let i = 1; i < zigzagVertices.length; i++) {
        this.ctx.lineTo(zigzagVertices[i].x, zigzagVertices[i].y);
      }
    } else {
      // Draw backward through the zig-zag
      for (let i = zigzagVertices.length - 2; i >= 0; i--) {
        this.ctx.lineTo(zigzagVertices[i].x, zigzagVertices[i].y);
      }
    }

    // Connect to the rotated point
    this.ctx.lineTo(rotatedPoint.x, rotatedPoint.y);

    // Close the polygon (back to farther corner)
    this.ctx.closePath();

    // Fill and stroke
    this.ctx.fillStyle = color;
    this.ctx.globalAlpha = 1.0;
    this.ctx.fill();

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.stroke();
  }

  // Render victory stars at player edges
  private renderVictoryStars(state: RootState): void {
    const { winners, players } = state.game;
    if (winners.length === 0) return;

    const center = this.layout.origin;
    const boardRadius = this.layout.size * calculateBoardRadiusMultiplier(state.game.boardRadius);
    const boardVertices = this.getFlatTopHexVertices(center, boardRadius);

    // Get the glow intensity for pulsing effect
    const glowIntensity = victoryAnimationState.glowIntensity;

    // Map edge positions to their midpoints on the board
    const vertexMap = [
      [4, 5], // Edge 0: Bottom
      [5, 0], // Edge 1: Bottom-right
      [0, 1], // Edge 2: Top-right
      [1, 2], // Edge 3: Top
      [2, 3], // Edge 4: Top-left
      [3, 4], // Edge 5: Bottom-left
    ];

    // Group winners by edge position for handling multiple winners on same edge
    const winnersByEdge = new Map<number, string[]>();
    winners.forEach((playerId) => {
      const player = players.find((p) => p.id === playerId);
      if (player) {
        const edge = player.edgePosition;
        if (!winnersByEdge.has(edge)) {
          winnersByEdge.set(edge, []);
        }
        winnersByEdge.get(edge)!.push(playerId);
      }
    });

    // Render star at each winning player's edge
    winnersByEdge.forEach((playerIds, edgePosition) => {
      const [v1Index, v2Index] = vertexMap[edgePosition];
      const v1 = boardVertices[v1Index];
      const v2 = boardVertices[v2Index];
      
      // Calculate midpoint of the edge
      const edgeMidpoint = {
        x: (v1.x + v2.x) / 2,
        y: (v1.y + v2.y) / 2,
      };

      // Move star outward from center so it's fully visible beyond the edge
      // Calculate direction vector from board center to edge midpoint
      const dx = edgeMidpoint.x - center.x;
      const dy = edgeMidpoint.y - center.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const offsetDistance = this.layout.size * 0.8; // Move star outward
      
      const starPosition = {
        x: edgeMidpoint.x + (dx / distance) * offsetDistance,
        y: edgeMidpoint.y + (dy / distance) * offsetDistance,
      };

      // If multiple winners on same edge, alternate colors with pulse timing
      if (playerIds.length > 1) {
        // Use pulse intensity to alternate: when intensity is increasing (> 0.75), show first player
        // when decreasing (< 0.75), show second player. This creates a clear alternation.
        // Since glowIntensity oscillates 0.5 -> 1.0 -> 0.5, we use 0.75 as the midpoint
        // to switch colors cleanly
        const activePlayerIndex = glowIntensity > 0.75 ? 0 : 1;
        const activePlayerId = playerIds[activePlayerIndex % playerIds.length];
        const player = players.find((p) => p.id === activePlayerId);
        if (player) {
          this.drawStar(starPosition, this.layout.size * 0.4, player.color, glowIntensity);
        }
      } else {
        // Single winner on this edge
        const player = players.find((p) => p.id === playerIds[0]);
        if (player) {
          this.drawStar(starPosition, this.layout.size * 0.4, player.color, glowIntensity);
        }
      }
    });
  }

  // Draw a star shape
  private drawStar(
    center: Point,
    size: number,
    color: string,
    pulseIntensity: number
  ): void {
    const points = 5;
    const outerRadius = size * (0.9 + 0.1 * pulseIntensity);
    const innerRadius = outerRadius * 0.4;

    this.ctx.save();

    // Add glow effect
    this.ctx.shadowBlur = 15 * pulseIntensity;
    this.ctx.shadowColor = color;
    this.ctx.globalAlpha = 0.9 + 0.1 * pulseIntensity;

    this.ctx.fillStyle = color;
    this.ctx.beginPath();

    for (let i = 0; i < points * 2; i++) {
      const angle = (Math.PI / points) * i - Math.PI / 2;
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const x = center.x + Math.cos(angle) * radius;
      const y = center.y + Math.sin(angle) * radius;

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

  // Helper: Find closest point on a line segment to a given point
  private closestPointOnLineSegment(
    point: Point,
    lineStart: Point,
    lineEnd: Point,
  ): Point {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) return lineStart;

    let t =
      ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) /
      lengthSquared;
    t = Math.max(0, Math.min(1, t));

    return {
      x: lineStart.x + t * dx,
      y: lineStart.y + t * dy,
    };
  }

  // Helper: Calculate distance between two points
  private distance(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Helper: Rotate a point around a center by an angle
  private rotatePointAround(point: Point, center: Point, angle: number): Point {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = point.x - center.x;
    const dy = point.y - center.y;

    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos,
    };
  }

  private renderHexPositions(radius: number): void {
    // Render all hex positions with subtle outlines
    const positions = getAllBoardPositions(radius);

    this.ctx.strokeStyle = "#666666"; // Dark gray outline
    this.ctx.lineWidth = 1;

    positions.forEach((pos) => {
      const center = hexToPixel(pos, this.layout);
      this.drawHexagon(center, this.layout.size, false);
    });
  }



  private renderVictoryConditionEdges(state: RootState): void {
    // Debug rendering: Highlight the victory condition edges
    // Victory edges are the same as the start edges for a player on the opposite side
    if (state.game.players.length === 0) return;

    state.game.players.forEach((player) => {
      const targetEdge = getOppositeEdge(player.edgePosition);
      const targetEdgeData = getEdgePositionsWithDirections(targetEdge, state.game.boardRadius);

      // Draw the same edges as start edges, but for the opposite side
      // These are the edges where flow must exit to win
      targetEdgeData.forEach(({ pos, dir }) => {
        const center = hexToPixel(pos, this.layout);

        // Get the two vertices that define this edge
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

        const [v1Index, v2Index] = vertexPairs[dir];
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

  private renderEdgeDirectionLabels(radius: number): void {
    // Debug rendering: Label each edge with its direction number (0-5) inside each hexagon
    const positions = getAllBoardPositions(radius);

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

  private renderAIScoring(state: RootState): void {
    // Debug rendering: Show AI evaluation scores for each rotation at each position
    if (!state.game.aiScoringData) return;

    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.font = `${this.layout.size * 0.2}px monospace`;

    Object.entries(state.game.aiScoringData).forEach(([posKey, rotationScores]) => {
      // Parse position key "row,col"
      const [rowStr, colStr] = posKey.split(',');
      const position = { row: parseInt(rowStr), col: parseInt(colStr) };
      const center = hexToPixel(position, this.layout);

      // Draw scores for each rotation in corners of the hexagon
      rotationScores.forEach(({ rotation, score }) => {
        // Get the position for this rotation
        // Rotations 0-5 correspond to corners of the hexagon
        const angle = (rotation * 60 - 30) * (Math.PI / 180); // Start from top corner
        const radius = this.layout.size * 0.7; // Position near the corner
        const x = center.x + Math.cos(angle) * radius;
        const y = center.y + Math.sin(angle) * radius;

        // Format score for display
        const scoreText = score >= 100000 ? 'WIN!' : score.toFixed(0);

        // Draw background circle
        const bgRadius = this.layout.size * 0.15;
        this.ctx.fillStyle = score >= 100000 ? '#00ff00' : '#ffff00';
        this.ctx.globalAlpha = 0.7;
        this.ctx.beginPath();
        this.ctx.arc(x, y, bgRadius, 0, 2 * Math.PI);
        this.ctx.fill();

        // Draw score text
        this.ctx.globalAlpha = 1.0;
        this.ctx.fillStyle = '#000000';
        this.ctx.fillText(scoreText, x, y);
      });
    });

    // Reset alpha
    this.ctx.globalAlpha = 1.0;
  }

  private renderPlacedTiles(state: RootState): void {
    // Multi-pass rendering for correct layering:
    // Pass 1: Draw all tile backgrounds
    state.game.board.forEach((tile) => {
      this.renderTileBackground(tile, 1.0);
    });

    // Pass 2: Draw all grey channels (unfilled connections)
    state.game.board.forEach((tile) => {
      this.renderGreyChannels(tile, state);
    });

    // Pass 3: Draw all filled flows
    state.game.board.forEach((tile) => {
      this.renderFilledFlows(tile, state);
    });

    // Pass 4: Draw all animating flows
    state.game.board.forEach((tile) => {
      this.renderAnimatingFlows(tile, state);
    });
  }

  private renderTile(
    tile: PlacedTile,
    state: RootState,
    opacity: number,
  ): void {
    // Render tile with all layers in correct order
    this.renderTileBackground(tile, opacity);
    this.renderGreyChannels(tile, state);
    this.renderFilledFlows(tile, state);
    this.renderAnimatingFlows(tile, state);
  }

  private renderTileBackground(tile: PlacedTile, opacity: number): void {
    const center = hexToPixel(tile.position, this.layout);

    // Fill tile background
    this.ctx.globalAlpha = opacity;
    this.ctx.fillStyle = TILE_BG;
    this.drawHexagon(center, this.layout.size, true);

    // Draw tile border
    this.ctx.strokeStyle = TILE_BORDER;
    this.ctx.lineWidth = 1;
    this.drawHexagon(center, this.layout.size, false);

    this.ctx.globalAlpha = 1.0;
  }

  private renderGreyChannels(tile: PlacedTile, state: RootState): void {
    const center = hexToPixel(tile.position, this.layout);
    const connections = getFlowConnections(tile.type, tile.rotation);
    const tileKey = `${tile.position.row},${tile.position.col}`;
    const tileFlowEdges = state.game.flowEdges.get(tileKey);

    connections.forEach(([dir1, dir2]) => {
      // Only draw grey if this connection doesn't have filled flow
      // With one-way flows, only the entry direction is recorded, so check if EITHER direction has a player
      const player1 = tileFlowEdges?.get(dir1);
      const player2 = tileFlowEdges?.get(dir2);
      const hasFlow = player1 !== undefined || player2 !== undefined;

      if (!hasFlow) {
        this.drawFlowConnection(center, dir1, dir2, "#888888", 1.0, false);
      }
    });
  }

  private renderFilledFlows(tile: PlacedTile, state: RootState): void {
    const center = hexToPixel(tile.position, this.layout);
    const connections = getFlowConnections(tile.type, tile.rotation);
    const tileKey = `${tile.position.row},${tile.position.col}`;
    const tileFlowEdges = state.game.flowEdges.get(tileKey);
    const flowPreviewData = getFlowPreviewData();

    // Check if we should add victory glow
    const isGameOver = state.game.screen === "game-over";
    const winnerIds = state.game.winners;

    connections.forEach(([dir1, dir2]) => {
      // Check both possible direction orderings for animation data
      const animKey1 = `flow-preview-${tileKey}-${dir1}-${dir2}`;
      const animKey2 = `flow-preview-${tileKey}-${dir2}-${dir1}`;
      const animData = flowPreviewData[animKey1] || flowPreviewData[animKey2];

      // Draw if: (1) animation completed (progress >= 1.0), or (2) actual filled flow exists and not animating
      if (animData && animData.animationProgress >= 1.0) {
        // Animation completed - draw the completed flow using actual flow direction
        const playerId = animData.playerId;
        const player = state.game.players.find((p) => p.id === playerId);
        if (player) {
          // Check if this specific connection is part of the winning path
          const shouldGlow =
            isGameOver &&
            winnerIds.includes(playerId) &&
            isConnectionInWinningPath(
              tile.position,
              animData.direction1 as Direction,
              animData.direction2 as Direction,
              playerId,
              state.game.flows,
              state.game.flowEdges,
              state.game.boardRadius,
            );

          // Use the actual flow direction from animation data
          this.drawFlowConnection(
            center,
            animData.direction1,
            animData.direction2,
            player.color,
            1.0,
            false,
            shouldGlow,
          );
        }
      } else if (!animData || animData.animationProgress >= 1.0) {
        // No animation data or animation done - check for actual filled flow
        if (tileFlowEdges) {
          const player1 = tileFlowEdges.get(dir1);
          const player2 = tileFlowEdges.get(dir2);

          // Check for bidirectional flow: different players flowing from each end
          if (player1 && player2 && player1 !== player2) {
            // Bidirectional flow: draw each player's color on their respective half
            const player1Obj = state.game.players.find((p) => p.id === player1);
            const player2Obj = state.game.players.find((p) => p.id === player2);
            
            if (player1Obj && player2Obj) {
              // Draw player1's flow on the left half
              const shouldGlow1 =
                isGameOver &&
                winnerIds.includes(player1) &&
                isConnectionInWinningPath(
                  tile.position,
                  dir1 as Direction,
                  dir2 as Direction,
                  player1,
                  state.game.flows,
                  state.game.flowEdges,
                  state.game.boardRadius,
                );
              
              this.drawFlowConnection(
                center,
                dir1,
                dir2,
                player1Obj.color,
                1.0,
                false,
                shouldGlow1,
                'left',
              );
              
              // Draw player2's flow on the right half
              const shouldGlow2 =
                isGameOver &&
                winnerIds.includes(player2) &&
                isConnectionInWinningPath(
                  tile.position,
                  dir1 as Direction,
                  dir2 as Direction,
                  player2,
                  state.game.flows,
                  state.game.flowEdges,
                  state.game.boardRadius,
                );
              
              this.drawFlowConnection(
                center,
                dir1,
                dir2,
                player2Obj.color,
                1.0,
                false,
                shouldGlow2,
                'right',
              );
            }
          } else {
            // Unidirectional flow: use existing logic
            const playerId = player1 || player2;
            
            if (playerId) {
              const player = state.game.players.find((p) => p.id === playerId);
              if (player) {
                // Check if this specific connection is part of the winning path
                const shouldGlow =
                  isGameOver &&
                  winnerIds.includes(playerId) &&
                  isConnectionInWinningPath(
                    tile.position,
                    dir1 as Direction,
                    dir2 as Direction,
                    playerId,
                    state.game.flows,
                    state.game.flowEdges,
                    state.game.boardRadius,
                  );

                this.drawFlowConnection(
                  center,
                  dir1,
                  dir2,
                  player.color,
                  1.0,
                  false,
                  shouldGlow,
                );
              }
            }
          }
        }
      }
    });
  }



  private renderAnimatingFlows(tile: PlacedTile, state: RootState): void {
    const center = hexToPixel(tile.position, this.layout);
    const connections = getFlowConnections(tile.type, tile.rotation);
    const tileKey = `${tile.position.row},${tile.position.col}`;
    const flowPreviewData = getFlowPreviewData();

    connections.forEach(([dir1, dir2]) => {
      // Check both possible direction orderings for animation data
      const animKey1 = `flow-preview-${tileKey}-${dir1}-${dir2}`;
      const animKey2 = `flow-preview-${tileKey}-${dir2}-${dir1}`;
      const animData = flowPreviewData[animKey1] || flowPreviewData[animKey2];

      if (animData) {
        const animationProgress = animData.animationProgress;

        if (animationProgress < 1.0) {
          const playerId = animData.playerId;
          const player = state.game.players.find((p) => p.id === playerId);
          if (player) {
            // Use the actual flow direction from animation data
            this.drawFlowConnection(
              center,
              animData.direction1,
              animData.direction2,
              player.color,
              animationProgress,
              true,
            );
          }
        }
      }
    });
  }

  private drawFlowConnection(
    center: Point,
    dir1: number,
    dir2: number,
    color: string,
    progress: number,
    isAnimating: boolean,
    withGlow: boolean = false,
    clipSide?: 'left' | 'right',
  ): void {
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

    this.ctx.save();

    // Clip to hexagon boundary to prevent strokes from protruding
    const vertices = getHexVertices(center, this.layout.size);
    this.ctx.beginPath();
    this.ctx.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) {
      this.ctx.lineTo(vertices[i].x, vertices[i].y);
    }
    this.ctx.closePath();
    this.ctx.clip();

    // If clipSide is specified, add additional clipping for bidirectional flow
    if (clipSide) {
      // Create a clipping path along the centerline of the channel
      // We'll clip to either the left or right half of the stroke
      this.ctx.beginPath();
      
      // Calculate the centerline of the bezier curve
      // For simplicity, we'll create a polygon that represents one half
      const numPoints = 20;
      const points: Point[] = [];
      
      for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const pt = this.bezierPoint(t, start, control1, control2, end);
        points.push(pt);
      }
      
      // Calculate perpendicular offset for each point
      // The direction depends on which side we're clipping
      const offsetSign = clipSide === 'left' ? -1 : 1;
      
      // Start from one end, offset perpendicular
      for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const pt = this.bezierPoint(t, start, control1, control2, end);
        
        // Calculate tangent at this point
        let tangent: Point;
        if (i === 0) {
          const nextPt = this.bezierPoint((i + 1) / numPoints, start, control1, control2, end);
          tangent = { x: nextPt.x - pt.x, y: nextPt.y - pt.y };
        } else {
          const prevPt = this.bezierPoint((i - 1) / numPoints, start, control1, control2, end);
          tangent = { x: pt.x - prevPt.x, y: pt.y - prevPt.y };
        }
        
        // Normalize tangent
        const len = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y);
        if (len > 0) {
          tangent.x /= len;
          tangent.y /= len;
        }
        
        // Perpendicular is (-y, x) for left, (y, -x) for right
        const perpX = -tangent.y * offsetSign;
        const perpY = tangent.x * offsetSign;
        
        // Offset by a large amount to ensure we clip the entire half
        const offset = this.layout.size * 2;
        const offsetPt = { x: pt.x + perpX * offset, y: pt.y + perpY * offset };
        
        if (i === 0) {
          this.ctx.moveTo(offsetPt.x, offsetPt.y);
        } else {
          this.ctx.lineTo(offsetPt.x, offsetPt.y);
        }
      }
      
      // Come back along the centerline
      for (let i = numPoints; i >= 0; i--) {
        const t = i / numPoints;
        const pt = this.bezierPoint(t, start, control1, control2, end);
        this.ctx.lineTo(pt.x, pt.y);
      }
      
      this.ctx.closePath();
      this.ctx.clip();
    }

    // Add pulsing glow effect if this is a winning flow
    if (withGlow) {
      // Get current glow intensity from animation state
      const glowIntensity = victoryAnimationState.glowIntensity;

      // Draw outer glow
      this.ctx.shadowBlur = 20 * glowIntensity;
      this.ctx.shadowColor = color;
      this.ctx.globalAlpha = 0.8 + 0.2 * glowIntensity;
    }

    this.ctx.strokeStyle = color;
    // Increase stroke width slightly from 0.15 to 0.18
    this.ctx.lineWidth = this.layout.size * 0.18;
    this.ctx.lineCap = "round";

    if (isAnimating) {
      this.ctx.globalAlpha = 0.7; // Preview opacity

      // Use setLineDash to create animated "fill in" effect
      const tileKey = `${Math.round(center.x)}-${Math.round(center.y)}`;
      const cacheKey = `${tileKey}-${dir1}-${dir2}`;
      let pathLength = this.bezierLengthCache.get(cacheKey);
      if (pathLength === undefined) {
        pathLength = this.estimateBezierLength(start, control1, control2, end);
        this.bezierLengthCache.set(cacheKey, pathLength);
      }
      const dashLength = pathLength * progress;
      this.ctx.setLineDash([dashLength, pathLength - dashLength]);
    }

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
    this.ctx.restore();
  }

  // Estimate Bezier curve length for animation
  private estimateBezierLength(
    start: Point,
    control1: Point,
    control2: Point,
    end: Point,
  ): number {
    // Simple estimation using line segments
    const steps = 10;
    let length = 0;
    let prevPoint = start;

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const point = this.bezierPoint(t, start, control1, control2, end);
      const dx = point.x - prevPoint.x;
      const dy = point.y - prevPoint.y;
      length += Math.sqrt(dx * dx + dy * dy);
      prevPoint = point;
    }

    return length;
  }

  // Calculate point on Bezier curve at t
  private bezierPoint(
    t: number,
    p0: Point,
    p1: Point,
    p2: Point,
    p3: Point,
  ): Point {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;

    return {
      x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
      y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
    };
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
        state.game.boardRadius,
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

    // Draw flow paths in player color using the same method as placed tiles
    const connections = getFlowConnections(tileType, rotation as any);
    connections.forEach(([dir1, dir2]) => {
      this.drawFlowConnection(center, dir1, dir2, playerColor, 1.0, false);
    });

    this.ctx.globalAlpha = 1.0;
  }

  private renderActionButtons(state: RootState): void {
    if (!state.ui.selectedPosition || state.game.currentTile === null) {
      return;
    }

    // Calculate button positions relative to selected hex
    const center = hexToPixel(state.ui.selectedPosition, this.layout);
    const buttonSize = this.layout.size * 0.8;
    const buttonSpacing = this.layout.size * 2;

    // Check if the move is legal
    const placedTile: PlacedTile = {
      type: state.game.currentTile,
      rotation: state.ui.currentRotation,
      position: state.ui.selectedPosition,
    };

    const isLegal = isLegalMove(
      state.game.board,
      placedTile,
      state.game.players,
      state.game.teams,
      state.game.boardRadius,
      state.ui.settings.supermove,
    );

    // Get blocked players if move is illegal
    let blockedPlayers: typeof state.game.players = [];
    if (!isLegal) {
      const blockedPlayerIds = getBlockedPlayers(
        state.game.board,
        placedTile,
        state.game.players,
        state.game.teams,
        state.game.boardRadius,
      );
      blockedPlayers = state.game.players.filter((p) =>
        blockedPlayerIds.includes(p.id),
      );
    }

    // Check if this is a replacement move (supermove)
    // Only show supermove checkmark if: supermove enabled, player is blocked, AND position is occupied
    const currentPlayer = state.game.players[state.game.currentPlayerIndex];
    const posKey = positionToKey(state.ui.selectedPosition);
    const isOccupied = state.game.board.has(posKey);
    const hasSupermove = state.ui.settings.supermove && currentPlayer && isOccupied &&
      isPlayerBlocked(
        state.game.board,
        currentPlayer,
        state.game.players,
        state.game.teams,
        state.game.boardRadius
      );

    // Checkmark button (to the right)
    const checkPos = { x: center.x + buttonSpacing, y: center.y };
    this.renderCheckmarkButton(checkPos, buttonSize, isLegal, hasSupermove);

    // X button (to the left)
    const xPos = { x: center.x - buttonSpacing, y: center.y };
    this.renderXButton(xPos, buttonSize);

    // Show blocked players warning if move is illegal
    if (!isLegal && blockedPlayers.length > 0) {
      this.renderBlockedPlayersWarning(center, blockedPlayers);
    }
  }

  private renderCheckmarkButton(
    center: Point,
    size: number,
    enabled: boolean,
    hasSupermove: boolean = false,
  ): void {
    // Get glow intensity for supermove animation (same as victory glow)
    const glowIntensity = victoryAnimationState.glowIntensity;

    this.ctx.save();

    // Add glow effect for supermove
    if (hasSupermove) {
      // White glow for supermove
      this.ctx.shadowBlur = 20 * glowIntensity;
      this.ctx.shadowColor = "#FFFFFF";
    }

    // Draw button background
    if (hasSupermove) {
      // Golden background with glow for supermove
      this.ctx.fillStyle = `rgba(255, 215, 0, ${0.7 + 0.2 * glowIntensity})`;
    } else {
      this.ctx.fillStyle = enabled
        ? "rgba(76, 175, 80, 0.8)"
        : "rgba(85, 85, 85, 0.8)";
    }
    this.ctx.beginPath();
    this.ctx.arc(center.x, center.y, size / 2, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw checkmark icon
    if (hasSupermove) {
      // White checkmark with pulsing opacity
      this.ctx.globalAlpha = 0.9 + 0.1 * glowIntensity;
      this.ctx.strokeStyle = "#FFFFFF";
    } else {
      this.ctx.strokeStyle = enabled ? BUTTON_ICON : "#999999";
    }
    this.ctx.lineWidth = size * 0.15;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    this.ctx.beginPath();
    this.ctx.moveTo(center.x - size * 0.25, center.y);
    this.ctx.lineTo(center.x - size * 0.05, center.y + size * 0.2);
    this.ctx.lineTo(center.x + size * 0.3, center.y - size * 0.2);
    this.ctx.stroke();

    this.ctx.restore();
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

  private renderBlockedPlayersWarning(
    tileCenter: Point,
    blockedPlayers: Array<{ id: string; color: string }>,
  ): void {
    // Show warning message below the tile
    const warningY = tileCenter.y + this.layout.size * 1.5;

    // Draw warning background
    const padding = 10;
    const lineHeight = 20;
    const warningText = "Would block:";

    this.ctx.font = "bold 14px sans-serif";
    const warningWidth = this.ctx.measureText(warningText).width;

    // Calculate max player name width
    this.ctx.font = "12px sans-serif";
    let maxPlayerWidth = warningWidth;
    blockedPlayers.forEach((player) => {
      const playerText = `Player ${player.id}`;
      const textWidth = this.ctx.measureText(playerText).width;
      if (textWidth > maxPlayerWidth) {
        maxPlayerWidth = textWidth;
      }
    });

    const boxWidth = maxPlayerWidth + padding * 3;
    const boxHeight = lineHeight * (blockedPlayers.length + 1) + padding * 2;

    // Draw semi-transparent background
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    this.ctx.fillRect(
      tileCenter.x - boxWidth / 2,
      warningY - padding,
      boxWidth,
      boxHeight,
    );

    // Draw border
    this.ctx.strokeStyle = "rgba(255, 165, 0, 0.9)";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(
      tileCenter.x - boxWidth / 2,
      warningY - padding,
      boxWidth,
      boxHeight,
    );

    // Draw warning text
    this.ctx.font = "bold 14px sans-serif";
    this.ctx.fillStyle = "rgba(255, 165, 0, 1)";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "top";
    this.ctx.fillText(warningText, tileCenter.x, warningY);

    // Draw each blocked player with their color
    this.ctx.font = "12px sans-serif";
    blockedPlayers.forEach((player, index) => {
      const y = warningY + lineHeight + index * lineHeight;

      // Draw colored circle indicator
      const circleRadius = 6;
      const circleX = tileCenter.x - maxPlayerWidth / 2 + padding;
      this.ctx.fillStyle = player.color;
      this.ctx.beginPath();
      this.ctx.arc(circleX, y + lineHeight / 2, circleRadius, 0, Math.PI * 2);
      this.ctx.fill();

      // Draw player text
      this.ctx.fillStyle = "#ffffff";
      this.ctx.textAlign = "left";
      this.ctx.fillText(`Player ${player.id}`, circleX + circleRadius + 5, y);
    });

    // Reset text alignment
    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "alphabetic";
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

  private renderDebugLegalityPaths(state: RootState): void {
    // Log debug mode status once
    if (!(window as any).__debugLegalityLogged) {
      console.log(
        "%c[DEBUG_LEGALITY_TEST] Debug mode enabled",
        "color: #00ff00; font-weight: bold",
      );
      console.log("Showing edge-level winning paths for all players");
      console.log("- Light lines/dots: all visited edges during BFS");
      console.log(
        "- Thick dashed line: the winning path through specific edges",
      );
      console.log("- Large dots: specific hex edges on the path");
      console.log(
        "Each edge is shown as a line from hex center to edge midpoint",
      );
      (window as any).__debugLegalityLogged = true;
    }

    // Include the previewed tile in the board state if one exists
    let boardToUse = state.game.board;
    if (state.ui.selectedPosition && state.game.currentTile !== null) {
      // Create a new board with the previewed tile placement
      boardToUse = new Map(state.game.board);
      const previewedTile: PlacedTile = {
        type: state.game.currentTile,
        rotation: state.ui.currentRotation,
        position: state.ui.selectedPosition,
      };
      boardToUse.set(positionToKey(state.ui.selectedPosition), previewedTile);
    }

    // Get debug path information for all players with the previewed tile
    const debugInfo = getDebugPathInfo(
      boardToUse,
      state.game.players,
      state.game.teams,
      state.game.boardRadius,
    );

    // Render each player's path information
    debugInfo.forEach((info: any) => {
      // Skip if no path
      if (!info.hasPath) {
        return;
      }

      // Draw visited edges (lighter lines)
      this.ctx.strokeStyle = info.playerColor;
      this.ctx.lineWidth = 2;
      this.ctx.globalAlpha = 0.15;

      for (const edge of info.visitedEdges) {
        const center = hexToPixel(edge.position, this.layout);
        const edgeMid = getEdgeMidpoint(
          center,
          this.layout.size,
          edge.direction,
        );

        // Draw a small line from center toward the edge
        this.ctx.beginPath();
        this.ctx.moveTo(center.x, center.y);
        this.ctx.lineTo(edgeMid.x, edgeMid.y);
        this.ctx.stroke();

        // Draw a small circle at the edge
        this.ctx.beginPath();
        this.ctx.arc(edgeMid.x, edgeMid.y, 3, 0, Math.PI * 2);
        this.ctx.fill();
      }

      this.ctx.globalAlpha = 1.0;

      // Draw path edges (thicker, more visible)
      this.ctx.strokeStyle = info.playerColor;
      this.ctx.lineWidth = 4;
      this.ctx.globalAlpha = 0.7;
      this.ctx.setLineDash([8, 4]);

      if (info.pathEdges.length > 0) {
        this.ctx.beginPath();

        // Start from the first edge
        const firstEdge = info.pathEdges[0];
        const firstCenter = hexToPixel(firstEdge.position, this.layout);
        const firstEdgeMid = getEdgeMidpoint(
          firstCenter,
          this.layout.size,
          firstEdge.direction,
        );
        this.ctx.moveTo(firstEdgeMid.x, firstEdgeMid.y);

        // Draw lines through subsequent edges
        for (let i = 1; i < info.pathEdges.length; i++) {
          const edge = info.pathEdges[i];
          const center = hexToPixel(edge.position, this.layout);
          const edgeMid = getEdgeMidpoint(
            center,
            this.layout.size,
            edge.direction,
          );
          this.ctx.lineTo(edgeMid.x, edgeMid.y);
        }

        this.ctx.stroke();
      }

      this.ctx.setLineDash([]);
      this.ctx.globalAlpha = 1.0;

      // Draw path edge markers (filled circles)
      this.ctx.fillStyle = info.playerColor;
      this.ctx.globalAlpha = 0.8;

      for (const edge of info.pathEdges) {
        const center = hexToPixel(edge.position, this.layout);
        const edgeMid = getEdgeMidpoint(
          center,
          this.layout.size,
          edge.direction,
        );

        this.ctx.beginPath();
        this.ctx.arc(edgeMid.x, edgeMid.y, 5, 0, Math.PI * 2);
        this.ctx.fill();
      }

      this.ctx.globalAlpha = 1.0;
    });

    // Draw legend in top-right corner
    const legendX = this.layout.canvasWidth - 250;
    const legendY = 80;
    const lineHeight = 25;

    // Background
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    this.ctx.fillRect(
      legendX - 10,
      legendY - 10,
      240,
      debugInfo.length * lineHeight + 40,
    );

    // Title
    this.ctx.fillStyle = "#ffffff";
    this.ctx.font = "bold 14px sans-serif";
    this.ctx.textAlign = "left";
    this.ctx.fillText("DEBUG: Winning Paths", legendX, legendY + 10);

    // Player info
    this.ctx.font = "12px sans-serif";
    debugInfo.forEach((info: any, index: number) => {
      const y = legendY + 30 + index * lineHeight;

      // Color indicator
      this.ctx.fillStyle = info.playerColor;
      this.ctx.beginPath();
      this.ctx.arc(legendX + 10, y, 6, 0, Math.PI * 2);
      this.ctx.fill();

      // Player text
      this.ctx.fillStyle = info.hasPath ? "#00ff00" : "#ff0000";
      this.ctx.fillText(
        `${info.playerId}: ${info.hasPath ? "PATH FOUND" : "NO PATH"}`,
        legendX + 25,
        y + 4,
      );

      // Path length
      if (info.hasPath) {
        this.ctx.fillStyle = "#aaaaaa";
        this.ctx.fillText(
          `(${info.pathEdges?.length || 0} edges)`,
          legendX + 25,
          y + 16,
        );
      }
    });

    // Reset text alignment
    this.ctx.textAlign = "left";
  }

  getLayout(): HexLayout {
    return this.layout;
  }
}
