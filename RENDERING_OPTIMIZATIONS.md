# Rendering Optimizations Design

## Overview

This document outlines an approach to optimize canvas rendering by tracking "dirty" regions and avoiding repainting the entire canvas every frame. The goal is to minimize the number of pixels painted per animation frame while maintaining the current visual quality and animation smoothness.

## Problem Statement

### Current State

The current rendering implementation follows a simple full-repaint strategy:

1. Every frame (60fps), the entire canvas is cleared: `ctx.fillRect(0, 0, canvasWidth, canvasHeight)`
2. All rendering layers are redrawn in sequence:
   - Background (wood texture or solid color)
   - Board hexagon with colored edges
   - All hex positions
   - All placed tiles
   - Current tile preview
   - Action buttons
   - Exit/help buttons
   - Dialogs (if visible)
3. This happens even when nothing has changed visually

**Performance Impact:**
- For a 1920x1080 canvas, we're repainting ~2 million pixels every frame
- At 60fps, that's ~120 million pixels per second
- Most frames have minimal or no visual changes (e.g., only a button hover state)
- The wood texture background requires expensive image operations
- Large boards with many tiles compound the cost

### Target Optimization

Minimize pixels painted per frame by:
1. Tracking which regions of the canvas are "dirty" (need repainting)
2. Only clearing and redrawing dirty regions
3. Caching static content in off-screen canvases
4. Intelligently determining when regions become dirty

**Expected Benefits:**
- 90%+ reduction in pixels painted for idle frames (no animations)
- 50-80% reduction during typical animations (single tile placement)
- Smoother 60fps even on lower-end devices
- Reduced battery consumption on mobile devices

## Proposed Approach

### 1. Dirty Region Tracking System

#### Core Concept

Track rectangular "dirty regions" that need repainting. Maintain a list of dirty rectangles and merge overlapping ones before rendering.

```typescript
interface DirtyRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DirtyRegionTracker {
  dirtyRects: DirtyRect[];
  fullRedrawNeeded: boolean;
  
  markDirty(rect: DirtyRect): void;
  markFullRedraw(): void;
  getDirtyRegions(): DirtyRect[];
  clear(): void;
}
```

#### Region Management

**Marking Regions Dirty:**
- Individual elements (tiles, buttons) mark their bounding rectangles dirty when they change
- Animations mark affected regions dirty each frame they update
- State changes determine which visual elements changed and mark corresponding regions
- Screen transitions trigger full redraws

**Optimizing Dirty Regions:**
- Merge overlapping or adjacent rectangles to reduce draw calls
- If dirty area exceeds 60% of canvas, fall back to full redraw
- Expand rectangles slightly (1-2px) to avoid edge artifacts from anti-aliasing

**Edge Cases:**
- Rotated elements: use bounding box of rotated rectangle
- Bezier curves: calculate bounding box including control points
- Shadows/glows: expand dirty region to include effect area

### 2. Layer Invalidation Strategy

#### Rendering Layer Architecture

Organize rendering into cacheable layers with different update frequencies:

```
Layer 0: Static Background (cached)
  ├─ Wood texture or solid color background
  └─ Updates: Only on resize or theme change

Layer 1: Board Structure (cached)
  ├─ Board hexagon outline
  ├─ Hex grid positions
  ├─ Player edge colors
  └─ Updates: Only on game start, player changes, or resize

Layer 2: Placed Tiles (partial cache)
  ├─ All placed tiles without animations
  ├─ Flow paths through tiles
  └─ Updates: When tiles are placed/removed, flow changes

Layer 3: Dynamic Elements (never cached)
  ├─ Current tile preview (follows cursor)
  ├─ Tile placement animations
  ├─ Flow preview animations
  └─ Updates: Every frame during interactions

Layer 4: UI Elements (selective cache)
  ├─ Buttons (cached until hover/press)
  ├─ Dialogs (cached while static)
  └─ Updates: On hover, press, or dialog content change

Layer 5: Debug Overlays (optional, never cached)
  ├─ Hit test visualization
  ├─ Debug labels
  └─ Updates: When debug mode active
```

#### Layer Caching Implementation

**Off-Screen Canvas Cache:**
```typescript
class LayerCache {
  private backgroundCanvas: HTMLCanvasElement | null = null;
  private boardCanvas: HTMLCanvasElement | null = null;
  private tilesCanvas: HTMLCanvasElement | null = null;
  
  invalidateBackground(): void;
  invalidateBoard(): void;
  invalidateTiles(): void;
  
  getOrRenderBackground(renderFn: () => void): HTMLCanvasElement;
  getOrRenderBoard(renderFn: () => void): HTMLCanvasElement;
  getOrRenderTiles(renderFn: () => void): HTMLCanvasElement;
}
```

**Cache Invalidation Rules:**
- Background: Invalidate on resize, theme change
- Board: Invalidate on game start, player edge ownership change, resize
- Tiles: Invalidate when any tile placed/removed or flows change
- UI: Invalidate specific elements on state changes

**Compositing:**
- During render, composite cached layers onto main canvas
- Only redraw cached layer if invalidated
- For dirty regions, clip to affected area before compositing

### 3. Dirty Detection from State Changes

#### Redux State Diffing

Hook into Redux state changes to automatically detect dirty regions:

```typescript
class DirtyDetector {
  private previousState: RootState | null = null;
  
  detectDirtyRegions(currentState: RootState): DirtyRect[] {
    if (!this.previousState) {
      return [{ x: 0, y: 0, width: canvasWidth, height: canvasHeight }];
    }
    
    const dirtyRects: DirtyRect[] = [];
    
    // Check for board changes
    if (this.previousState.game.board !== currentState.game.board) {
      dirtyRects.push(...this.getBoardDirtyRegions(currentState));
    }
    
    // Check for UI element changes
    if (this.previousState.ui.selectedPosition !== currentState.ui.selectedPosition) {
      dirtyRects.push(...this.getPreviewDirtyRegions(currentState));
    }
    
    // Check for animation state
    if (currentState.animation.animations.length > 0) {
      dirtyRects.push(...this.getAnimationDirtyRegions(currentState));
    }
    
    // Check for button hover states
    if (this.previousState.ui.hoveredElement !== currentState.ui.hoveredElement) {
      dirtyRects.push(...this.getHoverDirtyRegions(currentState));
    }
    
    this.previousState = currentState;
    return dirtyRects;
  }
}
```

#### Animation Integration

Animations register their dirty regions:

```typescript
interface AnimationDirtyRegion {
  animationId: string;
  getDirtyRect(t: number): DirtyRect;
}

// Example: Tile placement animation
registerAnimation('tile-place', {
  duration: 12,
  getDirtyRect: (t) => {
    const tilePos = getTilePixelPosition(position);
    const radius = hexRadius * 1.2; // Slightly larger for safety
    return {
      x: tilePos.x - radius,
      y: tilePos.y - radius,
      width: radius * 2,
      height: radius * 2
    };
  }
});
```

### 4. Optimized Rendering Loop

#### Modified Render Pipeline

```typescript
class GameplayRenderer {
  private dirtyTracker: DirtyRegionTracker;
  private layerCache: LayerCache;
  private dirtyDetector: DirtyDetector;
  
  render(state: RootState): void {
    // Detect what changed
    const dirtyRects = this.dirtyDetector.detectDirtyRegions(state);
    
    if (dirtyRects.length === 0) {
      // Nothing to draw - skip entire render!
      return;
    }
    
    // Mark dirty regions
    dirtyRects.forEach(rect => this.dirtyTracker.markDirty(rect));
    
    // Get optimized dirty regions (merged, etc.)
    const regions = this.dirtyTracker.getDirtyRegions();
    
    if (this.dirtyTracker.fullRedrawNeeded) {
      // Full redraw needed
      this.renderFull(state);
    } else {
      // Partial redraw
      this.renderDirtyRegions(state, regions);
    }
    
    // Clear dirty state for next frame
    this.dirtyTracker.clear();
  }
  
  private renderDirtyRegions(state: RootState, regions: DirtyRect[]): void {
    // Save full canvas state
    this.ctx.save();
    
    for (const region of regions) {
      // Clip to dirty region
      this.ctx.beginPath();
      this.ctx.rect(region.x, region.y, region.width, region.height);
      this.ctx.clip();
      
      // Clear dirty region
      this.ctx.clearRect(region.x, region.y, region.width, region.height);
      
      // Render layers for this region
      this.compositeLayer('background', region);
      this.compositeLayer('board', region);
      this.compositeLayer('tiles', region);
      this.renderDynamicElements(state, region);
      
      // Restore for next region
      this.ctx.restore();
      this.ctx.save();
    }
    
    this.ctx.restore();
  }
  
  private compositeLayer(layer: string, region: DirtyRect): void {
    const cachedCanvas = this.layerCache.get(layer);
    if (cachedCanvas) {
      // Draw cached layer clipped to region
      this.ctx.drawImage(
        cachedCanvas,
        region.x, region.y, region.width, region.height,  // source
        region.x, region.y, region.width, region.height   // dest
      );
    }
  }
}
```

### 5. Special Optimizations

#### Wood Background Texture

The wood texture is expensive to generate. Optimize it:

1. **Generate once, cache forever** - already implemented via `woodBackgroundCanvas`
2. **Dirty region optimization** - only composite affected region:
   ```typescript
   // Instead of drawing full texture
   ctx.drawImage(woodCanvas, 0, 0);
   
   // Draw only dirty region
   ctx.drawImage(
     woodCanvas,
     dirtyX, dirtyY, dirtyWidth, dirtyHeight,
     dirtyX, dirtyY, dirtyWidth, dirtyHeight
   );
   ```

#### Flow Path Rendering

Flow paths can be expensive with Bezier curves:

1. **Pre-calculate and cache** flow paths as Path2D objects
2. **Only recalculate** when tiles are placed or flows change
3. **Dirty region** only includes affected tiles and their flow connections

```typescript
class FlowPathCache {
  private pathCache: Map<string, Path2D> = new Map();
  
  getFlowPath(tileKey: string, flowPattern: number[][]): Path2D {
    const cacheKey = `${tileKey}-${JSON.stringify(flowPattern)}`;
    if (!this.pathCache.has(cacheKey)) {
      const path = this.buildFlowPath(tileKey, flowPattern);
      this.pathCache.set(cacheKey, path);
    }
    return this.pathCache.get(cacheKey)!;
  }
  
  invalidateTile(tileKey: string): void {
    // Remove all cached paths for this tile
    for (const key of this.pathCache.keys()) {
      if (key.startsWith(tileKey)) {
        this.pathCache.delete(key);
      }
    }
  }
}
```

#### Button Hover States

Buttons don't need full redraws:

1. **Cache static button rendering** to off-screen canvas
2. **On hover** - mark button region dirty, redraw with hover state
3. **On unhover** - mark button region dirty, composite cached version

## Implementation Plan

### Phase 1: Foundation (Low Risk)

**Goal:** Establish dirty region infrastructure without changing rendering behavior

1. Create `DirtyRegionTracker` class
2. Create `LayerCache` class  
3. Create `DirtyDetector` class
4. Add feature flag: `enableDirtyRendering: boolean` in UI settings
5. When flag is false, use current full-redraw approach
6. When flag is true, track dirty regions but still do full redraw (measure overhead)

**Testing:**
- Verify no visual regressions
- Measure dirty region tracking overhead
- Validate dirty regions are detected correctly (debug visualization)

**Files to modify:**
- Create `src/rendering/dirtyRegion.ts` (new)
- Create `src/rendering/layerCache.ts` (new)
- Modify `src/rendering/gameplayRenderer.ts` (add tracking, keep rendering same)

### Phase 2: Layer Caching (Medium Risk)

**Goal:** Cache static layers without changing when we redraw

1. Implement background layer caching (wood texture)
2. Implement board layer caching (hexagon, grid)
3. Hook up cache invalidation to state changes
4. Continue full redraw but composite from cache

**Testing:**
- Verify cached layers match direct rendering
- Test cache invalidation triggers correctly
- Measure memory usage of cached canvases

**Files to modify:**
- `src/rendering/gameplayRenderer.ts` (add caching logic)
- `src/rendering/layerCache.ts` (implement caching)

### Phase 3: Dirty Region Rendering (High Risk)

**Goal:** Actually skip rendering clean regions

1. Implement `renderDirtyRegions()` method
2. Add dirty region merging and optimization
3. Enable selective layer compositing
4. Add debug visualization for dirty regions (setting)

**Testing:**
- Extensive visual regression testing
- Test edge cases (overlapping animations, screen edges)
- Test all interaction scenarios (hover, click, drag)
- Performance benchmarking

**Files to modify:**
- `src/rendering/gameplayRenderer.ts` (implement dirty rendering)
- `src/rendering/dirtyRegion.ts` (add merging logic)

### Phase 4: Optimization & Polish (Low Risk)

**Goal:** Tune for maximum performance

1. Implement flow path caching
2. Optimize button rendering
3. Tune dirty region merge heuristics
4. Add performance metrics/telemetry
5. Make feature default (remove flag after validation)

**Testing:**
- A/B performance comparison
- Test on various device capabilities
- Long-running stability testing

**Files to modify:**
- `src/rendering/gameplayRenderer.ts` (optimizations)
- Add `src/rendering/performanceMonitor.ts` (optional)

## Performance Considerations

### Memory vs Speed Tradeoffs

**Cached Canvases:**
- Each cached layer = full canvas size in memory
- For 1920x1080: ~8MB per layer (4 bytes per pixel)
- 3-4 cached layers = ~30MB additional memory
- **Mitigation:** Only cache layers that are expensive to render
- **Mitigation:** Free caches when not in gameplay mode

**Dirty Region Overhead:**
- Tracking dirty regions has small CPU cost
- Too many small regions can be slower than full redraw
- **Mitigation:** Merge nearby/overlapping regions
- **Mitigation:** Threshold for falling back to full redraw

### Fallback Strategies

**When to Skip Optimization:**
1. Screen transitions (first frame after state change)
2. Dirty area > 60% of canvas
3. More than 20 separate dirty regions
4. During full-screen animations (victory, screen transitions)

**Feature Detection:**
```typescript
// Disable on low-end devices if needed
const enableOptimizations = 
  !state.ui.settings.debugDisableOptimizations &&
  canvasWidth * canvasHeight < 5_000_000 && // Disable on very large displays
  navigator.hardwareConcurrency >= 4;  // Require decent CPU
```

### Measuring Impact

**Metrics to Track:**
```typescript
interface RenderMetrics {
  frameTime: number;           // ms per frame
  pixelsPainted: number;       // pixels painted this frame
  dirtyRegionCount: number;    // number of dirty regions
  cacheHitRate: number;        // % of layers from cache
  fallbackToFullRedraw: boolean;
}
```

**Debug Overlay:**
- Show dirty regions as red rectangles
- Display metrics on screen
- Toggle with debug setting

## Testing Strategy

### Unit Tests

1. **DirtyRegionTracker:**
   - Test region merging logic
   - Test full redraw threshold
   - Test region expansion for anti-aliasing

2. **LayerCache:**
   - Test cache invalidation
   - Test cache hits/misses
   - Test memory cleanup

3. **DirtyDetector:**
   - Test state diff detection
   - Test all state change paths
   - Test animation dirty regions

### Visual Regression Tests

1. **Pixel-perfect comparison:**
   - Render frame with dirty optimization ON
   - Render same frame with optimization OFF
   - Compare pixel-by-pixel (should be identical)

2. **Interaction sequences:**
   - Record sequence of interactions
   - Replay with optimization ON/OFF
   - Compare screenshots at each step

### E2E Tests

1. **Performance tests:**
   - Measure FPS during typical gameplay
   - Measure pixels painted per frame
   - Ensure 60fps maintained

2. **Scenarios to test:**
   - Idle state (no changes) → 0 pixels painted
   - Button hover → only button region painted
   - Tile placement → tile + preview region painted
   - Flow animation → only affected flow paths painted
   - Screen transition → full redraw

### Manual Testing Checklist

- [ ] Tile placement animations look smooth
- [ ] Flow propagation renders correctly
- [ ] Button hovers work on all buttons
- [ ] Dialogs open/close cleanly
- [ ] Screen transitions are smooth
- [ ] Rotations look correct
- [ ] Victory animations work
- [ ] No visual artifacts at region boundaries
- [ ] Works correctly after window resize
- [ ] Multi-player rotation works (board rotation)
- [ ] All debug visualizations work

## Rollout Strategy

### Feature Flag

Start with optimization disabled by default:

```typescript
// In UI state
interface UISettings {
  // ... existing settings
  enableDirtyRendering: boolean;  // Default: false initially
  debugShowDirtyRegions: boolean; // Default: false
  debugDisableOptimizations: boolean; // Emergency kill switch
}
```

### Gradual Enablement

1. **Week 1:** Ship with flag OFF, let users opt-in for testing
2. **Week 2:** Enable for subset of users (A/B test)
3. **Week 3:** Enable for all users if metrics look good
4. **Week 4:** Remove flag, make optimization always-on

### Monitoring

Track metrics:
- Average frame time
- FPS drops below 60
- Memory usage
- User reports of visual glitches

### Rollback Plan

If issues found:
1. Flip feature flag OFF via config (no deployment needed)
2. Investigate issues with debug visualizations
3. Fix and re-enable

## Success Criteria

### Performance Targets

1. **Idle frames:** < 1% of pixels painted (previously 100%)
2. **Typical interaction:** < 20% of pixels painted (previously 100%)
3. **Complex animation:** < 50% of pixels painted (previously 100%)
4. **Frame time:** Maintain < 16ms (60fps) on target devices
5. **Memory overhead:** < 50MB additional memory usage

### Visual Quality

1. **No regressions:** Pixel-perfect match to current rendering
2. **No artifacts:** No tearing, flickering, or edge artifacts
3. **Smooth animations:** All animations maintain 60fps

### Code Quality

1. **Maintainable:** Clear separation of concerns
2. **Testable:** Good unit test coverage of new code
3. **Minimal changes:** Reuse existing rendering code where possible
4. **Feature flagged:** Easy to disable if issues arise

## Risks and Mitigations

### Risk: Visual Artifacts

**Issue:** Clipping regions might cause anti-aliasing artifacts at boundaries

**Mitigation:**
- Expand dirty regions by 2px to include anti-aliasing
- Test extensively with different zoom levels
- Add visual regression tests

### Risk: Complexity Overhead

**Issue:** Dirty tracking adds complexity without performance gain

**Mitigation:**
- Measure overhead in Phase 1 before proceeding
- Fall back to full redraw if overhead > benefit
- Keep feature flag to disable if needed

### Risk: Cache Invalidation Bugs

**Issue:** Stale cache leads to incorrect rendering

**Mitigation:**
- Conservative invalidation (invalidate more rather than less)
- Debug visualization to show cache hits/misses
- Extensive testing of all state changes

### Risk: Memory Issues

**Issue:** Cached canvases use too much memory

**Mitigation:**
- Only cache genuinely static layers
- Free caches when leaving gameplay mode
- Monitor memory usage
- Fallback on low-memory devices

## Alternative Approaches Considered

### 1. WebGL Rendering

**Pros:** Much faster for complex scenes, built-in layer/texture caching

**Cons:** 
- Major rewrite of all rendering code
- Harder to debug and test
- Overkill for relatively simple 2D board game
- No clear benefit over optimized canvas 2D

**Decision:** Rejected - too risky, too much work for unclear benefit

### 2. Multiple Canvas Layers (DOM)

**Pros:** Browser handles compositing, simple layer invalidation

**Cons:**
- DOM overhead for layer management
- Harder to coordinate animations across layers
- Rotation/transformation affects all layers
- More complex hit testing

**Decision:** Rejected - adds complexity without clear performance win

### 3. Tile-Based Invalidation

**Pros:** Natural fit for hexagonal board game

**Cons:**
- Doesn't help with off-board elements (buttons, dialogs)
- Complex tile boundary calculations
- Less flexible for arbitrary animations

**Decision:** Rejected - dirty regions more general and flexible

## Future Enhancements

Once dirty rendering is stable, consider:

1. **Adaptive quality:** Reduce rendering quality during fast animations to maintain framerate
2. **Render scheduling:** Priority queue for dirty regions (render critical regions first)
3. **Background rendering:** Use OffscreenCanvas and workers for non-critical rendering
4. **Smart caching:** Learn which regions update frequently and avoid caching them
5. **Delta rendering:** Only update pixels that actually changed color

## Conclusion

This dirty rendering optimization provides a clear path to dramatically reduce pixels painted per frame while maintaining visual quality. The phased approach minimizes risk and allows validation at each step. The optimization is especially valuable for battery-powered devices and lower-end hardware.

**Key Principles:**
- **Minimal changes:** Build on existing rendering architecture
- **Incremental:** Phase approach allows validation before proceeding
- **Safe:** Feature flag allows easy rollback
- **Measurable:** Clear metrics to validate success
- **Maintainable:** Clean abstractions keep code understandable

The expected performance improvement (50-90% fewer pixels painted) will result in smoother gameplay, better battery life, and support for more complex animations in the future.
