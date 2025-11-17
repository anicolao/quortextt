/**
 * Discord Activity Entry Point
 * Initializes the game in Discord Activity mode with authentication
 */

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
import { DiscordActivityClient } from './discord/discordClient';

// Expose store to window for testing
declare global {
  interface Window {
    __REDUX_STORE__: typeof store;
    ANIMATIONS_DEBUG_SLOWDOWN?: number;
  }
}
window.__REDUX_STORE__ = store;

// UI Elements
const loadingElement = document.getElementById('discord-loading');
const errorElement = document.getElementById('discord-error');
const errorTextElement = document.getElementById('error-text');
const multiplayerUiElement = document.getElementById('multiplayer-ui');
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

if (!canvas) {
  throw new Error('Canvas element not found');
}
if (!multiplayerUiElement) {
  throw new Error('Multiplayer UI root element not found');
}

let renderer: Renderer | null = null;
let inputHandler: InputHandler | null = null;
let gameCoordinator: GameCoordinator | null = null;
let discordClient: DiscordActivityClient | null = null;

/**
 * Show error screen with message
 */
function showError(message: string) {
  console.error('[Discord Activity] Error:', message);
  if (loadingElement) loadingElement.classList.add('hidden');
  if (errorElement) errorElement.classList.add('visible');
  if (errorTextElement) errorTextElement.textContent = message;
}

/**
 * Hide loading screen and show main UI
 */
function hideLoading() {
  if (loadingElement) loadingElement.classList.add('hidden');
  if (multiplayerUiElement) multiplayerUiElement.style.display = 'block';
}

/**
 * Initialize Discord Activity
 */
async function initializeDiscordActivity() {
  try {
    // Get Discord Client ID from environment
    const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;
    if (!clientId) {
      throw new Error('Discord Client ID not configured. Set VITE_DISCORD_CLIENT_ID environment variable.');
    }

    console.log('[Discord Activity] Starting initialization with client ID:', clientId);

    // Create Discord client and initialize SDK
    discordClient = new DiscordActivityClient(clientId);
    await discordClient.initialize();

    // Authenticate user
    const authResult = await discordClient.authenticate();
    console.log('[Discord Activity] Authenticated as:', authResult.username);

    // Get Discord channel and instance information
    const { channelId, guildId } = discordClient.getChannelInfo();
    const instanceId = discordClient.getInstanceId();
    console.log('[Discord Activity] Channel ID:', channelId, 'Guild ID:', guildId, 'Instance ID:', instanceId);

    if (!channelId) {
      throw new Error('Unable to determine Discord channel. Please start the Activity from a text channel.');
    }

    if (!instanceId) {
      throw new Error('Unable to determine Discord Activity instance. Please try restarting the Activity.');
    }

    // Store Discord user info in multiplayer store
    const multiplayerState = multiplayerStore.get();
    multiplayerStore.set({
      ...multiplayerState,
      userId: authResult.userId,
      username: authResult.username,
      playerId: authResult.userId, // Use Discord user ID as player ID
    });

    // Import socket for multiplayer communication
    const { socket } = await import('./multiplayer/socket');

    // Enable Discord proxy mode to bypass CSP restrictions
    socket.setDiscordProxyMode(true);

    // Connect to the multiplayer server (via Discord proxy)
    await socket.connect();
    
    // Identify with the server
    socket.identify(authResult.username);

    // Wait for identification to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Create or join a Discord instance-specific game room
    // Use instance ID to make each activity launch have its own unique game
    const roomName = `Discord: ${guildId ? `Guild ${guildId.slice(-6)}` : 'Activity'} - ${instanceId.slice(-6)}`;
    const roomId = `discord-${instanceId}`; // Use instance ID as unique room identifier per activity launch

    // Try to join existing room first
    console.log('[Discord Activity] Looking for existing game room:', roomId);
    const rooms = await socket.fetchRooms(authResult.userId);
    const existingRoom = rooms.find(r => r.id === roomId);

    if (existingRoom) {
      console.log('[Discord Activity] Joining existing room:', existingRoom.name);
      socket.joinRoom(roomId);
      
      // For Discord Activities, show the game canvas with color configuration
      console.log('[Discord Activity] Showing color configuration screen...');
      socket.startGame(roomId);
    } else {
      // Create new room for this Discord Activity instance with custom room ID
      console.log('[Discord Activity] Creating new room:', roomName);
      const createdRoomId = await socket.createRoom(roomName, 6, authResult.userId, roomId);
      
      if (!createdRoomId) {
        throw new Error('Failed to create game room');
      }
      
      // Join the room
      socket.joinRoom(roomId);
      
      // For Discord Activities, immediately show the game canvas with color configuration
      console.log('[Discord Activity] Showing color configuration screen...');
      socket.startGame(roomId);
    }

    // Hide loading screen but keep UI hidden initially
    // The UI will be shown when we're in the room waiting state
    hideLoading();

    // Mount the Svelte app (will show room screen)
    mount(App, {
      target: multiplayerUiElement as HTMLElement,
    });

    // Listen for game state changes
    multiplayerStore.subscribe((state) => {
      if (state.screen === 'game' && state.gameId) {
        console.log('[Discord Activity] Starting game with gameId:', state.gameId);
        
        // Set game mode to multiplayer
        store.dispatch(setGameMode('multiplayer'));
        
        // Hide Svelte UI, show canvas
        if (multiplayerUiElement) multiplayerUiElement.style.display = 'none';
        canvas.classList.add('active');
        
        // Initialize game if not already done
        if (!renderer) {
          initializeGame();
        }
        
        // Initialize game coordinator
        if (!gameCoordinator) {
          gameCoordinator = new GameCoordinator(store, state.gameId);
          gameCoordinator.start();
        }
      } else {
        // Show Svelte UI, hide canvas
        if (multiplayerUiElement) multiplayerUiElement.style.display = 'block';
        canvas.classList.remove('active');
        
        // Clean up coordinator if leaving game
        if (gameCoordinator && state.screen !== 'game') {
          gameCoordinator.stop();
          gameCoordinator = null;
        }
      }
    });

    console.log('[Discord Activity] Initialization complete');

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    showError(message);
  }
}

/**
 * Initialize the game canvas and rendering
 */
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

// Start the Discord Activity
initializeDiscordActivity();
