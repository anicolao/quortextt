// Multiplayer game coordinator - handles event sourcing and Redux integration
import { socket } from './socket';

export class GameCoordinator {
  private store: any; // Redux store
  private gameId: string;
  private localActionsProcessed = 0;
  private originalDispatch: any = null;

  constructor(reduxStore: any, gameId: string) {
    this.store = reduxStore;
    this.gameId = gameId;
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

  private interceptReduxDispatch() {
    // Intercept Redux dispatch to catch START_GAME and other actions
    // that should be broadcast to all clients
    if (!this.store) return;
    
    this.originalDispatch = this.store.dispatch;
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
      
      // Check if this is a player action that should be broadcast
      if (this.shouldBroadcastAction(action.type)) {
        console.log(`Broadcasting action: ${action.type}`);
        socket.postAction(this.gameId, action);
        // Don't dispatch locally - wait for server broadcast
        return;
      }
      
      // For other actions (UI, etc.), dispatch normally
      return this.originalDispatch(action);
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
    window.addEventListener('multiplayer:game-ready', this.handleGameReady.bind(this) as EventListener);
    
    // Action received from server - replay it
    window.addEventListener('multiplayer:action', this.handleActionReceived.bind(this) as EventListener);
    
    // Sync all actions (for reconnection)
    window.addEventListener('multiplayer:actions-sync', this.handleActionsSync.bind(this) as EventListener);
  }

  private handleGameReady(event: Event) {
    const customEvent = event as CustomEvent;
    const { gameId, players } = customEvent.detail;
    this.gameId = gameId;
    
    console.log(`Game ready! GameId: ${gameId}, Players: ${players.length}`);
    
    // Request any existing actions to sync first
    socket.getActions(gameId);
    
    // Check if we're the host (first player in the list)
    // The host should initialize the game by posting ADD_PLAYER actions
    const mySocketId = socket.getSocketId();
    const isHost = players.length > 0 && players[0].id === mySocketId;
    
    if (isHost) {
      console.log('I am the host. Posting ADD_PLAYER actions for all players.');
      
      // Post ADD_PLAYER action for each player
      players.forEach((_player: any, index: number) => {
        const color = this.getPlayerColor(index);
        socket.postAction(gameId, {
          type: 'ADD_PLAYER',
          payload: {
            color,
            isAI: false
          }
        });
      });
      
      console.log('Posted all ADD_PLAYER actions. Players can now configure game settings.');
    } else {
      console.log('Waiting for host to initialize game setup.');
    }
  }

  private getPlayerColor(index: number): string {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f7b731', '#5f27cd', '#00d2d3'];
    return colors[index % colors.length];
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
    
    // Dispatch to Redux store using original dispatch to avoid re-interception
    if (this.store && this.originalDispatch) {
      this.originalDispatch.call(this.store, {
        type: action.type,
        payload: action.payload
      });
      
      this.localActionsProcessed = action.sequence + 1;
    }
  }

  private handleActionsSync(event: Event) {
    const customEvent = event as CustomEvent;
    const { gameId, actions } = customEvent.detail;
    
    if (gameId !== this.gameId) return;
    
    console.log(`Syncing ${actions.length} actions`);
    
    // Replay all actions in order using original dispatch
    actions.forEach((action: any) => {
      if (action.sequence >= this.localActionsProcessed && this.store && this.originalDispatch) {
        this.originalDispatch.call(this.store, {
          type: action.type,
          payload: action.payload
        });
        this.localActionsProcessed = action.sequence + 1;
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
    window.removeEventListener('multiplayer:game-ready', this.handleGameReady.bind(this) as EventListener);
    window.removeEventListener('multiplayer:action', this.handleActionReceived.bind(this) as EventListener);
    window.removeEventListener('multiplayer:actions-sync', this.handleActionsSync.bind(this) as EventListener);
    
    // Restore original dispatch
    if (this.originalDispatch && this.store) {
      this.store.dispatch = this.originalDispatch;
    }
    
    this.localActionsProcessed = 0;
  }
}
