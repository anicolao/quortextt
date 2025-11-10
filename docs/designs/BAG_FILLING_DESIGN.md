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
6. **Integrated Settings**: Part of existing settings dialog, consistent with other options

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

The tile distribution settings appear in the **Settings dialog** accessed from the lobby/configuration screen. This is the same dialog that contains Board Radius, Supermove, and Debug options.

### Settings Dialog Layout

The settings dialog has a maximum width of 500px and height of 650px. The tile distribution section will be added to this existing dialog.

### Visual Layout (Horizontal Only)

```
┌──────────────────────────────────────────────┐
│              Settings                        │
├──────────────────────────────────────────────┤
│ Board Radius:              [-]  3  [+]       │
│ Supermove                           [✓]      │
│                                              │
│ Tile Distribution:                           │
│                                              │
│  [🔷]    [🔶]    [🔹]    [◇]                │
│  [-] 1 [+] [-] 1 [+] [-] 1 [+] [-] 1 [+]     │
│                                              │
│  Total: 40 tiles (10 groups)                 │
│  [Reset to Default]                          │
│                                              │
│ Debug Options                                │
│ ...                                          │
│                                              │
│              [Close]                         │
└──────────────────────────────────────────────┘
```

### Component Breakdown

#### Tile Type Displays

For each of the 4 tile types, display in a horizontal row:

1. **Tile Image**
   - Render a small sample tile of each type in canonical orientation
   - Size: 30-35px hexagon (small to fit dialog width)
   - Show flow patterns clearly at reduced size
   - Use same rendering as gameplay tiles

2. **Counter Controls** (directly beneath each tile)
   - Reuse existing `renderNumberControl()` method from settings dialog
   - **Minus Button (-)**: Decrease ratio count (minimum 0)
   - **Number Display**: Current ratio value (0-99)
   - **Plus Button (+)**: Increase ratio count (maximum 99)

#### Counter Control Specifications

**Reuse Existing Design:**
The settings dialog already has a number control pattern used for "Board Radius" and "Animation Slowdown". This same control will be used for tile distribution ratios.

**Button Appearance:**
- Shape: Rectangular buttons (30px width × 30px height)
- Colors:
  - Background: #555555 (enabled), #333333 (disabled)
  - Text: #ffffff (enabled), #666666 (disabled)
  - Border: #ffffff, 1px
- Icon: Bold "−" and "+" symbols (20px font)

**Number Display:**
- Background: #1a1a2e (dark blue-gray)
- Border: #ffffff, 1px
- Size: 40px width × 30px height
- Font: 18px sans-serif, white
- Centered text

**Interaction:**
- Tap/click to increment/decrement
- Visual feedback: Consistent with existing number controls
- Disable minus button when value is 0 (dimmed appearance: #333333 background, #666666 text)

#### Information Display

**Total Tiles Indicator:**
- Shows: "Total: {X} tiles ({Y} groups)"
  - X = total tiles that will be in bag
  - Y = number of complete distribution groups
- Updates live as distribution changes
- Position: Below the tile counters, centered
- Font: 18px sans-serif, white

**Example:**
```
Total: 40 tiles (10 groups)
```

#### Reset Button

**"Reset to Default" Button:**
- Resets distribution to [1, 1, 1, 1]
- Position: Below the total tiles indicator
- Style: Small secondary button (similar to other dialog buttons)
- Size: 150px width × 30px height
- Confirmation: None needed (non-destructive action)

### Layout Constraints

**Horizontal Layout Only:**
All four tile types must be displayed in a horizontal row to fit within the 500px dialog width. The layout is:

```
Spacing calculation (for 500px dialog with 30px margins = 440px content):
4 tiles × 35px = 140px
4 controls × 100px = 400px (includes minus, value, plus, spacing)
Total: ~540px - Needs tight spacing within dialog
```

**Optimized Layout:**
- Tiles: 30px hexagons with 5px spacing between = 140px
- Controls: 95px each (25px minus + 40px value + 25px plus + 5px spacing) × 4 = 380px
- Total with margins: fits within 440px content width

## Rendering Specification

### Tile Preview Rendering

The tile distribution section will be added to the existing settings dialog renderer in `lobbyRenderer.ts`. The implementation will reuse existing rendering methods:

```typescript
// Added to renderSettingsDialog() method in lobbyRenderer.ts
private renderSettingsDialog(...) {
  // ... existing settings ...
  
  // Tile Distribution section
  contentY += 10;
  this.ctx.font = "bold 20px sans-serif";
  this.ctx.fillText("Tile Distribution", contentX, contentY);
  contentY += lineHeight;
  
  this.ctx.font = "18px sans-serif";
  
  // Render tile previews in horizontal row
  const tileTypes = [TileType.NoSharps, TileType.OneSharp, TileType.TwoSharps, TileType.ThreeSharps];
  const tileSize = 30; // Small hexagon size
  const controlSpacing = 95; // Space for each control set
  const startX = contentX + 20;
  
  for (let i = 0; i < tileTypes.length; i++) {
    const x = startX + i * controlSpacing;
    const tileY = contentY;
    
    // Render small tile preview
    this.renderSmallTile(ctx, tileTypes[i], x, tileY, tileSize);
    
    // Render number control beneath tile (reuse existing method)
    const controlY = tileY + tileSize + 10;
    this.renderNumberControl(x, controlY, settings.tileDistribution[i], 0, 99);
    
    // Add controls to clickable areas
    controls.push({
      type: 'number',
      x: x - 25,
      y: controlY,
      width: 30,
      height: 30,
      settingKey: 'tileDistribution',
      tileIndex: i, // Which tile type this controls
      label: '-',
    });
    controls.push({
      type: 'number',
      x: x + 40,
      y: controlY,
      width: 30,
      height: 30,
      settingKey: 'tileDistribution',
      tileIndex: i,
      label: '+',
    });
  }
  
  contentY += 80; // Space for tiles + controls
  
  // Total tiles display
  const totalInfo = calculateTotalTiles(settings.tileDistribution, settings.boardRadius);
  this.ctx.fillText(`Total: ${totalInfo.totalTiles} tiles (${totalInfo.numGroups} groups)`, contentX, contentY);
  contentY += lineHeight;
  
  // Reset button
  const resetButtonWidth = 150;
  const resetButtonHeight = 30;
  const resetButtonX = contentX + (dialogWidth - 60 - resetButtonWidth) / 2;
  this.renderButton(resetButtonX, contentY, resetButtonWidth, resetButtonHeight, "Reset to Default");
  controls.push({
    type: 'reset-distribution',
    x: resetButtonX,
    y: contentY,
    width: resetButtonWidth,
    height: resetButtonHeight,
  });
  contentY += lineHeight;
  
  // ... continue with debug options ...
}

// New helper method for small tile rendering
private renderSmallTile(
  ctx: CanvasRenderingContext2D,
  tileType: TileType,
  x: number,
  y: number,
  size: number
): void {
  // Render a small hexagonal tile with flow patterns
  // Reuse existing tile rendering logic but scaled down
  // ... implementation ...
}
```

### Animation

**Minimal Animation:**
- No special animations for tile distribution controls
- Reuse existing button interaction feedback from settings dialog
- Number display updates immediately on click

**Visual Feedback:**
- Consistent with existing settings controls
- Button color changes on click (existing behavior)
- Total tiles recalculates and updates immediately

## State Management

### Redux State Changes

#### GameSettings Extension

Add to `GameSettings` interface (in `redux/types.ts`):

```typescript
export interface GameSettings {
  boardRadius: number;
  supermove: boolean;
  debugShowEdgeLabels: boolean;
  debugShowVictoryEdges: boolean;
  debugLegalityTest: boolean;
  debugAnimationSlowdown: number;
  debugAIScoring: boolean;
  
  // NEW: Tile distribution settings
  tileDistribution: [number, number, number, number]; // [NoSharps, OneSharp, TwoSharps, ThreeSharps]
}
```

**Initial State (in `uiReducer.ts`):**

```typescript
const initialUIState: UIState = {
  // ... existing fields ...
  settings: {
    boardRadius: 3,
    supermove: true,
    debugShowEdgeLabels: false,
    debugShowVictoryEdges: false,
    debugLegalityTest: false,
    debugAnimationSlowdown: 1,
    debugAIScoring: false,
    tileDistribution: [1, 1, 1, 1], // Default balanced distribution
  },
};
```

#### Settings Actions

The existing `UPDATE_SETTING` action will be extended to handle tile distribution:

```typescript
// Existing action in actions.ts
export const UPDATE_SETTING = 'UPDATE_SETTING';

export interface UpdateSettingAction {
  type: typeof UPDATE_SETTING;
  payload: {
    key: keyof GameSettings;
    value: any;
  };
}

// For tile distribution, use specialized handling:
export interface UpdateTileDistributionAction {
  type: typeof UPDATE_SETTING;
  payload: {
    key: 'tileDistribution';
    value: [number, number, number, number];
    tileIndex?: number; // Optional: which tile type to update (0-3)
    delta?: number;     // Optional: +1 or -1 for increment/decrement
  };
}
```

#### Reducer Updates

Update `uiReducer.ts` to handle tile distribution within the existing `UPDATE_SETTING` case:

```typescript
case UPDATE_SETTING: {
  const { key, value, tileIndex, delta } = action.payload;
  
  // Special handling for tileDistribution
  if (key === 'tileDistribution') {
    let newDistribution: [number, number, number, number];
    
    if (tileIndex !== undefined && delta !== undefined) {
      // Increment/decrement a specific tile type
      newDistribution = [...state.settings.tileDistribution] as [number, number, number, number];
      const newValue = newDistribution[tileIndex] + delta;
      newDistribution[tileIndex] = Math.max(0, Math.min(99, newValue));
    } else if (Array.isArray(value)) {
      // Set entire distribution
      newDistribution = value.map(v => Math.max(0, Math.min(99, v))) as [number, number, number, number];
    } else {
      // Invalid, return state unchanged
      return state;
    }
    
    return {
      ...state,
      settings: {
        ...state.settings,
        tileDistribution: newDistribution,
      },
    };
  }
  
  // Existing logic for other settings
  return {
    ...state,
    settings: {
      ...state.settings,
      [key]: value,
    },
  };
}
```

#### Reset Distribution Action

Add a new action for resetting distribution to default:

```typescript
// In actions.ts
export const RESET_TILE_DISTRIBUTION = 'RESET_TILE_DISTRIBUTION';

export interface ResetTileDistributionAction {
  type: typeof RESET_TILE_DISTRIBUTION;
}

export function resetTileDistribution(): ResetTileDistributionAction {
  return { type: RESET_TILE_DISTRIBUTION };
}

// In uiReducer.ts
case RESET_TILE_DISTRIBUTION: {
  return {
    ...state,
    settings: {
      ...state.settings,
      tileDistribution: [1, 1, 1, 1],
    },
  };
}
}
```

### Game Initialization

Update `gameReducer.ts` to use the custom distribution from settings:

```typescript
case START_GAME: {
  // ... existing code ...
  
  return {
    ...state,
    // Use tileDistribution from settings
    availableTiles: createShuffledDeck(
      state.boardRadius, 
      seed, 
      settings.tileDistribution // Pass custom distribution from settings
    ),
    // ... rest of state ...
  };
}
```

**Note:** The `START_GAME` action should include the settings in its payload, or the reducer should access settings from the UI state.

### Selectors

Add to `selectors.ts`:

```typescript
/**
 * Get the current tile distribution ratio from settings
 */
export const selectTileDistribution = (state: RootState): [number, number, number, number] => {
  return state.ui.settings.tileDistribution;
};

/**
 * Calculate total tiles that will be in the bag based on distribution
 */
export const selectCalculatedTileCounts = createSelector(
  [selectTileDistribution, (state: RootState) => state.ui.settings.boardRadius],
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

### Settings Dialog Input

The settings dialog input handler already exists in the lobby input system. The tile distribution controls will be integrated into the existing settings dialog control handling:

```typescript
// In lobby input handler (existing pattern)
function handleSettingsInput(x: number, y: number, state: RootState, dispatch: Dispatch): void {
  if (!state.ui.settingsDialog) return;
  
  const { controls } = state.ui.settingsDialog;
  
  for (const control of controls) {
    if (!isPointInBounds(x, y, control)) continue;
    
    if (control.type === 'number') {
      // Handle +/- buttons for tile distribution
      if (control.settingKey === 'tileDistribution' && control.tileIndex !== undefined) {
        const delta = control.label === '+' ? 1 : -1;
        dispatch(updateSetting('tileDistribution', null, control.tileIndex, delta));
        return;
      }
      
      // Handle other number controls (boardRadius, animationSlowdown)
      // ... existing logic ...
    }
    
    if (control.type === 'reset-distribution') {
      dispatch(resetTileDistribution());
      return;
    }
    
    // ... other control types ...
  }
}
```

**No Keyboard Shortcuts:**
Settings dialog is touch/mouse only, consistent with the rest of the game.

## Implementation Plan

### Phase 1: State Management
1. Add `tileDistribution` to `GameSettings` interface
2. Update initial settings state with default [1, 1, 1, 1]
3. Extend `UPDATE_SETTING` action to handle tile distribution
4. Add `RESET_TILE_DISTRIBUTION` action
5. Update `uiReducer` to handle distribution changes
6. Add selectors for distribution and calculated totals
7. Write unit tests for reducer and selectors

### Phase 2: Rendering
1. Add tile distribution section to `renderSettingsDialog()` in `lobbyRenderer.ts`
2. Implement small tile preview rendering (30px hexagons)
3. Reuse `renderNumberControl()` for +/- controls
4. Add total tiles information display
5. Implement reset button rendering
6. Update `SettingsDialogLayout` type to include distribution controls
7. Test rendering at 500px dialog width

### Phase 3: Input Handling
1. Extend settings dialog control handling for distribution controls
2. Handle +/- button clicks with tileIndex and delta
3. Handle reset button click
4. Test interaction with existing settings controls
5. Verify no conflicts with other dialog elements

### Phase 4: Integration
1. Update `START_GAME` action to pass distribution from settings
2. Ensure `createShuffledDeck` receives custom distribution
3. Test with various distributions (examples from this doc)
4. Verify backward compatibility (default [1,1,1,1] unchanged)
5. Test dialog height adjustment if needed

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

- Button size: 30px × 30px (meets minimum for settings dialog)
- Adequate spacing between adjacent controls
- Consistent with existing settings dialog controls

### Settings Dialog Consistency

- Matches existing settings dialog patterns
- Same visual style as other number controls
- Familiar interaction model for users

## Visual Design Examples

### Example 1: Default Distribution (in Settings Dialog)

```
┌──────────────────────────────────────────────┐
│              Settings                        │
├──────────────────────────────────────────────┤
│ Board Radius:              [-]  3  [+]       │
│ Supermove                           [✓]      │
│                                              │
│ Tile Distribution:                           │
│                                              │
│  [🔷]   [🔶]   [🔹]   [◇]                    │
│ [-] 1 [+] [-] 1 [+] [-] 1 [+] [-] 1 [+]      │
│                                              │
│  Total: 40 tiles (10 groups)                 │
│  [Reset to Default]                          │
│                                              │
│ Debug Options                                │
│ ...                                          │
└──────────────────────────────────────────────┘
```

### Example 2: NoSharps Only

```
│ Tile Distribution:                           │
│                                              │
│  [🔷]   [🔶]   [🔹]   [◇]                    │
│ [-] 1 [+] [-] 0 [+] [-] 0 [+] [-] 0 [+]      │
│                                              │
│  Total: 37 tiles (37 groups)                 │
```

### Example 3: Weighted Distribution

```
│ Tile Distribution:                           │
│                                              │
│  [🔷]   [🔶]   [🔹]   [◇]                    │
│ [-] 2 [+] [-] 1 [+] [-] 1 [+] [-] 1 [+]      │
│                                              │
│  Total: 40 tiles (8 groups)                  │
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

1. **Settings Integration**: Tile distribution is part of the existing settings dialog, not a separate UI
2. **Horizontal Layout**: Compact horizontal arrangement fits within 500px dialog width
3. **Small Tile Previews**: 30px hexagons clearly show tile types without overwhelming the dialog
4. **Reused Controls**: Uses existing `renderNumberControl()` method for consistency
5. **Clear Feedback**: Live calculation of total tiles and distribution groups
6. **Flexibility**: Support for any distribution ratio from 0 to 99 per tile type
7. **Correctness**: Proper ratio-based calculation ensures correct tile quantities

This feature enables learning scenarios, strategic experimentation, and variant gameplay while remaining fully integrated with the existing settings system.

## Implementation Checklist

- [ ] Add `tileDistribution` to `GameSettings` interface
- [ ] Update initial settings state with [1, 1, 1, 1]
- [ ] Extend `UPDATE_SETTING` action for tile distribution
- [ ] Add `RESET_TILE_DISTRIBUTION` action
- [ ] Update `uiReducer` with distribution handlers
- [ ] Add selectors for distribution and calculations
- [ ] Add tile distribution section to `renderSettingsDialog()`
- [ ] Implement small tile preview rendering (30px hexagons)
- [ ] Reuse `renderNumberControl()` for +/- buttons
- [ ] Add total tiles information display
- [ ] Implement reset button
- [ ] Extend settings input handling for distribution controls
- [ ] Update `START_GAME` to use custom distribution from settings
- [ ] Write unit tests for reducers and selectors
- [ ] Write integration tests for distribution application
- [ ] Write E2E tests for settings dialog interaction
- [ ] Verify dialog height accommodates new section
- [ ] Test with various distributions (examples from doc)
- [ ] Performance testing with large distributions
