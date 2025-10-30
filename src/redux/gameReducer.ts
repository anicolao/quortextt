// Redux reducer for game state management

import { GameState, ConfigPlayer, MAX_PLAYERS, PLAYER_COLORS } from './types';
import {
  GameAction,
  ADD_PLAYER,
  REMOVE_PLAYER,
  CHANGE_PLAYER_COLOR,
  START_GAME,
  RETURN_TO_CONFIG,
  SETUP_GAME,
  SHUFFLE_TILES,
  DRAW_TILE,
  PLACE_TILE,
  NEXT_PLAYER,
  END_GAME,
  RESET_GAME,
} from './actions';
import { TileType } from '../game/types';
import { calculateFlows } from '../game/flows';
import { checkVictory } from '../game/victory';
import { positionToKey } from '../game/board';

// Initial state
export const initialState: GameState = {
  screen: 'configuration',
  configPlayers: [],
  players: [],
  teams: [],
  currentPlayerIndex: 0,
  board: new Map(),
  availableTiles: [],
  currentTile: null,
  flows: new Map(),
  flowEdges: new Map(),
  phase: 'setup',
  winner: null,
  winType: null,
  moveHistory: [],
};

// Helper function to generate unique player ID
function generatePlayerId(): string {
  return `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Helper function to create a shuffled tile deck
// tileDistribution: [NoSharps, OneSharp, TwoSharps, ThreeSharps]
// Defaults to [10, 10, 10, 10] if not specified
function createShuffledDeck(
  seed?: number,
  tileDistribution?: [number, number, number, number]
): TileType[] {
  // Use provided distribution or default to [10, 10, 10, 10]
  const [noSharps, oneSharp, twoSharps, threeSharps] = tileDistribution || [10, 10, 10, 10];
  
  const tiles: TileType[] = [
    ...Array(noSharps).fill(TileType.NoSharps),
    ...Array(oneSharp).fill(TileType.OneSharp),
    ...Array(twoSharps).fill(TileType.TwoSharps),
    ...Array(threeSharps).fill(TileType.ThreeSharps),
  ];

  // Fisher-Yates shuffle
  const shuffled = [...tiles];
  const random = seed !== undefined ? seededRandom(seed) : Math.random;
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

// Seeded random number generator
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

// Reducer function
export function gameReducer(
  state: GameState = initialState,
  action: GameAction
): GameState {
  switch (action.type) {
    case ADD_PLAYER: {
      // Don't add more than MAX_PLAYERS
      if (state.configPlayers.length >= MAX_PLAYERS) {
        return state;
      }

      // Get color and edge from payload, or auto-assign if not provided
      const payload = action.payload || {};
      let color = payload.color;
      let edge = payload.edge;

      // Auto-assign color if not provided
      if (color === undefined) {
        // Find the first available color
        const usedColors = new Set(state.configPlayers.map((p) => p.color));
        color = PLAYER_COLORS.find((c) => !usedColors.has(c)) || PLAYER_COLORS[0];
      }
      
      // Check if color is already taken
      const colorTaken = state.configPlayers.some((p) => p.color === color);
      if (colorTaken) {
        return state;
      }

      // Auto-assign edge if not provided
      if (edge === undefined) {
        // Find the first available edge (0=bottom, 1=right, 2=top, 3=left)
        const usedEdges = new Set(state.configPlayers.map((p) => p.edge));
        for (let i = 0; i < 4; i++) {
          if (!usedEdges.has(i as 0 | 1 | 2 | 3)) {
            edge = i;
            break;
          }
        }
        // Default to 0 if all edges are somehow taken (shouldn't happen with MAX_PLAYERS=6)
        if (edge === undefined) {
          edge = 0;
        }
      }

      const newPlayer: ConfigPlayer = {
        id: generatePlayerId(),
        color,
        edge: edge as 0 | 1 | 2 | 3,
      };

      return {
        ...state,
        configPlayers: [...state.configPlayers, newPlayer],
      };
    }

    case REMOVE_PLAYER: {
      return {
        ...state,
        configPlayers: state.configPlayers.filter((p) => p.id !== action.payload.playerId),
      };
    }

    case CHANGE_PLAYER_COLOR: {
      const { playerId, color } = action.payload;
      
      // Find if another player has this color
      const otherPlayerWithColor = state.configPlayers.find(
        (p) => p.id !== playerId && p.color === color
      );

      // Find the player requesting the color change
      const requestingPlayer = state.configPlayers.find((p) => p.id === playerId);

      if (!requestingPlayer) {
        return state;
      }

      // If another player has this color, swap colors
      if (otherPlayerWithColor) {
        return {
          ...state,
          configPlayers: state.configPlayers.map((p) => {
            if (p.id === playerId) {
              return { ...p, color };
            }
            if (p.id === otherPlayerWithColor.id) {
              return { ...p, color: requestingPlayer.color };
            }
            return p;
          }),
        };
      }

      // Otherwise, just change the color
      return {
        ...state,
        configPlayers: state.configPlayers.map((p) =>
          p.id === playerId ? { ...p, color } : p
        ),
      };
    }

    case START_GAME: {
      // Only allow starting game if at least one player is configured
      if (state.configPlayers.length === 0) {
        return state;
      }

      // Create Player objects from ConfigPlayers
      // Assign edge positions based on number of players
      const players = state.configPlayers.map((cp, index) => {
        // Distribute players evenly around the hexagon (6 edges)
        // For 2 players: edges 0 and 3 (opposite sides)
        // For 3 players: edges 0, 2, 4 (every other edge)
        // For 4-6 players: consecutive edges
        let edgePosition: number;
        const numPlayers = state.configPlayers.length;
        
        if (numPlayers === 2) {
          edgePosition = index * 3; // 0, 3
        } else if (numPlayers === 3) {
          edgePosition = index * 2; // 0, 2, 4
        } else {
          edgePosition = index; // 0, 1, 2, 3, 4, 5
        }

        return {
          id: cp.id,
          color: cp.color,
          edgePosition,
          isAI: false,
        };
      });

      // Create teams for 4 or 6 players (opposite sides team up)
      const teams = [];
      if (players.length === 4) {
        teams.push(
          { player1Id: players[0].id, player2Id: players[2].id },
          { player1Id: players[1].id, player2Id: players[3].id }
        );
      } else if (players.length === 6) {
        teams.push(
          { player1Id: players[0].id, player2Id: players[3].id },
          { player1Id: players[1].id, player2Id: players[4].id },
          { player1Id: players[2].id, player2Id: players[5].id }
        );
      }

      // Initialize the game
      const availableTiles = createShuffledDeck();
      const currentTile = availableTiles.length > 0 ? availableTiles[0] : null;
      const remainingTiles = availableTiles.slice(1);

      return {
        ...state,
        screen: 'gameplay',
        players,
        teams,
        currentPlayerIndex: 0,
        phase: 'playing',
        board: new Map(),
        availableTiles: remainingTiles,
        currentTile,
        flows: new Map(),
        flowEdges: new Map(),
        winner: null,
        winType: null,
        moveHistory: [],
      };
    }

    case RETURN_TO_CONFIG: {
      return {
        ...state,
        screen: 'configuration',
      };
    }

    case SETUP_GAME: {
      const { players, teams } = action.payload;
      
      return {
        ...state,
        players,
        teams,
        currentPlayerIndex: 0,
        phase: 'playing',
        board: new Map(),
        availableTiles: [],
        currentTile: null,
        flows: new Map(),
        flowEdges: new Map(),
        winner: null,
        winType: null,
        moveHistory: [],
      };
    }

    case SHUFFLE_TILES: {
      const { seed, tileDistribution } = action.payload;
      
      return {
        ...state,
        availableTiles: createShuffledDeck(seed, tileDistribution),
      };
    }

    case DRAW_TILE: {
      // Draw next tile from deck
      if (state.availableTiles.length === 0) {
        return state;
      }

      const [nextTile, ...remainingTiles] = state.availableTiles;

      return {
        ...state,
        currentTile: nextTile,
        availableTiles: remainingTiles,
      };
    }

    case PLACE_TILE: {
      if (state.currentTile === null) {
        return state;
      }

      const { position, rotation } = action.payload;
      const posKey = positionToKey(position);

      // Check if position is already occupied
      if (state.board.has(posKey)) {
        return state;
      }

      // Create new placed tile
      const placedTile = {
        type: state.currentTile,
        rotation,
        position,
      };

      // Update board
      const newBoard = new Map(state.board);
      newBoard.set(posKey, placedTile);

      // Calculate new flows
      const { flows: newFlows, flowEdges: newFlowEdges } = calculateFlows(newBoard, state.players);

      // Check for victory
      const victoryResult = checkVictory(newBoard, newFlows, state.players, state.teams);

      // Add to move history
      const move = {
        playerId: state.players[state.currentPlayerIndex].id,
        tile: placedTile,
        timestamp: Date.now(),
      };

      const newState: GameState = {
        ...state,
        board: newBoard,
        currentTile: null,
        flows: newFlows,
        flowEdges: newFlowEdges,
        moveHistory: [...state.moveHistory, move],
      };

      // If there's a winner, update game state
      if (victoryResult.winner !== null) {
        return {
          ...newState,
          phase: 'finished',
          winner: victoryResult.winner,
          winType: victoryResult.winType,
          screen: 'game-over',
        };
      }

      return newState;
    }

    case NEXT_PLAYER: {
      return {
        ...state,
        currentPlayerIndex: (state.currentPlayerIndex + 1) % state.players.length,
      };
    }

    case END_GAME: {
      const { winner, winType } = action.payload;
      
      return {
        ...state,
        phase: 'finished',
        winner,
        winType,
        screen: 'game-over',
      };
    }

    case RESET_GAME: {
      return {
        ...initialState,
        screen: 'configuration',
      };
    }

    default:
      return state;
  }
}
