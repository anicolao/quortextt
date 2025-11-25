// E2E test for victory animation

import { test, expect } from '@playwright/test';
import { getReduxState, completeSeatingPhase , pauseAnimations, waitForAnimationFrame, takeScreenshot } from './helpers';

test.describe('Victory Animation', () => {
  test('should display animated victory modals in all corners with pulsing flow', async ({ page }) => {
    await page.goto('/quortextt/tabletop.html');
    
    // Wait for the page to load
    await page.waitForSelector('canvas#game-canvas');
    
    // Pause animations once at the beginning
    await pauseAnimations(page);
    
    // Set up a 2-player game
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      
      // Add two players
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'ADD_PLAYER' });
      
      // Start the game with deterministic seed
      store.dispatch({ type: 'START_GAME', payload: { seed: 12345 } });
    });
    
    await waitForAnimationFrame(page);
    
    // Complete seating phase
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    await completeSeatingPhase(page, canvas, box);
    
    await waitForAnimationFrame(page);
    
    // Get current state to determine winner
    let state = await getReduxState(page);
    const winnerId = state.game.players[0].id;
    
    console.log(`Triggering victory for player: ${winnerId}`);
    
    // Trigger END_GAME action to show victory animation
    await page.evaluate((winner) => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({
        type: 'END_GAME',
        payload: {
          winners: [winner],
          winType: 'flow'
        }
      });
    }, winnerId);
    
    // Wait for the game over screen to appear
    await waitForAnimationFrame(page);
    
    // Verify we're on the game-over screen
    state = await getReduxState(page);
    expect(state.game.screen).toBe('game-over');
    expect(state.game.winners.length).toBeGreaterThan(0);
    
    console.log(`Winners: ${state.game.winners}, Win type: ${state.game.winType}`);
    
    // Wait for initial animation to start (modal fade-in)
    await waitForAnimationFrame(page);
    
    // Take a screenshot during early animation
    await takeScreenshot(page, { 
      path: '/tmp/victory-animation-early.png',
      fullPage: false
    });
    
    // Wait for modal to fully appear
    await waitForAnimationFrame(page);
    await takeScreenshot(page, { 
      path: '/tmp/victory-animation-modal.png',
      fullPage: false
    });
    
    // Wait for pulse animation
    await waitForAnimationFrame(page);
    await takeScreenshot(page, { 
      path: '/tmp/victory-animation-pulse.png',
      fullPage: false
    });
    
    console.log('Victory animation screenshots saved to /tmp/victory-animation-*.png');
  });
  
  test('should display victory animation for team victory', async ({ page }) => {
    await page.goto('/quortextt/tabletop.html');
    await page.waitForSelector('canvas#game-canvas');
    
    // Pause animations once at the beginning
    await pauseAnimations(page);
    
    // Set up a 4-player game (2 teams)
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      
      // Add four players
      for (let i = 0; i < 4; i++) {
        store.dispatch({ type: 'ADD_PLAYER' });
      }
      
      // Start the game with deterministic seed
      store.dispatch({ type: 'START_GAME', payload: { seed: 12345 } });
    });
    
    await waitForAnimationFrame(page);
    
    // Complete seating phase
    const canvas = page.locator('canvas#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    await completeSeatingPhase(page, canvas, box);
    
    await waitForAnimationFrame(page);
    
    // Get team information and trigger victory
    let state = await getReduxState(page);
    const team = state.game.teams[0];
    const winners = [team.player1Id, team.player2Id];
    
    console.log(`Triggering team victory for players: ${winners}`);
    
    // Trigger END_GAME action for team victory
    await page.evaluate((winnerIds) => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({
        type: 'END_GAME',
        payload: {
          winners: winnerIds,
          winType: 'flow'
        }
      });
    }, winners);
    
    await waitForAnimationFrame(page);
    
    // Verify game over
    state = await getReduxState(page);
    expect(state.game.screen).toBe('game-over');
    
    // Take screenshot of team victory with two color squares
    await takeScreenshot(page, { 
      path: '/tmp/victory-animation-team.png',
      fullPage: false
    });
    
    console.log('Team victory animation screenshot saved to /tmp/victory-animation-team.png');
  });
});
