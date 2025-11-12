// E2E test for rematch button functionality

import { test, expect } from '@playwright/test';
import { getReduxState, waitForAnimationFrame, setupTwoPlayerGame, pauseAnimations } from './helpers';

test.describe('Rematch Button', () => {
  test('should show rematch button when game is over and start a new game', async ({ page }) => {
    // Set up a two-player game
    await setupTwoPlayerGame(page);
    
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Simulate game ending by dispatching END_GAME action
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({
        type: 'END_GAME',
        payload: {
          winners: ['P1'],
          winType: 'flow'
        }
      });
    });

    await waitForAnimationFrame(page);
    await pauseAnimations(page);

    // Verify we're in game-over state
    let state = await getReduxState(page);
    expect(state.game.screen).toBe('game-over');
    expect(state.game.phase).toBe('finished');
    expect(state.game.winners).toContain('P1');

    // Take a screenshot showing the rematch buttons
    await page.screenshot({ path: 'test-results/rematch-button-visible.png' });

    // Get canvas dimensions to calculate button position
    const canvasSize = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      return {
        width: canvas.width,
        height: canvas.height
      };
    });

    // Click one of the rematch buttons (bottom-left corner)
    const cornerSize = 50;
    const margin = 10;
    const spacing = cornerSize * 0.15;
    const buttonX = margin + cornerSize / 2 + (cornerSize + spacing) * 3; // Rematch button is now at position 3
    const buttonY = canvasSize.height - margin - cornerSize / 2;
    
    await page.mouse.click(box.x + buttonX, box.y + buttonY);
    await waitForAnimationFrame(page);

    // Verify the game restarted
    state = await getReduxState(page);
    
    // Should be back in gameplay with a fresh game
    expect(state.game.screen).toBe('gameplay');
    expect(state.game.phase).toBe('playing');
    expect(state.game.winners).toHaveLength(0);
    expect(state.game.winType).toBeNull();
    expect(state.game.moveHistory).toHaveLength(0);
    
    // Verify players are the same (P1 and P2)
    const playerIds = state.game.players.map((p: any) => p.id).sort();
    expect(playerIds).toEqual(['P1', 'P2']);
    
    // Verify board is empty
    expect(Object.keys(state.game.board).length).toBe(0);
    
    // Verify we have tiles to play
    expect(state.game.currentTile).not.toBeNull();
    expect(state.game.availableTiles.length).toBeGreaterThan(0);

    // Take a screenshot after rematch
    await pauseAnimations(page);
    await page.screenshot({ path: 'test-results/after-rematch.png' });
  });

  test('should preserve player edge positions after rematch', async ({ page }) => {
    // Set up a two-player game
    await setupTwoPlayerGame(page);

    // Remember the edge positions before game over
    let stateBefore = await getReduxState(page);
    const player1Before = stateBefore.game.players.find((p: any) => p.id === 'P1');
    const player2Before = stateBefore.game.players.find((p: any) => p.id === 'P2');
    const edgeAssignmentsBefore = stateBefore.game.seatingPhase.edgeAssignments;

    // End the game
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({
        type: 'END_GAME',
        payload: {
          winners: ['P1'],
          winType: 'flow'
        }
      });
    });

    await waitForAnimationFrame(page);

    // Click rematch button (bottom-left corner)
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    const canvasSize = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      return {
        width: canvas.width,
        height: canvas.height
      };
    });

    const cornerSize = 50;
    const margin = 10;
    const spacing = cornerSize * 0.15;
    const buttonX = margin + cornerSize / 2 + (cornerSize + spacing) * 3; // Rematch button is now at position 3
    const buttonY = canvasSize.height - margin - cornerSize / 2;
    
    await page.mouse.click(box.x + buttonX, box.y + buttonY);
    await waitForAnimationFrame(page);

    // Verify edge positions are preserved
    const stateAfter = await getReduxState(page);
    const edgeAssignmentsAfter = stateAfter.game.seatingPhase.edgeAssignments;
    
    // Edge assignments should be the same
    expect(edgeAssignmentsAfter).toEqual(edgeAssignmentsBefore);
    
    // Find players by ID (they may be in different order)
    const player1After = stateAfter.game.players.find((p: any) => p.id === 'P1');
    const player2After = stateAfter.game.players.find((p: any) => p.id === 'P2');
    
    // Player edge positions should match
    expect(player1After.edgePosition).toBe(player1Before.edgePosition);
    expect(player2After.edgePosition).toBe(player2Before.edgePosition);
  });
});