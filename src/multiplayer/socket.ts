// Socket.IO client for multiplayer
import { io, Socket } from 'socket.io-client';
import { multiplayerStore } from './stores/multiplayerStore';
import type { Room, Player } from './stores/multiplayerStore';
import { store } from '../redux/store';
import { setPlayerConnected, setPlayerDisconnected } from '../redux/actions';

class MultiplayerSocket {
  private socket: Socket | null = null;
  private serverUrl: string;
  private useDiscordProxy: boolean = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Use environment variable or auto-detect based on current protocol
    // @ts-ignore - Vite injects import.meta.env
    const envServerUrl = import.meta.env?.VITE_SERVER_URL;
    
    if (envServerUrl) {
      this.serverUrl = envServerUrl;
    } else {
      // Auto-detect: if page is HTTPS, use wss:// and https://, otherwise use ws:// and http://
      const isSecure = window.location.protocol === 'https:';
      const protocol = isSecure ? 'https:' : 'http:';
      const host = window.location.hostname;
      const port = isSecure ? '3001' : '3001'; // Use same port for now
      this.serverUrl = `${protocol}//${host}:${port}`;
    }
  }

  /**
   * Start sending heartbeat to server every 1 second
   */
  private startHeartbeat() {
    // Clear any existing interval
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Send heartbeat every 1 second
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('heartbeat');
      }
    }, 1000);
  }

  /**
   * Stop sending heartbeat
   */
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Enable Discord proxy mode for Discord Activities
   * This uses Discord's /.proxy path to bypass CSP restrictions
   */
  setDiscordProxyMode(enabled: boolean) {
    this.useDiscordProxy = enabled;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      // When using Discord proxy, we need to connect to the current origin
      // and specify the full proxy path for Socket.IO
      const socketUrl = this.useDiscordProxy ? window.location.origin : this.serverUrl;

      this.socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        // Specify the Socket.IO path - for Discord proxy, use the full proxy path
        path: this.useDiscordProxy ? '/.proxy/socket.io' : '/socket.io',
      });

      this.socket.on('connect', () => {
        console.log('Connected to server');
        multiplayerStore.setConnected(true);
        this.startHeartbeat();
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        multiplayerStore.setConnectionStatus('reconnecting');
        this.stopHeartbeat();
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
        // Socket.io will automatically try to reconnect unless disconnect was intentional
        if (reason === 'io server disconnect' || reason === 'io client disconnect') {
          multiplayerStore.setConnected(false);
        } else {
          // Network issue - will auto-reconnect
          multiplayerStore.setConnectionStatus('reconnecting');
        }
        this.stopHeartbeat();
      });

      this.socket.on('reconnect', (attemptNumber) => {
        console.log('Reconnected to server after', attemptNumber, 'attempts');
        multiplayerStore.setConnected(true);
        this.startHeartbeat();
      });

      this.socket.on('reconnect_attempt', (attemptNumber) => {
        console.log('Attempting to reconnect...', attemptNumber);
        multiplayerStore.setConnectionStatus('reconnecting');
      });

      this.setupEventHandlers();
    });
  }

  connectWithAuth(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      // When using Discord proxy, we need to connect to the current origin
      // and specify the full proxy path for Socket.IO
      const socketUrl = this.useDiscordProxy ? window.location.origin : this.serverUrl;

      this.socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        // Specify the Socket.IO path - for Discord proxy, use the full proxy path
        path: this.useDiscordProxy ? '/.proxy/socket.io' : '/socket.io',
        auth: {
          token: token
        }
      });

      this.socket.on('connect', () => {
        console.log('Connected to server with authentication');
        multiplayerStore.setConnected(true);
        this.startHeartbeat();
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        multiplayerStore.setConnectionStatus('reconnecting');
        this.stopHeartbeat();
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
        // Socket.io will automatically try to reconnect unless disconnect was intentional
        if (reason === 'io server disconnect' || reason === 'io client disconnect') {
          multiplayerStore.setConnected(false);
        } else {
          // Network issue - will auto-reconnect
          multiplayerStore.setConnectionStatus('reconnecting');
        }
        this.stopHeartbeat();
      });

      this.socket.on('reconnect', (attemptNumber) => {
        console.log('Reconnected to server after', attemptNumber, 'attempts');
        multiplayerStore.setConnected(true);
        this.startHeartbeat();
      });

      this.socket.on('reconnect_attempt', (attemptNumber) => {
        console.log('Attempting to reconnect...', attemptNumber);
        multiplayerStore.setConnectionStatus('reconnecting');
      });

      this.setupEventHandlers();
    });
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    // Player identification response
    this.socket.on('identified', (data: { playerId: string; username: string; authenticated?: boolean; activeGames?: string[] }) => {
      multiplayerStore.setUsername(data.username, data.playerId);
      
      // If user has active games, refresh the room list to show them
      if (data.activeGames && data.activeGames.length > 0) {
        console.log(`User has ${data.activeGames.length} active games, refreshing room list`);
        this.fetchRooms(data.playerId).then(rooms => {
          multiplayerStore.setAvailableRooms(rooms);
        });
      }
    });

    // Room events
    this.socket.on('player_joined', (data: { player: Player; room: Room }) => {
      console.log('Player joined:', data.player.username);
      multiplayerStore.setCurrentRoom(data.room);
    });

    this.socket.on('player_reconnected', (data: { playerId: string; username: string }) => {
      console.log('🟢 [RECONNECT] Player reconnected:', data.username, 'playerId:', data.playerId);
      // Mark player as connected in both Redux and multiplayer store
      store.dispatch(setPlayerConnected(data.playerId));
      multiplayerStore.setPlayerConnected(data.playerId);
      console.log('🟢 [RECONNECT] State updated - removed from disconnected list');
    });

    this.socket.on('player_left', (data: { playerId: string; room: Room }) => {
      console.log('Player left');
      multiplayerStore.setCurrentRoom(data.room);
    });

    this.socket.on('player_disconnected', (data: { playerId: string; username: string }) => {
      console.log('🔴 [DISCONNECT] Player disconnected:', data.username, 'playerId:', data.playerId);
      // Mark player as disconnected in both Redux and multiplayer store
      store.dispatch(setPlayerDisconnected(data.playerId));
      multiplayerStore.setPlayerDisconnected(data.playerId);
      console.log('🔴 [DISCONNECT] State updated - added to disconnected list');
    });

    // Game events (event sourcing architecture)
    this.socket.on('game_ready', (data: { gameId: string; players: any[] }) => {
      console.log('Game ready! Players should now start posting actions.');
      multiplayerStore.setScreen('game');
      multiplayerStore.setGameId(data.gameId);
      
      // Trigger game ready event - clients should initialize and subscribe to actions
      window.dispatchEvent(new CustomEvent('multiplayer:game-ready', {
        detail: { gameId: data.gameId, players: data.players }
      }));
    });

    // Action posted - broadcast to all clients for event replay
    this.socket.on('action_posted', (action: any) => {
      console.log('Action received:', action.type);
      
      // Broadcast action to be replayed through Redux
      window.dispatchEvent(new CustomEvent('multiplayer:action', {
        detail: action
      }));
    });

    // Response to get_actions request
    this.socket.on('actions_list', (data: { gameId: string; actions: any[] }) => {
      console.log(`Received ${data.actions.length} actions for game ${data.gameId}`);
      
      // Broadcast all actions for replay
      window.dispatchEvent(new CustomEvent('multiplayer:actions-sync', {
        detail: { gameId: data.gameId, actions: data.actions }
      }));
    });

    // Rematch created - server notifies all players
    this.socket.on('rematch_created', (data: {
      newGameId: string;
      oldGameId: string;
      name: string;
      maxPlayers: number;
      hostId: string;
      players: Array<{ id: string; username: string }>;
    }) => {
      console.log('Rematch created:', data.newGameId);
      
      // Broadcast rematch event to the game coordinator
      window.dispatchEvent(new CustomEvent('multiplayer:rematch-created', {
        detail: data
      }));
    });

    // Error handling
    this.socket.on('error', (data: { message: string }) => {
      console.error('Server error:', data.message);
      alert(data.message);
    });
  }

  identify(username: string) {
    if (!this.socket) return;
    this.socket.emit('identify', { username });
  }

  async fetchRooms(userId?: string): Promise<Room[]> {
    try {
      // Use Discord proxy if enabled, otherwise use server URL
      const baseUrl = this.useDiscordProxy ? '/.proxy' : this.serverUrl;
      
      // Include userId parameter if provided to get user's active games
      const url = userId 
        ? `${baseUrl}/api/rooms?userId=${encodeURIComponent(userId)}`
        : `${baseUrl}/api/rooms`;
      
      const response = await fetch(url);
      const data = await response.json();
      return data.rooms || [];
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
      return [];
    }
  }

  async createRoom(name: string, maxPlayers: number, hostId: string, roomId?: string): Promise<string | null> {
    try {
      // Use Discord proxy if enabled, otherwise use server URL
      const baseUrl = this.useDiscordProxy ? '/.proxy' : this.serverUrl;
      
      const response = await fetch(`${baseUrl}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, maxPlayers, hostId, roomId })
      });
      const data = await response.json();
      return data.room?.id || null;
    } catch (error) {
      console.error('Failed to create room:', error);
      return null;
    }
  }

  joinRoom(roomId: string) {
    if (!this.socket) return;
    this.socket.emit('join_room', { roomId });
  }

  leaveRoom(roomId: string) {
    if (!this.socket) return;
    this.socket.emit('leave_room', { roomId });
  }

  startGame(roomId: string) {
    if (!this.socket) return;
    this.socket.emit('start_game', { roomId });
  }

  // Event sourcing methods
  postAction(gameId: string, action: any) {
    if (!this.socket) return;
    this.socket.emit('post_action', { gameId, action });
  }

  getActions(gameId: string) {
    if (!this.socket) return;
    this.socket.emit('get_actions', { gameId });
  }

  requestRematch(gameId: string) {
    if (!this.socket) return;
    this.socket.emit('request_rematch', { gameId });
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    multiplayerStore.setConnected(false);
  }
}

// Export singleton instance
export const socket = new MultiplayerSocket();
