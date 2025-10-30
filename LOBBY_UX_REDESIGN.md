# Lobby UX Redesign

## Overview

This document defines the redesigned user experience for the game lobby - the phase where players choose to join the game. The redesign addresses critical usability issues with the current vertical-oriented interface and introduces a multi-directional, edge-based design optimized for tabletop displays.

## Design Goals

1. **Fast Interaction from Any Edge**: Players seated at any edge of the table can quickly join without reaching across
2. **Upright Interface for Each Player**: Each player views their controls in the correct orientation
3. **Simpler Color Selection**: Streamlined interaction model eliminates complex color picker UI
4. **Landscape Optimization**: Design fits within typical landscape tablet orientations without vertical scrolling

## Current Design Issues

The existing lobby UI has several problems:

- **Single Orientation**: Displayed upright only for one player (center of table)
- **Height Problems**: Often too tall for landscape orientation
- **Awkward Reach**: Players must reach across table to interact
- **Complex Color Picker**: Requires multiple interactions to change color
- **Difficult Removal**: Remove button not always easily accessible

## New Design Specification

### Layout Overview

The new lobby uses a radial, edge-based layout with + buttons at each edge for player addition, a central START button, corner X buttons for exit, and player lists displayed at all four edges rotated appropriately.

### Edge-Based Player Addition (+ Buttons)

**Location**: Each edge of the display (top, right, bottom, left)

**Visual Design**:
- Circular buttons with a **+** symbol
- One button for each available player color
- Colors drawn from the standard palette:
  - Blue (#0173B2)
  - Orange (#DE8F05)
  - Green (#029E73)
  - Yellow (#ECE133)
  - Purple (#CC78BC)
  - Red (#CA5127)
- Button size: Large enough for easy touch targeting (minimum 60x60 pixels)
- Arranged in a row along each edge
- Rotated to face outward toward that edge (0°, 90°, 180°, 270°)

**Interaction**:
1. Player taps a + button in their desired color
2. Player is immediately added to the game in that color
3. The button for that color disappears from all edges (color is now taken)
4. A new player entry animates into the player list at that edge

**States**:
- **Available**: Color not yet chosen, button visible and enabled
- **Taken**: Color already chosen by another player, button hidden
- **All Positions Full**: All 6 players joined, no + buttons visible

### Center Start Button

**Location**: Center of the display

**Visual Design**:
- Large circular button
- Symbol: **▶** (play/start triangle) or **⬤** (filled circle) with forward arrow
- Non-directional design (looks the same from all angles)
- Size: Prominent but not obstructive (approximately 100x100 pixels minimum)
- Color: Distinct from player colors (e.g., white or neutral gray)

**Interaction**:
- Tap to start the game
- Initiates transition from lobby to gameplay phase

**States**:
- **Disabled**: No players have joined yet
  - Visual: Greyed out or low opacity (30-40%)
  - No interaction response
- **Enabled**: At least one player has joined
  - Visual: Full opacity, possibly with subtle pulse animation
  - Tap starts the game

### Corner Exit Buttons (X)

**Location**: All four corners of the display

**Visual Design**:
- Same X button design used in gameplay
- Clear, recognizable X or ✕ symbol
- Size: 50x50 pixels minimum
- Same orientation and positioning as current gameplay screen

**Interaction**:
- In lobby: Close/exit the application or return to main menu
- In gameplay: Return to lobby screen (replacing current behavior)

**Behavior**:
- Consistent across both lobby and gameplay screens
- May show confirmation dialog for in-progress games

### Player Lists (Four Orientations)

**Location**: Along each edge, between the + buttons and the board center

**Visual Design**:
- Vertical list of player entries
- Each list rotated to face its respective edge:
  - Bottom edge: 0° (upright for bottom players)
  - Right edge: 90° clockwise (upright for right players)  
  - Top edge: 180° (upright for top players)
  - Left edge: 270° clockwise (upright for left players)
- Slim, compact design to fit in landscape orientation

**Player Entry Format**:
Each entry shows:
- Player number or identifier (e.g., "P1", "P2", or just a number)
- Color indicator (filled circle or square in player's color)
- Remove button (X) positioned consistently within the entry
- Minimal text to maintain multi-angle readability

**List Behavior**:
- Initially empty
- Players appear in the list for their edge when they join
- List can show players from all edges (each edge shows all players)
- Optional: Highlight or emphasize players who joined from this edge

### Player Addition Interaction Flow

**Sequence**:
1. Player approaches table edge
2. Player identifies available colors from + buttons at their edge
3. Player taps preferred color button
4. **Animation**: Player entry "slides up" from button position into the player list
   - Duration: 300-500ms
   - Easing: Ease-out for natural deceleration
   - Path: Straight vertical slide (relative to edge orientation)
5. Player list adjusts layout to accommodate new entry
6. + button for chosen color disappears from all edges
7. If this is the first player, center START button enables

**Animation Details**:
- New player entry fades in at button location (opacity 0 → 1, 100ms)
- Entry scales from small to full size (scale 0.5 → 1.0, 200ms)
- Entry slides from button position to its place in list (300-400ms)
- Other list entries smoothly shift to make room if needed
- Smooth, continuous motion creates clear cause-and-effect relationship

### Color Selection Workflow

**Simplified Model**:
- No color picker interface
- Color selection implicit in + button choice
- One interaction selects color and joins game

**Changing Colors** (If Needed):
1. Player taps remove (X) button on their player entry
2. Player entry animates out and disappears
3. That color's + buttons reappear at all edges
4. Player taps + button in new desired color
5. New entry appears with new color

**Rationale**:
- Reduces interaction complexity (1 tap vs. 3+ taps)
- Eliminates need for color picker UI component
- Color decision made upfront, not after joining
- Removal/re-addition workflow is simple and discoverable

### Player Removal

**Interaction**:
- Each player entry has an X button
- Tap to remove that player from the game
- X button positioned consistently within each entry

**Animation**:
- Player entry fades out and scales down (200-300ms)
- List smoothly collapses to fill the gap
- That color's + buttons reappear at all edges
- If last player removed, START button disables

**Accessibility**:
- Any player can remove any other player (trust-based, suitable for tabletop play)

## Technical Considerations

### Rotation and Layout

**Four Orientations**:
- All UI elements rendered in four rotations: 0°, 90°, 180°, 270°
- Canvas transformations used to rotate content
- Touch/click coordinates transformed to match rotated content
- Each player sees their edge's controls as "upright"

**Coordinate Mapping**:
- Input events (touches/clicks) mapped to rotated coordinate spaces
- Each edge has its own coordinate system for hit testing
- Center button uses radial hit testing (same from all angles)

### Layout Calculations

**Edge Regions**:
- Display divided into four edge regions (top, right, bottom, left)
- Each region allocated space for:
  - + buttons row
  - Player list area
  - Margin for visual separation

**Responsive Sizing**:
- Minimum display size: 800x600 pixels
- Button sizes scale with display size
- Player list entry height adapts to available space
- Center button size proportional to display dimensions

**Portrait vs. Landscape**:
- Primary target: Landscape orientation (wider than tall)
- Design accommodates portrait mode with adjusted proportions
- + buttons may stack or wrap if needed in portrait

### Animation System

**Requirements**:
- Smooth, 60fps animations
- Coordinated timing between fade, scale, and position animations
- Interruptible animations (if player taps rapidly)
- No animation blocking (UI remains responsive)

**Implementation Approach**:
- Canvas-based animations using requestAnimationFrame
- Frame-count based timing: animations specified as integer frame counts
- Animation timer counts down from totalFrames to 0
- Generate floating point time value `t` calculated as: `t = (totalFrames - currentFrame) / (1.0 * totalFrames)`
- Time value `t` starts at 0 and progresses to 1.0 over the animation duration
- Use `t` to drive animation calculations (e.g., ease-out position interpolation)
- Update Redux state at start of requestAnimationFrame, redraw shows outcome naturally
- Generic, reusable animation framework applicable across entire application

### State Management

**Lobby State**:
```typescript
interface LobbyState {
  players: LobbyPlayer[];  // Joined players
  availableColors: Color[];  // Colors not yet chosen
  startEnabled: boolean;  // Whether START button is enabled
}

interface LobbyPlayer {
  id: string;
  color: Color;
  edge: Edge;  // Which edge they joined from (0-3)
  timestamp: number;  // Join time for ordering
}

type Edge = 0 | 1 | 2 | 3;  // Bottom, Right, Top, Left
```

**Redux Actions**:
- `ADD_PLAYER`: Add player with color and edge
- `REMOVE_PLAYER`: Remove player by ID
- `START_GAME`: Transition from lobby to gameplay

### Accessibility

**Color Blindness**:
- Use color-blind friendly palette (already established)
- Colors distinguishable by hue differences
- Optional: Add patterns or icons in addition to colors

**Touch Targets**:
- Minimum size: 60x60 pixels for + buttons
- Minimum size: 50x50 pixels for X buttons
- Adequate spacing between adjacent buttons (min 10-20px)

**Visual Feedback**:
- Button press visual feedback (scale, color change)
- Clear indication of disabled state (START button)
- Smooth animations provide action feedback

**No Text Dependency**:
- Symbols and icons used for all controls
- Player identification by color and position
- Numbers used minimally (player count, if needed)

## User Experience Flow

### Initial State
- Empty lobby
- + buttons visible in all available colors at all edges
- Player lists empty
- START button disabled and greyed out
- X buttons in corners

### Player Joins
1. Player taps + button in desired color
2. Button disappears from all edges
3. Player entry animates into view at that edge
4. Player appears in all four player lists (rotated appropriately)
5. If first player: START button enables

### Multiple Players Join
- Process repeats for each player
- Available colors decrease
- Player lists grow
- Maximum 6 players

### Player Changes Mind
1. Player taps X on their entry
2. Entry animates out and disappears
3. Color's + buttons reappear
4. Player taps new color's + button
5. New entry appears in new color

### Game Starts
1. Any player taps enabled START button
2. Lobby transitions to gameplay screen
3. Player order determined (by join order or edge order)
4. Game begins with first player's turn

### Exiting Lobby
1. Player taps X in any corner
2. Confirmation dialog appears (if needed)
3. Application exits or returns to main menu

## Comparison with Current Design

| Aspect | Current Design | New Design |
|--------|---------------|------------|
| **Orientation** | Single (vertical, center) | Four (one per edge) |
| **Player Addition** | "Add Player" button → color picker | Direct color selection with + buttons |
| **Color Selection** | Multi-step (add → pick → confirm) | Single tap (implicit in join) |
| **Color Changes** | Edit color picker | Remove → re-add in new color |
| **Layout** | Vertical list (can be too tall) | Edge-based (fits landscape) |
| **Reach** | All players reach to center | Each player uses nearby controls |
| **Start Button** | In vertical list | Center of display |
| **Exit** | (Not specified) | X buttons in all corners |
| **Interactions** | Multiple steps per action | Single tap per action |

## Benefits of New Design

1. **Ergonomic**: Players interact with controls directly in front of them
2. **Fast**: Single tap to join, single tap to start
3. **Scalable**: Works for 1-6 players without UI overflow
4. **Intuitive**: Visual + buttons clearly indicate available colors
5. **Symmetric**: Fair and equal access for all players regardless of seating
6. **Landscape-Friendly**: Fits within typical tablet aspect ratios
7. **Animation-Rich**: Clear feedback for all actions
8. **Consistent**: X buttons work same way in lobby and gameplay

## Implementation Phases

### Phase 1: Core Layout
- Render + buttons at all four edges
- Render center START button
- Render corner X buttons
- Implement rotation for four orientations

### Phase 2: Player Addition
- Handle + button taps
- Add player to state
- Update available colors
- Show/hide + buttons based on availability
- Enable/disable START button

### Phase 3: Player Lists
- Render player entries at each edge
- Rotate lists appropriately
- Update lists when players join/leave
- Style player entries (color, number, X button)

### Phase 4: Animations
- Slide-in animation for player addition
- Fade-out animation for player removal
- List reflow animations
- Button state transitions

### Phase 5: Game Start & Exit
- START button initiates gameplay
- X buttons trigger exit/return actions
- Transition animations between screens

### Phase 6: Polish & Testing
- Fine-tune animation timings
- Test on actual tabletop hardware
- Optimize performance
- E2E tests for all workflows

---

**This design provides a modern, accessible, and ergonomic lobby experience optimized for tabletop multi-player gaming.**
