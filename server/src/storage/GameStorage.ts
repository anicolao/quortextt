import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';
import readline from 'readline';

/**
 * Game action interface matching the event sourcing architecture.
 * Each action represents a state change in a game.
 */
export interface GameAction {
  type: string;
  payload: any;
  playerId: string;
  timestamp: number;
  sequence: number;
}

/**
 * Game state interface representing the reconstructed state.
 */
export interface GameState {
  gameId: string;
  status: 'waiting' | 'playing' | 'finished';
  players: Array<{
    id: string;
    username: string;
    socketId: string;
    connected: boolean;
  }>;
  hostId: string;
  name: string;
  maxPlayers: number;
  lastActionSequence: number;
}

/**
 * File-based storage for game data using append-only .jsonl files.
 * Implements the event sourcing pattern for game actions.
 * 
 * Each game has its own action file: game-{gameId}.actions.jsonl
 * Actions are appended sequentially and never modified.
 * State is reconstructed by replaying actions.
 */
export class GameStorage {
  private dataDir: string;
  private cache: Map<string, GameState> = new Map();
  private writeBuffers: Map<string, string[]> = new Map();
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(dataDir = './data/games') {
    this.dataDir = dataDir;
  }

  /**
   * Initialize the storage by creating necessary directories and starting the flush timer.
   */
  async initialize(): Promise<void> {
    await this.ensureDataDir();
    
    // Flush buffers every 5 seconds
    this.flushInterval = setInterval(() => {
      this.flushAll().catch(err => console.error('Error flushing buffers:', err));
    }, 5000);
  }

  /**
   * Ensure the data directory exists.
   */
  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create data directory:', error);
      throw error;
    }
  }

  /**
   * Append a game action to the action log.
   * Actions are buffered in memory and flushed periodically for performance.
   * The in-memory cache is updated immediately to ensure consistent reads.
   * 
   * @param gameId - The game ID
   * @param action - The action to append
   * @param immediate - If true, flush immediately (default: false for performance)
   */
  async appendAction(gameId: string, action: GameAction, immediate = false): Promise<void> {
    const line = JSON.stringify(action);
    
    // Add to write buffer
    if (!this.writeBuffers.has(gameId)) {
      this.writeBuffers.set(gameId, []);
    }
    this.writeBuffers.get(gameId)!.push(line);
    
    // Update in-memory cache immediately
    if (this.cache.has(gameId)) {
      const state = this.cache.get(gameId)!;
      this.cache.set(gameId, this.applyAction(state, action));
    } else if (action.type === 'CREATE_GAME') {
      // Initialize cache for new game
      const initialState: GameState = {
        gameId,
        status: 'waiting',
        players: [],
        hostId: '',
        name: '',
        maxPlayers: 2,
        lastActionSequence: -1
      };
      this.cache.set(gameId, this.applyAction(initialState, action));
    }
    
    // Flush if immediate mode, buffer is large, or this is a critical action
    const shouldFlushNow = immediate || 
                           this.writeBuffers.get(gameId)!.length >= 10 ||
                           action.type === 'CREATE_GAME';
    
    if (shouldFlushNow) {
      await this.flush(gameId);
    }
  }

  /**
   * Read all actions for a game from the .jsonl file.
   * Uses streaming to handle large files efficiently.
   */
  async readActions(gameId: string): Promise<GameAction[]> {
    const filename = this.getActionsFilename(gameId);
    
    try {
      const fileStream = createReadStream(filename);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });
      
      const actions: GameAction[] = [];
      for await (const line of rl) {
        if (line.trim()) {
          actions.push(JSON.parse(line));
        }
      }
      
      return actions;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return []; // File doesn't exist yet
      }
      throw error;
    }
  }

  /**
   * Get the current game state.
   * Returns cached state if available, otherwise reconstructs from actions.
   */
  async getGameState(gameId: string): Promise<GameState | null> {
    // Check cache first
    if (this.cache.has(gameId)) {
      return this.cache.get(gameId)!;
    }
    
    // Reconstruct from actions
    const actions = await this.readActions(gameId);
    if (actions.length === 0) {
      return null; // Game doesn't exist
    }
    
    const state = this.reconstructState(gameId, actions);
    
    // Cache it
    this.cache.set(gameId, state);
    
    return state;
  }

  /**
   * Create a new game with initial state.
   * This creates the first action in the game's action log.
   */
  async createGame(gameId: string, name: string, hostId: string, maxPlayers: number): Promise<void> {
    const initialAction: GameAction = {
      type: 'CREATE_GAME',
      payload: {
        name,
        hostId,
        maxPlayers
      },
      playerId: hostId,
      timestamp: Date.now(),
      sequence: 0
    };
    
    await this.appendAction(gameId, initialAction);
  }

  /**
   * List all game IDs that have action files.
   */
  async listGames(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.dataDir);
      return files
        .filter(f => f.startsWith('game-') && f.endsWith('.actions.jsonl'))
        .map(f => f.replace('game-', '').replace('.actions.jsonl', ''));
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Reconstruct game state from action history.
   * Applies each action sequentially to build the current state.
   */
  private reconstructState(gameId: string, actions: GameAction[]): GameState {
    let state: GameState = {
      gameId,
      status: 'waiting',
      players: [],
      hostId: '',
      name: '',
      maxPlayers: 2,
      lastActionSequence: -1
    };
    
    for (const action of actions) {
      state = this.applyAction(state, action);
    }
    
    return state;
  }

  /**
   * Apply a single action to state (Redux-style reducer).
   */
  private applyAction(state: GameState, action: GameAction): GameState {
    const newState = { ...state, lastActionSequence: action.sequence };
    
    switch (action.type) {
      case 'CREATE_GAME':
        return {
          ...newState,
          status: 'waiting',
          name: action.payload.name || '',
          hostId: action.payload.hostId || action.playerId,
          maxPlayers: action.payload.maxPlayers || 2,
          players: []
        };
      
      case 'JOIN_GAME':
        // Don't add duplicate players
        if (newState.players.some(p => p.id === action.payload.player.id)) {
          return newState;
        }
        return {
          ...newState,
          players: [...newState.players, action.payload.player]
        };
      
      case 'LEAVE_GAME':
        return {
          ...newState,
          players: newState.players.filter(p => p.id !== action.payload.playerId)
        };
      
      case 'START_GAME':
        return {
          ...newState,
          status: 'playing'
        };
      
      case 'COMPLETE_GAME':
        return {
          ...newState,
          status: 'finished'
        };
      
      case 'PLAYER_DISCONNECT':
        return {
          ...newState,
          players: newState.players.map(p =>
            p.id === action.payload.playerId
              ? { ...p, connected: false }
              : p
          )
        };
      
      case 'PLAYER_RECONNECT':
        return {
          ...newState,
          players: newState.players.map(p =>
            p.id === action.payload.playerId
              ? { ...p, connected: true, socketId: action.payload.socketId }
              : p
          )
        };
      
      default:
        // For game-specific actions (PLACE_TILE, etc.), we don't need to update
        // this metadata state. The game client handles those.
        return newState;
    }
  }

  /**
   * Flush write buffer for a specific game to disk.
   */
  async flush(gameId: string): Promise<void> {
    const buffer = this.writeBuffers.get(gameId);
    if (!buffer || buffer.length === 0) return;
    
    const filename = this.getActionsFilename(gameId);
    const content = buffer.join('\n') + '\n';
    
    try {
      await fs.appendFile(filename, content, 'utf8');
      this.writeBuffers.set(gameId, []);
    } catch (error) {
      console.error(`Failed to flush game ${gameId}:`, error);
      // Don't clear buffer on failure - will retry next time
    }
  }

  /**
   * Flush all write buffers to disk.
   */
  async flushAll(): Promise<void> {
    const gameIds = Array.from(this.writeBuffers.keys());
    await Promise.all(gameIds.map(id => this.flush(id)));
  }

  /**
   * Graceful shutdown - flush all pending writes.
   */
  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    await this.flushAll();
  }

  /**
   * Clear the in-memory cache for a specific game.
   * Useful when you want to force a reload from disk.
   */
  clearCache(gameId: string): void {
    this.cache.delete(gameId);
  }

  /**
   * Clear all caches.
   */
  clearAllCaches(): void {
    this.cache.clear();
  }

  /**
   * Get the filename for a game's action log.
   */
  private getActionsFilename(gameId: string): string {
    return path.join(this.dataDir, `game-${gameId}.actions.jsonl`);
  }

  /**
   * Check if a game exists.
   */
  async gameExists(gameId: string): Promise<boolean> {
    const filename = this.getActionsFilename(gameId);
    try {
      await fs.access(filename);
      return true;
    } catch {
      return false;
    }
  }
}
