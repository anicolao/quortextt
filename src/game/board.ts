// Hexagonal board utilities for Quortex/Flows
// Uses axial coordinate system for hex positions

import { HexPosition, Direction } from "./types";

// Helper to create position key for Map storage
export function positionToKey(pos: HexPosition): string {
  return `${pos.row},${pos.col}`;
}

// Helper to parse position from key
export function keyToPosition(key: string): HexPosition {
  const [row, col] = key.split(",").map(Number);
  return { row, col };
}

// Get all valid hex positions on the board
// The board is diamond-shaped with rows from -radius to +radius
export function getAllBoardPositions(radius: number = 3): HexPosition[] {
  const positions: HexPosition[] = [];

  // For each row from -radius to +radius
  for (let row = -radius; row <= radius; row++) {
    // Calculate column range for this row
    // The diamond shape means columns are constrained based on row
    const colStart = Math.max(-radius, -radius - row);
    const colEnd = Math.min(radius, radius - row);

    for (let col = colStart; col <= colEnd; col++) {
      positions.push({ row, col });
    }
  }

  return positions;
}

// Check if a position is valid on the board
export function isValidPosition(pos: HexPosition, radius: number = 3): boolean {
  // Check if within diamond bounds
  const absRow = Math.abs(pos.row);
  const absCol = Math.abs(pos.col);
  const absSum = Math.abs(pos.row + pos.col);

  return absRow <= radius && absCol <= radius && absSum <= radius;
}

// Direction vectors in axial coordinates
// These represent the offset to move in each direction
const DIRECTION_VECTORS: Record<Direction, HexPosition> = {
  [Direction.SouthWest]: { row: -1, col: 0 },
  [Direction.West]: { row: 0, col: -1 },
  [Direction.NorthWest]: { row: 1, col: -1 },
  [Direction.NorthEast]: { row: 1, col: 0 },
  [Direction.East]: { row: 0, col: 1 },
  [Direction.SouthEast]: { row: -1, col: 1 },
};

// Get neighboring position in a given direction
export function getNeighborInDirection(
  pos: HexPosition,
  direction: Direction,
): HexPosition {
  const offset = DIRECTION_VECTORS[direction];
  return {
    row: pos.row + offset.row,
    col: pos.col + offset.col,
  };
}

// Get all neighboring positions for a hex
export function getNeighbors(pos: HexPosition, radius: number = 3): HexPosition[] {
  const neighbors: HexPosition[] = [];

  for (let dir = 0; dir < 6; dir++) {
    const neighbor = getNeighborInDirection(pos, dir as Direction);
    if (isValidPosition(neighbor, radius)) {
      neighbors.push(neighbor);
    }
  }

  return neighbors;
}

// Get the direction from one position to a neighboring position
// Returns null if positions are not adjacent
export function getDirection(
  from: HexPosition,
  to: HexPosition,
): Direction | null {
  const deltaRow = to.row - from.row;
  const deltaCol = to.col - from.col;

  // Check each direction
  for (let dir = 0; dir < 6; dir++) {
    const offset = DIRECTION_VECTORS[dir as Direction];
    if (offset.row === deltaRow && offset.col === deltaCol) {
      return dir as Direction;
    }
  }

  return null;
}

// Get the opposite direction (180 degrees)
export function getOppositeDirection(direction: Direction): Direction {
  return ((direction + 3) % 6) as Direction;
}

// Rotate a direction by a number of steps (60 degrees per step)
export function rotateDirection(
  direction: Direction,
  steps: number,
): Direction {
  // We add 6 to handle negative steps, ensuring the result is always non-negative
  return ((direction + steps + 6) % 6) as Direction;
}

// Get edge positions for a player based on their edge number (0-5)
// Edge 0 is top-left (NorthWest), going clockwise
export function getEdgePositions(edgeNumber: number, radius: number = 3): HexPosition[] {
  const edge = edgeNumber % 6;
  const positions: HexPosition[] = [];

  switch (edge) {
    case 0: // NorthWest edge (top-left) - row = -radius
      for (let col = 0; col <= radius; col++) {
        positions.push({ row: -radius, col });
      }
      break;
    case 1: // NorthEast edge (top-right) - col = radius
      for (let row = -radius; row <= 0; row++) {
        positions.push({ row, col: radius });
      }
      break;
    case 2: // East edge (right) - row + col = radius
      for (let row = 0; row <= radius; row++) {
        positions.push({ row, col: radius - row });
      }
      break;
    case 3: // SouthEast edge (bottom-right) - row = radius
      for (let col = -radius; col <= 0; col++) {
        positions.push({ row: radius, col });
      }
      break;
    case 4: // SouthWest edge (bottom-left) - col = -radius
      for (let row = 0; row <= radius; row++) {
        positions.push({ row, col: -radius });
      }
      break;
    case 5: // West edge (left) - row + col = -radius
      for (let row = -radius; row <= 0; row++) {
        positions.push({ row, col: -radius - row });
      }
      break;
  }

  return positions;
}

// Get the opposite edge number (the edge directly across the board)
export function getOppositeEdge(edgeNumber: number): number {
  return (edgeNumber + 3) % 6;
}

// Get edge positions with their specific hex edge directions
// Returns array of [position, direction] pairs where direction indicates
// which hex edge faces the board edge and can accept flow from the player's edge
export function getEdgePositionsWithDirections(
  edgeNumber: number,
  radius: number = 3,
): Array<{ pos: HexPosition; dir: Direction }> {
  const edge = edgeNumber % 6;
  const result: Array<{ pos: HexPosition; dir: Direction }> = [];
  const edgePositions = getEdgePositions(edge, radius);

  // For each edge, define the two inward-facing directions for all hexes on that edge.
  // These pairs are ordered to match the clockwise enumeration of edges starting from edge 0 (NW).
  const directionPairs: Direction[][] = [
    [Direction.SouthWest, Direction.SouthEast], // Edge 0 (NW): Inward is South
    [Direction.SouthEast, Direction.East], // Edge 5 (W): Inward is East
    [Direction.East, Direction.NorthEast], // Edge 4 (SW): Inward is NE
    [Direction.NorthWest, Direction.NorthEast], // Edge 3 (SE): Inward is North
    [Direction.West, Direction.NorthWest], // Edge 2 (E): Inward is West
    [Direction.SouthWest, Direction.West], // Edge 1 (NE): Inward is SW
  ];

  const directions = directionPairs[edge];

  // Assign both inward-facing directions to every hex on the edge
  for (const pos of edgePositions) {
    result.push({ pos, dir: directions[0] });
    result.push({ pos, dir: directions[1] });
  }

  if (edgeNumber < 3) {
    return result.slice(0, -1);
  }
  return result.slice(1);
}
