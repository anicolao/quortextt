# Animation Framework Design

## Overview

This document specifies the animation framework for the Quortex game. The framework provides a generic, reusable system for managing smooth, frame-based animations using `requestAnimationFrame`, with support for debugging and testing.

## Core Concepts

### Frame-Based Timing

All animations are specified in **integer frame counts** rather than milliseconds. Assuming 60fps:
- 60 frames = 1000ms (1 second)
- 6 frames ≈ 100ms
- 18 frames ≈ 300ms
- 36 frames ≈ 600ms

This frame-based approach enables:
- Deterministic animation playback for testing
- Frame-by-frame debugging
- Consistent timing across different devices

### Animation Functions

An animation function receives a normalized time parameter `t` where `0 <= t <= 1`:
- `t = 0`: Animation start
- `t = 0.5`: Animation midpoint
- `t = 1`: Animation complete

The animation function uses `t` to calculate intermediate values (position, opacity, scale, etc.).

**Example:**
```typescript
// Fade-in animation
function fadeIn(t: number): number {
  return t; // opacity goes from 0 to 1
}

// Ease-out scale animation
function scaleEaseOut(t: number): number {
  return 0.8 + 0.2 * (1 - Math.pow(1 - t, 3)); // scale from 0.8 to 1.0
}
```

## Redux State

### Animation State Structure

Add to Redux state:

```typescript
interface AnimationState {
  frameCounter: number;           // Global frame counter
  paused: boolean;                // For debugging: pause all animations
  animations: ActiveAnimation[];  // List sorted by startFrame
}

interface ActiveAnimation {
  id: string;                     // Unique animation ID
  animationName: string;          // Name of registered animation function
  startFrame: number;             // Frame when animation starts
  endFrame: number;               // Frame when animation ends
}
```

### Animation Function Registry

Animation functions are stored in a separate registry outside Redux (not serializable):

```typescript
// Global registry of animation functions
const animationFunctions: Map<string, (t: number) => void> = new Map();

/**
 * Register a named animation function
 */
function defineAnimation(name: string, animFn: (t: number) => void): void {
  animationFunctions.set(name, animFn);
}

/**
 * Get animation function by name
 */
function getAnimationFunction(name: string): ((t: number) => void) | undefined {
  return animationFunctions.get(name);
}
```

### Computed Values

For each active animation:
```typescript
// Calculate current progress
const currentFrame = animationState.frameCounter;
const totalFrames = animation.endFrame - animation.startFrame;
const elapsedFrames = currentFrame - animation.startFrame;
const t = Math.min(1, Math.max(0, elapsedFrames / totalFrames));

// Get and call animation function
const animFn = getAnimationFunction(animation.animationName);
if (animFn) {
  animFn(t);
}

// Animation is complete when t >= 1
// It will be removed from the list during processing
```

## Animation Registration API

### Basic Registration

```typescript
/**
 * Register an animation to start immediately
 * @param animationName - Name of registered animation function
 * @param duration - Animation duration in frames
 * @returns Unique animation ID
 */
function registerAnimation(
  animationName: string,
  duration: number
): string;
```

**Example:**
```typescript
// First, define the animation function
defineAnimation('fade-in', (t) => {
  element.opacity = t;
});

// Then register it to run over 18 frames (~300ms)
registerAnimation('fade-in', 18);
```

### Delayed Registration

```typescript
/**
 * Register an animation to start after a delay
 * @param animationName - Name of registered animation function
 * @param duration - Animation duration in frames
 * @param delay - Delay before starting in frames
 * @returns Unique animation ID
 */
function registerAnimation(
  animationName: string,
  duration: number,
  delay: number
): string;
```

**Example:**
```typescript
// Define the animation
defineAnimation('fade-in-delayed', (t) => {
  element.opacity = t;
});

// Register to run after 30 frames delay, over 18 frames duration
registerAnimation('fade-in-delayed', 18, 30);
```

### Redux Action

```typescript
interface RegisterAnimationAction {
  type: 'REGISTER_ANIMATION';
  payload: {
    id: string;               // Generated unique ID
    animationName: string;    // Name of animation function (no function reference)
    startFrame: number;       // frameCounter + delay
    endFrame: number;         // startFrame + duration
  };
}
```

## Frame Counter Integration

### requestAnimationFrame Loop

The main animation loop increments the frame counter and processes animations:

```typescript
function animationLoop() {
  requestAnimationFrame(animationLoop);
  
  const state = store.getState();
  
  // Skip if paused (for debugging)
  if (state.animation.paused) {
    return;
  }
  
  // Increment frame counter
  store.dispatch({ type: 'INCREMENT_FRAME' });
  
  // Process active animations
  processAnimations();
  
  // Render frame
  render();
}
```

### Processing Animations

```typescript
function processAnimations() {
  const state = store.getState();
  const currentFrame = state.animation.frameCounter;
  const animations = state.animation.animations;
  
  // List is sorted by startFrame, so active animations are at the front
  const activeAnimations: ActiveAnimation[] = [];
  
  for (const animation of animations) {
    // Skip if not started yet
    if (currentFrame < animation.startFrame) {
      // Since list is sorted, all remaining animations are also not started
      activeAnimations.push(animation);
      continue;
    }
    
    // Calculate progress
    const totalFrames = animation.endFrame - animation.startFrame;
    const elapsedFrames = currentFrame - animation.startFrame;
    const t = Math.min(1, elapsedFrames / totalFrames);
    
    // Get and call animation function
    const animFn = getAnimationFunction(animation.animationName);
    if (animFn) {
      animFn(t);
    }
    
    // Keep animation if not complete
    if (t < 1) {
      activeAnimations.push(animation);
    }
    // If t >= 1, animation is omitted from new list (automatically removed)
  }
  
  // Update animation list with completed animations removed
  if (activeAnimations.length !== animations.length) {
    store.dispatch({
      type: 'UPDATE_ANIMATIONS',
      payload: { animations: activeAnimations }
    });
  }
}
```

## Higher-Order Animation Functions

Animation functions can be composed using higher-order functions to create effects.

### Easing Functions

```typescript
/**
 * Ease-in: slow start, fast end
 */
function easeIn(animFn: (t: number) => void): (t: number) => void {
  return (t: number) => {
    const easedT = t * t;
    animFn(easedT);
  };
}

/**
 * Ease-out: fast start, slow end
 */
function easeOut(animFn: (t: number) => void): (t: number) => void {
  return (t: number) => {
    const easedT = 1 - Math.pow(1 - t, 2);
    animFn(easedT);
  };
}

/**
 * Ease-in-out: slow start, fast middle, slow end
 */
function easeInOut(animFn: (t: number) => void): (t: number) => void {
  return (t: number) => {
    const easedT = t < 0.5
      ? 2 * t * t
      : 1 - Math.pow(-2 * t + 2, 2) / 2;
    animFn(easedT);
  };
}
```

**Usage:**
```typescript
// Define base animation
const fadeAnim = (t: number) => { element.opacity = t; };

// Define composed animation with ease-out
defineAnimation('fade-ease-out', easeOut(fadeAnim));

// Register the composed animation
registerAnimation('fade-ease-out', 18);
```

### Animation Sequencing

```typescript
/**
 * Run animations in sequence
 */
function sequence(
  animations: Array<{ fn: (t: number) => void; duration: number }>
): (t: number) => void {
  return (t: number) => {
    const totalDuration = animations.reduce((sum, a) => sum + a.duration, 0);
    let elapsed = t * totalDuration;
    
    for (const anim of animations) {
      if (elapsed <= anim.duration) {
        const localT = elapsed / anim.duration;
        anim.fn(localT);
        return;
      }
      elapsed -= anim.duration;
      anim.fn(1); // Ensure previous animations complete
    }
  };
}
```

### Animation Parallel Composition

```typescript
/**
 * Run multiple animations in parallel
 */
function parallel(
  animations: Array<(t: number) => void>
): (t: number) => void {
  return (t: number) => {
    animations.forEach(anim => anim(t));
  };
}
```

**Usage:**
```typescript
// Define parallel animation: fade and scale simultaneously
const combined = parallel([
  (t) => { element.opacity = t; },
  (t) => { element.scale = 0.8 + 0.2 * t; }
]);

defineAnimation('fade-and-scale', combined);
registerAnimation('fade-and-scale', 18);
```

## Debugging and Testing

### Pause and Step Controls

For development and E2E testing:

```typescript
// Pause all animations
store.dispatch({ type: 'PAUSE_ANIMATIONS' });

// Resume animations
store.dispatch({ type: 'RESUME_ANIMATIONS' });

// Step forward one frame (while paused)
store.dispatch({ type: 'STEP_FRAME' });
```

### E2E Test Support

E2E tests can step through animations frame-by-frame:

```typescript
// In test setup
await page.evaluate(() => {
  window.__REDUX_STORE__.dispatch({ type: 'PAUSE_ANIMATIONS' });
});

// Verify animation at specific frames
for (let frame = 0; frame < 18; frame++) {
  await page.evaluate(() => {
    window.__REDUX_STORE__.dispatch({ type: 'STEP_FRAME' });
  });
  
  // Take screenshot or verify state
  await page.screenshot({ path: `frame-${frame}.png` });
}
```

### Animation Verification

Tests can verify animations are registered and running:

```typescript
// Check active animations
const animations = store.getState().animation.animations;
expect(animations.length).toBeGreaterThan(0);

// Verify specific animation exists
const fadeAnimation = animations.find(a => a.animationName === 'fade-in-player-1');
expect(fadeAnimation).toBeDefined();
```

## Application Examples

### Button Press Animation

From SEATING_UX.md: Button scales down to 0.95 for 100ms (6 frames):

```typescript
function handleButtonPress(buttonElement: Element) {
  // Define the animation
  defineAnimation('button-press', (t) => {
    // Scale from 1.0 to 0.95 and back
    const scale = t < 0.5
      ? 1.0 - 0.05 * (t * 2)      // Scale down
      : 0.95 + 0.05 * ((t - 0.5) * 2); // Scale up
    buttonElement.style.transform = `scale(${scale})`;
  });
  
  // Register it to run for 6 frames (100ms at 60fps)
  registerAnimation('button-press', 6);
}
```

### Edge Selection Animation

From SEATING_UX.md: Complex multi-stage animation:

```typescript
function handleEdgeSelection(edge: number, playerColor: string) {
  const edgeElement = getEdgeElement(edge);
  const buttonElement = getButtonElement(edge);
  
  // Define animations
  defineAnimation('button-scale-down', (t) => {
    buttonElement.style.transform = `scale(${1.0 - 0.05 * t})`;
  });
  
  defineAnimation('edge-fade-in', (t) => {
    edgeElement.style.borderColor = playerColor;
    edgeElement.style.opacity = t;
  });
  
  defineAnimation('button-fade-out', (t) => {
    buttonElement.style.opacity = 1 - t;
  });
  
  // Register animations with timing
  // Stage 1: Button press (0-100ms)
  registerAnimation('button-scale-down', 6, 0);
  
  // Stage 2: Edge border fade-in (100-300ms)
  registerAnimation('edge-fade-in', 12, 6);
  
  // Stage 3: Button fade-out (300-450ms)
  registerAnimation('button-fade-out', 9, 18);
}
```

### Tile Placement Animation

From UI_DESIGN.md: Fade + scale with ease-out:

```typescript
function placeTile(tile: TileElement, position: HexPosition) {
  const fadeScale = parallel([
    (t) => { tile.opacity = t; },
    (t) => { tile.scale = 0.8 + 0.2 * t; }
  ]);
  
  defineAnimation('tile-place', easeOut(fadeScale));
  registerAnimation('tile-place', 12); // 200ms
}
```

### Rotation Animation

From UI_DESIGN.md: 450ms smooth rotation:

```typescript
function rotateTile(tile: TileElement, fromAngle: number, toAngle: number) {
  defineAnimation('tile-rotate', easeInOut((t) => {
    const angle = fromAngle + (toAngle - fromAngle) * t;
    tile.style.transform = `rotate(${angle}deg)`;
  }));
  
  registerAnimation('tile-rotate', 27); // 450ms
}
```

### Snap Animations

From UI_DESIGN.md: Different speeds for snap-in vs snap-out:

```typescript
// Snap-in: slow 600ms
function snapIn(tile: TileElement, targetPos: Position) {
  const startPos = tile.position;
  
  defineAnimation('snap-in', easeOut((t) => {
    tile.position = {
      x: startPos.x + (targetPos.x - startPos.x) * t,
      y: startPos.y + (targetPos.y - startPos.y) * t
    };
  }));
  
  registerAnimation('snap-in', 36); // 600ms
}

// Snap-out: fast 200ms
function snapOut(tile: TileElement, cursorPos: Position) {
  const startPos = tile.position;
  
  defineAnimation('snap-out', easeIn((t) => {
    tile.position = {
      x: startPos.x + (cursorPos.x - startPos.x) * t,
      y: startPos.y + (cursorPos.y - startPos.y) * t
    };
  }));
  
  registerAnimation('snap-out', 12); // 200ms
}
```

## Performance Considerations

### Efficient Animation Updates

- Animation functions should directly update render state, not trigger Redux actions
- Keep animation functions lightweight (avoid heavy computations)
- Use sorted list for efficient processing: active animations are at the front
- Clean up completed animations immediately by rebuilding list

### Memory Management

- Remove animations when complete (t >= 1)
- Cancel animations when components unmount or state changes
- Limit maximum number of concurrent animations if needed

### Render Optimization

- Only re-render when state changes or animations are active
- Batch multiple animation updates in a single frame
- Use canvas-based rendering for better animation performance

## Summary

The animation framework provides:

1. **Frame-based timing**: Integer frame counts for deterministic playback
2. **Redux integration**: Animations stored as serializable list in Redux state
3. **Function registry**: Animation functions stored separately (not in Redux)
4. **Simple API**: `defineAnimation(name, fn)` then `registerAnimation(name, duration, delay?)`
5. **Normalized parameter**: Animation functions receive `t` from 0 to 1
6. **Composability**: Higher-order functions for easing and composition
7. **Efficient processing**: Sorted list with automatic cleanup of completed animations
8. **Debuggability**: Pause, step, and inspect animations
9. **Testability**: E2E tests can verify every frame

This design enables smooth 60fps animations while maintaining Redux serialization requirements and providing powerful debugging capabilities for development and testing.
