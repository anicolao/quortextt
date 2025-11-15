// Socket.IO client for multiplayer
import { io, Socket } from 'socket.io-client';
import { multiplayerStore } from './stores/multiplayerStore';
import type { Room, Player } from './stores/multiplayerStore';

class MultiplayerSocket {
  private socket: Socket | null = null;
  private serverUrl: string;

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

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling'],
      });

      this.socket.on('connect', () => {
        console.log('Connected to server');
        multiplayerStore.setConnected(true);
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        multiplayerStore.setConnected(false);
        reject(error);
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from server');
        multiplayerStore.setConnected(false);
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

      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling'],
        auth: {
          token: token
        }
      });

      this.socket.on('connect', () => {
        console.log('Connected to server with authentication');
        multiplayerStore.setConnected(true);
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        multiplayerStore.setConnected(false);
        reject(error);
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from server');
        multiplayerStore.setConnected(false);
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

    this.socket.on('player_left', (data: { playerId: string; room: Room }) => {
      console.log('Player left');
      multiplayerStore.setCurrentRoom(data.room);
    });

    this.socket.on('player_disconnected', (data: { playerId: string; username: string }) => {
      console.log('Player disconnected:', data.username);
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
      // Include userId parameter if provided to get user's active games
      const url = userId 
        ? `${this.serverUrl}/api/rooms?userId=${encodeURIComponent(userId)}`
        : `${this.serverUrl}/api/rooms`;
      
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
      const response = await fetch(`${this.serverUrl}/api/rooms`, {
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

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    multiplayerStore.setConnected(false);
  }
}

// Export singleton instance
export const socket = new MultiplayerSocket();
