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
  START_SEATING_PHASE,
  SELECT_EDGE,
  COMPLETE_SEATING_PHASE,
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
  seatingPhase: {
    active: false,
    seatingOrder: [],
    seatingIndex: 0,
    availableEdges: [],
    edgeAssignments: new Map(),
  },
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

// Helper function to randomize player order for seating selection
// Uses Fisher-Yates shuffle for uniform distribution
function randomizePlayerOrder(playerIds: string[]): string[] {
  const shuffled = [...playerIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Helper function to determine gameplay order after seating is complete
// Players are ordered clockwise by their edge positions
// Starting player is the first from the seating order
function determineGameplayOrder(
  players: { id: string; edgePosition: number }[],
  seatingOrder: string[]
): string[] {
  // Sort players by edge position (clockwise order)
  const sortedPlayers = [...players].sort(
    (a, b) => a.edgePosition - b.edgePosition
  );
  
  // Find the starting player (first from seating order)
  const startingPlayerId = seatingOrder[0];
  const startIndex = sortedPlayers.findIndex(p => p.id === startingPlayerId);
  
  // Rotate array to start with the starting player
  const gameplayOrder = [
    ...sortedPlayers.slice(startIndex),
    ...sortedPlayers.slice(0, startIndex)
  ];
  
  return gameplayOrder.map(p => p.id);
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

      // Randomize player order for seating selection
      const playerIds = state.configPlayers.map(cp => cp.id);
      const seatingOrder = randomizePlayerOrder(playerIds);

      // Transition to seating phase
      return {
        ...state,
        screen: 'seating',
        phase: 'seating',
        seatingPhase: {
          active: true,
          seatingOrder,
          seatingIndex: 0,
          availableEdges: [0, 1, 2, 3, 4, 5],
          edgeAssignments: new Map(),
        },
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

    case START_SEATING_PHASE: {
      const { seatingOrder } = action.payload;
      
      return {
        ...state,
        screen: 'seating',
        phase: 'seating',
        seatingPhase: {
          active: true,
          seatingOrder,
          seatingIndex: 0,
          availableEdges: [0, 1, 2, 3, 4, 5],
          edgeAssignments: new Map(),
        },
      };
    }

    case SELECT_EDGE: {
      const { playerId, edgeNumber } = action.payload;
      const { seatingPhase } = state;
      
      // Validate edge is available
      if (!seatingPhase.availableEdges.includes(edgeNumber)) {
        return state;
      }
      
      // Validate it's this player's turn
      const currentPlayer = seatingPhase.seatingOrder[seatingPhase.seatingIndex];
      if (currentPlayer !== playerId) {
        return state;
      }
      
      // Update edge assignments
      const newEdgeAssignments = new Map(seatingPhase.edgeAssignments);
      newEdgeAssignments.set(playerId, edgeNumber);
      
      // Remove edge from available
      const newAvailableEdges = seatingPhase.availableEdges.filter(
        e => e !== edgeNumber
      );
      
      // Update or create player's edge position
      const configPlayer = state.configPlayers.find(cp => cp.id === playerId);
      if (!configPlayer) {
        return state;
      }
      
      const updatedPlayers = state.players.length > 0
        ? state.players.map(p =>
            p.id === playerId ? { ...p, edgePosition: edgeNumber } : p
          )
        : state.configPlayers.map(cp => ({
            id: cp.id,
            color: cp.color,
            edgePosition: cp.id === playerId ? edgeNumber : -1,
            isAI: false,
          }));
      
      // Increment seating index
      const newSeatingIndex = seatingPhase.seatingIndex + 1;
      
      // Check if seating is complete
      const seatingComplete = newSeatingIndex >= seatingPhase.seatingOrder.length;
      
      if (seatingComplete) {
        // Create teams for 4 or 6 players (opposite sides team up)
        const teams = [];
        const sortedPlayers = [...updatedPlayers].sort((a, b) => a.edgePosition - b.edgePosition);
        
        if (updatedPlayers.length === 4) {
          teams.push(
            { player1Id: sortedPlayers[0].id, player2Id: sortedPlayers[2].id },
            { player1Id: sortedPlayers[1].id, player2Id: sortedPlayers[3].id }
          );
        } else if (updatedPlayers.length === 6) {
          teams.push(
            { player1Id: sortedPlayers[0].id, player2Id: sortedPlayers[3].id },
            { player1Id: sortedPlayers[1].id, player2Id: sortedPlayers[4].id },
            { player1Id: sortedPlayers[2].id, player2Id: sortedPlayers[5].id }
          );
        }
        
        // Determine gameplay order
        const gameplayOrder = determineGameplayOrder(updatedPlayers, seatingPhase.seatingOrder);
        const startingPlayerId = gameplayOrder[0];
        const currentPlayerIndex = updatedPlayers.findIndex(p => p.id === startingPlayerId);
        
        // Initialize the game
        const availableTiles = createShuffledDeck();
        const currentTile = availableTiles.length > 0 ? availableTiles[0] : null;
        const remainingTiles = availableTiles.slice(1);
        
        // Transition to gameplay
        return {
          ...state,
          players: updatedPlayers,
          teams,
          currentPlayerIndex,
          screen: 'gameplay',
          phase: 'playing',
          board: new Map(),
          availableTiles: remainingTiles,
          currentTile,
          flows: new Map(),
          flowEdges: new Map(),
          winner: null,
          winType: null,
          moveHistory: [],
          seatingPhase: {
            ...seatingPhase,
            active: false,
            edgeAssignments: newEdgeAssignments,
            availableEdges: newAvailableEdges,
            seatingIndex: newSeatingIndex,
          },
        };
      }
      
      // Continue seating phase
      return {
        ...state,
        players: updatedPlayers,
        seatingPhase: {
          ...seatingPhase,
          edgeAssignments: newEdgeAssignments,
          availableEdges: newAvailableEdges,
          seatingIndex: newSeatingIndex,
        },
      };
    }

    case COMPLETE_SEATING_PHASE: {
      // This action can be used to manually complete seating if needed
      // For now, it's handled automatically in SELECT_EDGE
      return state;
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
