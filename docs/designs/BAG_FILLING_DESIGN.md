# Bag Filling Design Document

## Overview

This document defines the design for a new **bag fill distribution option** that gives players control over the composition of tiles in the game. Instead of the current fixed distribution of equal quantities of each tile type, players will be able to customize how many of each tile type appears in the bag.

## Current System

The current tile distribution system creates a balanced bag with equal quantities of each tile type:

```typescript
// Current distribution (from gameReducer.ts)
function calculateTileDistribution(boardRadius: number): [number, number, number, number] {
  const totalTiles = getBoardSize(boardRadius);
  const tilesPerType = totalTiles / 4;
  return [tilesPerType, tilesPerType, tilesPerType, tilesPerType];
}
```

For a standard radius-3 board (37 positions), this creates:
- **Distribution: [10, 10, 10, 10]** (rounded up to 40 total tiles)
- 10 NoSharps tiles (Basketball)
- 10 OneSharp tiles (Kimono)
- 10 TwoSharps tiles (Rink)
- 10 ThreeSharps tiles (Sharps)

## Problem Statement

The fixed 1:1:1:1 distribution limits strategic variety. Players should be able to customize the tile mix to:

1. **Create learning scenarios** - Use only NoSharps tiles (1:0:0:0) to simplify the game for beginners
2. **Experiment with strategy** - Try distributions like 2:1:1:1 to favor curved paths over sharp turns
3. **Create variant game modes** - Distributions like 1:0:0:1 for "extremes only" gameplay
4. **Match physical game variants** - Support house rules and tournament formats

## Design Goals

1. **Intuitive UI**: Visual tile representation with simple +/- controls
2. **Flexible Distribution**: Support any ratio of tile types
3. **Automatic Calculation**: System calculates total tiles needed based on distribution ratio
4. **Backward Compatible**: Default distribution remains 1:1:1:1
5. **Persistent Settings**: Save custom distributions in game configuration
6. **Multi-Angle Viewable**: Works on tabletop displays viewed from all angles

## Distribution Mechanics

### Ratio-Based Filling

The distribution is specified as a **ratio** of tile types: `[NoSharps, OneSharp, TwoSharps, ThreeSharps]`

**Algorithm:**
1. Sum the ratio values to get the **group size**: `groupSize = sum(distribution)`
2. Calculate how many complete groups are needed: `numGroups = ceil(boardSize / groupSize)`
3. Total tiles in bag: `totalTiles = numGroups × groupSize`
4. Tiles of each type: `tilesPerType[i] = distribution[i] × numGroups`

### Examples

#### Example 1: Default Distribution (1,1,1,1)
- Board size: 37 positions
- Group size: 1 + 1 + 1 + 1 = 4
- Groups needed: ceil(37 / 4) = 10
- Total tiles: 10 × 4 = 40
- **Distribution: [10, 10, 10, 10]** ✅ Same as current

#### Example 2: NoSharps Only (1,0,0,0)
- Board size: 37 positions
- Group size: 1 + 0 + 0 + 0 = 1
- Groups needed: ceil(37 / 1) = 37
- Total tiles: 37 × 1 = 37
- **Distribution: [37, 0, 0, 0]** - Exact board size

#### Example 3: Extremes Only (1,0,0,1)
- Board size: 37 positions
- Group size: 1 + 0 + 0 + 1 = 2
- Groups needed: ceil(37 / 2) = 19
- Total tiles: 19 × 2 = 38
- **Distribution: [19, 0, 0, 19]** - Half NoSharps, half ThreeSharps

#### Example 4: Weighted Curves (2,1,1,1)
- Board size: 37 positions
- Group size: 2 + 1 + 1 + 1 = 5
- Groups needed: ceil(37 / 5) = 8
- Total tiles: 8 × 5 = 40
- **Distribution: [16, 8, 8, 8]** - Double the curved tiles

#### Example 5: All Sharp Turns (0,0,0,1)
- Board size: 37 positions
- Group size: 0 + 0 + 0 + 1 = 1
- Groups needed: ceil(37 / 1) = 37
- Total tiles: 37 × 1 = 37
- **Distribution: [0, 0, 0, 37]** - Only ThreeSharps tiles

### Edge Case: All Zeros

If all ratio values are 0, default to [1, 1, 1, 1] to prevent empty bag.

## UI Design Specification

### Location

The tile distribution settings appear in the **lobby/configuration screen**, below the player setup section.

### Visual Layout

```
┌─────────────────────────────────────┐
│     Tile Distribution Settings      │
├─────────────────────────────────────┤
│                                     │
│  [Tile Image]  [Tile Image]  [...] │
│  NoSharps      OneSharp     [...]  │
│                                     │
│     [-]  1  [+]                    │
│          ↑                          │
│     Counter for each tile type      │
│                                     │
│  Total: 40 tiles (10 groups)        │
│                                     │
│  [Reset to Default]                 │
│                                     │
└─────────────────────────────────────┘
```

### Component Breakdown

#### Tile Type Displays

For each of the 4 tile types, display:

1. **Tile Image**
   - Render a sample tile of each type in canonical orientation
   - Size: 60-80px hexagon
   - Show flow patterns clearly
   - Use same rendering as gameplay tiles

2. **Tile Name** (optional, may be icons only for multi-angle viewing)
   - "NoSharps" / "Basketball" (0 sharp corners)
   - "OneSharp" / "Kimono" (1 sharp corner)
   - "TwoSharps" / "Rink" (2 sharp corners)
   - "ThreeSharps" / "Sharps" (3 sharp corners)

3. **Counter Controls**
   - **Minus Button (-)**: Decrease ratio count (minimum 0)
   - **Number Display**: Current ratio value (0-9+)
   - **Plus Button (+)**: Increase ratio count (maximum 99)

#### Counter Control Specifications

**Button Appearance:**
- Shape: Circular buttons
- Size: 44px diameter (comfortable touch target)
- Colors:
  - Minus: Red/orange (#E57373)
  - Plus: Green/blue (#81C784)
  - Background: Consistent with lobby theme
- Icon: Large, clear "−" and "+" symbols

**Number Display:**
- Font: Large, bold (24-30px)
- Color: High contrast (white on dark, or dark on light)
- Width: Fixed to prevent layout shifts (3 digits max)

**Interaction:**
- Tap/click to increment/decrement
- Visual feedback: Scale down to 0.95 on press (100ms)
- Sound effect (optional): Click/beep on press
- Disable minus button when value is 0 (dimmed appearance)

#### Information Display

**Total Tiles Indicator:**
- Shows: "Total: {X} tiles ({Y} groups)"
  - X = total tiles that will be in bag
  - Y = number of complete distribution groups
- Updates live as distribution changes
- Position: Below the tile counters, centered

**Example:**
```
Total: 40 tiles (10 groups)
Distribution: 10 NoSharps, 10 OneSharp, 10 TwoSharps, 10 ThreeSharps
```

#### Reset Button

**"Reset to Default" Button:**
- Resets distribution to [1, 1, 1, 1]
- Position: Bottom of the settings section
- Style: Secondary button (not as prominent as "Start Game")
- Confirmation: None needed (non-destructive action)

### Layout Variations

#### Horizontal Layout (Default)

All four tile types in a horizontal row:

```
[NoSharps]  [OneSharp]  [TwoSharps]  [ThreeSharps]
   [-] 1 [+]   [-] 1 [+]    [-] 1 [+]     [-] 1 [+]
```

**Advantages:**
- Compact
- Aligns with typical left-to-right reading
- Good for landscape displays

#### Vertical Layout (Narrow Screens)

Stack tile controls vertically on narrow screens:

```
[NoSharps]
[-] 1 [+]

[OneSharp]
[-] 1 [+]

[TwoSharps]
[-] 1 [+]

[ThreeSharps]
[-] 1 [+]
```

#### Grid Layout (Tabletop)

For tabletop displays with multi-angle viewing, use 2×2 grid with rotated labels:

```
[NoSharps]    [OneSharp]
[-] 1 [+]     [-] 1 [+]

[TwoSharps]   [ThreeSharps]
[-] 1 [+]     [-] 1 [+]
```

Each quadrant rotated for viewing from that angle (0°, 90°, 180°, 270°).

## Rendering Specification

### Tile Preview Rendering

Use the existing tile rendering system to display sample tiles:

```typescript
// Pseudo-code for rendering tile previews
function renderTileDistributionUI(ctx: CanvasRenderingContext2D, state: UIState) {
  const tileTypes = [TileType.NoSharps, TileType.OneSharp, TileType.TwoSharps, TileType.ThreeSharps];
  
  for (let i = 0; i < tileTypes.length; i++) {
    const tileType = tileTypes[i];
    const x = baseX + i * spacing;
    const y = baseY;
    
    // Render tile preview
    renderTilePreview(ctx, tileType, Rotation.R0, x, y, previewSize);
    
    // Render counter controls
    renderCounter(ctx, state.tileDistribution[i], x, y + controlsOffset);
  }
  
  // Render total tiles info
  renderTotalInfo(ctx, calculateTotalTiles(state.tileDistribution, boardSize));
}
```

### Animation

**Smooth Updates:**
- Number transitions: Fade out old value, fade in new value (150ms)
- Total tiles update: Pulse effect when distribution changes (200ms)
- Button press: Scale animation (100ms)

**Visual Feedback:**
- Highlight the entire tile distribution section when values change
- Show calculated distribution expanding from group size (optional animation)

## State Management

### Redux State Changes

#### UIState Extension

Add to `UIState` (in `redux/types.ts`):

```typescript
interface UIState {
  // ... existing fields ...
  
  // Tile distribution settings
  tileDistribution: [number, number, number, number]; // [NoSharps, OneSharp, TwoSharps, ThreeSharps]
}
```

**Initial State:**

```typescript
const initialUIState: UIState = {
  // ... existing fields ...
  tileDistribution: [1, 1, 1, 1], // Default balanced distribution
};
```

#### New Actions

Add to `actions.ts`:

```typescript
// Update tile distribution ratio
export const SET_TILE_DISTRIBUTION = 'SET_TILE_DISTRIBUTION';

export interface SetTileDistributionAction {
  type: typeof SET_TILE_DISTRIBUTION;
  payload: {
    distribution: [number, number, number, number];
  };
}

// Set individual tile type ratio
export const SET_TILE_TYPE_RATIO = 'SET_TILE_TYPE_RATIO';

export interface SetTileTypeRatioAction {
  type: typeof SET_TILE_TYPE_RATIO;
  payload: {
    tileType: TileType;
    ratio: number; // 0-99
  };
}

// Reset distribution to default
export const RESET_TILE_DISTRIBUTION = 'RESET_TILE_DISTRIBUTION';

export interface ResetTileDistributionAction {
  type: typeof RESET_TILE_DISTRIBUTION;
}

// Action creators
export function setTileDistribution(
  distribution: [number, number, number, number]
): SetTileDistributionAction {
  return {
    type: SET_TILE_DISTRIBUTION,
    payload: { distribution },
  };
}

export function setTileTypeRatio(
  tileType: TileType,
  ratio: number
): SetTileTypeRatioAction {
  return {
    type: SET_TILE_TYPE_RATIO,
    payload: { tileType, ratio },
  };
}

export function resetTileDistribution(): ResetTileDistributionAction {
  return {
    type: RESET_TILE_DISTRIBUTION,
  };
}
```

#### Reducer Updates

Update `uiReducer.ts`:

```typescript
case SET_TILE_DISTRIBUTION: {
  const { distribution } = action.payload;
  
  // Validate distribution (all values 0-99)
  const validated = distribution.map(v => Math.max(0, Math.min(99, v))) as [number, number, number, number];
  
  return {
    ...state,
    tileDistribution: validated,
  };
}

case SET_TILE_TYPE_RATIO: {
  const { tileType, ratio } = action.payload;
  
  // Validate ratio
  const validatedRatio = Math.max(0, Math.min(99, ratio));
  
  // Update specific tile type in distribution
  const newDistribution = [...state.tileDistribution] as [number, number, number, number];
  newDistribution[tileType] = validatedRatio;
  
  return {
    ...state,
    tileDistribution: newDistribution,
  };
}

case RESET_TILE_DISTRIBUTION: {
  return {
    ...state,
    tileDistribution: [1, 1, 1, 1],
  };
}
```

### Game Initialization

Update `gameReducer.ts` to use the custom distribution:

```typescript
case START_GAME: {
  // ... existing code ...
  
  return {
    ...state,
    // Use tileDistribution from UI state instead of calculated distribution
    availableTiles: createShuffledDeck(
      state.boardRadius, 
      seed, 
      uiState.tileDistribution // Pass custom distribution
    ),
    // ... rest of state ...
  };
}
```

**Note:** This requires access to `UIState` in the game reducer. Consider using a selector or passing the distribution as part of the `START_GAME` action payload.

### Selectors

Add to `selectors.ts`:

```typescript
/**
 * Get the current tile distribution ratio
 */
export const selectTileDistribution = (state: RootState): [number, number, number, number] => {
  return state.ui.tileDistribution;
};

/**
 * Calculate total tiles that will be in the bag based on distribution
 */
export const selectCalculatedTileCounts = createSelector(
  [selectTileDistribution, (state: RootState) => state.game.boardRadius],
  (distribution, boardRadius): { totalTiles: number; numGroups: number; distribution: [number, number, number, number] } => {
    const boardSize = getBoardSize(boardRadius);
    const groupSize = distribution.reduce((sum, count) => sum + count, 0);
    
    // Handle all-zeros case
    if (groupSize === 0) {
      const defaultDist: [number, number, number, number] = [1, 1, 1, 1];
      const defaultGroupSize = 4;
      const numGroups = Math.ceil(boardSize / defaultGroupSize);
      return {
        totalTiles: numGroups * defaultGroupSize,
        numGroups,
        distribution: [numGroups, numGroups, numGroups, numGroups],
      };
    }
    
    const numGroups = Math.ceil(boardSize / groupSize);
    const actualDistribution: [number, number, number, number] = [
      distribution[0] * numGroups,
      distribution[1] * numGroups,
      distribution[2] * numGroups,
      distribution[3] * numGroups,
    ];
    
    return {
      totalTiles: numGroups * groupSize,
      numGroups,
      distribution: actualDistribution,
    };
  }
);
```

## Input Handling

### Touch/Click Events

Add to lobby renderer's input handler:

```typescript
function handleLobbyInput(x: number, y: number, state: RootState, dispatch: Dispatch): void {
  // ... existing lobby input handling ...
  
  // Check for tile distribution controls
  for (let tileType = 0; tileType < 4; tileType++) {
    const minusButton = getTileMinusButtonBounds(tileType);
    const plusButton = getTilePlusButtonBounds(tileType);
    
    if (isPointInBounds(x, y, minusButton)) {
      const currentRatio = state.ui.tileDistribution[tileType];
      if (currentRatio > 0) {
        dispatch(setTileTypeRatio(tileType, currentRatio - 1));
      }
      return;
    }
    
    if (isPointInBounds(x, y, plusButton)) {
      const currentRatio = state.ui.tileDistribution[tileType];
      if (currentRatio < 99) {
        dispatch(setTileTypeRatio(tileType, currentRatio + 1));
      }
      return;
    }
  }
  
  // Check for reset button
  const resetButton = getResetButtonBounds();
  if (isPointInBounds(x, y, resetButton)) {
    dispatch(resetTileDistribution());
    return;
  }
}
```

### Keyboard Shortcuts (Optional)

For desktop users:

- **Number keys 1-4**: Select tile type to modify
- **Arrow Up/Down**: Increase/decrease selected tile type ratio
- **R**: Reset to default distribution

## Implementation Plan

### Phase 1: UI State Management
1. Add `tileDistribution` to `UIState`
2. Implement actions and action creators
3. Update `uiReducer` to handle distribution changes
4. Add selectors for distribution and calculated totals
5. Write unit tests for reducer and selectors

### Phase 2: Rendering
1. Design tile preview rendering in lobby
2. Implement counter controls rendering
3. Add total tiles information display
4. Implement reset button
5. Add animations for value changes
6. Test rendering on different screen sizes

### Phase 3: Input Handling
1. Implement tap/click detection for +/- buttons
2. Add reset button interaction
3. Implement visual feedback for button presses
4. Add optional keyboard shortcuts
5. Test touch interaction on mobile/tablet

### Phase 4: Integration
1. Update `START_GAME` action to accept distribution
2. Modify `createShuffledDeck` usage to apply custom distribution
3. Ensure distribution is applied correctly
4. Test with various distributions
5. Verify backward compatibility (default behavior unchanged)

### Phase 5: Polish & Testing
1. Add animations and transitions
2. Implement sound effects (optional)
3. Write E2E tests for distribution UI
4. Test full game flow with custom distributions
5. Add visual regression tests
6. Update documentation

## Testing Requirements

### Unit Tests

1. **Reducer Tests**
   - `SET_TILE_DISTRIBUTION` updates state correctly
   - `SET_TILE_TYPE_RATIO` updates single tile type
   - `RESET_TILE_DISTRIBUTION` resets to [1,1,1,1]
   - Values are clamped to 0-99 range
   - Invalid inputs are handled gracefully

2. **Selector Tests**
   - `selectTileDistribution` returns current distribution
   - `selectCalculatedTileCounts` calculates correct totals
   - Edge cases: all zeros, single type, large ratios
   - Board size variations (radius 2, 3, 4, etc.)

3. **Calculation Tests**
   - Verify examples from this document
   - Test group size calculation
   - Test numGroups calculation
   - Test final distribution calculation
   - Edge case: distribution [0,0,0,0] defaults to [1,1,1,1]

### Integration Tests

1. **Distribution Application**
   - Custom distribution creates correct tile deck
   - Shuffled deck has correct quantities
   - Game uses custom tiles throughout
   - Multiple games with different distributions

2. **State Persistence**
   - Distribution settings persist during lobby
   - Distribution resets properly between games
   - UI reflects current distribution accurately

### E2E Tests

1. **UI Interaction**
   - Click +/- buttons updates values
   - Reset button restores default
   - Values cannot go below 0 or above 99
   - Total tiles updates correctly

2. **Full Game Flow**
   - Configure distribution → Start game → Verify tiles
   - Test with distribution [1,0,0,0] (only NoSharps)
   - Test with distribution [0,0,0,1] (only ThreeSharps)
   - Test with distribution [2,1,1,1] (weighted)
   - Complete game with custom distribution

3. **Visual Tests**
   - Screenshot tile distribution UI
   - Verify tile previews render correctly
   - Test on different screen sizes
   - Test multi-angle layout (if implemented)

## Edge Cases and Error Handling

### All Zeros Distribution

**Scenario:** User sets all ratios to 0
**Handling:** Automatically default to [1,1,1,1] with visual indicator

```typescript
if (groupSize === 0) {
  // Show warning message: "At least one tile type required. Using default distribution."
  distribution = [1, 1, 1, 1];
}
```

### Very Large Ratios

**Scenario:** User sets ratio like [99, 99, 99, 99]
**Handling:** 
- Clamp maximum ratio to 99 per tile type
- May result in very large bag (e.g., 400+ tiles for radius 3 board)
- Show warning if total tiles > 1000

### Very Small Group Size

**Scenario:** Distribution [1,0,0,0] with large board
**Handling:** Works correctly - bag will have exact board size tiles

### Mid-Game Changes

**Scenario:** User tries to change distribution during active game
**Handling:** Distribution controls are only available in lobby, disabled during gameplay

### Network Multiplayer (Future)

**Scenario:** Host sets distribution, clients need to see it
**Handling:** Distribution is part of game configuration, synced to all clients before game starts

## Accessibility Considerations

### Color Independence

- Don't rely solely on tile colors to distinguish types
- Use flow patterns as primary visual indicator
- Counter values provide non-visual differentiation

### Touch Target Size

- All buttons meet minimum 44px touch target size
- Adequate spacing between adjacent controls (8px minimum)
- Clear visual separation between +/- buttons

### Screen Reader Support (Future)

- Add ARIA labels to buttons
- Announce ratio changes
- Provide text description of current distribution

### Keyboard Navigation (Future)

- Tab through tile type controls
- Space/Enter to activate buttons
- Arrow keys to adjust values

## Visual Design Examples

### Example 1: Default Distribution

```
  [🔷]        [🔶]        [🔹]        [◇]
NoSharps    OneSharp    TwoSharps   ThreeSharps

  [-] 1 [+]   [-] 1 [+]   [-] 1 [+]   [-] 1 [+]

Total: 40 tiles (10 groups)
Distribution: 10 of each type

[Reset to Default]
```

### Example 2: Curves Only

```
  [🔷]        [🔶]        [🔹]        [◇]
NoSharps    OneSharp    TwoSharps   ThreeSharps

  [-] 1 [+]   [-] 0 [+]   [-] 0 [+]   [-] 0 [+]
       ↑          ↑          ↑          ↑
   Active      Disabled   Disabled   Disabled
   (value>0)   (value=0)  (value=0)  (value=0)

Total: 37 tiles (37 groups)
Distribution: 37 NoSharps, 0 OneSharp, 0 TwoSharps, 0 ThreeSharps

[Reset to Default]
```

### Example 3: Weighted Distribution

```
  [🔷]        [🔶]        [🔹]        [◇]
NoSharps    OneSharp    TwoSharps   ThreeSharps

  [-] 2 [+]   [-] 1 [+]   [-] 1 [+]   [-] 1 [+]

Total: 40 tiles (8 groups)
Distribution: 16 NoSharps, 8 OneSharp, 8 TwoSharps, 8 ThreeSharps

[Reset to Default]
```

## Future Enhancements

### Preset Distributions

Add quick-select buttons for common distributions:
- **Balanced**: [1, 1, 1, 1]
- **Beginner**: [1, 0, 0, 0] (NoSharps only)
- **Extreme**: [1, 0, 0, 1] (NoSharps and ThreeSharps)
- **Weighted Curves**: [2, 1, 1, 1]
- **Advanced**: [0, 0, 0, 1] (ThreeSharps only)

```
┌─────────────────────────────────┐
│ Quick Presets:                  │
│ [Balanced] [Beginner] [Extreme] │
│ [Custom...]                     │
└─────────────────────────────────┘
```

### Distribution Validation

Show warnings for potentially problematic distributions:
- **Very few tiles**: "Only 37 tiles - game may end quickly"
- **Very many tiles**: "400+ tiles - game may be very long"
- **Single type**: "Only one tile type - limited strategy"

### Advanced Mode

Add toggle for percentage-based distribution instead of ratios:
- Input exact percentages instead of ratios
- Show percentage breakdown in real-time
- Useful for precise tournament configurations

### Save/Load Custom Distributions

Allow players to save and name custom distributions:
- "My Balanced Curves" → [3, 2, 1, 1]
- "Sharp Challenge" → [0, 1, 1, 2]
- Store in browser localStorage
- Export/import as JSON for sharing

### Distribution Statistics

Show expected gameplay characteristics:
- Average flow path complexity
- Estimated game length
- Difficulty rating
- Strategic insights

Example:
```
Distribution: [2, 1, 1, 1]
────────────────────────────
Complexity:    ███████░░░ 7/10
Expected Length: Medium-Long
Strategy Tips: More curved paths available
```

### Tournament Mode

Official tournament distributions with locked settings:
- Predefined balanced distributions
- Cannot be modified
- Verified fair play
- Recorded in game history

### Tile Count Display During Game

Show remaining tiles of each type during gameplay:
- Small indicator near current player
- Updates as tiles are drawn
- Helps with strategic planning

## Related Documentation

- **[DESIGN_DOC.md](DESIGN_DOC.md)** - Core architecture and tile system
- **[UI_DESIGN.md](UI_DESIGN.md)** - UI specifications and interaction patterns
- **[LOBBY_UX_REDESIGN.md](LOBBY_UX_REDESIGN.md)** - Lobby screen design
- **[../RULES.md](../RULES.md)** - Game rules and tile mechanics

## Summary

The bag filling distribution option adds significant strategic depth and flexibility to Quortex while maintaining the game's core mechanics. The design prioritizes:

1. **Intuitive Control**: Visual tile previews with simple +/- controls
2. **Clear Feedback**: Live calculation of total tiles and distribution
3. **Flexibility**: Support for any distribution ratio from 0 to 99 per tile type
4. **Consistency**: Matches existing lobby UI patterns and multi-angle design
5. **Correctness**: Proper ratio-based calculation ensures correct tile quantities

This feature enables learning scenarios, strategic experimentation, and variant gameplay while remaining true to the game's touch-first, board-focused design philosophy.

## Implementation Checklist

- [ ] Add `tileDistribution` to `UIState`
- [ ] Create new Redux actions for distribution control
- [ ] Update `uiReducer` with distribution handlers
- [ ] Add selectors for distribution and calculations
- [ ] Design and implement tile preview rendering
- [ ] Implement counter controls (+/- buttons)
- [ ] Add total tiles information display
- [ ] Implement reset button
- [ ] Add input handling for button clicks
- [ ] Update `START_GAME` to use custom distribution
- [ ] Add animations for value changes
- [ ] Write unit tests for reducers and selectors
- [ ] Write integration tests for distribution application
- [ ] Write E2E tests for UI interaction
- [ ] Add visual regression tests
- [ ] Update user documentation
- [ ] Test on multiple screen sizes
- [ ] Test multi-angle viewing (tabletop mode)
- [ ] Performance testing with large distributions
