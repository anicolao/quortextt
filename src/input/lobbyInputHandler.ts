// Input handler for the redesigned lobby

import { store } from '../redux/store';
import { addPlayer, removePlayer, startGame, toggleSettings, updateSettings, showHelp, hideHelp, restoreGame } from '../redux/actions';
import { LobbyLayout, isPointInButton, isPointInCircle } from '../rendering/lobbyLayout';

export class LobbyInputHandler {
  handleClick(x: number, y: number, layout: LobbyLayout | null): void {
    if (!layout) return;

    const state = store.getState();

    // If help dialog is open, close it on any click
    if (state.ui.showHelp) {
      store.dispatch(hideHelp());
      return;
    }

    // If settings dialog is open, check for clicks on dialog controls
    if (layout.settingsDialog) {
      const state = store.getState();
      const currentSettings = state.ui.settings;

      for (const control of layout.settingsDialog.controls) {
        if (x >= control.x && x <= control.x + control.width &&
            y >= control.y && y <= control.y + control.height) {
          
          if (control.type === 'close') {
            store.dispatch(toggleSettings());
            return;
          }
          
          if (control.type === 'checkbox' && control.settingKey) {
            const key = control.settingKey;
            store.dispatch(updateSettings({
              [key]: !currentSettings[key]
            }));
            return;
          }
          
          if (control.type === 'number' && control.settingKey) {
            const key = control.settingKey;
            
            // Special handling for tile distribution
            if (key === 'tileDistribution' && control.tileIndex !== undefined) {
              const currentDist = [...currentSettings.tileDistribution] as [number, number, number, number];
              const delta = control.label === '+' ? 1 : -1;
              const newValue = Math.max(0, Math.min(99, currentDist[control.tileIndex] + delta));
              currentDist[control.tileIndex] = newValue;
              
              store.dispatch(updateSettings({
                tileDistribution: currentDist
              }));
              return;
            }
            
            const currentValue = currentSettings[key] as number;
            let newValue = currentValue;
            
            if (control.label === '+') {
              if (key === 'boardRadius') {
                newValue = Math.min(6, currentValue + 1);
              } else if (key === 'debugAnimationSlowdown') {
                newValue = Math.min(10, currentValue + 1);
              }
            } else if (control.label === '-') {
              if (key === 'boardRadius') {
                newValue = Math.max(2, currentValue - 1);
              } else if (key === 'debugAnimationSlowdown') {
                newValue = Math.max(1, currentValue - 1);
              }
            }
            
            store.dispatch(updateSettings({
              [key]: newValue
            }));
            return;
          }

          if (control.type === 'reset-distribution') {
            store.dispatch(updateSettings({
              tileDistribution: [1, 1, 1, 1]
            }));
            return;
          }
        }
      }

      // Click outside dialog closes it
      const dialog = layout.settingsDialog;
      if (x < dialog.dialogX || x > dialog.dialogX + dialog.dialogWidth ||
          y < dialog.dialogY || y > dialog.dialogY + dialog.dialogHeight) {
        store.dispatch(toggleSettings());
        return;
      }

      // Click was on dialog, don't process other buttons
      return;
    }

    // Check settings button
    const settingsCenterX = layout.settingsButton.x + layout.settingsButton.size / 2;
    const settingsCenterY = layout.settingsButton.y + layout.settingsButton.size / 2;
    const settingsRadius = layout.settingsButton.size / 2;
    
    if (isPointInCircle(x, y, settingsCenterX, settingsCenterY, settingsRadius)) {
      store.dispatch(toggleSettings());
      return;
    }

    // Check start button
    if (layout.startButton.enabled) {
      const centerX = layout.startButton.x + layout.startButton.size / 2;
      const centerY = layout.startButton.y + layout.startButton.size / 2;
      const radius = layout.startButton.size / 2;
      
      if (isPointInCircle(x, y, centerX, centerY, radius)) {
        const state = store.getState();
        store.dispatch(startGame({
          boardRadius: state.ui.settings.boardRadius,
          supermove: state.ui.settings.supermove,
          singleSupermove: state.ui.settings.singleSupermove,
        }));
        return;
      }
    }

    // Check exit buttons
    for (const exitBtn of layout.exitButtons) {
      if (isPointInCircle(x, y, exitBtn.x, exitBtn.y, exitBtn.size / 2)) {
        // In multiplayer mode, return to multiplayer lobby
        // In tabletop mode, close the window
        const gameMode = state.ui.gameMode;
        if (gameMode === 'multiplayer') {
          // Return to multiplayer lobby by setting the screen
          // This will hide the canvas and show the Svelte UI
          import('../multiplayer/stores/multiplayerStore').then(({ multiplayerStore }) => {
            multiplayerStore.setScreen('lobby');
          });
        } else {
          window.close();
        }
        return;
      }
    }

    // Check help buttons
    for (const helpBtn of layout.helpButtons) {
      if (isPointInCircle(x, y, helpBtn.x, helpBtn.y, helpBtn.size / 2)) {
        store.dispatch(showHelp(helpBtn.corner));
        return;
      }
    }

    // Check back buttons (restore saved game)
    for (const backBtn of layout.backButtons) {
      if (isPointInCircle(x, y, backBtn.x, backBtn.y, backBtn.size / 2)) {
        store.dispatch(restoreGame());
        return;
      }
    }

    // Check edge buttons (+ buttons)
    for (const edgeBtn of layout.edgeButtons) {
      if (isPointInButton(x, y, edgeBtn)) {
        store.dispatch(addPlayer(edgeBtn.color, edgeBtn.edge));
        return;
      }
    }

    // Check remove buttons in player lists
    for (const list of layout.playerLists) {
      for (const entry of list) {
        if (isPointInButton(x, y, entry.removeButton)) {
          store.dispatch(removePlayer(entry.player.id));
          return;
        }
      }
    }
  }
}
