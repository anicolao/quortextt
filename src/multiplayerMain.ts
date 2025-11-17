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
import { setGameMode, resetGame, setSpectatorMode } from './redux/actions';
import { Router } from './multiplayer/router';
import { socket } from './multiplayer/socket';

// Expose store to window for testing
declare global {
  interface Window {
    __REDUX_STORE__: typeof store;
    ANIMATIONS_DEBUG_SLOWDOWN?: number;
  }
}
window.__REDUX_STORE__ = store;

// Initialize router
Router.init();

// Restore state from URL on page load
const initialRoute = Router.getCurrentRoute();
console.log('[multiplayerMain] Initial route from URL:', initialRoute);

// Mount Svelte app
const svelteRoot = document.getElementById('multiplayer-ui');
if (!svelteRoot) {
  throw new Error('Multiplayer UI root element not found');
}

const app = mount(App, {
  target: svelteRoot,
});

// Handle URL restoration with authentication
// Deep linking requires socket connection first
async function handleDeepLink() {
  if (initialRoute.screen === 'login' && !initialRoute.params.id) {
    // No deep link, just regular login screen
    return;
  }
  
  console.log('[multiplayerMain] Handling deep link from URL:', initialRoute);
  
  // Check for stored auth token
  const storedToken = localStorage.getItem('quortex_token');
  if (!storedToken) {
    console.log('[multiplayerMain] No auth token found, cannot restore game state');
    // Stay on login screen but preserve the game ID for after login
    if (initialRoute.params.id) {
      multiplayerStore.setGameId(initialRoute.params.id);
    }
    return;
  }
  
  try {
    // Get server URL from environment
    // @ts-ignore - Vite injects import.meta.env
    const serverUrl = (import.meta as any).env?.VITE_SERVER_URL || 'http://localhost:3001';
    
    // Validate token and get user info
    const response = await fetch(`${serverUrl}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${storedToken}`
      }
    });
    
    if (!response.ok) {
      console.log('[multiplayerMain] Token invalid, clearing and staying on login');
      localStorage.removeItem('quortex_token');
      return;
    }
    
    const user = await response.json();
    console.log('[multiplayerMain] Authenticated as:', user.alias || user.displayName);
    
    // Connect to socket with authentication
    await socket.connectWithAuth(storedToken);
    socket.identify(user.alias || user.displayName);
    
    // Wait for socket to be fully connected and identified
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Now handle the deep link based on the route
    if (initialRoute.params.id) {
      multiplayerStore.setGameId(initialRoute.params.id);
      
      if (initialRoute.screen === 'game') {
        // Join the game room to receive actions
        const isSpectating = initialRoute.params.spectate === 'true';
        
        if (isSpectating) {
          console.log('[multiplayerMain] Joining as spectator for game:', initialRoute.params.id);
          multiplayerStore.setIsSpectator(true);
          store.dispatch(setSpectatorMode(true));
          socket.joinAsSpectator(initialRoute.params.id);
        } else {
          console.log('[multiplayerMain] Joining game room:', initialRoute.params.id);
          socket.joinRoom(initialRoute.params.id);
        }
        
        // Set the screen - this will trigger GameCoordinator to fetch actions
        const params: any = { id: initialRoute.params.id };
        if (isSpectating) params.spectate = true;
        multiplayerStore.setScreen('game', params);
      } else if (initialRoute.screen === 'room') {
        // Joining a room (pre-game)
        console.log('[multiplayerMain] Joining room:', initialRoute.params.id);
        socket.joinRoom(initialRoute.params.id);
        multiplayerStore.setScreen('room', { id: initialRoute.params.id });
      } else {
        // For other screens, just set the screen
        multiplayerStore.setScreen(initialRoute.screen);
      }
    } else {
      // No game ID, just navigate to the screen
      multiplayerStore.setScreen(initialRoute.screen);
    }
  } catch (error) {
    console.error('[multiplayerMain] Error handling deep link:', error);
    // Stay on login screen on error
  }
}

// Start deep link handling
handleDeepLink();

// Subscribe to router changes (browser back/forward)
Router.subscribe((route) => {
  console.log('[multiplayerMain] Route changed via browser navigation:', route);
  
  // Update store based on route
  if (route.params.id) {
    multiplayerStore.setGameId(route.params.id);
    
    if (route.screen === 'game' && route.params.spectate === 'true') {
      multiplayerStore.setIsSpectator(true);
      store.dispatch(setSpectatorMode(true));
    }
  }
  
  // Update screen without triggering navigation (to avoid infinite loop)
  // We directly update the store's internal state
  const currentState = multiplayerStore.get();
  if (currentState.screen !== route.screen) {
    // Use internal update to avoid calling Router.navigate again
    const storeInternal = multiplayerStore as any;
    storeInternal.update((state: any) => ({ ...state, screen: route.screen }));
  }
});

// Initialize game canvas (hidden initially)
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
if (!canvas) {
  throw new Error('Canvas element not found');
}

let renderer: Renderer | null = null;
let inputHandler: InputHandler | null = null;
let gameCoordinator: GameCoordinator | null = null;
let currentGameId: string | null = null;

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
    // Recreate coordinator if gameId has changed (e.g., for rematch)
    if (!gameCoordinator || currentGameId !== state.gameId) {
      let rematchInfo = null;
      
      // Clean up old coordinator if it exists
      if (gameCoordinator) {
        console.log('[multiplayerMain] Cleaning up old coordinator for gameId:', currentGameId);
        
        // Get rematch info before stopping the coordinator
        rematchInfo = gameCoordinator.getRematchInfo();
        if (rematchInfo) {
          console.log('[multiplayerMain] Retrieved rematch info:', rematchInfo);
        }
        
        gameCoordinator.stop();
        
        // Reset the Redux game state when transitioning to a new game
        console.log('[multiplayerMain] Resetting game state for new game');
        store.dispatch(resetGame());
      }
      
      console.log('[multiplayerMain] Creating new coordinator for gameId:', state.gameId);
      currentGameId = state.gameId;
      gameCoordinator = new GameCoordinator(store, state.gameId, rematchInfo || undefined);
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
      currentGameId = null;
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
      if (selectedPos && state.game.supermove && currentPlayer) {
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
