// Tile types and flow pattern logic for Quortex/Flows

import { TileType, Direction, Rotation, FlowConnection, PlacedTile } from './types';

// Define flow patterns for each tile type in default orientation (rotation 0)
// Each tile has 3 flow connections (pairs of directions)
// NOTE: These definitions are rotated by -2 (or +4) from the original
// to match the correct visual orientation
export const TILE_FLOWS: Record<TileType, readonly FlowConnection[]> = {
  [TileType.NoSharps]: [
    [Direction.East, Direction.SouthWest],
    [Direction.West, Direction.NorthEast],
    [Direction.SouthEast, Direction.NorthWest],
  ],
  [TileType.OneSharp]: [
    [Direction.East, Direction.NorthEast],
    [Direction.SouthWest, Direction.NorthWest],
    [Direction.SouthEast, Direction.West],
  ],
  [TileType.TwoSharps]: [
    [Direction.East, Direction.NorthEast],
    [Direction.SouthWest, Direction.West],
    [Direction.SouthEast, Direction.NorthWest],
  ],
  [TileType.ThreeSharps]: [
    [Direction.East, Direction.NorthEast],
    [Direction.West, Direction.NorthWest],
    [Direction.SouthEast, Direction.SouthWest],
  ],
};

// Apply rotation to a direction
// Each rotation is 60 degrees clockwise
export function rotateDirection(direction: Direction, rotation: Rotation): Direction {
  return ((direction + rotation) % 6) as Direction;
}

// Get flow connections for a tile with a specific rotation
export function getFlowConnections(
  type: TileType,
  rotation: Rotation
): FlowConnection[] {
  const baseFlows = TILE_FLOWS[type];
  
  if (rotation === 0) {
    return baseFlows as FlowConnection[];
  }
  
  // Apply rotation to each flow connection
  return baseFlows.map(([dir1, dir2]) => [
    rotateDirection(dir1, rotation),
    rotateDirection(dir2, rotation),
  ] as const);
}

// Get the exit direction for a flow entering from a specific direction
// Returns null if the entry direction doesn't have a connection
export function getFlowExit(
  tile: PlacedTile,
  entryDirection: Direction
): Direction | null {
  const connections = getFlowConnections(tile.type, tile.rotation);
  
  // Find the connection that contains the entry direction
  for (const [dir1, dir2] of connections) {
    if (dir1 === entryDirection) {
      return dir2;
    }
    if (dir2 === entryDirection) {
      return dir1;
    }
  }
  
  return null;
}

// Check if two directions are connected on a tile
export function areDirectionsConnected(
  tile: PlacedTile,
  direction1: Direction,
  direction2: Direction
): boolean {
  const connections = getFlowConnections(tile.type, tile.rotation);
  
  for (const [dir1, dir2] of connections) {
    if (
      (dir1 === direction1 && dir2 === direction2) ||
      (dir1 === direction2 && dir2 === direction1)
    ) {
      return true;
    }
  }
  
  return false;
}

// Create a full deck of tiles (10 of each type)
export function createTileDeck(): TileType[] {
  const deck: TileType[] = [];
  
  for (const tileType of [
    TileType.NoSharps,
    TileType.OneSharp,
    TileType.TwoSharps,
    TileType.ThreeSharps,
  ]) {
    for (let i = 0; i < 10; i++) {
      deck.push(tileType);
    }
  }
  
  return deck;
}

// Shuffle a deck of tiles using Fisher-Yates algorithm
// Optional seed for reproducibility
export function shuffleDeck(deck: TileType[], seed?: number): TileType[] {
  const shuffled = [...deck];
  
  // Simple seeded random number generator
  let random = seed !== undefined ? seed : Math.random() * 0x100000000;
  const seededRandom = () => {
    random = (1664525 * random + 1013904223) % 0x100000000;
    return random / 0x100000000;
  };
  
  const rng = seed !== undefined ? seededRandom : Math.random;
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
}
