// Input handling for seating phase

import { store } from '../redux/store';
import { selectEdge, returnToConfig } from '../redux/actions';
import { SeatingLayout } from '../rendering/seatingRenderer';

export class SeatingInputHandler {
  handleClick(x: number, y: number, layout: SeatingLayout | null): void {
    if (!layout) return;

    const state = store.getState().game;
    if (!state.seatingPhase.active) return;

    // Check if click is on exit button (multiplayer mode only)
    if (layout.exitButton) {
      const distance = Math.sqrt(
        Math.pow(x - layout.exitButton.x, 2) + Math.pow(y - layout.exitButton.y, 2)
      );

      if (distance <= layout.exitButton.size / 2) {
        // Return to configuration/lobby screen
        store.dispatch(returnToConfig());
        return;
      }
    }

    // Check if click is on an edge button
    for (const button of layout.edgeButtons) {
      const distance = Math.sqrt(
        Math.pow(x - button.position.x, 2) + Math.pow(y - button.position.y, 2)
      );

      if (distance <= button.radius) {
        // Get current player
        const currentPlayerId = state.seatingPhase.seatingOrder[state.seatingPhase.seatingIndex];
        
        // Dispatch edge selection
        store.dispatch(selectEdge(currentPlayerId, button.edge));
        return;
      }
    }
  }
}
