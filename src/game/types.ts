// Core game type definitions for Quortex/Flows

// Hexagonal board position using axial coordinates
export interface HexPosition {
  readonly row: number;
  readonly col: number;
}

// Tile types based on sharp corners
export enum TileType {
  NoSharps = 0,    // Basketball - 3 curved flows
  OneSharp = 1,    // Kimono - 1 sharp corner
  TwoSharps = 2,   // Rink - 2 sharp corners
  ThreeSharps = 3, // Sharps - 3 sharp corners
}

// Six possible orientations (0-5, each is 60 degrees)
export type Rotation = 0 | 1 | 2 | 3 | 4 | 5;

// Six directions on a hexagon (starting from SouthWest, going clockwise)
export enum Direction {
  SouthWest = 0,
  West = 1,
  NorthWest = 2,
  NorthEast = 3,
  East = 4,
  SouthEast = 5,
}

// A tile placed on the board
export interface PlacedTile {
  readonly type: TileType;
  readonly rotation: Rotation;
  readonly position: HexPosition;
  // Flow cache: for each of the 6 hex edge directions, which player's flow (if any)
  // enters/exits through that edge. This allows rendering to show only the connected flows.
  readonly flowCache?: ReadonlyArray<string | null>; // 6 elements, indexed by Direction
}

// Flow connection on a tile (direction pairs)
export type FlowConnection = readonly [Direction, Direction];

// Player identification
export interface Player {
  readonly id: string;
  readonly color: string;
  readonly edgePosition: number; // 0-5, which edge of hexagon
  readonly isAI: boolean;
  readonly userId?: string; // Optional: User ID for multiplayer (e.g., 'google:123') - associates user with claimed color
}

// Team pairing (for 4-6 player games)
export interface Team {
  readonly player1Id: string;
  readonly player2Id: string;
}
