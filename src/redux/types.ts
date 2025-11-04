// State structure for the Quortex game

import {
  HexPosition,
  TileType,
  PlacedTile,
  Player as GamePlayer,
  Team,
  Rotation,
} from '../game/types';

export type Screen = 'configuration' | 'seating' | 'gameplay' | 'game-over';
export type GamePhase = 'setup' | 'seating' | 'playing' | 'finished';
export type WinType = 'flow' | 'constraint' | 'tie';

// Edge represents which edge of the display (0=bottom, 1=right, 2=top, 3=left)
export type Edge = 0 | 1 | 2 | 3;

// Player for configuration (simplified)
export interface ConfigPlayer {
  id: string;
  color: string;
  edge: Edge; // Which edge they joined from
}

// Move history entry
export interface Move {
  readonly playerId: string;
  readonly tile: PlacedTile;
  readonly timestamp: number;
}

// Seating phase state
export interface SeatingPhaseState {
  active: boolean;              // Whether we're in seating phase
  seatingOrder: string[];       // Player IDs in randomized turn order
  seatingIndex: number;         // Current index in seating order
  availableEdges: number[];     // Edge numbers (0-5) still available
  edgeAssignments: Map<string, number>; // Player ID -> edge number
}

// Main game state
export interface GameState {
  // UI state
  screen: Screen;
  
  // Configuration
  configPlayers: ConfigPlayer[];
  boardRadius: number;  // Board size (default 3 for 37 tiles)
  
  // Seating phase
  seatingPhase: SeatingPhaseState;
  
  // Game setup (after starting game)
  players: GamePlayer[];
  teams: Team[];
  currentPlayerIndex: number;
  
  // Board state
  board: Map<string, PlacedTile>;  // Key: "row,col"
  availableTiles: TileType[];      // Shuffled deck
  currentTile: TileType | null;    // Tile in hand
  
  // Supermove state
  supermoveInProgress: boolean;    // True when player has replaced a tile and needs to place it
  
  // Flow tracking
  flows: Map<string, Set<string>>; // Player ID -> set of hex positions
  flowEdges: Map<string, Map<number, string>>; // position key -> direction -> player ID
  
  // Game status
  phase: GamePhase;
  winners: string[];  // Array of player IDs who won
  winType: WinType | null;
  
  // Move history
  moveHistory: Move[];
}

// Game settings
export interface GameSettings {
  boardRadius: number;
  supermove: boolean;
  debugShowEdgeLabels: boolean;
  debugShowVictoryEdges: boolean;
  debugLegalityTest: boolean;
  debugAnimationSlowdown: number;
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
  
  // Settings dialog
  showSettings: boolean;
  settings: GameSettings;
}

// Root state combining all state slices
export interface RootState {
  game: GameState;
  ui: UIState;
  animation: import('../animation/types').AnimationState;
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
