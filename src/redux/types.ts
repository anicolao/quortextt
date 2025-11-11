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
  isAI: boolean; // Whether this is an AI player
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
  
  // Random seed for deterministic behavior
  seed?: number;  // Optional seed for tile shuffling and seating order
  
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
  
  // Last placed tile (for highlighting)
  lastPlacedTilePosition: HexPosition | null;
  
  // AI debug data (when debugAIScoring is enabled)
  aiScoringData?: Record<string, { rotation: number; score: number }[]>; // position key -> array of {rotation, score}
}

// Game settings
export interface GameSettings {
  boardRadius: number;
  supermove: boolean;
  singleSupermove: boolean; // If true with supermove, replaced tile returns to bag and turn passes to next player
  debugShowEdgeLabels: boolean;
  debugShowVictoryEdges: boolean;
  debugLegalityTest: boolean;
  debugAnimationSlowdown: number;
  debugAIScoring: boolean; // Show AI evaluation scores for tile placements
  debugHitTest: boolean; // Show hit test areas with red outlines on hover
  tileDistribution: [number, number, number, number]; // [NoSharps, OneSharp, TwoSharps, ThreeSharps]
}

// UI state for interaction
// Hovered element type for debug visualization
export type HoveredElementType = 
  | { type: 'hexagon'; position: HexPosition }
  | { type: 'rotation-button'; position: { x: number; y: number }; radius: number; clockwise: boolean }
  | { type: 'action-button'; position: { x: number; y: number }; radius: number; action: 'checkmark' | 'cancel' }
  | { type: 'exit-button'; x: number; y: number; width: number; height: number }
  | null;

export interface UIState {
  // Interaction state
  selectedPosition: HexPosition | null;
  hoveredPosition: HexPosition | null;
  hoveredElement: HoveredElementType;
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
