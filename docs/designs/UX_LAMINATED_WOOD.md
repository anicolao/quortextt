# Laminated Cherry Wood Tabletop Background

## Overview

This document describes the implementation of the cherry wood laminated tabletop background for the gameplay screen in Quortex.

## Design Goals

- Create a realistic laminated wood tabletop appearance
- Use the existing `cherry.jpg` asset (1024x932 pixels)
- Apply only to the gameplay screen, not configuration or seating screens
- Maintain good performance through caching

## Implementation

### Algorithm

The laminated wood effect is created by slicing the cherry wood image into horizontal boards:

1. **Create Offscreen Canvas**: An offscreen canvas is created matching the size of the gameplay area
2. **Slice Source Image**: The cherry.jpg image (1024x932px) is divided into 8 horizontal slices
3. **Draw Boards**: Each board is 120 pixels in height and spans the full width of the canvas
4. **Vary Slices**: To create visual variety, boards cycle through the 8 different slices from the source image
5. **Add Seam Lines**: Subtle black lines (15% opacity, 2px width) are drawn between boards to create the laminate effect

### Technical Details

```typescript
// Board configuration
const boardHeight = 120; // Height of each board in pixels
const numBoards = Math.ceil(canvas.height / boardHeight) + 1;

// Source image slicing
const sourceHeight = this.woodImage.height;
const sliceHeight = Math.floor(sourceHeight / 8); // Divide into 8 slices

// For each board
for (let i = 0; i < numBoards; i++) {
  const y = i * boardHeight;
  const sliceIndex = i % 8; // Cycle through slices
  const sourceY = sliceIndex * sliceHeight;
  
  // Draw stretched slice
  ctx.drawImage(
    this.woodImage,
    0, sourceY, sourceWidth, sliceHeight,  // Source
    0, y, canvas.width, boardHeight        // Destination
  );
  
  // Add seam line
  if (i > 0) {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 2;
    // ... draw horizontal line
  }
}
```

### Performance Optimizations

1. **Caching**: The wood background is rendered once to an offscreen canvas and cached
2. **Lazy Loading**: The cherry.jpg image is loaded asynchronously during initialization
3. **Regeneration**: The cached background is only regenerated when:
   - The image finishes loading (transitions from gray fallback to wood)
   - The canvas size changes (e.g., window resize)

### Grain Direction

The boards are oriented horizontally to match the natural grain direction visible in the cherry.jpg source image. This creates a more realistic appearance where the wood grain runs across the width of each board.

## Files Modified

- `src/rendering/gameplayRenderer.ts`: Main implementation
  - Added `woodBackgroundCanvas`, `woodImage`, and `woodImageLoaded` properties
  - Added `loadWoodTexture()` method for async image loading
  - Added `createWoodBackground()` method to generate the laminated effect
  - Modified `renderBackground()` to use the wood texture
  - Modified `updateLayout()` to regenerate on resize

- `src/vite-env.d.ts`: Added TypeScript declarations for image imports

## Visual Result

The gameplay screen now displays a warm cherry wood tabletop with visible horizontal boards and subtle seam lines, creating the appearance of a laminated wood surface. The configuration and seating screens retain their original dark backgrounds.

## Fallback Behavior

If the cherry.jpg image fails to load or is not yet loaded, the background falls back to the original light gray color (`#e8e8e8`) until the image becomes available.
