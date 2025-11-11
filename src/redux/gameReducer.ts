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
  REPLACE_TILE,
  NEXT_PLAYER,
  END_GAME,
  RESET_GAME,
  SET_AI_SCORING_DATA,
} from './actions';
import { TileType } from '../game/types';
import { calculateFlows } from '../game/flows';
import { checkVictory } from '../game/victory';
import { positionToKey } from '../game/board';

// Initial state
export const initialState: GameState = {
  screen: 'configuration',
  configPlayers: [],
  boardRadius: 3,
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
  winners: [],
  winType: null,
  moveHistory: [],
  supermoveInProgress: false,
  lastPlacedTilePosition: null,
};

// Helper function to generate unique player ID
let playerIdCounter = 0;
function generatePlayerId(): string {
  return `P${++playerIdCounter}`;
}

// Helper function to reset player ID counter (for testing)
export function resetPlayerIdCounter(): void {
  playerIdCounter = 0;
}

// Helper function to calculate number of hexes for a given board radius
// Formula: 1 + 3*r*(r+1) where r is the radius
export function calculateHexCount(radius: number): number {
  return 1 + 3 * radius * (radius + 1);
}

// Helper function to calculate tile distribution for a given board radius
// Returns the number of tiles per type (NoSharps, OneSharp, TwoSharps, ThreeSharps)
// Rounds up hex count to the nearest multiple of 4, then divides by 4
export function calculateTileDistribution(radius: number): [number, number, number, number] {
  const hexCount = calculateHexCount(radius);
  const totalTiles = Math.ceil(hexCount / 4) * 4;
  const tilesPerType = totalTiles / 4;
  return [tilesPerType, tilesPerType, tilesPerType, tilesPerType];
}

// Helper function to calculate actual tile counts from distribution ratio
// Based on the ratio-based filling algorithm from BAG_FILLING_DESIGN.md
// Returns total tiles and number of groups needed
export function calculateTileCountsFromRatio(
  boardRadius: number,
  distributionRatio: [number, number, number, number]
): { totalTiles: number; numGroups: number; distribution: [number, number, number, number] } {
  const boardSize = calculateHexCount(boardRadius);
  const groupSize = distributionRatio.reduce((sum, count) => sum + count, 0);
  
  // Handle all-zeros case - default to balanced distribution
  if (groupSize === 0) {
    const defaultRatio: [number, number, number, number] = [1, 1, 1, 1];
    return calculateTileCountsFromRatio(boardRadius, defaultRatio);
  }
  
  const numGroups = Math.ceil(boardSize / groupSize);
  const actualDistribution: [number, number, number, number] = [
    distributionRatio[0] * numGroups,
    distributionRatio[1] * numGroups,
    distributionRatio[2] * numGroups,
    distributionRatio[3] * numGroups,
  ];
  
  return {
    totalTiles: numGroups * groupSize,
    numGroups,
    distribution: actualDistribution,
  };
}

// Helper function to create a shuffled tile deck
// tileDistribution: [NoSharps, OneSharp, TwoSharps, ThreeSharps]
// If not specified, calculates based on boardRadius
// If boardRadius is also not specified, defaults to [10, 10, 10, 10] (radius 3)
function createShuffledDeck(
  boardRadius: number,
  seed?: number,
  tileDistribution?: [number, number, number, number]
): TileType[] {
  // Use explicit distribution if provided, otherwise calculate from board radius
  const distribution = tileDistribution ?? calculateTileDistribution(boardRadius);
  
  const [noSharps, oneSharp, twoSharps, threeSharps] = distribution;
  
  const tiles: TileType[] = [
    ...Array(noSharps).fill(TileType.NoSharps),
    ...Array(oneSharp).fill(TileType.OneSharp),
    ...Array(twoSharps).fill(TileType.TwoSharps),
    ...Array(threeSharps).fill(TileType.ThreeSharps),
  ];

  return shuffleArray(tiles, seed);
}

// Seeded random number generator
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

// Helper function to shuffle an array using Fisher-Yates algorithm
// If seed is provided, uses seeded random for deterministic behavior
function shuffleArray<T>(array: T[], seed?: number): T[] {
  const shuffled = [...array];
  const random = seed !== undefined ? seededRandom(seed) : Math.random;
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Helper function to randomize player order for seating selection
// Uses Fisher-Yates shuffle for uniform distribution
// If seed is provided, uses seeded random for deterministic behavior
function randomizePlayerOrder(playerIds: string[], seed?: number): string[] {
  return shuffleArray(playerIds, seed);
}

// Helper function to determine gameplay order after seating is complete
// Players are ordered clockwise by their edge positions
// Starting player is the first from the seating order
function determineGameplayOrder<T extends { id: string; edgePosition: number }>(
  players: T[],
  seatingOrder: string[]
): T[] {
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
  
  return gameplayOrder;
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

      // Get color, edge, and isAI from payload, or auto-assign if not provided
      const payload = action.payload || {};
      let color = payload.color;
      let edge = payload.edge;
      const isAI = payload.isAI || false;

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
        isAI,
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

      // If only one player, automatically add an AI opponent
      let configPlayers = state.configPlayers;
      if (configPlayers.length === 1 && !configPlayers[0].isAI) {
        // Find an available color and edge for the AI
        const usedColors = new Set(configPlayers.map((p) => p.color));
        const aiColor = PLAYER_COLORS.find((c) => !usedColors.has(c)) || PLAYER_COLORS[1];
        
        const usedEdges = new Set(configPlayers.map((p) => p.edge));
        let aiEdge: 0 | 1 | 2 | 3 = 1;
        for (let i = 0; i < 4; i++) {
          if (!usedEdges.has(i as 0 | 1 | 2 | 3)) {
            aiEdge = i as 0 | 1 | 2 | 3;
            break;
          }
        }
        
        const aiPlayer: ConfigPlayer = {
          id: generatePlayerId(),
          color: aiColor,
          edge: aiEdge,
          isAI: true,
        };
        
        configPlayers = [...configPlayers, aiPlayer];
      }

      // Randomize player order for seating selection
      const playerIds = configPlayers.map(cp => cp.id);
      const seed = action.payload?.seed;
      const seatingOrder = randomizePlayerOrder(playerIds, seed);

      // Transition to seating phase
      return {
        ...state,
        configPlayers, // Update config players if AI was added
        screen: 'seating',
        phase: 'seating',
        boardRadius: action.payload?.boardRadius ?? state.boardRadius,
        seed, // Store seed for later use when shuffling tiles
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
        winners: [],
        winType: null,
        moveHistory: [],
      };
    }

    case SHUFFLE_TILES: {
      const { seed, tileDistribution } = action.payload;
      
      return {
        ...state,
        availableTiles: createShuffledDeck(state.boardRadius, seed, tileDistribution),
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
            isAI: cp.isAI,
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
        
        // Determine gameplay order - players ordered clockwise from starting player
        const orderedPlayers = determineGameplayOrder(updatedPlayers, seatingPhase.seatingOrder);
        
        // Starting player is now at index 0
        const currentPlayerIndex = 0;
        
        // Initialize the game
        // Use existing availableTiles if already shuffled (e.g., from SHUFFLE_TILES action)
        // Otherwise create a new shuffled deck using the stored seed from START_GAME
        const availableTiles = state.availableTiles.length > 0 
          ? state.availableTiles 
          : createShuffledDeck(state.boardRadius, state.seed);
        const currentTile = availableTiles.length > 0 ? availableTiles[0] : null;
        const remainingTiles = availableTiles.slice(1);
        
        // Transition to gameplay
        return {
          ...state,
          players: orderedPlayers,
          teams,
          currentPlayerIndex,
          screen: 'gameplay',
          phase: 'playing',
          board: new Map(),
          availableTiles: remainingTiles,
          currentTile,
          flows: new Map(),
          flowEdges: new Map(),
          winners: [],
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
      const { flows: newFlows, flowEdges: newFlowEdges } = calculateFlows(newBoard, state.players, state.boardRadius);

      // Check for victory
      const victoryResult = checkVictory(newBoard, state.players, state.teams, undefined, state.boardRadius);

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
        supermoveInProgress: false, // Clear supermove flag after placing tile
        lastPlacedTilePosition: position,
      };

      // If there's a winner, update game state
      if (victoryResult.winners.length > 0) {
        return {
          ...newState,
          phase: 'finished',
          winners: victoryResult.winners,
          winType: victoryResult.winType,
          screen: 'game-over',
        };
      }

      return newState;
    }

    case REPLACE_TILE: {
      // Handle supermove tile replacement
      if (state.currentTile === null) {
        return state;
      }

      const { position, rotation, isSingleSupermove } = action.payload;
      const posKey = positionToKey(position);

      // Position must be occupied for replacement
      const oldTile = state.board.get(posKey);
      if (!oldTile) {
        return state;
      }

      // Create new placed tile from current tile in hand
      const newPlacedTile = {
        type: state.currentTile,
        rotation,
        position,
      };

      // Update board with replacement
      const newBoard = new Map(state.board);
      newBoard.set(posKey, newPlacedTile);

      // Calculate new flows
      const { flows: newFlows, flowEdges: newFlowEdges } = calculateFlows(newBoard, state.players, state.boardRadius);

      // Check for victory
      const victoryResult = checkVictory(newBoard, state.players, state.teams, undefined, state.boardRadius);

      // Add to move history (replacement move)
      const move = {
        playerId: state.players[state.currentPlayerIndex].id,
        tile: newPlacedTile,
        timestamp: Date.now(),
      };

      // Handle single supermove: return tile to bag, shuffle, clear current tile, don't set supermoveInProgress
      if (isSingleSupermove) {
        // Return the replaced tile to the bag
        const newAvailableTiles = [...state.availableTiles, oldTile.type];
        
        // Shuffle the bag using the same seeded shuffle as tile distribution
        const shuffled = shuffleArray(newAvailableTiles, state.seed);

        const newState: GameState = {
          ...state,
          board: newBoard,
          currentTile: null, // No tile in hand after single supermove
          availableTiles: shuffled,
          flows: newFlows,
          flowEdges: newFlowEdges,
          moveHistory: [...state.moveHistory, move],
          supermoveInProgress: false, // Single supermove completes immediately
          lastPlacedTilePosition: position,
        };

        // If there's a winner, update game state
        if (victoryResult.winners.length > 0) {
          return {
            ...newState,
            phase: 'finished',
            winners: victoryResult.winners,
            winType: victoryResult.winType,
            screen: 'game-over',
          };
        }

        return newState;
      }

      // Regular supermove: keep tile in hand for placement
      const newState: GameState = {
        ...state,
        board: newBoard,
        currentTile: oldTile.type, // The replaced tile is now in hand
        flows: newFlows,
        flowEdges: newFlowEdges,
        moveHistory: [...state.moveHistory, move],
        supermoveInProgress: true, // Mark that we're in the middle of a supermove
        lastPlacedTilePosition: position,
      };

      // If there's a winner, update game state
      if (victoryResult.winners.length > 0) {
        return {
          ...newState,
          supermoveInProgress: false,
          phase: 'finished',
          winners: victoryResult.winners,
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
      const { winners, winType } = action.payload;
      
      return {
        ...state,
        phase: 'finished',
        winners,
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

    case SET_AI_SCORING_DATA: {
      return {
        ...state,
        aiScoringData: action.payload,
      };
    }

    default:
      return state;
  }
}
