// Multiplayer entry point
import { mount } from 'svelte';
import App from './multiplayer/App.svelte';
import { store } from './redux/store';
import { Renderer } from './rendering/renderer';
import { InputHandler } from './input/inputHandler';
import { GameplayInputHandler } from './input/gameplayInputHandler';
import { incrementFrame } from './animation/actions';
import { processAnimations } from './animation/processor';
import { updateFlowPreview } from './animation/flowPreview';
import { HexPosition, Rotation } from './game/types';
import { positionToKey } from './game/board';
import { isPlayerBlocked } from './game/legality';
import { multiplayerStore } from './multiplayer/stores/multiplayerStore';
import { GameCoordinator } from './multiplayer/gameCoordinator';
import { setGameMode } from './redux/actions';

// Expose store to window for testing
declare global {
  interface Window {
    __REDUX_STORE__: typeof store;
    ANIMATIONS_DEBUG_SLOWDOWN?: number;
  }
}
window.__REDUX_STORE__ = store;

// Mount Svelte app
const svelteRoot = document.getElementById('multiplayer-ui');
if (!svelteRoot) {
  throw new Error('Multiplayer UI root element not found');
}

const app = mount(App, {
  target: svelteRoot,
});

// Initialize game canvas (hidden initially)
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
if (!canvas) {
  throw new Error('Canvas element not found');
}

let renderer: Renderer | null = null;
let inputHandler: InputHandler | null = null;
let gameCoordinator: GameCoordinator | null = null;

// Listen for game state changes
multiplayerStore.subscribe((state) => {
  if (state.screen === 'game' && state.gameId) {
    console.log('Starting multiplayer game with gameId:', state.gameId);
    
    // Set game mode to multiplayer
    store.dispatch(setGameMode('multiplayer'));
    console.log('Set game mode to multiplayer');
    // Note: localPlayerId will be set when the player selects their edge during seating
    
    // Hide Svelte UI, show canvas
    if (svelteRoot) svelteRoot.style.display = 'none';
    canvas.classList.add('active');
    
    // Initialize game if not already done
    if (!renderer) {
      initializeGame();
    }
    
    // Initialize game coordinator to subscribe to actions
    if (!gameCoordinator) {
      gameCoordinator = new GameCoordinator(store, state.gameId);
      gameCoordinator.start();
    }
  } else {
    // Show Svelte UI, hide canvas
    if (svelteRoot) svelteRoot.style.display = 'block';
    canvas.classList.remove('active');
    
    // Clean up coordinator if leaving game
    if (gameCoordinator && state.screen !== 'game') {
      gameCoordinator.stop();
      gameCoordinator = null;
    }
  }
});

function initializeGame() {
  if (!canvas) return;
  
  renderer = new Renderer(canvas);
  inputHandler = new InputHandler(renderer);

  // Main render function
  function render() {
    if (!renderer || !inputHandler) return;
    
    const state = store.getState();
    const layout = renderer.render(state);
    inputHandler.setCurrentLayout(layout);

    // Set up gameplay input handler if in gameplay mode
    if (state.game.screen === 'gameplay') {
      const gameplayRenderer = renderer!.getGameplayRenderer();
      if (gameplayRenderer) {
        const gameplayInput = new GameplayInputHandler(gameplayRenderer);
        inputHandler.setGameplayInputHandler(gameplayInput);
      }
    } else {
      inputHandler.setGameplayInputHandler(null);
    }
  }

  // Set up render callback for color picker changes
  renderer.setRenderCallback(render);

  // Handle window resize
  window.addEventListener('resize', () => {
    if (renderer) {
      renderer.resizeCanvas();
      render();
    }
  });

  // Track previous state for flow preview updates and screen transitions
  let prevSelectedPosition: HexPosition | null = null;
  let prevRotation: Rotation = 0;
  let prevScreen: string | null = null;
  let supermoveAnimationActive = false;

  // Subscribe to store changes
  store.subscribe(() => {
    const state = store.getState();
    
    // Check if we transitioned to game-over screen
    if (state.game.screen === 'game-over' && prevScreen !== 'game-over') {
      // Initialize victory breathing animation
      import('./animation/victoryAnimations').then(({ initVictoryAnimations }) => {
        initVictoryAnimations();
      });
    }
    
    // Check if we transitioned away from game-over screen
    if (state.game.screen !== 'game-over' && prevScreen === 'game-over') {
      // Cancel victory animations
      import('./animation/victoryAnimations').then(({ cancelVictoryAnimations }) => {
        cancelVictoryAnimations();
      });
    }
    
    // Manage supermove animation during gameplay
    if (state.game.screen === 'gameplay') {
      // Check if supermove conditions are met
      const selectedPos = state.ui.selectedPosition;
      const currentPlayer = state.game.players[state.game.currentPlayerIndex];
      
      let hasSupermove = false;
      if (selectedPos && state.ui.settings.supermove && currentPlayer) {
        const posKey = positionToKey(selectedPos);
        const isOccupied = state.game.board.has(posKey);
        hasSupermove = isOccupied && isPlayerBlocked(
          state.game.board,
          currentPlayer,
          state.game.players,
          state.game.teams,
          state.game.boardRadius
        );
      }
      
      // Start or stop supermove animation
      if (hasSupermove && !supermoveAnimationActive) {
        import('./animation/victoryAnimations').then(({ initSupermoveAnimation }) => {
          initSupermoveAnimation();
        });
        supermoveAnimationActive = true;
      } else if (!hasSupermove && supermoveAnimationActive) {
        import('./animation/victoryAnimations').then(({ cancelSupermoveAnimation }) => {
          cancelSupermoveAnimation();
        });
        supermoveAnimationActive = false;
      }
    } else if (supermoveAnimationActive) {
      // Cancel supermove animation when leaving gameplay screen
      import('./animation/victoryAnimations').then(({ cancelSupermoveAnimation }) => {
        cancelSupermoveAnimation();
      });
      supermoveAnimationActive = false;
    }
    
    prevScreen = state.game.screen;
    
    // Check if we should update flow preview
    if (state.game.screen === 'gameplay') {
      const selectedPos = state.ui.selectedPosition;
      const rotation = state.ui.currentRotation;
      
      // Update flow preview if position or rotation changed
      if (selectedPos !== prevSelectedPosition || rotation !== prevRotation) {
        prevSelectedPosition = selectedPos;
        prevRotation = rotation;
        updateFlowPreview(selectedPos, rotation, state.game.currentTile);
      }
    }
    
    render();
  });

  // Initial render
  render();

  // Animation loop for smooth rendering
  let frameSkipCounter = 0;
  
  function animate() {
    requestAnimationFrame(animate);
    
    const state = store.getState();
    
    // Skip if paused (for debugging)
    if (state.animation.paused) {
      return;
    }
    
    // Apply debug slowdown from settings or window override
    const slowdown = window.ANIMATIONS_DEBUG_SLOWDOWN || state.ui.settings.debugAnimationSlowdown;
    frameSkipCounter++;
    
    // Only process animations every Nth frame based on slowdown
    if (frameSkipCounter >= slowdown) {
      frameSkipCounter = 0;
      
      // Process active animations
      processAnimations(state.animation, store.dispatch);
      
      // Increment frame counter (triggers render via store subscription)
      store.dispatch(incrementFrame());
    }
  }

  animate();
}

export { app };
