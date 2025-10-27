// Hexagon layout and coordinate conversion utilities
// Implements pointy-top hexagon layout for rendering

import { HexPosition, Direction } from '../game/types';

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
  canvasHeight: number
): HexLayout {
  // Board has 37 hexes in a diamond shape with radius 3
  // maxBoardDimension = 5 (from -3 to +3 is 7 positions, but effective dimension is 5)
  const maxBoardDimension = 5;
  const padding = 3; // Extra space for player tile previews outside board

  // Calculate hex size to fit the board
  // For pointy-top hexagons, we need to consider both width and height
  const availableWidth = canvasWidth / (2 * maxBoardDimension + padding);
  const availableHeight = canvasHeight / (2 * maxBoardDimension + padding);
  
  // For pointy-top hexagons:
  // width = sqrt(3) * size
  // height = 2 * size
  const sizeFromWidth = availableWidth / Math.sqrt(3);
  const sizeFromHeight = availableHeight / 2;
  
  const size = Math.min(sizeFromWidth, sizeFromHeight) * 0.9; // 0.9 to ensure some margin

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
  const x = layout.origin.x + layout.size * (Math.sqrt(3) * hex.col + Math.sqrt(3) / 2 * hex.row);
  const y = layout.origin.y + layout.size * (3 / 2 * hex.row);
  
  return { x, y };
}

// Convert pixel coordinates to hex position (pointy-top orientation)
export function pixelToHex(point: Point, layout: HexLayout): HexPosition {
  // Inverse of hexToPixel
  const relX = (point.x - layout.origin.x) / layout.size;
  const relY = (point.y - layout.origin.y) / layout.size;
  
  // Convert from pixel to axial coordinates
  const col = (Math.sqrt(3) / 3 * relX - 1 / 3 * relY);
  const row = (2 / 3 * relY);
  
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
export function getHexVertex(center: Point, size: number, vertex: number): Point {
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
export function getEdgeMidpoint(center: Point, size: number, direction: Direction): Point {
  // For pointy-top hexagons, edges are perpendicular to directions
  // Direction.SouthWest = 0 corresponds to the edge between vertices 4 and 5
  // We need to map directions to edges
  const edgeAngles = [
    210, // SouthWest edge
    270, // West edge
    330, // NorthWest edge
    30,  // NorthEast edge
    90,  // East edge
    150, // SouthEast edge
  ];
  
  const angleDeg = edgeAngles[direction];
  const angleRad = (Math.PI / 180) * angleDeg;
  
  // Edge midpoints are at distance sqrt(3)/2 * size from center
  const distance = (Math.sqrt(3) / 2) * size;
  
  return {
    x: center.x + distance * Math.cos(angleRad),
    y: center.y + distance * Math.sin(angleRad),
  };
}

// Get the perpendicular vector for a direction (for Bézier control points)
export function getPerpendicularVector(direction: Direction, size: number): Point {
  // Get the inward perpendicular vector for control points
  const edgeAngles = [
    210, // SouthWest
    270, // West
    330, // NorthWest
    30,  // NorthEast
    90,  // East
    150, // SouthEast
  ];
  
  const angleDeg = edgeAngles[direction];
  const angleRad = (Math.PI / 180) * angleDeg;
  
  // Perpendicular inward is 180 degrees from edge normal
  const perpAngle = angleRad + Math.PI;
  
  // Control point distance is about 30% of hex radius
  const distance = size * 0.3;
  
  return {
    x: distance * Math.cos(perpAngle),
    y: distance * Math.sin(perpAngle),
  };
}

// Get position for player's tile preview by their edge
export function getPlayerEdgePosition(
  edgePosition: number,
  layout: HexLayout
): Point {
  // Players are positioned around the board at their edge
  // Edge 0 is at bottom (SouthWest), going clockwise
  // We need to place the tile preview outside the board
  
  const boardRadius = layout.size * 4; // Approximate board radius
  const previewDistance = boardRadius * 1.3; // Distance from center to preview position
  
  // Map edge positions to angles
  // Edge 0 (SouthWest) should be at bottom, etc.
  const angles = [
    210, // Edge 0: SouthWest (bottom-left)
    270, // Edge 1: West (left)
    330, // Edge 2: NorthWest (top-left)
    30,  // Edge 3: NorthEast (top-right)
    90,  // Edge 4: East (right)
    150, // Edge 5: SouthEast (bottom-right)
  ];
  
  const angleDeg = angles[edgePosition];
  const angleRad = (Math.PI / 180) * angleDeg;
  
  return {
    x: layout.origin.x + previewDistance * Math.cos(angleRad),
    y: layout.origin.y + previewDistance * Math.sin(angleRad),
  };
}

// Check if a point is inside a hexagon
export function isPointInHex(point: Point, hexCenter: Point, size: number): boolean {
  const vertices = getHexVertices(hexCenter, size);
  
  // Use ray casting algorithm
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x;
    const yi = vertices[i].y;
    const xj = vertices[j].x;
    const yj = vertices[j].y;
    
    const intersect = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  
  return inside;
}
