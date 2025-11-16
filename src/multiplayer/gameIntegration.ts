// Integration between multiplayer and existing game logic

import { store } from '../redux/store';
import { Renderer } from '../rendering/renderer';
import { InputHandler } from '../input/inputHandler';
import { GameplayInputHandler } from '../input/gameplayInputHandler';
import { incrementFrame } from '../animation/actions';
import { processAnimations } from '../animation/processor';
import { updateFlowPreview } from '../animation/flowPreview';
import { HexPosition, Rotation } from '../game/types';
import { positionToKey } from '../game/board';
import { isPlayerBlocked } from '../game/legality';
import { GameCoordinator } from './gameCoordinator';
import { socket } from './socket';
import { multiplayerStore } from './stores/multiplayerStore';

let renderer: Renderer | null = null;
let inputHandler: InputHandler | null = null;
let gameCoordinator: GameCoordinator | null = null;
let animationId: number | null = null;
let unsubscribe: (() => void) | null = null;
let spectatorExitHandler: (() => void) | null = null;

export function initGame(gameId: string) {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    throw new Error('Canvas element not found');
  }

  // Initialize renderer if not already done
  if (!renderer) {
    renderer = new Renderer(canvas);
    inputHandler = new InputHandler(renderer);

    // Set up render callback
    renderer.setRenderCallback(render);

    // Handle window resize
    window.addEventListener('resize', () => {
      renderer?.resizeCanvas();
      render();
    });
  }

  // Initialize game coordinator for multiplayer
  gameCoordinator = new GameCoordinator(store, gameId);
  gameCoordinator.start();

  // Handle spectator exit event
  spectatorExitHandler = () => {
    const mpState = multiplayerStore.get();
    if (mpState.isSpectator && mpState.gameId) {
      // Spectator: leave spectator mode and return to lobby
      socket.leaveSpectator(mpState.gameId);
      multiplayerStore.setIsSpectator(false);
      multiplayerStore.setScreen('lobby');
    }
  };
  
  window.addEventListener('multiplayer:spectator-exit', spectatorExitHandler);

  // Track previous state for flow preview updates and screen transitions
  let prevSelectedPosition: HexPosition | null = null;
  let prevRotation: Rotation = 0;
  let prevScreen: string | null = null;
  let supermoveAnimationActive = false;

  // Subscribe to store changes
  if (unsubscribe) {
    unsubscribe();
  }
  
  unsubscribe = store.subscribe(() => {
    const state = store.getState();
    
    // Check if we transitioned to game-over screen
    if (state.game.screen === 'game-over' && prevScreen !== 'game-over') {
      // Initialize victory breathing animation
      import('../animation/victoryAnimations').then(({ initVictoryAnimations }) => {
        initVictoryAnimations();
      });
    }
    
    // Check if we transitioned away from game-over screen
    if (state.game.screen !== 'game-over' && prevScreen === 'game-over') {
      // Cancel victory animations
      import('../animation/victoryAnimations').then(({ cancelVictoryAnimations }) => {
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
        import('../animation/victoryAnimations').then(({ initSupermoveAnimation }) => {
          initSupermoveAnimation();
        });
        supermoveAnimationActive = true;
      } else if (!hasSupermove && supermoveAnimationActive) {
        import('../animation/victoryAnimations').then(({ cancelSupermoveAnimation }) => {
          cancelSupermoveAnimation();
        });
        supermoveAnimationActive = false;
      }
    } else if (supermoveAnimationActive) {
      // Cancel supermove animation when leaving gameplay screen
      import('../animation/victoryAnimations').then(({ cancelSupermoveAnimation }) => {
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

  // Start animation loop if not already running
  if (!animationId) {
    startAnimationLoop();
  }
}

function render() {
  if (!renderer || !inputHandler) return;
  
  const state = store.getState();
  const layout = renderer.render(state);
  inputHandler.setCurrentLayout(layout);

  // Set up gameplay input handler if in gameplay mode
  if (state.game.screen === 'gameplay') {
    const gameplayRenderer = renderer.getGameplayRenderer();
    if (gameplayRenderer) {
      const gameplayInput = new GameplayInputHandler(gameplayRenderer);
      inputHandler.setGameplayInputHandler(gameplayInput);
    }
  } else {
    inputHandler.setGameplayInputHandler(null);
  }
}

function startAnimationLoop() {
  let frameSkipCounter = 0;
  
  function animate() {
    animationId = requestAnimationFrame(animate);
    
    const state = store.getState();
    
    // Skip if paused (for debugging)
    if (state.animation.paused) {
      return;
    }
    
    // Apply debug slowdown from settings or window override
    const slowdown = (window as any).ANIMATIONS_DEBUG_SLOWDOWN || state.ui.settings.debugAnimationSlowdown;
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

export function showCanvas() {
  const canvas = document.getElementById('game-canvas');
  if (canvas) {
    canvas.classList.add('active');
  }
}

export function hideCanvas() {
  const canvas = document.getElementById('game-canvas');
  if (canvas) {
    canvas.classList.remove('active');
  }
}

export function cleanup() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  
  if (spectatorExitHandler) {
    window.removeEventListener('multiplayer:spectator-exit', spectatorExitHandler);
    spectatorExitHandler = null;
  }
  
  if (gameCoordinator) {
    gameCoordinator.stop();
    gameCoordinator = null;
  }
}
