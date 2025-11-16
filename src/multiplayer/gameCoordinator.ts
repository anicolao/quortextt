// Multiplayer game coordinator - handles event sourcing and Redux integration
import { socket } from './socket';
import { setLocalPlayerId, selectEdge } from '../redux/actions';

export class GameCoordinator {
  private store: any; // Redux store
  private gameId: string;
  private localActionsProcessed = 0;
  private realOriginalDispatch: any = null; // The actual Redux dispatch before interception
  private localPlayerId: string | null = null;
  private isProcessingRematch: boolean = false;
  private rematchInfo?: { isInitiator: boolean; playerData?: { color: string; edge: number } };
  private pendingRematchEdges?: Map<string, number>; // Player edges to apply after START_GAME
  
  // Store bound event handlers so we can properly remove them
  private boundGameReady: EventListener;
  private boundActionReceived: EventListener;
  private boundActionsSync: EventListener;
  private boundRematchCreated: EventListener;

  constructor(reduxStore: any, gameId: string, rematchInfo?: { isInitiator: boolean; playerData?: { color: string; edge: number } }) {
    this.store = reduxStore;
    this.gameId = gameId;
    
    // Store rematch information if provided
    if (rematchInfo) {
      this.rematchInfo = rematchInfo;
      console.log('[GameCoordinator] Created with rematch info:', rematchInfo);
    }
    
    // Bind event handlers once
    this.boundGameReady = this.handleGameReady.bind(this) as EventListener;
    this.boundActionReceived = this.handleActionReceived.bind(this) as EventListener;
    this.boundActionsSync = this.handleActionsSync.bind(this) as EventListener;
    this.boundRematchCreated = this.handleRematchCreated.bind(this) as EventListener;
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
  getRematchInfo(): { isInitiator: boolean; playerData?: { color: string; edge: number } } | null {
    // Check if there's rematch data stored globally
    const playerData = (window as any).__localPlayerRematchData as { color: string; edge: number } | undefined;
    const isInitiator = (window as any).__isRematchInitiator === true;
    
    if (playerData) {
      // Clear the globals since we're transferring the data
      delete (window as any).__localPlayerRematchData;
      delete (window as any).__isRematchInitiator;
      
      return { isInitiator, playerData };
    }
    
    return null;
  }

  private handleRematch() {
    // Prevent duplicate rematch requests
    if (this.isProcessingRematch) {
      console.log('[GameCoordinator] Rematch already in progress, ignoring duplicate request');
      return;
    }
    
    // Get the current game state to extract player information
    const state = this.store.getState();
    const edgeAssignments = state.game?.seatingPhase?.edgeAssignments;
    const players = state.game?.players;
    
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
    
    console.log('[GameCoordinator] Requesting rematch...');
    
    // Mark that we're processing a rematch
    this.isProcessingRematch = true;
    
    // Mark this player as the rematch initiator (store globally so new coordinator can access it)
    (window as any).__isRematchInitiator = true;
    
    // Store player information for restoration in the rematch
    if (edgeAssignments && players) {
      (window as any).__rematchEdgeAssignments = new Map(edgeAssignments);
      
      // Store complete player data (color, edge) for each player
      const playerData = new Map<string, { color: string; edge: number }>();
      players.forEach((player: any) => {
        const edge = edgeAssignments.get(player.id);
        if (edge !== undefined) {
          playerData.set(player.id, {
            color: player.color,
            edge: edge
          });
        }
      });
      (window as any).__rematchPlayerData = playerData;
      
      console.log('[GameCoordinator] Stored player data for rematch:', playerData);
    }
    
    // Request rematch via socket (server will broadcast to all players)
    socket.requestRematch(this.gameId);
  }

  private handleRematchCreated(event: Event) {
    const customEvent = event as CustomEvent;
    const { newGameId, oldGameId } = customEvent.detail;
    
    console.log('[GameCoordinator] Rematch created, transitioning from', oldGameId, 'to', newGameId);
    
    // Get stored player data
    const playerData = (window as any).__rematchPlayerData as Map<string, { color: string; edge: number }> | undefined;
    
    // Get localPlayerId from Redux state (more reliable than instance variable)
    const state = this.store.getState();
    const localPlayerId = state.ui?.localPlayerId || this.localPlayerId;
    
    // Store player data for reapplication
    if (playerData && localPlayerId) {
      const localPlayerData = playerData.get(localPlayerId);
      if (localPlayerData) {
        console.log('[GameCoordinator] Will restore player data:', localPlayerData);
        (window as any).__localPlayerRematchData = localPlayerData;
      }
    }
    
    // Leave the old game room
    socket.leaveRoom(oldGameId);
    
    // Join the new game room
    socket.joinRoom(newGameId);
    
    // The server will send game_ready event for the new game
    // which will trigger multiplayerStore.setGameId() via socket event handler
    // That will cause multiplayerMain to create a fresh coordinator for the new game
    // So we just need to clean up this coordinator instance
    this.stop();
    
    // Reset the rematch processing flag to allow future rematches
    this.isProcessingRematch = false;
  }

  private interceptReduxDispatch() {
    // Intercept Redux dispatch to catch START_GAME and other actions
    // that should be broadcast to all clients
    if (!this.store) return;
    
    // Save the real original dispatch before we replace it
    this.realOriginalDispatch = this.store.dispatch;
    
    this.store.dispatch = (action: any) => {
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
  }

  private handleGameReady(event: Event) {
    const customEvent = event as CustomEvent;
    const { gameId, players } = customEvent.detail;
    this.gameId = gameId;
    
    console.log(`Game ready! GameId: ${gameId}, Players: ${players.length}`);
    
    // Get localPlayerId from Redux state (it persists across coordinator instances)
    const state = this.store.getState();
    const localPlayerId = state.ui?.localPlayerId || this.localPlayerId;
    
    // Check if this is a rematch (passed from old coordinator)
    if (this.rematchInfo && this.rematchInfo.isInitiator && localPlayerId) {
      console.log('[GameCoordinator] This is a rematch and I am the initiator');
      
      // Store localPlayerId for this coordinator instance
      this.localPlayerId = localPlayerId;
      
      // Get all players' data from window globals (stored by handleRematch)
      const allPlayersData = (window as any).__rematchPlayerData as Map<string, { color: string; edge: number }> | undefined;
      
      if (allPlayersData) {
        console.log('[GameCoordinator] Initiator posting setup for all', allPlayersData.size, 'players');
        
        // Store edge assignments to apply after START_GAME
        this.pendingRematchEdges = new Map();
        allPlayersData.forEach((data, playerId) => {
          this.pendingRematchEdges!.set(playerId, data.edge);
        });
        
        // Import all needed actions
        import('../redux/actions').then(({ addPlayer, startGame }) => {
          // Step 1: Add all players
          allPlayersData.forEach((data, playerId) => {
            console.log('[GameCoordinator] Posting ADD_PLAYER for player', playerId, 'color:', data.color, 'edge:', data.edge);
            this.store.dispatch(addPlayer(data.color, data.edge, playerId));
          });
          
          // Step 2: Send START_GAME (wait a bit for ADD_PLAYER actions to be broadcast)
          setTimeout(() => {
            const seed = Math.floor(Math.random() * 1000000);
            console.log('[GameCoordinator] Posting START_GAME with seed:', seed);
            socket.postAction(gameId, startGame({ seed }));
            // SELECT_EDGE will be posted when START_GAME is received and seating order is set
          }, 200);
        });
        
        // Clear the global data
        delete (window as any).__rematchPlayerData;
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
      this.realOriginalDispatch.call(this.store, {
        type: action.type,
        payload: action.payload
      });
      
      this.localActionsProcessed = action.sequence + 1;
      
      // Check if START_GAME was processed and we have pending rematch edges to apply
      if (action.type === 'START_GAME' && this.pendingRematchEdges) {
        console.log('[GameCoordinator] START_GAME received, posting SELECT_EDGE in seating order');
        
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
      }
    });
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
    
    // Restore original dispatch
    if (this.realOriginalDispatch && this.store) {
      this.store.dispatch = this.realOriginalDispatch;
    }
    
    this.localActionsProcessed = 0;
  }
}
