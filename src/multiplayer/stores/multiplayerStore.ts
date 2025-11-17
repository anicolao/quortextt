// Multiplayer state management using Svelte stores
import { writable, derived } from 'svelte/store';
import { Router } from '../router';

export interface Player {
  id: string;
  username: string;
}

export interface Room {
  id: string;
  name: string;
  hostId: string;
  players?: Player[]; // Optional, may not be present in room list API
  playerCount?: number; // Alternative count from API
  maxPlayers: number;
  status: 'waiting' | 'playing' | 'finished';
  spectatorCount?: number; // Number of spectators watching
}

export interface MultiplayerState {
  connected: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting' | 'connected_elsewhere';
  username: string | null;
  playerId: string | null;
  userId: string | null; // Discord user ID when in Discord Activity mode
  currentRoom: Room | null;
  availableRooms: Room[];
  screen: 'login' | 'lobby' | 'room' | 'game' | 'profile';
  gameId: string | null;
  disconnectedPlayers: Set<string>; // Track which players are disconnected
  isSpectator: boolean; // Whether current user is spectating
  spectatorCount: number; // Number of spectators in current game
}

const initialState: MultiplayerState = {
  connected: false,
  connectionStatus: 'disconnected',
  username: null,
  playerId: null,
  userId: null,
  currentRoom: null,
  availableRooms: [],
  screen: 'login',
  gameId: null,
  disconnectedPlayers: new Set(),
  isSpectator: false,
  spectatorCount: 0,
};

// Create the main store
function createMultiplayerStore() {
  const { subscribe, set, update } = writable<MultiplayerState>(initialState);

  return {
    subscribe,
    set, // Expose set for Discord Activity to directly update state
    update, // Expose update for internal use (e.g., from router)
    get: () => {
      let value: MultiplayerState = initialState;
      subscribe(v => value = v)();
      return value;
    },
    
    setConnected: (connected: boolean) => 
      update(state => ({ 
        ...state, 
        connected,
        connectionStatus: connected ? 'connected' : 'disconnected'
      })),
    
    setConnectionStatus: (connectionStatus: MultiplayerState['connectionStatus']) =>
      update(state => ({ ...state, connectionStatus })),
    
    setUsername: (username: string, playerId: string) =>
      update(state => ({ ...state, username, playerId })),
    
    setScreen: (screen: MultiplayerState['screen'], params?: { id?: string; spectate?: boolean }) =>
      update(state => {
        // Update URL via router
        const routeParams: any = {};
        if (params?.id) routeParams.id = params.id;
        if (params?.spectate) routeParams.spectate = 'true';
        if (Router.isDiscordContext()) routeParams.discord = 'true';
        
        Router.navigate(screen, routeParams);
        return { ...state, screen };
      }),
    
    setAvailableRooms: (rooms: Room[]) =>
      update(state => ({ ...state, availableRooms: rooms })),
    
    setCurrentRoom: (room: Room | null) =>
      update(state => ({ ...state, currentRoom: room })),
    
    updateCurrentRoom: (updates: Partial<Room>) =>
      update(state => {
        if (!state.currentRoom) return state;
        return {
          ...state,
          currentRoom: { ...state.currentRoom, ...updates }
        };
      }),
    
    setGameId: (gameId: string | null) =>
      update(state => {
        // If we're setting a gameId and on the game screen, update the URL
        if (gameId && state.screen === 'game') {
          const routeParams: any = { id: gameId };
          if (state.isSpectator) routeParams.spectate = 'true';
          if (Router.isDiscordContext()) routeParams.discord = 'true';
          Router.navigate('game', routeParams);
        }
        return { ...state, gameId };
      }),
    
    setPlayerDisconnected: (playerId: string) =>
      update(state => {
        const newDisconnectedPlayers = new Set(state.disconnectedPlayers);
        newDisconnectedPlayers.add(playerId);
        return { ...state, disconnectedPlayers: newDisconnectedPlayers };
      }),
    
    setPlayerConnected: (playerId: string) =>
      update(state => {
        const newDisconnectedPlayers = new Set(state.disconnectedPlayers);
        newDisconnectedPlayers.delete(playerId);
        return { ...state, disconnectedPlayers: newDisconnectedPlayers };
      }),
    
    setIsSpectator: (isSpectator: boolean) =>
      update(state => ({ ...state, isSpectator })),
    
    setSpectatorCount: (spectatorCount: number) =>
      update(state => ({ ...state, spectatorCount })),
    
    reset: () => set(initialState),
  };
}

export const multiplayerStore = createMultiplayerStore();

// Derived stores for convenience
export const isHost = derived(
  multiplayerStore,
  $store => $store.currentRoom?.hostId === $store.playerId
);
