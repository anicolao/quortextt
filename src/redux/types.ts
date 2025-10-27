// State structure for the Quortex game

import {
  HexPosition,
  TileType,
  PlacedTile,
  Player as GamePlayer,
  Team,
  Rotation,
} from '../game/types';

export type Screen = 'configuration' | 'gameplay' | 'game-over';
export type GamePhase = 'setup' | 'playing' | 'finished';
export type WinType = 'flow' | 'constraint' | 'tie';

// Player for configuration (simplified)
export interface ConfigPlayer {
  id: string;
  color: string;
}

// Move history entry
export interface Move {
  readonly playerId: string;
  readonly tile: PlacedTile;
  readonly timestamp: number;
}

// Main game state
export interface GameState {
  // UI state
  screen: Screen;
  
  // Configuration
  configPlayers: ConfigPlayer[];
  
  // Game setup (after starting game)
  players: GamePlayer[];
  teams: Team[];
  currentPlayerIndex: number;
  
  // Board state
  board: Map<string, PlacedTile>;  // Key: "row,col"
  availableTiles: TileType[];      // Shuffled deck
  currentTile: TileType | null;    // Tile in hand
  
  // Flow tracking
  flows: Map<string, Set<string>>; // Player ID -> set of hex positions
  
  // Game status
  phase: GamePhase;
  winner: string | null;  // Player ID or Team ID
  winType: WinType | null;
  
  // Move history
  moveHistory: Move[];
}

// UI state for interaction
export interface UIState {
  // Interaction state
  selectedPosition: HexPosition | null;
  hoveredPosition: HexPosition | null;
  currentRotation: Rotation;
  
  // Visual preferences
  showLegalMoves: boolean;
  showFlowMarkers: boolean;
  animationSpeed: number;
  
  // Canvas/viewport
  zoom: number;
  panOffset: { x: number; y: number };
}

// Root state combining all state slices
export interface RootState {
  game: GameState;
  ui: UIState;
}

// Available color-blind friendly palette
export const PLAYER_COLORS = [
  '#0173B2', // Blue
  '#DE8F05', // Orange
  '#029E73', // Green
  '#ECE133', // Yellow
  '#CC78BC', // Purple
  '#CA5127', // Red
] as const;

export const MAX_PLAYERS = 6;
