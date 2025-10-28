// Redux action types and action creators

import { HexPosition, Rotation, Player, Team } from '../game/types';

// Configuration actions
export const ADD_PLAYER = 'ADD_PLAYER';
export const REMOVE_PLAYER = 'REMOVE_PLAYER';
export const CHANGE_PLAYER_COLOR = 'CHANGE_PLAYER_COLOR';
export const START_GAME = 'START_GAME';
export const RETURN_TO_CONFIG = 'RETURN_TO_CONFIG';

// Game setup actions
export const SETUP_GAME = 'SETUP_GAME';
export const SHUFFLE_TILES = 'SHUFFLE_TILES';

// Gameplay actions
export const DRAW_TILE = 'DRAW_TILE';
export const PLACE_TILE = 'PLACE_TILE';
export const SET_CURRENT_TILE_FOR_TESTING = 'SET_CURRENT_TILE_FOR_TESTING'; // Test-only action

// Game flow actions
export const NEXT_PLAYER = 'NEXT_PLAYER';
export const END_GAME = 'END_GAME';
export const RESET_GAME = 'RESET_GAME';

// UI actions
export const SET_HOVERED_POSITION = 'SET_HOVERED_POSITION';
export const SET_SELECTED_POSITION = 'SET_SELECTED_POSITION';
export const SET_ROTATION = 'SET_ROTATION';
export const TOGGLE_LEGAL_MOVES = 'TOGGLE_LEGAL_MOVES';

// Configuration action types
export interface AddPlayerAction {
  type: typeof ADD_PLAYER;
}

export interface RemovePlayerAction {
  type: typeof REMOVE_PLAYER;
  payload: {
    playerId: string;
  };
}

export interface ChangePlayerColorAction {
  type: typeof CHANGE_PLAYER_COLOR;
  payload: {
    playerId: string;
    color: string;
  };
}

export interface StartGameAction {
  type: typeof START_GAME;
}

export interface ReturnToConfigAction {
  type: typeof RETURN_TO_CONFIG;
}

// Game setup action types
export interface SetupGameAction {
  type: typeof SETUP_GAME;
  payload: {
    players: Player[];
    teams: Team[];
  };
}

export interface ShuffleTilesAction {
  type: typeof SHUFFLE_TILES;
  payload: {
    seed?: number;
  };
}

// Gameplay action types
export interface DrawTileAction {
  type: typeof DRAW_TILE;
}

export interface PlaceTileAction {
  type: typeof PLACE_TILE;
  payload: {
    position: HexPosition;
    rotation: Rotation;
  };
}

export interface SetCurrentTileForTestingAction {
  type: typeof SET_CURRENT_TILE_FOR_TESTING;
  payload: {
    tileType: number; // TileType enum value
  };
}

// Game flow action types
export interface NextPlayerAction {
  type: typeof NEXT_PLAYER;
}

export interface EndGameAction {
  type: typeof END_GAME;
  payload: {
    winner: string;
    winType: 'flow' | 'constraint' | 'tie';
  };
}

export interface ResetGameAction {
  type: typeof RESET_GAME;
}

// UI action types
export interface SetHoveredPositionAction {
  type: typeof SET_HOVERED_POSITION;
  payload: HexPosition | null;
}

export interface SetSelectedPositionAction {
  type: typeof SET_SELECTED_POSITION;
  payload: HexPosition | null;
}

export interface SetRotationAction {
  type: typeof SET_ROTATION;
  payload: Rotation;
}

export interface ToggleLegalMovesAction {
  type: typeof TOGGLE_LEGAL_MOVES;
}

// Combined action type
export type GameAction =
  | AddPlayerAction
  | RemovePlayerAction
  | ChangePlayerColorAction
  | StartGameAction
  | ReturnToConfigAction
  | SetupGameAction
  | ShuffleTilesAction
  | DrawTileAction
  | PlaceTileAction
  | SetCurrentTileForTestingAction
  | NextPlayerAction
  | EndGameAction
  | ResetGameAction;

export type UIAction =
  | SetHoveredPositionAction
  | SetSelectedPositionAction
  | SetRotationAction
  | ToggleLegalMovesAction;

// Configuration action creators
export const addPlayer = (): AddPlayerAction => ({
  type: ADD_PLAYER,
});

export const removePlayer = (playerId: string): RemovePlayerAction => ({
  type: REMOVE_PLAYER,
  payload: { playerId },
});

export const changePlayerColor = (
  playerId: string,
  color: string
): ChangePlayerColorAction => ({
  type: CHANGE_PLAYER_COLOR,
  payload: { playerId, color },
});

export const startGame = (): StartGameAction => ({
  type: START_GAME,
});

export const returnToConfig = (): ReturnToConfigAction => ({
  type: RETURN_TO_CONFIG,
});

// Game setup action creators
export const setupGame = (players: Player[], teams: Team[]): SetupGameAction => ({
  type: SETUP_GAME,
  payload: { players, teams },
});

export const shuffleTiles = (seed?: number): ShuffleTilesAction => ({
  type: SHUFFLE_TILES,
  payload: { seed },
});

// Gameplay action creators
export const drawTile = (): DrawTileAction => ({
  type: DRAW_TILE,
});

export const placeTile = (position: HexPosition, rotation: Rotation): PlaceTileAction => ({
  type: PLACE_TILE,
  payload: { position, rotation },
});

export const setCurrentTileForTesting = (tileType: number): SetCurrentTileForTestingAction => ({
  type: SET_CURRENT_TILE_FOR_TESTING,
  payload: { tileType },
});

// Game flow action creators
export const nextPlayer = (): NextPlayerAction => ({
  type: NEXT_PLAYER,
});

export const endGame = (winner: string, winType: 'flow' | 'constraint' | 'tie'): EndGameAction => ({
  type: END_GAME,
  payload: { winner, winType },
});

export const resetGame = (): ResetGameAction => ({
  type: RESET_GAME,
});

// UI action creators
export const setHoveredPosition = (position: HexPosition | null): SetHoveredPositionAction => ({
  type: SET_HOVERED_POSITION,
  payload: position,
});

export const setSelectedPosition = (position: HexPosition | null): SetSelectedPositionAction => ({
  type: SET_SELECTED_POSITION,
  payload: position,
});

export const setRotation = (rotation: Rotation): SetRotationAction => ({
  type: SET_ROTATION,
  payload: rotation,
});

export const toggleLegalMoves = (): ToggleLegalMovesAction => ({
  type: TOGGLE_LEGAL_MOVES,
});
