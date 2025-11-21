// Canvas rendering functions

import { RootState } from '../redux/types';
import { UILayout } from './layout';
import { GameplayRenderer } from './gameplayRenderer';
import { OverlayCanvasPool } from './overlayCanvasPool';
import { LobbyRenderer } from './lobbyRenderer';
import { LobbyLayout } from './lobbyLayout';
import { SeatingRenderer } from './seatingRenderer';
import { SeatingLayout } from './seatingRenderer';
import { GameOverRenderer, GameOverLayout } from './gameOverRenderer';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private colorPickerPlayerId: string | null = null;
  private onRenderNeeded: (() => void) | null = null;
  private gameplayRenderer: GameplayRenderer | null = null;
  private overlayCanvasPool: OverlayCanvasPool | null = null;
  private lobbyRenderer: LobbyRenderer | null = null;
  private currentLobbyLayout: LobbyLayout | null = null;
  private seatingRenderer: SeatingRenderer | null = null;
  private currentSeatingLayout: SeatingLayout | null = null;
  private gameOverRenderer: GameOverRenderer | null = null;
  private currentGameOverLayout: GameOverLayout | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    // Use willReadFrequently for better performance with frequent pixel reads
    // and disable alpha for better performance if we don't need transparency
    const ctx = canvas.getContext('2d', { 
      willReadFrequently: false,
      alpha: true,
      // desynchronized can help with rendering performance but may affect clipping
      desynchronized: false
    });
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }
    this.ctx = ctx;

    // Initialize overlay pool for dirty region optimization
    this.overlayCanvasPool = new OverlayCanvasPool();

    this.resizeCanvas();
  }

  setRenderCallback(callback: () => void): void {
    this.onRenderNeeded = callback;
  }

  resizeCanvas(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    
    // Update gameplay renderer layout if it exists
    if (this.gameplayRenderer) {
      this.gameplayRenderer.updateLayout(this.canvas.width, this.canvas.height);
    }
  }

  showColorPicker(playerId: string): void {
    this.colorPickerPlayerId = playerId;
    if (this.onRenderNeeded) {
      this.onRenderNeeded();
    }
  }

  hideColorPicker(): void {
    this.colorPickerPlayerId = null;
    if (this.onRenderNeeded) {
      this.onRenderNeeded();
    }
  }

  getColorPickerPlayerId(): string | null {
    return this.colorPickerPlayerId;
  }

  render(state: RootState): UILayout {
    const { screen } = state.game;

    // Clear canvas (unless dirty rendering is enabled in gameplay or game-over mode)
    // When dirty rendering is enabled, the gameplayRenderer manages its own clearing
    const skipClear = (screen === 'gameplay' || screen === 'game-over') && state.ui.settings.enableDirtyRendering;
    
    if (!skipClear) {
      this.ctx.fillStyle = '#1a1a2e';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    if (screen === 'configuration') {
      return this.renderConfigurationScreenNew(state);
    } else if (screen === 'seating') {
      return this.renderSeatingScreen(state);
    } else if (screen === 'gameplay') {
      return this.renderGameplayScreen(state);
    } else if (screen === 'game-over') {
      return this.renderGameOverScreen(state);
    }

    return this.createEmptyLayout();
  }

  private renderConfigurationScreenNew(state: RootState): UILayout {
    // Clear gameplay renderer when returning to configuration
    // This ensures a fresh renderer with the correct board size for the next game
    if (this.gameplayRenderer) {
      this.gameplayRenderer = null;
    }
    
    // Initialize lobby renderer if needed
    if (!this.lobbyRenderer) {
      this.lobbyRenderer = new LobbyRenderer(this.ctx);
    }

    // Create a set of disconnected config player IDs by looking up the mapping
    const disconnectedConfigPlayerIds = new Set<string>();
    state.ui.disconnectedPlayers.forEach(userId => {
      const configPlayerId = state.ui.userIdToPlayerId.get(userId);
      if (configPlayerId) {
        disconnectedConfigPlayerIds.add(configPlayerId);
      }
    });

    // Render the new lobby layout
    this.currentLobbyLayout = this.lobbyRenderer.render(
      this.canvas.width,
      this.canvas.height,
      state.game.configPlayers,
      state.ui.showSettings,
      state.ui.settings,
      state.ui.showHelp,
      state.ui.helpCorner,
      state.ui.savedGameState !== null,
      state.ui.gameMode,
      disconnectedConfigPlayerIds
    );

    // Return empty UILayout for compatibility (new input handler will use LobbyLayout)
    return this.createEmptyLayout();
  }

  getLobbyLayout(): LobbyLayout | null {
    return this.currentLobbyLayout;
  }

  private renderSeatingScreen(state: RootState): UILayout {
    // Initialize seating renderer if needed
    if (!this.seatingRenderer) {
      this.seatingRenderer = new SeatingRenderer(this.ctx);
    }

    // Create a set of disconnected config player IDs by looking up the mapping
    const disconnectedConfigPlayerIds = new Set<string>();
    state.ui.disconnectedPlayers.forEach(userId => {
      const configPlayerId = state.ui.userIdToPlayerId.get(userId);
      if (configPlayerId) {
        disconnectedConfigPlayerIds.add(configPlayerId);
      }
    });

    // Render the seating phase screen
    this.currentSeatingLayout = this.seatingRenderer.render(
      this.canvas.width,
      this.canvas.height,
      state.game,
      disconnectedConfigPlayerIds
    );

    // Return empty UILayout for compatibility
    return this.createEmptyLayout();
  }

  getSeatingLayout(): SeatingLayout | null {
    return this.currentSeatingLayout;
  }

  private renderGameplayScreen(state: RootState): UILayout {
    // Initialize gameplay renderer if needed
    if (!this.gameplayRenderer) {
      this.gameplayRenderer = new GameplayRenderer(
        this.ctx,
        this.canvas.width,
        this.canvas.height,
        state.game.boardRadius,
        this.overlayCanvasPool,
        () => {
          // Trigger re-render when async resources (like wood texture) load
          if (this.onRenderNeeded) {
            this.onRenderNeeded();
          }
        }
      );
    }

    // Render the gameplay screen
    this.gameplayRenderer.render(state);

    return this.createEmptyLayout();
  }

  getGameplayRenderer(): GameplayRenderer | null {
    return this.gameplayRenderer;
  }

  private renderGameOverScreen(state: RootState): UILayout {
    // First render the gameplay board so the winning flow is visible
    if (!this.gameplayRenderer) {
      this.gameplayRenderer = new GameplayRenderer(
        this.ctx,
        this.canvas.width,
        this.canvas.height,
        state.game.boardRadius,
        this.overlayCanvasPool,
        () => {
          // Trigger re-render when async resources (like wood texture) load
          if (this.onRenderNeeded) {
            this.onRenderNeeded();
          }
        }
      );
    }
    this.gameplayRenderer.render(state);

    // Then render the victory modals on top
    if (!this.gameOverRenderer) {
      this.gameOverRenderer = new GameOverRenderer(this.ctx);
    }

    // Render the game over screen (victory modals)
    this.currentGameOverLayout = this.gameOverRenderer.render(
      this.canvas.width,
      this.canvas.height,
      state
    );

    // Return empty UILayout for compatibility
    return this.createEmptyLayout();
  }

  getGameOverLayout(): GameOverLayout | null {
    return this.currentGameOverLayout;
  }

  private createEmptyLayout(): UILayout {
    return {
      titleX: 0,
      titleY: 0,
      titleSize: 0,
      playerEntries: [],
      addPlayerButton: {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        text: '',
        enabled: false,
        type: 'add-player',
      },
      startGameButton: {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        text: '',
        enabled: false,
        type: 'start-game',
      },
      colorPicker: null,
    };
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  getCanvasWidth(): number {
    return this.canvas.width;
  }

  getCanvasHeight(): number {
    return this.canvas.height;
  }
}
