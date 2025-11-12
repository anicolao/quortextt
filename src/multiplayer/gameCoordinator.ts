// Multiplayer game coordinator - handles event sourcing and Redux integration
import { socket } from './socket';
import { multiplayerStore } from './stores/multiplayerStore';
import { get } from 'svelte/store';

export class MultiplayerGameCoordinator {
  private store: any | null = null; // Redux store
  private gameId: string | null = null;
  private isHostPlayer: boolean = false;
  private localActionsProcessed = 0;

  initialize(reduxStore: any) {
    this.store = reduxStore;
    this.setupEventListeners();
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
    
    const state = get(multiplayerStore);
    this.isHostPlayer = state.playerId === state.currentRoom?.hostId;
    
    console.log(`Game ready! GameId: ${gameId}, IsHost: ${this.isHostPlayer}`);
    
    // If host, generate seed and post START_GAME action
    if (this.isHostPlayer) {
      this.initializeGameAsHost(players);
    } else {
      // Non-host: request all actions to sync
      socket.getActions(gameId);
    }
  }

  private initializeGameAsHost(players: any[]) {
    if (!this.gameId) return;
    
    // Generate random seed
    const seed = Math.floor(Math.random() * 1000000);
    
    console.log(`Host initializing game with seed: ${seed}`);
    
    // Post START_GAME action with seed and player configuration
    const startGameAction = {
      type: 'START_GAME',
      payload: {
        seed,
        boardRadius: 5,
        // Map socket players to game players
        players: players.map((p, index) => ({
          id: `p${index + 1}`,
          username: p.username,
          socketId: p.id,
          color: this.getPlayerColor(index),
          edge: index, // Assign edges in order
          isAI: false
        }))
      }
    };
    
    // Post to server
    socket.postAction(this.gameId, startGameAction);
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
    
    // Dispatch to Redux store
    if (this.store) {
      this.store.dispatch({
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
    
    // Replay all actions in order
    actions.forEach((action: any) => {
      if (action.sequence >= this.localActionsProcessed && this.store) {
        this.store.dispatch({
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

  cleanup() {
    window.removeEventListener('multiplayer:game-ready', this.handleGameReady.bind(this) as EventListener);
    window.removeEventListener('multiplayer:action', this.handleActionReceived.bind(this) as EventListener);
    window.removeEventListener('multiplayer:actions-sync', this.handleActionsSync.bind(this) as EventListener);
    
    this.store = null;
    this.gameId = null;
    this.localActionsProcessed = 0;
  }
}

// Export singleton
export const gameCoordinator = new MultiplayerGameCoordinator();
