// Integration test for userId propagation through the full game flow

import { describe, it, expect } from 'vitest';
import { gameReducer, resetPlayerIdCounter } from '../src/redux/gameReducer';
import { initialState as gameInitialState } from '../src/redux/gameReducer';
import { GameState } from '../src/redux/types';
import { 
  addPlayer, 
  startGame, 
  selectEdge,
  AddPlayerAction,
  StartGameAction,
  SelectEdgeAction,
  ADD_PLAYER,
  START_GAME,
  SELECT_EDGE
} from '../src/redux/actions';

describe('UserId Propagation Integration', () => {
  it('should propagate userId from ADD_PLAYER through seating to gameplay', () => {
    // Reset player ID counter for consistent results
    resetPlayerIdCounter();
    
    let state: GameState = gameInitialState;

    // Step 1: Add first player with userId (simulating multiplayer)
    const addPlayer1Action: AddPlayerAction = {
      type: ADD_PLAYER,
      payload: {
        color: '#0173B2',
        edge: 0,
        playerId: undefined, // Auto-generate
        userId: 'google:user1', // Multiplayer user ID
      },
    };
    state = gameReducer(state, addPlayer1Action);
    
    // Verify ConfigPlayer has userId
    expect(state.configPlayers.length).toBe(1);
    expect(state.configPlayers[0].id).toBe('P1');
    expect(state.configPlayers[0].userId).toBe('google:user1');

    // Step 2: Add second player with different userId
    const addPlayer2Action: AddPlayerAction = {
      type: ADD_PLAYER,
      payload: {
        color: '#DE8F05',
        edge: 1,
        playerId: undefined,
        userId: 'google:user2',
      },
    };
    state = gameReducer(state, addPlayer2Action);
    
    expect(state.configPlayers.length).toBe(2);
    expect(state.configPlayers[1].id).toBe('P2');
    expect(state.configPlayers[1].userId).toBe('google:user2');

    // Step 3: Start game (transitions to seating phase)
    const startGameAction: StartGameAction = {
      type: START_GAME,
      payload: {
        boardRadius: 3,
        seed: 12345,
      },
    };
    state = gameReducer(state, startGameAction);
    
    expect(state.screen).toBe('seating');
    expect(state.phase).toBe('seating');
    expect(state.seatingPhase.active).toBe(true);

    // Step 4: Players select edges in seating order
    const firstPlayerId = state.seatingPhase.seatingOrder[0];
    const selectEdge1Action: SelectEdgeAction = {
      type: SELECT_EDGE,
      payload: {
        playerId: firstPlayerId,
        edgeNumber: 0,
      },
    };
    state = gameReducer(state, selectEdge1Action);
    
    // Verify Player objects are created with userId
    expect(state.players.length).toBe(2);
    const player1 = state.players.find(p => p.id === firstPlayerId);
    expect(player1).toBeDefined();
    expect(player1?.userId).toBeDefined();
    expect(['google:user1', 'google:user2']).toContain(player1?.userId);

    // Step 5: Second player selects edge (completes seating)
    const secondPlayerId = state.seatingPhase.seatingOrder[1];
    const selectEdge2Action: SelectEdgeAction = {
      type: SELECT_EDGE,
      payload: {
        playerId: secondPlayerId,
        edgeNumber: 3,
      },
    };
    state = gameReducer(state, selectEdge2Action);
    
    // Verify transition to gameplay
    expect(state.screen).toBe('gameplay');
    expect(state.phase).toBe('playing');
    
    // Verify both players have userId
    expect(state.players.length).toBe(2);
    const allPlayersHaveUserId = state.players.every(p => 
      p.userId === 'google:user1' || p.userId === 'google:user2'
    );
    expect(allPlayersHaveUserId).toBe(true);
    
    // Verify userIds are unique and assigned correctly
    const userIds = new Set(state.players.map(p => p.userId));
    expect(userIds.size).toBe(2);
    expect(userIds.has('google:user1')).toBe(true);
    expect(userIds.has('google:user2')).toBe(true);
  });

  it('should work correctly in tabletop mode without userId', () => {
    resetPlayerIdCounter();
    
    let state: GameState = gameInitialState;

    // Add players without userId (tabletop mode)
    const addPlayer1Action: AddPlayerAction = {
      type: ADD_PLAYER,
      payload: {
        color: '#0173B2',
        edge: 0,
      },
    };
    state = gameReducer(state, addPlayer1Action);
    
    expect(state.configPlayers[0].userId).toBeUndefined();

    const addPlayer2Action: AddPlayerAction = {
      type: ADD_PLAYER,
      payload: {
        color: '#DE8F05',
        edge: 1,
      },
    };
    state = gameReducer(state, addPlayer2Action);
    
    expect(state.configPlayers[1].userId).toBeUndefined();

    // Start game
    state = gameReducer(state, startGame({ seed: 12345 }));
    
    // Select edges
    const firstPlayerId = state.seatingPhase.seatingOrder[0];
    state = gameReducer(state, selectEdge(firstPlayerId, 0));
    
    const secondPlayerId = state.seatingPhase.seatingOrder[1];
    state = gameReducer(state, selectEdge(secondPlayerId, 3));
    
    // Verify players don't have userId in tabletop mode
    expect(state.players.length).toBe(2);
    expect(state.players[0].userId).toBeUndefined();
    expect(state.players[1].userId).toBeUndefined();
  });

  it('should handle AI players correctly (no userId)', () => {
    resetPlayerIdCounter();
    
    let state: GameState = gameInitialState;

    // Add human player with userId
    const addHumanAction: AddPlayerAction = {
      type: ADD_PLAYER,
      payload: {
        color: '#0173B2',
        edge: 0,
        userId: 'google:user1',
      },
    };
    state = gameReducer(state, addHumanAction);

    // Add AI player
    const addAIAction: AddPlayerAction = {
      type: ADD_PLAYER,
      payload: {
        color: '#DE8F05',
        edge: 1,
        isAI: true,
      },
    };
    state = gameReducer(state, addAIAction);
    
    expect(state.configPlayers[0].userId).toBe('google:user1');
    expect(state.configPlayers[1].userId).toBeUndefined();
    expect(state.configPlayers[1].isAI).toBe(true);

    // Start game and complete seating
    state = gameReducer(state, startGame({ seed: 12345 }));
    const firstPlayerId = state.seatingPhase.seatingOrder[0];
    state = gameReducer(state, selectEdge(firstPlayerId, 0));
    const secondPlayerId = state.seatingPhase.seatingOrder[1];
    state = gameReducer(state, selectEdge(secondPlayerId, 3));
    
    // Verify userId is correct for each player type
    const humanPlayer = state.players.find(p => !p.isAI);
    const aiPlayer = state.players.find(p => p.isAI);
    
    expect(humanPlayer?.userId).toBe('google:user1');
    expect(aiPlayer?.userId).toBeUndefined();
  });
});
