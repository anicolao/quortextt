// Hexagon layout and coordinate conversion utilities
// Implements pointy-top hexagon layout for rendering

import { HexPosition, Direction } from "../game/types";

// Point in pixel coordinates
export interface Point {
  x: number;
  y: number;
}

// Hexagon layout parameters
export interface HexLayout {
  // Hexagon size (distance from center to vertex)
  size: number;
  // Origin point (center of the board)
  origin: Point;
  // Canvas dimensions
  canvasWidth: number;
  canvasHeight: number;
}

// Calculate optimal hex layout for the canvas
export function calculateHexLayout(
  canvasWidth: number,
  canvasHeight: number,
): HexLayout {
  const minDimension = Math.min(canvasWidth, canvasHeight);
  const size = minDimension / 17;

  // Center of the canvas
  const origin: Point = {
    x: canvasWidth / 2,
    y: canvasHeight / 2,
  };

  return { size, origin, canvasWidth, canvasHeight };
}

// Convert hex position to pixel coordinates (pointy-top orientation)
export function hexToPixel(hex: HexPosition, layout: HexLayout): Point {
  // Pointy-top hexagon orientation
  // x = size * (sqrt(3) * col + sqrt(3)/2 * row)
  // y = size * (3/2 * row)
  const x =
    layout.origin.x +
    layout.size * (Math.sqrt(3) * hex.col + (Math.sqrt(3) / 2) * hex.row);
  const y = layout.origin.y + layout.size * ((3 / 2) * hex.row);

  return { x, y };
}

// Convert pixel coordinates to hex position (pointy-top orientation)
export function pixelToHex(point: Point, layout: HexLayout): HexPosition {
  // Inverse of hexToPixel
  const relX = (point.x - layout.origin.x) / layout.size;
  const relY = (point.y - layout.origin.y) / layout.size;

  // Convert from pixel to axial coordinates
  const col = (Math.sqrt(3) / 3) * relX - (1 / 3) * relY;
  const row = (2 / 3) * relY;

  // Round to nearest hex
  return roundHex({ row, col });
}

// Round fractional hex coordinates to nearest integer hex
function roundHex(hex: { row: number; col: number }): HexPosition {
  // Convert to cube coordinates for rounding
  const x = hex.col;
  const z = hex.row;
  const y = -x - z;

  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);

  const xDiff = Math.abs(rx - x);
  const yDiff = Math.abs(ry - y);
  const zDiff = Math.abs(rz - z);

  // Reset the component with the largest difference
  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return { row: rz, col: rx };
}

// Get the pixel coordinates for a hex vertex (pointy-top)
// Vertex 0 is at the top, going clockwise
export function getHexVertex(
  center: Point,
  size: number,
  vertex: number,
): Point {
  const angleDeg = 60 * vertex - 30; // Offset by -30 for pointy-top
  const angleRad = (Math.PI / 180) * angleDeg;
  return {
    x: center.x + size * Math.cos(angleRad),
    y: center.y + size * Math.sin(angleRad),
  };
}

// Get all 6 vertices of a hexagon
export function getHexVertices(center: Point, size: number): Point[] {
  const vertices: Point[] = [];
  for (let i = 0; i < 6; i++) {
    vertices.push(getHexVertex(center, size, i));
  }
  return vertices;
}

// Get the midpoint of a hex edge (for flow rendering)
export function getEdgeMidpoint(
  center: Point,
  size: number,
  direction: Direction,
): Point {
  // For pointy-top hexagons, get the actual edge midpoints by averaging vertices
  // Direction maps to edges between vertices:
  // Vertices are at angles: -30°, 30°, 90°, 150°, 210°, 270° (indices 0-5)
  // Note: Rendering appears to be vertically flipped, so North/South are swapped from typical screen coordinates
  // SouthWest (0): 240° (up-left in render) = vertices 4-5
  // West (1): 180° (left) = vertices 3-4
  // NorthWest (2): 120° (down-left in render) = vertices 2-3
  // NorthEast (3): 60° (down-right in render) = vertices 1-2
  // East (4): 0° (right) = vertices 0-1
  // SouthEast (5): 300° (up-right in render) = vertices 5-0

  const vertexPairs = [
    [4, 5], // SouthWest (240°)
    [3, 4], // West (180°)
    [2, 3], // NorthWest (120°)
    [1, 2], // NorthEast (60°)
    [0, 1], // East (0°)
    [5, 0], // SouthEast (300°)
  ];

  const [v1Index, v2Index] = vertexPairs[direction];
  const v1 = getHexVertex(center, size, v1Index);
  const v2 = getHexVertex(center, size, v2Index);

  // Return the midpoint between the two vertices
  return {
    x: (v1.x + v2.x) / 2,
    y: (v1.y + v2.y) / 2,
  };
}

// Get the perpendicular vector for a direction (for Bézier control points)
export function getPerpendicularVector(
  direction: Direction,
  size: number,
): Point {
  const center = { x: 0, y: 0 }; // Relative to tile center
  const edgeMidpoint = getEdgeMidpoint(center, size, direction);

  // Vector from edge midpoint toward center
  const towardCenter = {
    x: center.x - edgeMidpoint.x,
    y: center.y - edgeMidpoint.y,
  };

  const distance = 0.5;

  return {
    x: towardCenter.x * distance,
    y: towardCenter.y * distance,
  };
}

// Get position for player's tile preview by their edge
export function getPlayerEdgePosition(
  edgePosition: number,
  layout: HexLayout,
): Point {
  // Board extends to about 7.2 * hex size from center
  // Place preview just beyond the board edge at about 8.0 * hex size
  const boardRadius = layout.size * 7.2;
  const previewDistance = boardRadius + layout.size * 1.5;

  // Map edge positions to angles for flat-top hexagon
  // Edge 0 should be at bottom (270°) parallel to screen bottom
  // Going clockwise: bottom, bottom-right, top-right, top, top-left, bottom-left
  const angles = [
    270, // Edge 0: Bottom (parallel to screen bottom)
    330, // Edge 1: Bottom-right
    30,  // Edge 2: Top-right
    90,  // Edge 3: Top
    150, // Edge 4: Top-left
    210, // Edge 5: Bottom-left
  ];

  const angleDeg = angles[edgePosition];
  const angleRad = (Math.PI / 180) * angleDeg;

  return {
    x: layout.origin.x + previewDistance * Math.cos(angleRad),
    y: layout.origin.y + previewDistance * Math.sin(angleRad),
  };
}

// Check if a point is inside a hexagon
export function isPointInHex(
  point: Point,
  hexCenter: Point,
  size: number,
): boolean {
  const vertices = getHexVertices(hexCenter, size);

  // Use ray casting algorithm
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x;
    const yi = vertices[i].y;
    const xj = vertices[j].x;
    const yj = vertices[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}
