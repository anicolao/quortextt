// Input handler for the redesigned lobby

import { store } from '../redux/store';
import { addPlayer, removePlayer, startGame } from '../redux/actions';
import { LobbyLayout, isPointInButton, isPointInCircle } from '../rendering/lobbyLayout';

export class LobbyInputHandler {
  handleClick(x: number, y: number, layout: LobbyLayout | null): void {
    if (!layout) return;

    // Check start button
    if (layout.startButton.enabled) {
      const centerX = layout.startButton.x + layout.startButton.size / 2;
      const centerY = layout.startButton.y + layout.startButton.size / 2;
      const radius = layout.startButton.size / 2;
      
      if (isPointInCircle(x, y, centerX, centerY, radius)) {
        store.dispatch(startGame());
        return;
      }
    }

    // Check exit buttons
    for (const exitBtn of layout.exitButtons) {
      if (isPointInCircle(x, y, exitBtn.x, exitBtn.y, exitBtn.size / 2)) {
        // In lobby, exit means close/exit the app
        // For now, we'll just reload to configuration
        window.location.reload();
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
