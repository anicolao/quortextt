// Socket.IO client for multiplayer
import { io, Socket } from 'socket.io-client';
import { multiplayerStore } from './stores/multiplayerStore';
import type { Room, Player } from './stores/multiplayerStore';

class MultiplayerSocket {
  private socket: Socket | null = null;
  private serverUrl: string;

  constructor() {
    // Use environment variable or default to localhost
    // @ts-ignore - Vite injects import.meta.env
    this.serverUrl = import.meta.env?.VITE_SERVER_URL || 'http://localhost:3001';
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

  private setupEventHandlers() {
    if (!this.socket) return;

    // Player identification response
    this.socket.on('identified', (data: { playerId: string; username: string }) => {
      multiplayerStore.setUsername(data.username, data.playerId);
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

    // Game events
    this.socket.on('game_started', (data: { roomId: string; players: Player[] }) => {
      console.log('Game started!');
      multiplayerStore.setScreen('game');
      
      // Trigger game initialization event
      window.dispatchEvent(new CustomEvent('multiplayer:game-start', {
        detail: { roomId: data.roomId, players: data.players }
      }));
    });

    this.socket.on('game_state_update', (data: { state: any }) => {
      // Broadcast game state updates
      window.dispatchEvent(new CustomEvent('multiplayer:game-state', {
        detail: data.state
      }));
    });

    this.socket.on('move_made', (data: { playerId: string; move: any }) => {
      // Broadcast move events
      window.dispatchEvent(new CustomEvent('multiplayer:move', {
        detail: { playerId: data.playerId, move: data.move }
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

  async fetchRooms(): Promise<Room[]> {
    try {
      const response = await fetch(`${this.serverUrl}/api/rooms`);
      const data = await response.json();
      return data.rooms || [];
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
      return [];
    }
  }

  async createRoom(name: string, maxPlayers: number, hostId: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.serverUrl}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, maxPlayers, hostId })
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

  sendGameState(roomId: string, state: any) {
    if (!this.socket) return;
    this.socket.emit('game_state', { roomId, state });
  }

  sendMove(roomId: string, move: any) {
    if (!this.socket) return;
    this.socket.emit('make_move', { roomId, move });
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
