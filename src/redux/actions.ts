// Redux action types and action creators

import { HexPosition, Rotation, Player, Team } from "../game/types";
import { GameSettings } from "./types";

// Configuration actions
export const ADD_PLAYER = "ADD_PLAYER";
export const REMOVE_PLAYER = "REMOVE_PLAYER";
export const CHANGE_PLAYER_COLOR = "CHANGE_PLAYER_COLOR";
export const START_GAME = "START_GAME";
export const RETURN_TO_CONFIG = "RETURN_TO_CONFIG";

// Game setup actions
export const SETUP_GAME = "SETUP_GAME";
export const SHUFFLE_TILES = "SHUFFLE_TILES";

// Seating phase actions
export const START_SEATING_PHASE = "START_SEATING_PHASE";
export const SELECT_EDGE = "SELECT_EDGE";
export const COMPLETE_SEATING_PHASE = "COMPLETE_SEATING_PHASE";

// Gameplay actions
export const DRAW_TILE = "DRAW_TILE";
export const PLACE_TILE = "PLACE_TILE";
export const REPLACE_TILE = "REPLACE_TILE";

// AI debug actions
export const SET_AI_SCORING_DATA = "SET_AI_SCORING_DATA";

// Game flow actions
export const NEXT_PLAYER = "NEXT_PLAYER";
export const END_GAME = "END_GAME";
export const RESET_GAME = "RESET_GAME";
export const REMATCH_GAME = "REMATCH_GAME";
export const RESTORE_GAME = "RESTORE_GAME";

// UI actions
export const SET_GAME_MODE = "SET_GAME_MODE";
export const SET_LOCAL_PLAYER_ID = "SET_LOCAL_PLAYER_ID";
export const SET_HOVERED_POSITION = "SET_HOVERED_POSITION";
export const SET_HOVERED_ELEMENT = "SET_HOVERED_ELEMENT";
export const SET_SELECTED_POSITION = "SET_SELECTED_POSITION";
export const SET_ROTATION = "SET_ROTATION";
export const TOGGLE_LEGAL_MOVES = "TOGGLE_LEGAL_MOVES";
export const TOGGLE_SETTINGS = "TOGGLE_SETTINGS";
export const UPDATE_SETTINGS = "UPDATE_SETTINGS";
export const SHOW_HELP = "SHOW_HELP";
export const HIDE_HELP = "HIDE_HELP";
export const SHOW_MOVE_LIST = "SHOW_MOVE_LIST";
export const HIDE_MOVE_LIST = "HIDE_MOVE_LIST";
export const NAVIGATE_MOVE_LIST = "NAVIGATE_MOVE_LIST";

// Player connection actions
export const SET_PLAYER_CONNECTED = "SET_PLAYER_CONNECTED";
export const SET_PLAYER_DISCONNECTED = "SET_PLAYER_DISCONNECTED";

// Configuration action types
export interface AddPlayerAction {
  type: typeof ADD_PLAYER;
  payload?: {
    color?: string;
    edge?: number; // 0=bottom, 1=right, 2=top, 3=left
    isAI?: boolean; // Whether this is an AI player
    playerId?: string; // Optional: use specific playerId (for rematch in multiplayer)
  };
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
  payload?: {
    boardRadius?: number;
    seed?: number;
    supermove?: boolean;
    singleSupermove?: boolean;
    supermoveAnyPlayer?: boolean;
  };
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
    // Optional tile distribution: [NoSharps, OneSharp, TwoSharps, ThreeSharps]
    // Defaults to [10, 10, 10, 10] if not specified
    tileDistribution?: [number, number, number, number];
  };
}

// Seating phase action types
export interface StartSeatingPhaseAction {
  type: typeof START_SEATING_PHASE;
  payload: {
    seatingOrder: string[]; // Randomized player IDs
  };
}

export interface SelectEdgeAction {
  type: typeof SELECT_EDGE;
  payload: {
    playerId: string;
    edgeNumber: number; // 0-5
  };
}

export interface CompleteSeatingPhaseAction {
  type: typeof COMPLETE_SEATING_PHASE;
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

export interface ReplaceTileAction {
  type: typeof REPLACE_TILE;
  payload: {
    position: HexPosition;
    rotation: Rotation;
    isSingleSupermove?: boolean; // If true, return tile to bag, shuffle, and advance to next player
  };
}

// Game flow action types
export interface NextPlayerAction {
  type: typeof NEXT_PLAYER;
}

export interface EndGameAction {
  type: typeof END_GAME;
  payload: {
    winners: string[];
    winType: "flow" | "constraint" | "tie";
  };
}

export interface ResetGameAction {
  type: typeof RESET_GAME;
}

export interface RematchGameAction {
  type: typeof REMATCH_GAME;
}

export interface RestoreGameAction {
  type: typeof RESTORE_GAME;
}

// AI debug action types
export interface SetAIScoringDataAction {
  type: typeof SET_AI_SCORING_DATA;
  payload: Record<string, { rotation: number; score: number }[]> | undefined;
}

// UI action types
export interface SetGameModeAction {
  type: typeof SET_GAME_MODE;
  payload: import("./types").GameMode;
}

export interface SetLocalPlayerIdAction {
  type: typeof SET_LOCAL_PLAYER_ID;
  payload: string | null;
}

export interface SetHoveredPositionAction {
  type: typeof SET_HOVERED_POSITION;
  payload: HexPosition | null;
}

export interface SetHoveredElementAction {
  type: typeof SET_HOVERED_ELEMENT;
  payload: import("./types").HoveredElementType;
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

export interface ToggleSettingsAction {
  type: typeof TOGGLE_SETTINGS;
}

export interface UpdateSettingsAction {
  type: typeof UPDATE_SETTINGS;
  payload: Partial<GameSettings>;
}

export interface ShowHelpAction {
  type: typeof SHOW_HELP;
  payload: {
    corner: 0 | 1 | 2 | 3; // 0=bottom-left, 1=bottom-right, 2=top-right, 3=top-left
  };
}

export interface HideHelpAction {
  type: typeof HIDE_HELP;
}

export interface ShowMoveListAction {
  type: typeof SHOW_MOVE_LIST;
  payload: {
    corner: 0 | 1 | 2 | 3; // 0=bottom-left, 1=bottom-right, 2=top-right, 3=top-left
  };
}

export interface HideMoveListAction {
  type: typeof HIDE_MOVE_LIST;
}

export interface NavigateMoveListAction {
  type: typeof NAVIGATE_MOVE_LIST;
  payload: {
    direction: "prev" | "next" | "first" | "last";
  };
}

// Player connection action types
export interface SetPlayerConnectedAction {
  type: typeof SET_PLAYER_CONNECTED;
  payload: {
    playerId: string;
  };
}

export interface SetPlayerDisconnectedAction {
  type: typeof SET_PLAYER_DISCONNECTED;
  payload: {
    playerId: string;
  };
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
  | StartSeatingPhaseAction
  | SelectEdgeAction
  | CompleteSeatingPhaseAction
  | DrawTileAction
  | PlaceTileAction
  | ReplaceTileAction
  | NextPlayerAction
  | EndGameAction
  | ResetGameAction
  | RematchGameAction
  | RestoreGameAction
  | SetAIScoringDataAction;

export type UIAction =
  | SetGameModeAction
  | SetLocalPlayerIdAction
  | SetHoveredPositionAction
  | SetHoveredElementAction
  | SetSelectedPositionAction
  | SetRotationAction
  | ToggleLegalMovesAction
  | ToggleSettingsAction
  | UpdateSettingsAction
  | ShowHelpAction
  | HideHelpAction
  | ShowMoveListAction
  | HideMoveListAction
  | NavigateMoveListAction
  | SetPlayerConnectedAction
  | SetPlayerDisconnectedAction;

// Configuration action creators
export const addPlayer = (color: string, edge: number, playerId?: string): AddPlayerAction => ({
  type: ADD_PLAYER,
  payload: { color, edge, playerId },
});

export const removePlayer = (playerId: string): RemovePlayerAction => ({
  type: REMOVE_PLAYER,
  payload: { playerId },
});

export const changePlayerColor = (
  playerId: string,
  color: string,
): ChangePlayerColorAction => ({
  type: CHANGE_PLAYER_COLOR,
  payload: { playerId, color },
});

export const startGame = (params?: {
  boardRadius?: number;
  seed?: number;
  supermove?: boolean;
  singleSupermove?: boolean;
  supermoveAnyPlayer?: boolean;
} | number): StartGameAction => {
  // Handle legacy call with just boardRadius number
  if (typeof params === 'number') {
    return {
      type: START_GAME,
      payload: { boardRadius: params },
    };
  }
  
  return {
    type: START_GAME,
    payload: params,
  };
};

export const returnToConfig = (): ReturnToConfigAction => ({
  type: RETURN_TO_CONFIG,
});

// Game setup action creators
export const setupGame = (
  players: Player[],
  teams: Team[],
): SetupGameAction => ({
  type: SETUP_GAME,
  payload: { players, teams },
});

export const shuffleTiles = (
  seed?: number,
  tileDistribution?: [number, number, number, number],
): ShuffleTilesAction => ({
  type: SHUFFLE_TILES,
  payload: { seed, tileDistribution },
});

// Seating phase action creators
export const startSeatingPhase = (
  seatingOrder: string[],
): StartSeatingPhaseAction => ({
  type: START_SEATING_PHASE,
  payload: { seatingOrder },
});

export const selectEdge = (
  playerId: string,
  edgeNumber: number,
): SelectEdgeAction => ({
  type: SELECT_EDGE,
  payload: { playerId, edgeNumber },
});

export const completeSeatingPhase = (): CompleteSeatingPhaseAction => ({
  type: COMPLETE_SEATING_PHASE,
});

// Gameplay action creators
export const drawTile = (): DrawTileAction => ({
  type: DRAW_TILE,
});

export const placeTile = (
  position: HexPosition,
  rotation: Rotation,
): PlaceTileAction => ({
  type: PLACE_TILE,
  payload: { position, rotation },
});

export const replaceTile = (
  position: HexPosition,
  rotation: Rotation,
  isSingleSupermove?: boolean,
): ReplaceTileAction => ({
  type: REPLACE_TILE,
  payload: { position, rotation, isSingleSupermove },
});

// Game flow action creators
export const nextPlayer = (): NextPlayerAction => ({
  type: NEXT_PLAYER,
});

export const endGame = (
  winners: string[],
  winType: "flow" | "constraint" | "tie",
): EndGameAction => ({
  type: END_GAME,
  payload: { winners, winType },
});

export const resetGame = (): ResetGameAction => ({
  type: RESET_GAME,
});

export const rematchGame = (): RematchGameAction => ({
  type: REMATCH_GAME,
});

export const restoreGame = (): RestoreGameAction => ({
  type: RESTORE_GAME,
});

// UI action creators
export const setGameMode = (
  mode: import("./types").GameMode,
): SetGameModeAction => ({
  type: SET_GAME_MODE,
  payload: mode,
});

export const setLocalPlayerId = (
  playerId: string | null,
): SetLocalPlayerIdAction => ({
  type: SET_LOCAL_PLAYER_ID,
  payload: playerId,
});

export const setHoveredPosition = (
  position: HexPosition | null,
): SetHoveredPositionAction => ({
  type: SET_HOVERED_POSITION,
  payload: position,
});

export const setHoveredElement = (
  element: import("./types").HoveredElementType,
): SetHoveredElementAction => ({
  type: SET_HOVERED_ELEMENT,
  payload: element,
});

export const setSelectedPosition = (
  position: HexPosition | null,
): SetSelectedPositionAction => ({
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

export const toggleSettings = (): ToggleSettingsAction => ({
  type: TOGGLE_SETTINGS,
});

export const updateSettings = (
  settings: Partial<GameSettings>,
): UpdateSettingsAction => ({
  type: UPDATE_SETTINGS,
  payload: settings,
});

export const showHelp = (corner: 0 | 1 | 2 | 3): ShowHelpAction => ({
  type: SHOW_HELP,
  payload: { corner },
});

export const hideHelp = (): HideHelpAction => ({
  type: HIDE_HELP,
});

export const showMoveList = (corner: 0 | 1 | 2 | 3): ShowMoveListAction => ({
  type: SHOW_MOVE_LIST,
  payload: { corner },
});

export const hideMoveList = (): HideMoveListAction => ({
  type: HIDE_MOVE_LIST,
});

export const navigateMoveList = (
  direction: "prev" | "next" | "first" | "last",
): NavigateMoveListAction => ({
  type: NAVIGATE_MOVE_LIST,
  payload: { direction },
});

// AI debug action creators
export const setAIScoringData = (
  data: Record<string, { rotation: number; score: number }[]> | undefined,
): SetAIScoringDataAction => ({
  type: SET_AI_SCORING_DATA,
  payload: data,
});

// Player connection action creators
export const setPlayerConnected = (playerId: string): SetPlayerConnectedAction => ({
  type: SET_PLAYER_CONNECTED,
  payload: { playerId },
});

export const setPlayerDisconnected = (playerId: string): SetPlayerDisconnectedAction => ({
  type: SET_PLAYER_DISCONNECTED,
  payload: { playerId },
});
