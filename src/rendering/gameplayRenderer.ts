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
} from "../game/board";
import { victoryAnimationState } from "../animation/victoryAnimations";
import { isConnectionInWinningPath } from "../game/victory";
import { TileType, PlacedTile, Direction } from "../game/types";
import { getFlowConnections } from "../game/tiles";
import { getFlowPreviewData } from "../animation/flowPreview";
import { isLegalMove, getBlockedPlayers } from "../game/legality";

// UI Colors from design spec
const CANVAS_BG = "#e8e8e8"; // Light gray "table"
const BOARD_HEX_BG = "#000000"; // Black
const TILE_BG = "#2a2a2a"; // Dark gray
const TILE_BORDER = "#444444"; // Slightly lighter gray
const BUTTON_ICON = "#ffffff"; // White

// Debug configuration
const DEBUG_SHOW_EDGE_LABELS = false; // Show edge direction labels (0-5) on each hexagon
const DEBUG_SHOW_VICTORY_EDGES = false; // Highlight victory condition edges for each player

export class GameplayRenderer {
  private ctx: CanvasRenderingContext2D;
  private layout: HexLayout;
  private bezierLengthCache: Map<string, number> = new Map();

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
    // Clear cache when layout changes
    this.bezierLengthCache.clear();
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
    // Debug rendering: Highlight the victory condition edges
    // Victory edges are the same as the start edges for a player on the opposite side
    if (state.game.players.length === 0) return;

    state.game.players.forEach((player) => {
      const targetEdge = getOppositeEdge(player.edgePosition);
      const targetEdgeData = getEdgePositionsWithDirections(targetEdge);

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
      const hasFlow =
        tileFlowEdges &&
        tileFlowEdges.get(dir1) === tileFlowEdges.get(dir2) &&
        tileFlowEdges.get(dir1) !== undefined;

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
    const winnerId = state.game.winner;

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
            winnerId !== null &&
            this.isWinningFlow(winnerId, playerId, state) &&
            isConnectionInWinningPath(
              tile.position,
              animData.direction1 as Direction,
              animData.direction2 as Direction,
              playerId,
              state.game.flows,
              state.game.flowEdges,
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

          if (player1 && player1 === player2) {
            const player = state.game.players.find((p) => p.id === player1);
            if (player) {
              // Check if this specific connection is part of the winning path
              const shouldGlow =
                isGameOver &&
                winnerId !== null &&
                this.isWinningFlow(winnerId, player1, state) &&
                isConnectionInWinningPath(
                  tile.position,
                  dir1 as Direction,
                  dir2 as Direction,
                  player1,
                  state.game.flows,
                  state.game.flowEdges,
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
    });
  }

  private isWinningFlow(
    winnerId: string,
    playerId: string,
    state: RootState,
  ): boolean {
    // Check if the flow belongs to the winning player or team
    if (winnerId === playerId) {
      return true;
    }

    // Check if it's a team victory
    const team = state.game.teams.find(
      (t) => `team-${t.player1Id}-${t.player2Id}` === winnerId,
    );

    if (team && (team.player1Id === playerId || team.player2Id === playerId)) {
      return true;
    }

    return false;
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
    this.ctx.lineWidth = this.layout.size * 0.15;
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
    if (!state.ui.selectedPosition || state.game.currentTile === null) return;

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
    );

    // Get blocked players if move is illegal
    let blockedPlayers: typeof state.game.players = [];
    if (!isLegal) {
      const blockedPlayerIds = getBlockedPlayers(
        state.game.board,
        placedTile,
        state.game.players,
        state.game.teams,
      );
      blockedPlayers = state.game.players.filter((p) =>
        blockedPlayerIds.includes(p.id),
      );
    }

    // Checkmark button (to the right)
    const checkPos = { x: center.x + buttonSpacing, y: center.y };
    this.renderCheckmarkButton(checkPos, buttonSize, isLegal);

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

  getLayout(): HexLayout {
    return this.layout;
  }
}
