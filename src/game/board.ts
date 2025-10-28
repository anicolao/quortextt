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

// Get all valid hex positions on the 37-tile diamond board
// The board is diamond-shaped with rows from -3 to +3
export function getAllBoardPositions(): HexPosition[] {
  const positions: HexPosition[] = [];

  // For each row from -3 to 3
  for (let row = -3; row <= 3; row++) {
    // Calculate column range for this row
    // The diamond shape means columns are constrained based on row
    const colStart = Math.max(-3, -3 - row);
    const colEnd = Math.min(3, 3 - row);

    for (let col = colStart; col <= colEnd; col++) {
      positions.push({ row, col });
    }
  }

  return positions;
}

// Check if a position is valid on the board
export function isValidPosition(pos: HexPosition): boolean {
  // Check if within diamond bounds
  const absRow = Math.abs(pos.row);
  const absCol = Math.abs(pos.col);
  const absSum = Math.abs(pos.row + pos.col);

  return absRow <= 3 && absCol <= 3 && absSum <= 3;
}

// Direction vectors in axial coordinates
// These represent the offset to move in each direction
const DIRECTION_VECTORS: Record<Direction, HexPosition> = {
  [Direction.SouthWest]: { row: 1, col: -1 },
  [Direction.West]: { row: 0, col: -1 },
  [Direction.NorthWest]: { row: -1, col: 0 },
  [Direction.NorthEast]: { row: -1, col: 1 },
  [Direction.East]: { row: 0, col: 1 },
  [Direction.SouthEast]: { row: 1, col: 0 },
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
export function getNeighbors(pos: HexPosition): HexPosition[] {
  const neighbors: HexPosition[] = [];

  for (let dir = 0; dir < 6; dir++) {
    const neighbor = getNeighborInDirection(pos, dir as Direction);
    if (isValidPosition(neighbor)) {
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
export function getEdgePositions(edgeNumber: number): HexPosition[] {
  const edge = edgeNumber % 6;
  const positions: HexPosition[] = [];

  switch (edge) {
    case 0: // NorthWest edge (top-left) - row = -3
      for (let col = 0; col <= 3; col++) {
        positions.push({ row: -3, col });
      }
      break;
    case 1: // NorthEast edge (top-right) - col = 3
      for (let row = -3; row <= 0; row++) {
        positions.push({ row, col: 3 });
      }
      break;
    case 2: // East edge (right) - row + col = 3
      for (let row = 0; row <= 3; row++) {
        positions.push({ row, col: 3 - row });
      }
      break;
    case 3: // SouthEast edge (bottom-right) - row = 3
      for (let col = -3; col <= 0; col++) {
        positions.push({ row: 3, col });
      }
      break;
    case 4: // SouthWest edge (bottom-left) - col = -3
      for (let row = 0; row <= 3; row++) {
        positions.push({ row, col: -3 });
      }
      break;
    case 5: // West edge (left) - row + col = -3
      for (let row = -3; row <= 0; row++) {
        positions.push({ row, col: -3 - row });
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
): Array<{ pos: HexPosition; dir: Direction }> {
  const edge = edgeNumber % 6;
  const result: Array<{ pos: HexPosition; dir: Direction }> = [];

  switch (edge) {
    case 0: // North edge (top-left) - row = -3
      // Only the hex edges that face outward (toward NW) are used
      result.push({ pos: { row: -3, col: 0 }, dir: Direction.SouthWest });
      result.push({ pos: { row: -3, col: 0 }, dir: Direction.SouthEast });
      result.push({ pos: { row: -3, col: 1 }, dir: Direction.SouthWest });
      result.push({ pos: { row: -3, col: 1 }, dir: Direction.SouthEast });
      result.push({ pos: { row: -3, col: 2 }, dir: Direction.SouthWest });
      result.push({ pos: { row: -3, col: 2 }, dir: Direction.SouthEast });
      result.push({ pos: { row: -3, col: 3 }, dir: Direction.SouthWest });
      break;
    case 1: // NorthEast edge (top-right) - col = 3
      // Only the hex edges that face outward (toward NE) are used
      result.push({
        pos: { row: -3, col: 3 },
        dir: rotateDirection(Direction.NorthEast, 2),
      });
      result.push({
        pos: { row: -2, col: 3 },
        dir: rotateDirection(Direction.NorthWest, 2),
      });
      result.push({
        pos: { row: -2, col: 3 },
        dir: rotateDirection(Direction.NorthEast, 2),
      });
      result.push({
        pos: { row: -1, col: 3 },
        dir: rotateDirection(Direction.NorthWest, 2),
      });
      result.push({
        pos: { row: -1, col: 3 },
        dir: rotateDirection(Direction.NorthEast, 2),
      });
      result.push({
        pos: { row: 0, col: 3 },
        dir: rotateDirection(Direction.NorthWest, 2),
      });
      result.push({
        pos: { row: 0, col: 3 },
        dir: rotateDirection(Direction.NorthEast, 2),
      });
      break;
    case 2: // East edge (right) - row + col = 3
      // Only the hex edges that face outward (toward E) are used
      result.push({
        pos: { row: 0, col: 3 },
        dir: rotateDirection(Direction.East, 2),
      });
      result.push({
        pos: { row: 1, col: 2 },
        dir: rotateDirection(Direction.NorthEast, 2),
      });
      result.push({
        pos: { row: 1, col: 2 },
        dir: rotateDirection(Direction.East, 2),
      });
      result.push({
        pos: { row: 2, col: 1 },
        dir: rotateDirection(Direction.NorthEast, 2),
      });
      result.push({
        pos: { row: 2, col: 1 },
        dir: rotateDirection(Direction.East, 2),
      });
      result.push({
        pos: { row: 3, col: 0 },
        dir: rotateDirection(Direction.NorthEast, 2),
      });
      result.push({
        pos: { row: 3, col: 0 },
        dir: rotateDirection(Direction.East, 2),
      });
      break;
    case 3: // SouthEast edge (bottom-right) - row = 3
      // Only the hex edges that face outward (toward SE) are used
      result.push({
        pos: { row: 3, col: 0 },
        dir: rotateDirection(Direction.SouthEast, 2),
      });
      result.push({
        pos: { row: 3, col: -1 },
        dir: rotateDirection(Direction.East, 2),
      });
      result.push({
        pos: { row: 3, col: -1 },
        dir: rotateDirection(Direction.SouthEast, 2),
      });
      result.push({
        pos: { row: 3, col: -2 },
        dir: rotateDirection(Direction.East, 2),
      });
      result.push({
        pos: { row: 3, col: -2 },
        dir: rotateDirection(Direction.SouthEast, 2),
      });
      result.push({
        pos: { row: 3, col: -3 },
        dir: rotateDirection(Direction.East, 2),
      });
      result.push({
        pos: { row: 3, col: -3 },
        dir: rotateDirection(Direction.SouthEast, 2),
      });
      break;
    case 4: // SouthWest edge (bottom-left) - col = -3
      // Only the hex edges that face outward (toward SW) are used
      result.push({
        pos: { row: 3, col: -3 },
        dir: rotateDirection(Direction.SouthWest, 2),
      });
      result.push({
        pos: { row: 2, col: -3 },
        dir: rotateDirection(Direction.SouthEast, 2),
      });
      result.push({
        pos: { row: 2, col: -3 },
        dir: rotateDirection(Direction.SouthWest, 2),
      });
      result.push({
        pos: { row: 1, col: -3 },
        dir: rotateDirection(Direction.SouthEast, 2),
      });
      result.push({
        pos: { row: 1, col: -3 },
        dir: rotateDirection(Direction.SouthWest, 2),
      });
      result.push({
        pos: { row: 0, col: -3 },
        dir: rotateDirection(Direction.SouthEast, 2),
      });
      result.push({
        pos: { row: 0, col: -3 },
        dir: rotateDirection(Direction.SouthWest, 2),
      });
      break;
    case 5: // West edge (left) - row + col = -3
      // Only the hex edges that face outward (toward W) are used
      result.push({
        pos: { row: 0, col: -3 },
        dir: rotateDirection(Direction.West, 2),
      });
      result.push({
        pos: { row: -1, col: -2 },
        dir: rotateDirection(Direction.SouthWest, 2),
      });
      result.push({
        pos: { row: -1, col: -2 },
        dir: rotateDirection(Direction.West, 2),
      });
      result.push({
        pos: { row: -2, col: -1 },
        dir: rotateDirection(Direction.SouthWest, 2),
      });
      result.push({
        pos: { row: -2, col: -1 },
        dir: rotateDirection(Direction.West, 2),
      });
      result.push({
        pos: { row: -3, col: 0 },
        dir: rotateDirection(Direction.SouthWest, 2),
      });
      result.push({
        pos: { row: -3, col: 0 },
        dir: rotateDirection(Direction.West, 2),
      });
      break;
  }

  return result;
}
