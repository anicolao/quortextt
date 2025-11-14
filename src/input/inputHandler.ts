// Input handling and hit detection

import { UILayout, Button } from '../rendering/layout';
import { PLAYER_COLORS } from '../redux/types';
import { Renderer } from '../rendering/renderer';
import { store } from '../redux/store';
import {
  removePlayer,
  changePlayerColor,
  startGame,
} from '../redux/actions';
import { GameplayInputHandler } from './gameplayInputHandler';
import { LobbyInputHandler } from './lobbyInputHandler';
import { SeatingInputHandler } from './seatingInputHandler';
import { GameOverInputHandler } from './gameOverInputHandler';

export class InputHandler {
  private renderer: Renderer;
  private currentLayout: UILayout | null = null;
  private gameplayInputHandler: GameplayInputHandler | null = null;
  private lobbyInputHandler: LobbyInputHandler;
  private seatingInputHandler: SeatingInputHandler;
  private gameOverInputHandler: GameOverInputHandler;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.lobbyInputHandler = new LobbyInputHandler();
    this.seatingInputHandler = new SeatingInputHandler();
    this.gameOverInputHandler = new GameOverInputHandler();
    this.setupEventListeners();
  }

  setGameplayInputHandler(handler: GameplayInputHandler | null): void {
    this.gameplayInputHandler = handler;
  }

  setCurrentLayout(layout: UILayout): void {
    this.currentLayout = layout;
  }

  private setupEventListeners(): void {
    const canvas = this.renderer.getCanvas();

    canvas.addEventListener('click', (event) => {
      this.handleClick(event.clientX, event.clientY);
    });

    canvas.addEventListener('touchstart', (event) => {
      if (event.touches.length > 0) {
        const touch = event.touches[0];
        this.handleClick(touch.clientX, touch.clientY);
      }
      event.preventDefault();
    });

    canvas.addEventListener('mousemove', (event) => {
      this.handleMouseMove(event.clientX, event.clientY);
    });
  }

  private handleClick(clientX: number, clientY: number): void {
    const canvas = this.renderer.getCanvas();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    // Check if in gameplay mode
    const state = store.getState();
    if (state.game.screen === 'gameplay' && this.gameplayInputHandler) {
      this.gameplayInputHandler.handleClick(x, y);
      return;
    }

    // Seating screen handling
    if (state.game.screen === 'seating') {
      const seatingLayout = this.renderer.getSeatingLayout();
      this.seatingInputHandler.handleClick(x, y, seatingLayout);
      return;
    }

    // Configuration screen handling - use new lobby input handler
    if (state.game.screen === 'configuration') {
      const lobbyLayout = this.renderer.getLobbyLayout();
      this.lobbyInputHandler.handleClick(x, y, lobbyLayout);
      return;
    }

    // Game over screen handling
    if (state.game.screen === 'game-over') {
      const gameOverLayout = this.renderer.getGameOverLayout();
      this.gameOverInputHandler.handleClick(x, y, gameOverLayout, canvas.width, canvas.height);
      return;
    }

    // Legacy configuration screen handling (fallback)
    if (!this.currentLayout) return;

    // Check if color picker is visible
    if (this.currentLayout.colorPicker?.visible) {
      this.handleColorPickerClick(x, y);
      return;
    }

    // Legacy code - not used with new lobby
    // Check for button clicks
    if (this.isPointInButton(x, y, this.currentLayout.addPlayerButton)) {
      if (this.currentLayout.addPlayerButton.enabled) {
        // Old addPlayer call - not used anymore
      }
      return;
    }

    if (this.isPointInButton(x, y, this.currentLayout.startGameButton)) {
      if (this.currentLayout.startGameButton.enabled) {
        const state = store.getState();
        store.dispatch(startGame({
          supermove: state.ui.settings.supermove,
          singleSupermove: state.ui.settings.singleSupermove,
        }));
      }
      return;
    }

    // Check for remove button clicks
    for (const entry of this.currentLayout.playerEntries) {
      if (this.isPointInButton(x, y, entry.removeButton)) {
        if (entry.removeButton.playerId) {
          store.dispatch(removePlayer(entry.removeButton.playerId));
        }
        return;
      }
    }

    // Check for color icon clicks
    for (const entry of this.currentLayout.playerEntries) {
      if (
        this.isPointInRect(
          x,
          y,
          entry.colorIconX,
          entry.colorIconY,
          entry.colorIconSize,
          entry.colorIconSize
        )
      ) {
        this.renderer.showColorPicker(entry.player.id);
        return;
      }
    }
  }

  private handleMouseMove(clientX: number, clientY: number): void {
    const canvas = this.renderer.getCanvas();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    // Check if in gameplay mode
    const state = store.getState();
    if (state.game.screen === 'gameplay' && this.gameplayInputHandler) {
      this.gameplayInputHandler.handleMouseMove(x, y);
      return;
    }
  }

  private handleColorPickerClick(x: number, y: number): void {
    if (!this.currentLayout?.colorPicker) return;

    const picker = this.currentLayout.colorPicker;
    const playerId = this.renderer.getColorPickerPlayerId();

    if (!playerId) {
      this.renderer.hideColorPicker();
      return;
    }

    // Check if click is outside the picker to close it
    if (
      !this.isPointInRect(x, y, picker.x, picker.y, picker.width, picker.height)
    ) {
      this.renderer.hideColorPicker();
      return;
    }

    // Check for color swatch clicks
    const colorSize = Math.min(picker.width, picker.height) * 0.15;
    const spacing = colorSize * 1.3;
    const startX = picker.x + (picker.width - spacing * 3) / 2 + colorSize / 2;
    const startY = picker.y + picker.height * 0.35;

    for (let index = 0; index < PLAYER_COLORS.length; index++) {
      const row = Math.floor(index / 3);
      const col = index % 3;
      const swatchX = startX + col * spacing;
      const swatchY = startY + row * spacing;

      if (
        this.isPointInRect(
          x,
          y,
          swatchX - colorSize / 2,
          swatchY - colorSize / 2,
          colorSize,
          colorSize
        )
      ) {
        const color = PLAYER_COLORS[index];
        store.dispatch(changePlayerColor(playerId, color));
        this.renderer.hideColorPicker();
        return;
      }
    }
  }

  private isPointInButton(x: number, y: number, button: Button): boolean {
    return this.isPointInRect(x, y, button.x, button.y, button.width, button.height);
  }

  private isPointInRect(
    x: number,
    y: number,
    rectX: number,
    rectY: number,
    rectWidth: number,
    rectHeight: number
  ): boolean {
    return (
      x >= rectX &&
      x <= rectX + rectWidth &&
      y >= rectY &&
      y <= rectY + rectHeight
    );
  }
}
