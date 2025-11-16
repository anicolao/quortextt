// Multiplayer game coordinator - handles event sourcing and Redux integration
import { socket } from './socket';
import { setLocalPlayerId, selectEdge, setUserIdMapping, addPlayer, startGame, resetGame } from '../redux/actions';
import { multiplayerStore } from './stores/multiplayerStore';

// Interface for rematch information
interface RematchInfo {
  isInitiator: boolean;
  playerData?: Map<string, { color: string; edge: number }>;
  gameSettings?: {
    boardRadius: number;
    supermove: boolean;
    singleSupermove: boolean;
    supermoveAnyPlayer: boolean;
  };
}

export class GameCoordinator {
  private store: any; // Redux store
  private gameId: string;
  private localActionsProcessed = 0;
  private realOriginalDispatch: any = null; // The actual Redux dispatch before interception
  private localPlayerId: string | null = null;
  private isProcessingRematch: boolean = false;
  private rematchInfo?: RematchInfo;
  private pendingRematchEdges?: Map<string, number>; // Player edges to apply after START_GAME
  private isSpectator: boolean = false; // Track if user is spectating
  private needsResetBeforeSync: boolean = false; // Flag to reset game state before syncing actions
  
  // Store bound event handlers so we can properly remove them
  private boundGameReady: EventListener;
  private boundActionReceived: EventListener;
  private boundActionsSync: EventListener;
  private boundRematchCreated: EventListener;
  private boundSpectatorRematchTransition: EventListener;

  constructor(reduxStore: any, gameId: string, rematchInfo?: RematchInfo) {
    this.store = reduxStore;
    this.gameId = gameId;
    
    // Check if user is spectating
    const state = multiplayerStore.get();
    this.isSpectator = state?.isSpectator || false;
    
    // Store rematch information if provided
    if (rematchInfo) {
      this.rematchInfo = rematchInfo;
      console.log('[GameCoordinator] Created with rematch info:', rematchInfo);
    }
    
    console.log('[GameCoordinator] Created for game', gameId, 'isSpectator:', this.isSpectator);
    
    // Bind event handlers once
    this.boundGameReady = this.handleGameReady.bind(this) as EventListener;
    this.boundActionReceived = this.handleActionReceived.bind(this) as EventListener;
    this.boundActionsSync = this.handleActionsSync.bind(this) as EventListener;
    this.boundRematchCreated = this.handleRematchCreated.bind(this) as EventListener;
    this.boundSpectatorRematchTransition = this.handleSpectatorRematchTransition.bind(this) as EventListener;
  }

  start() {
    this.setupEventListeners();
    this.interceptReduxDispatch();
    // Request game actions to sync state
    socket.getActions(this.gameId);
  }

  stop() {
    this.cleanup();
  }
  
  // Get rematch info to pass to new coordinator
  getRematchInfo(): RematchInfo | null {
    return this.rematchInfo || null;
  }

  private handleRematch() {
    // Prevent duplicate rematch requests
    if (this.isProcessingRematch) {
      console.log('[GameCoordinator] Rematch already in progress, ignoring duplicate request');
      return;
    }
    
    // Get the current game state to extract player information and settings
    const state = this.store.getState();
    const edgeAssignments = state.game?.seatingPhase?.edgeAssignments;
    const players = state.game?.players;
    
    // Extract game settings from current game state
    const gameSettings = {
      boardRadius: state.game?.boardRadius ?? 3,
      supermove: state.game?.supermove ?? true,
      singleSupermove: state.game?.singleSupermove ?? false,
      supermoveAnyPlayer: state.game?.supermoveAnyPlayer ?? false,
    };
    
    // Get local player ID from UI state or coordinator's stored value
    this.localPlayerId = state.ui?.localPlayerId || this.localPlayerId;
    
    // If still null, try to infer from the game state
    // In multiplayer, we should have the localPlayerId from when the player selected their edge
    // But as a fallback, we can use the first player if available
    if (!this.localPlayerId && players && players.length > 0) {
      console.warn('[GameCoordinator] LocalPlayerId not found, using first player as fallback');
      this.localPlayerId = players[0].id;
    }
    
    if (!this.localPlayerId) {
      console.error('[GameCoordinator] Cannot create rematch: no local player ID');
      return;
    }
    
    console.log('[GameCoordinator] Requesting rematch with settings:', gameSettings);
    
    // Mark that we're processing a rematch
    this.isProcessingRematch = true;
    
    // Prepare rematch info for the new coordinator
    const playerData = new Map<string, { color: string; edge: number }>();
    if (edgeAssignments && players) {
      players.forEach((player: any) => {
        const edge = edgeAssignments.get(player.id);
        if (edge !== undefined) {
          playerData.set(player.id, {
            color: player.color,
            edge: edge
          });
        }
      });
      
      console.log('[GameCoordinator] Prepared player data for rematch:', playerData);
    }
    
    // Store rematch info in the coordinator instance for transfer to new coordinator
    this.rematchInfo = {
      isInitiator: true,
      playerData,
      gameSettings
    };
    
    // Request rematch via socket (server will broadcast to all players)
    socket.requestRematch(this.gameId);
  }

  private handleRematchCreated(event: Event) {
    const customEvent = event as CustomEvent;
    const { newGameId, oldGameId } = customEvent.detail;
    
    console.log('[GameCoordinator] Rematch created, transitioning from', oldGameId, 'to', newGameId);
    
    // Spectators should NOT join immediately - they will be added after seating phase
    if (this.isSpectator) {
      console.log('[GameCoordinator] Spectator mode - will wait for rematch_spectator_rejoin event');
      // Don't leave old room or join new room
      // Don't stop the coordinator yet - we need to stay listening to old room
      return;
    }
    
    // For players: leave the old game room and join the new one
    socket.leaveRoom(oldGameId);
    socket.joinRoom(newGameId);
    
    // The server will send game_ready event for the new game
    // which will trigger multiplayerStore.setGameId() via socket event handler
    // That will cause multiplayerMain to create a fresh coordinator for the new game
    // The new coordinator will receive rematch info via getRematchInfo()
    // So we just need to clean up this coordinator instance
    this.stop();
    
    // Reset the rematch processing flag to allow future rematches
    this.isProcessingRematch = false;
  }

  private handleSpectatorRematchTransition(event: Event) {
    const customEvent = event as CustomEvent;
    const { newGameId } = customEvent.detail;
    
    console.log('[GameCoordinator] Spectator rematch transition to game:', newGameId);
    
    // Leave the old game room
    socket.leaveRoom(this.gameId);
    
    // Update our game ID to the new one and reset action counter
    // The action counter reset is crucial - we'll receive the full game state
    // from the server when we join as spectator, starting from action 0
    this.gameId = newGameId;
    this.localActionsProcessed = 0;
    
    // Update the multiplayer store game ID so UI knows about the new game
    multiplayerStore.setGameId(newGameId);
    
    // Join the new room so we can receive updates
    // This won't cause "room full" because we're not a player
    socket.joinRoom(newGameId);
    
    console.log('[GameCoordinator] Spectator transitioned to new game:', newGameId);
  }

  private interceptReduxDispatch() {
    // Intercept Redux dispatch to catch START_GAME and other actions
    // that should be broadcast to all clients
    if (!this.store) return;
    
    // Save the real original dispatch before we replace it
    this.realOriginalDispatch = this.store.dispatch;
    
    this.store.dispatch = (action: any) => {
      // Block all game actions for spectators (except UI actions)
      if (this.isSpectator && this.shouldBroadcastAction(action.type)) {
        console.log(`[GameCoordinator] Spectator mode: blocking action ${action.type}`);
        // Ignore the action - spectators cannot modify game state
        return;
      }
      
      // Check if this is START_GAME from lobby Play button
      if (action.type === 'START_GAME' && !action.payload?.seed) {
        // Generate seed and post to server
        const seed = Math.floor(Math.random() * 1000000);
        console.log(`Intercepted START_GAME, adding seed: ${seed}`);
        
        const actionWithSeed = {
          ...action,
          payload: {
            ...action.payload,
            seed
          }
        };
        
        // Post to server (will come back via action stream)
        socket.postAction(this.gameId, actionWithSeed);
        
        // Don't dispatch locally yet - wait for it to come back from server
        return;
      }
      
      // Check if this is REMATCH_GAME - handle specially for multiplayer
      if (action.type === 'REMATCH_GAME') {
        console.log('[GameCoordinator] Rematch requested - creating new game');
        this.handleRematch();
        // Don't dispatch locally - we'll transition to a new game instead
        return;
      }
      
      // Check if this is a player action that should be broadcast
      if (this.shouldBroadcastAction(action.type)) {
        console.log(`Broadcasting action: ${action.type}`);
        
        // Special handling for SELECT_EDGE from the local player
        // Track the local player ID before broadcasting
        if (action.type === 'SELECT_EDGE') {
          console.log('[GameCoordinator] Local player selected edge:', action.payload);
          // Store the local player's game ID in the UI state
          this.realOriginalDispatch.call(this.store, setLocalPlayerId(action.payload.playerId));
          console.log('[GameCoordinator] Set localPlayerId to:', action.payload.playerId);
          // Also track it in the coordinator for rematch
          this.localPlayerId = action.payload.playerId;
        }
        
        socket.postAction(this.gameId, action);
        // Don't dispatch locally - wait for server broadcast
        return;
      }
      
      // For other actions (UI, etc.), dispatch normally
      return this.realOriginalDispatch(action);
    };
  }

  private shouldBroadcastAction(actionType: string): boolean {
    // Actions that affect game state and should be broadcast
    const broadcastActions = [
      // Game setup actions
      'ADD_PLAYER',
      'REMOVE_PLAYER',
      'CHANGE_PLAYER_COLOR',
      'UPDATE_SETTINGS',
      'TOGGLE_SETTINGS',
      // Seating phase actions
      'SELECT_EDGE',
      'COMPLETE_SEATING_PHASE',
      // Gameplay actions
      'PLACE_TILE',
      'REPLACE_TILE',
      'DRAW_TILE',
      'NEXT_PLAYER',
      'END_GAME',
      // Other game flow actions
      'SETUP_GAME',
      'SHUFFLE_TILES',
      'START_SEATING_PHASE'
    ];
    return broadcastActions.includes(actionType);
  }

  private setupEventListeners() {
    // Game ready - initialize game with seed
    window.addEventListener('multiplayer:game-ready', this.boundGameReady);
    
    // Action received from server - replay it
    window.addEventListener('multiplayer:action', this.boundActionReceived);
    
    // Sync all actions (for reconnection)
    window.addEventListener('multiplayer:actions-sync', this.boundActionsSync);
    
    // Rematch created - transition to new game
    window.addEventListener('multiplayer:rematch-created', this.boundRematchCreated);
    
    // Spectator rematch transition - transition spectator to new game
    window.addEventListener('multiplayer:spectator-rematch-transition', this.boundSpectatorRematchTransition);
  }

  private handleGameReady(event: Event) {
    const customEvent = event as CustomEvent;
    const { gameId, players } = customEvent.detail;
    this.gameId = gameId;
    
    console.log(`Game ready! GameId: ${gameId}, Players: ${players.length}`, players);
    
    // Get localPlayerId from Redux state (it persists across coordinator instances)
    const state = this.store.getState();
    const localPlayerId = state.ui?.localPlayerId || this.localPlayerId;
    
    // Check if this is a rematch (passed from old coordinator)
    if (this.rematchInfo && this.rematchInfo.isInitiator && localPlayerId) {
      console.log('[GameCoordinator] This is a rematch and I am the initiator');
      
      // Store localPlayerId for this coordinator instance
      this.localPlayerId = localPlayerId;
      
      // Get player data and game settings from rematch info
      const allPlayersData = this.rematchInfo.playerData;
      const gameSettings = this.rematchInfo.gameSettings;
      
      if (allPlayersData && gameSettings) {
        console.log('[GameCoordinator] Initiator posting setup for all', allPlayersData.size, 'players');
        console.log('[GameCoordinator] Using game settings:', gameSettings);
        
        // Store edge assignments to apply after START_GAME
        this.pendingRematchEdges = new Map();
        allPlayersData.forEach((data, playerId) => {
          this.pendingRematchEdges!.set(playerId, data.edge);
        });
        
        // Step 1: Add all players
        allPlayersData.forEach((data, playerId) => {
          console.log('[GameCoordinator] Posting ADD_PLAYER for player', playerId, 'color:', data.color, 'edge:', data.edge);
          this.store.dispatch(addPlayer(data.color, data.edge, playerId, playerId)); // Pass userId as 4th param
        });
        
        // Step 2: Send START_GAME with game settings (wait a bit for ADD_PLAYER actions to be broadcast)
        setTimeout(() => {
          const seed = Math.floor(Math.random() * 1000000);
          console.log('[GameCoordinator] Posting START_GAME with seed:', seed, 'and settings:', gameSettings);
          socket.postAction(gameId, startGame({
            seed,
            boardRadius: gameSettings.boardRadius,
            supermove: gameSettings.supermove,
            singleSupermove: gameSettings.singleSupermove,
            supermoveAnyPlayer: gameSettings.supermoveAnyPlayer
          }));
          // SELECT_EDGE will be posted when START_GAME is received and seating order is set
        }, 200);
      }
      
      // Clear rematch info so we don't process it again
      this.rematchInfo = undefined;
    } else if (this.rematchInfo && !this.rematchInfo.isInitiator) {
      // Non-initiator: just wait for actions to arrive from initiator
      console.log('[GameCoordinator] This is a rematch but I am NOT the initiator, waiting for setup');
      this.rematchInfo = undefined;
    } else {
      console.log('Players should now use the configuration screen to add themselves by clicking edge buttons.');
    }
    
    // Request any existing actions to sync
    socket.getActions(gameId);
  }

  private handleActionReceived(event: Event) {
    const customEvent = event as CustomEvent;
    const action = customEvent.detail;
    
    console.log(`Received action ${action.sequence}: ${action.type}`);
    
    // Only process actions we haven't processed yet
    if (action.sequence < this.localActionsProcessed) {
      console.log(`Skipping already processed action ${action.sequence}`);
      return;
    }
    
    // Dispatch to Redux store using the REAL original dispatch to bypass interception
    if (this.store && this.realOriginalDispatch) {
      // Special handling for ADD_PLAYER: track user ID to player ID mapping
      if (action.type === 'ADD_PLAYER' && action.payload && action.payload.userId) {
        // Get current state to determine the config player ID that will be assigned
        const state = this.store.getState();
        const configPlayerId = `P${state.game.configPlayers.length + 1}`;
        
        // Update the mapping before dispatching ADD_PLAYER
        const mapping = new Map<string, string>(state.ui.userIdToPlayerId as Map<string, string>);
        mapping.set(action.payload.userId, configPlayerId);
        
        // Dispatch the mapping update first
        this.realOriginalDispatch.call(this.store, setUserIdMapping(mapping));
      }
      
      this.realOriginalDispatch.call(this.store, {
        type: action.type,
        payload: action.payload
      });
      
      this.localActionsProcessed = action.sequence + 1;
      
      // Check if START_GAME was processed and we have pending rematch edges to apply
      if (action.type === 'START_GAME' && this.pendingRematchEdges) {
        this.postPendingRematchEdges();
      }
    }
  }

  private handleActionsSync(event: Event) {
    const customEvent = event as CustomEvent;
    const { gameId, actions } = customEvent.detail;
    
    if (gameId !== this.gameId) return;
    
    console.log(`Syncing ${actions.length} actions`);
    
    // Replay all actions in order using the REAL original dispatch
    actions.forEach((action: any) => {
      if (action.sequence >= this.localActionsProcessed && this.store && this.realOriginalDispatch) {
        this.realOriginalDispatch.call(this.store, {
          type: action.type,
          payload: action.payload
        });
        this.localActionsProcessed = action.sequence + 1;
        
        // Check if START_GAME was processed and we have pending rematch edges to apply
        if (action.type === 'START_GAME' && this.pendingRematchEdges) {
          this.postPendingRematchEdges();
        }
      }
    });
  }

  /**
   * Posts SELECT_EDGE actions for all players with pending rematch edges.
   * This is called after START_GAME has been processed and the seating order is established.
   */
  private postPendingRematchEdges() {
    console.log('[GameCoordinator] START_GAME processed, posting SELECT_EDGE in seating order');
    
    // Get the seating order from the state (just created by START_GAME)
    const state = this.store.getState();
    const seatingOrder = state.game?.seatingPhase?.seatingOrder;
    
    if (seatingOrder && seatingOrder.length > 0) {
      console.log('[GameCoordinator] Seating order:', seatingOrder);
      
      // Post SELECT_EDGE for each player in seating order
      seatingOrder.forEach((playerId: string, index: number) => {
        const edge = this.pendingRematchEdges!.get(playerId);
        if (edge !== undefined) {
          console.log('[GameCoordinator] Posting SELECT_EDGE for player', playerId, 'edge:', edge, '(position', index, 'in seating order)');
          // Use setTimeout to ensure actions are sent in order
          setTimeout(() => {
            this.store.dispatch(selectEdge(playerId, edge));
          }, index * 50); // Small delay between each to ensure order
        }
      });
      
      // Clear pending edges after posting
      this.pendingRematchEdges = undefined;
    }
  }

  // Intercept local Redux actions and post to server
  postLocalAction(action: any) {
    if (!this.gameId) {
      console.warn('Cannot post action: no active game');
      return;
    }
    
    console.log(`Posting local action: ${action.type}`);
    socket.postAction(this.gameId, {
      type: action.type,
      payload: action.payload
    });
  }

  private cleanup() {
    window.removeEventListener('multiplayer:game-ready', this.boundGameReady);
    window.removeEventListener('multiplayer:action', this.boundActionReceived);
    window.removeEventListener('multiplayer:actions-sync', this.boundActionsSync);
    window.removeEventListener('multiplayer:rematch-created', this.boundRematchCreated);
    window.removeEventListener('multiplayer:spectator-rematch-transition', this.boundSpectatorRematchTransition);
    
    // Restore original dispatch
    if (this.realOriginalDispatch && this.store) {
      this.store.dispatch = this.realOriginalDispatch;
    }
    
    this.localActionsProcessed = 0;
  }
}
