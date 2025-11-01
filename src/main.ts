// Main application entry point

import { store } from './redux/store';
import { Renderer } from './rendering/renderer';
import { InputHandler } from './input/inputHandler';
import { GameplayInputHandler } from './input/gameplayInputHandler';
import { incrementFrame } from './animation/actions';
import { processAnimations } from './animation/processor';

// Expose store to window for testing
declare global {
  interface Window {
    __REDUX_STORE__: typeof store;
  }
}
window.__REDUX_STORE__ = store;

// Initialize the application
function init() {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    throw new Error('Canvas element not found');
  }

  const renderer = new Renderer(canvas);
  const inputHandler = new InputHandler(renderer);

  // Main render function
  function render() {
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

  // Set up render callback for color picker changes
  renderer.setRenderCallback(render);

  // Handle window resize
  window.addEventListener('resize', () => {
    renderer.resizeCanvas();
    render();
  });

  // Subscribe to store changes
  store.subscribe(render);

  // Initial render
  render();

  // Animation loop for smooth rendering
  function animate() {
    requestAnimationFrame(animate);
    
    const state = store.getState();
    
    // Skip if paused (for debugging)
    if (state.animation.paused) {
      return;
    }
    
    // Process active animations
    processAnimations(state.animation, store.dispatch);
    
    // Increment frame counter (triggers render via store subscription)
    store.dispatch(incrementFrame());
  }

  animate();
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
