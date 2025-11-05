# UI Design Specification - Phase 3 & 4

This document provides detailed UI specifications for Phase 3 (Rendering System) and Phase 4 (Input & Interaction) of the Quortex/Flows web implementation.

## Target Platforms

### Primary Target: Tabletop Touch Screen
- **Device Type:** Large tabletop touch screen with players seated around all edges
- **Viewing:** Players view from all angles (0°, 90°, 180°, 270°)
- **Primary Interaction:** Tapping only - no dragging required
- **Design Constraints:**
  - No text (icons and visual indicators only)
  - Large, legible icons viewable from any angle
  - No UI bars that obscure the board
  - Game elements rotated to face each player's edge

### Secondary Target: Desktop Browser
- **Device Type:** Desktop/laptop with mouse
- **Primary Interaction:** Mouse clicks (same as taps)
- **Enhanced Features:** 
  - Tile preview tracks mouse pointer
  - Mouse wheel rotation (configurable scroll steps per 60° rotation)
  - "Snap in" behavior: tile snaps to hex after 3s hover, snaps out if moved near edge

## Phase 3: Rendering System - Detailed Specifications

### 3.1 Canvas Layout and Coordinate System

#### Screen Layout
The canvas uses a simple, board-focused layout:

```
┌────────────────────────────────────────┐
│ X                                    X │ ← Exit buttons in corners
│                                        │
│                                        │
│         Hexagonal Game Board           │
│         (fills most of screen)         │
│    Player tiles appear by edges        │
│                                        │
│                                        │
│ X                                    X │
└────────────────────────────────────────┘
```

**Key Features:**
- No top or bottom bars
- Board fills almost entire screen
- Small margin around board edge for player tile previews
- Exit buttons (X) in each corner to trigger exit game dialog
- Light canvas background color
- Board itself drawn as black hexagon with colored edges for player ownership

#### Hexagon Layout Parameters

**Coordinate System:**
- Use axial coordinates (row, col) internally
- Convert to pixel coordinates using pointy-top hexagon layout
- Origin (0,0) at board center hex

**Hex Sizing:**
- Calculate hex radius based on available screen space
- Formula: `hexRadius = min(width, height) / (2 * maxBoardDimension + padding)`
- Where `maxBoardDimension = 5` (for the 37-hex diamond layout)
- `padding = 3` to allow space for player tile previews outside board
- Board should bleed almost to edge but leave space for tile previews

**Board Border:**
- Draw larger hexagon around board representing board edges
- Border is black by default
- Each edge that is owned by a player is filled with that player's color
- This creates a colored border on owned edges

### 3.2 Rendering Layers

Render in this order (back to front):

#### Layer 1: Background
- Fill canvas with light background color (e.g., #e8e8e8 or similar)
- This represents the "table" surface

#### Layer 2: Board Hexagon and Edges
- Draw the board as a larger black hexagon
- For each of the 6 edges:
  - If edge is owned by a player: fill that edge segment with player's color
  - If edge is unowned: leave it black
- This creates a colored border indicating player ownership

#### Layer 3: Placed Tiles
For each placed tile on the board:
- Fill hex with tile background color (dark gray/black #2a2a2a)
- Draw flow paths using Bézier curves:
  - **Path rendering:** Use stroke width to create channel effect
  - **Path color:** Player's color who owns that flow
  - **Bézier control points:** Perpendicular to hex edges for smooth tile-to-tile connections
  - **Control point distance:** Place control points at hex edge midpoints, extending perpendicular into hex interior
  - **Multiple flows:** Draw each flow path separately if multiple players' flows pass through tile
  - **Path width:** Approximately 15-20% of hex radius
- Add subtle tile border (#444444, 1px)

**Bézier Curve Specification:**
For a flow connecting two opposite hex edges (e.g., edge A to edge B):
1. Start point: Midpoint of edge A
2. End point: Midpoint of edge B
3. Control point 1: Start point + (perpendicular to edge A × distance)
4. Control point 2: End point + (perpendicular to edge B × distance)
5. Distance: ~30% of hex radius
6. This creates smooth curves that align perfectly when tiles are adjacent

All tile types (including "sharps") use Bézier curves with this system.

#### Layer 4: Current Tile Preview
- Draw current player's tile by their board edge, outside the board area
- Position: Adjacent to player's colored edge, on the "table" surface
- If tile is placed on board (being previewed in a hex position):
  - Show tile at that hex position with 70% opacity
  - If legal placement: normal rendering
  - If illegal placement: add red border (3px width)
  - Checkmark button appears to right of placed tile
  - X button appears to left of placed tile
- Tile can be rotated by tapping (see interaction section)
- Optional: Light grey arrow hints on left/right of tile to indicate tap targets for rotation

#### Layer 5: Action Buttons (when tile is placed)
When a tile is placed on the board:
- **Checkmark button (✓):** Overlaid on board area to right of previewed tile
  - Large, clear checkmark icon
  - Enabled when placement is legal (normal color)
  - Disabled when placement is illegal (greyed out)
- **X button (✗):** Overlaid on board area to left of previewed tile
  - Large, clear X icon
  - Always enabled (allows picking up tile to move it)

#### Layer 6: Exit Buttons
- Small X buttons in each corner of screen
- Rotated to face respective edges (0°, 90°, 180°, 270°)
- Tapping triggers exit game confirmation dialog

### 3.3 Visual Feedback & Animations

#### Tile Placement Animation (200-400ms)
1. Fade in: Tile appears with opacity 0→1 (100ms)
2. Scale: Tile scales from 0.8→1.0 (200ms, ease-out)
3. Flow propagation: If flows extend, animate the flow paths
   - Highlight *existing* flow segments with pulse animation first (200ms)
   - Then animate new flow paths progressively from source (200ms)
   - Use a "wave" effect moving along the path

#### Flow Update Animation
When a new tile extends a flow:
- Pulse existing segments before extending (200ms bright pulse)
- Flow into new tiles progressively (200ms)
- Fade to normal flow color (200ms)

#### Rotation Animation (450ms)
When rotating current tile:
- Smooth rotation over 450ms
- Use ease-in-out easing
- No rotation direction indicator needed

#### Victory Animation
- Highlight winning flow path with pulsing glow
- Display victory modal overlay in each corner:
  - One modal per corner, rotated to face that edge
  - 0° (bottom), 90° (right), 180° (top), 270° (left)
  - Position to avoid overlapping board where possible
  - Semi-transparent background (#00000099)
  - Victory icon/indicator (no text)
  - "New Game" and "View Board" icon buttons

#### Constraint Victory Display
- Highlight unplaceable tile with red border by its board edge
- Show victory modal (as above)
- No text explanations needed

#### Button Feedback
- On press: Slight scale (0.95), 100ms
- Use icons only, no text labels

### 3.4 Color Palette

**Player Colors (from configuration screen):**
- Player 1: #ff4444 (Red)
- Player 2: #4444ff (Blue)  
- Player 3: #44ff44 (Green)
- Player 4: #ffff44 (Yellow)
- Player 5: #ff44ff (Magenta)
- Player 6: #44ffff (Cyan)

These colors are already selected to be colorblind-friendly. No additional colorblind mode needed.

**UI Colors:**
- Canvas background: #e8e8e8 (Light gray - the "table")
- Board hexagon: #000000 (Black)
- Player edge borders: Player's color
- Tile background: #2a2a2a (Dark gray)
- Tile border: #444444 (Slightly lighter gray)
- Illegal placement border: #ff0000 (Red, 3px)
- Button icons: #ffffff (White) on semi-transparent background

**Accessibility:**
- All player colors have sufficient contrast against dark tile backgrounds
- Large, clear icons viewable from any angle
- No reliance on text

### 3.5 Responsive Design

**Single Layout:**
- Board-focused design works at all screen sizes
- Minimum screen size: 800x600 pixels
- Maximum: Full screen on large tabletop displays
- Board scales proportionally to fill screen
- Player tile previews scale with board

**Touch Targets:**
- Minimum: 60x60 pixels for all interactive elements
- Exit buttons: 50x50 pixels in corners
- Checkmark/X buttons: 80x80 pixels when visible
- Tile itself: Full hex size for rotation taps

## Phase 4: Input & Interaction - Detailed Specifications

### 4.1 Touch Screen Interaction (Primary)

All gameplay achieved with tapping only. No dragging required.

#### Touch Gesture: Tap on Hex Position
**Purpose:** Place tile at selected position

**Behavior:**
1. User taps on a hex position on the board
2. Tile moves from edge position to that hex (animated)
3. Tile preview appears at that position with 70% opacity
4. Checkmark (✓) button appears to right of tile
5. X button appears to left of tile
6. If placement is illegal:
   - Tile shown with red border (3px)
   - Checkmark button is disabled/greyed out
   - User can still rotate tile or move to different position
7. Tapping same hex again rotates the tile (see below)

**Visual Feedback:**
- Tile preview: 70% opacity at selected position
- Red border if illegal
- Action buttons appear immediately

#### Touch Gesture: Tap on Tile to Rotate
**Purpose:** Rotate the current tile

**Interaction:**
- Tap on left side of tile: Rotate counter-clockwise (60°)
- Tap on right side of tile: Rotate clockwise (60°)
- Works whether tile is in hand (by edge) or placed on board
- Optional: Light grey arrow hints on left/right sides of tile

**Behavior:**
1. User taps left or right side of tile
2. Tile rotates immediately (animated 350ms)
3. If tile is on board, legality re-evaluated
4. Checkmark button enabled/disabled based on new legality
5. No limit on rotations

**Visual Feedback:**
- Smooth 350ms rotation animation
- Tile rotates in place
- Red border appears/disappears based on legality

#### Touch Gesture: Tap Checkmark Button
**Purpose:** Confirm tile placement

**Conditions to Enable:**
- Tile must be placed on a hex
- Placement must be legal
- It's the current player's turn

**Behavior:**
1. User taps checkmark (✓) button
2. Tile is committed with animation
3. Flows update automatically with animation
4. Checkmark and X buttons disappear
5. Turn advances to next player (or game ends)
6. Next player's tile appears by their edge

**Visual Feedback:**
- Button press animation (scale 0.95, 100ms)
- Tile placement animation
- Flow update animations
- New tile appears by next player's edge

#### Touch Gesture: Tap X Button
**Purpose:** Pick up tile and return to hand

**Behavior:**
1. User taps X button
2. Tile moves back to player's edge position (animated)
3. Checkmark and X buttons disappear
4. User can now place tile elsewhere or rotate

#### Touch Gesture: Tap Exit Button (X in corner)
**Purpose:** Exit game

**Behavior:**
1. User taps X button in any corner
2. Confirmation dialog appears (with icons, no text)
3. User confirms or cancels

### 4.2 Mouse/Desktop Interaction (Secondary)

Enhanced experience for desktop users while maintaining same core interactions.

#### Mouse Action: Tile Tracks Mouse Pointer
**Purpose:** Show preview without manual placement

**Behavior:**
1. Current player's tile follows mouse pointer
2. Tile centers on mouse cursor location
3. If mouse hovers over a hex for 3 seconds:
   - Tile "snaps in" to that hex (slow 600ms animation)
   - Checkmark and X buttons appear
   - Legality evaluated
4. If mouse moves to within 10% of hex edge after snap:
   - Tile "snaps out" to follow cursor again (fast 200ms animation)
   - Buttons disappear
5. User can click to immediately snap tile to hex under cursor

**Visual Feedback:**
- Tile follows cursor smoothly
- Snap-in: slow 600ms fade/move
- Snap-out: fast 200ms
- Normal tap behaviors apply once snapped

#### Mouse Action: Click on Tile to Rotate
**Same as touch tap behavior**

#### Mouse Action: Mouse Wheel Rotation
**Purpose:** Alternative rotation method

**Behavior:**
- Scroll up: Rotate clockwise
- Scroll down: Rotate counter-clockwise
- N scroll steps = 1 rotation of 60° (N is configurable in code)
- Works anywhere when player has active tile

**Visual Feedback:**
- Same 350ms rotation animation

### 4.3 Game Flow Interactions

#### During Gameplay

**Turn Indication:**
- Current player's tile appears by their board edge
- That's the only indicator needed (no text notification)

**Turn Sequence (from user perspective):**
1. Player's tile appears by their edge
2. Player rotates tile (optional, by tapping on tile)
3. Player taps hex position to place
4. Checkmark and X buttons appear
5. Player taps checkmark to confirm (or X to move, or rotates more)
6. Tile places with animation
7. Flows update with animation
8. Next player's tile appears by their edge

#### Game End Interaction

**Victory Screen:**
1. Winning flow animates (glowing path)
2. Modal overlay appears in each corner:
   - Positioned in 4 corners
   - Each rotated to face its edge (0°, 90°, 180°, 270°)
   - Victory icon (no text)
   - "New Game" icon button
   - "View Board" icon button (dismisses modal)
   - Positioned to minimize board overlap where possible

**Constraint Victory:**
- Unplaceable tile highlighted in red by its edge
- Same victory modals appear

### 4.4 Error Handling & User Feedback

#### Illegal Move Attempt
**Trigger:** User places tile illegally

**Feedback:**
1. Tile preview shows with red border
2. Checkmark button disabled/greyed
3. User can rotate to fix or move to new position
4. Optional: Show X icon over blocked player's color on preview

**No text messages or notifications**

### 4.5 Accessibility Features

**Visual Accessibility:**
- Colors already chosen with colorblind users in mind
- Large icons viewable from all angles
- High contrast between board elements
- No text dependency

## E2E Test Specifications

### Test Suite 1: Rendering Tests

#### Test 1.1: Board Initial Render
**Verify:**
- Canvas initializes with correct dimensions
- Light background color rendered
- Board hexagon drawn in black
- Player edge borders drawn in player colors
- 37 hex positions calculated correctly
- Exit buttons in each corner
- All UI elements present and positioned correctly

**Assertions:**
- Canvas element exists and has non-zero dimensions
- All expected rendering layers present
- Color palette matches specification
- Exit buttons rotated to face edges

#### Test 1.2: Tile Rendering
**Setup:** Place a tile on the board via Redux action

**Verify:**
- Tile appears at correct position
- Flow paths drawn using Bézier curves
- Curves connect smoothly between tiles
- Tile has correct rotation
- Tile border visible
- Player color used for flows

**Test each tile type:**
- NoSharps (Basketball)
- OneSharp (Kimono)
- TwoSharps (Rink)
- ThreeSharps (Sharps)

**Test each rotation:** 0-5

#### Test 1.3: Flow Rendering
**Setup:** Place multiple tiles creating a flow

**Verify:**
- Flow paths drawn in player color
- Paths connect smoothly across tiles
- Bézier curves align at tile boundaries
- Multiple flows on same tile render correctly
- Flow color matches owning player

#### Test 1.4: Animation Rendering
**Verify:**
- Tile placement animation completes (200-400ms)
- Flow update animation: existing segments pulse first
- Rotation animation (450ms) smooth
- Victory animation displays in all corners
- Button press animations (100ms scale)

**Use:** Visual regression testing (screenshot comparison)

#### Test 1.5: Tile Preview Positioning
**Test scenarios:**
- Tile appears by player's edge when turn starts
- Tile moves to hex on tap
- Checkmark and X buttons appear correctly
- Red border on illegal placement
- Buttons positioned relative to placed tile

### Test Suite 2: Touch Interaction Tests

#### Test 2.1: Tap on Hex to Place
**Actions:**
1. Start game with 2 players
2. Tap on a valid hex position
3. Verify tile moves to that position
4. Verify checkmark and X buttons appear

**Assertions:**
- Tile position updates
- Visual preview at hex
- Buttons rendered and positioned correctly
- Legality evaluated

#### Test 2.2: Tap on Tile to Rotate
**Actions:**
1. Start game
2. Tap right side of tile
3. Verify clockwise rotation
4. Tap left side of tile
5. Verify counter-clockwise rotation

**Assertions:**
- Rotation updates (0→1→2→3→4→5→0)
- 350ms animation plays
- Works both in hand and on board
- Legality re-evaluated after rotation

#### Test 2.3: Tap Checkmark to Confirm
**Actions:**
1. Start game
2. Place tile at valid position
3. Tap checkmark button
4. Verify tile commits

**Assertions:**
- Tile committed to board
- Turn advances to next player
- New tile appears by next player's edge
- Buttons disappear
- Placement animation plays

#### Test 2.4: Tap X to Pick Up Tile
**Actions:**
1. Place tile on board
2. Tap X button
3. Verify tile returns to edge

**Assertions:**
- Tile moves back to player's edge
- Buttons disappear
- Can place again elsewhere

#### Test 2.5: Illegal Placement Handling
**Actions:**
1. Set up board state where position is illegal
2. Tap illegal position
3. Verify red border appears
4. Verify checkmark disabled

**Assertions:**
- Red border rendered (3px)
- Checkmark button greyed out
- X button still enabled
- Can rotate or move to fix

### Test Suite 3: Mouse Interaction Tests

#### Test 3.1: Mouse Tracking
**Actions:**
1. Start game
2. Move mouse around board
3. Verify tile follows cursor

**Assertions:**
- Tile centers on cursor
- Moves smoothly
- No lag or jitter

#### Test 3.2: Snap In/Out Behavior
**Actions:**
1. Hover over hex for 3+ seconds
2. Verify snap-in animation (600ms)
3. Move cursor to edge
4. Verify snap-out animation (200ms)

**Assertions:**
- Snap-in after 3s dwell
- 600ms smooth animation
- Buttons appear after snap
- Snap-out at 10% edge proximity
- 200ms fast animation

#### Test 3.3: Mouse Wheel Rotation
**Actions:**
1. Start game
2. Scroll mouse wheel up/down
3. Verify rotation

**Assertions:**
- N scroll steps = 60° rotation (N configurable)
- Rotation animation plays
- Works with tile in any state

#### Test 3.4: Click to Place
**Actions:**
1. Click on hex
2. Verify immediate snap (no 3s wait)

**Assertions:**
- Tile snaps immediately
- Buttons appear
- Same as tap behavior

### Test Suite 4: Game Flow Tests

#### Test 4.1: Full Game Playthrough
**Actions:**
1. Configure 2-player game  
2. Start game
3. Place tiles alternating turns
4. Continue until victory

**Assertions:**
- Game progresses correctly
- Turn indication (tile by edge) works
- No errors occur
- Victory detected correctly
- Victory modals in all corners

#### Test 4.2: Victory by Flow
**Setup:** Create board state near victory

**Actions:**
1. Place final tile to connect edges
2. Verify victory detected

**Assertions:**
- Victory check runs
- Correct winner identified
- Flow connection highlighted
- Victory modals appear in corners
- Modals rotated to face edges

#### Test 4.3: Victory by Constraint
**Setup:** Create board state where next tile cannot be placed

**Actions:**
1. Verify constraint detected
2. Verify correct winner

**Assertions:**
- Constraint check runs
- Last player wins
- Unplaceable tile shown in red by edge
- Victory modals appear

#### Test 4.4: Multi-Player Game
**Test with:**
- 3 players
- 4 players (teams)
- 6 players (teams)

**Assertions:**
- Turn order correct (tiles appear by correct edges)
- Team formation correct
- Victory conditions work for teams
- All players' flows tracked and colored correctly

### Test Suite 5: UI State Tests

#### Test 5.1: Exit Dialog
**Actions:**
1. Tap X in corner
2. Verify confirmation dialog
3. Test confirm and cancel

**Assertions:**
- Dialog appears
- Icon-based (no text)
- Confirm exits game
- Cancel returns to game

#### Test 5.2: Victory Modal Positioning
**Actions:**
1. Trigger victory
2. Check all 4 corner modals

**Assertions:**
- Modal in each corner
- Rotations: 0°, 90°, 180°, 270°
- Positioned to minimize board overlap
- Icon buttons work

### Test Suite 6: Error & Edge Cases

#### Test 6.1: Rapid Tapping
**Actions:**
1. Rapidly tap hex positions
2. Rapidly tap rotation areas
3. Verify state remains consistent

**Assertions:**
- No race conditions
- No duplicate actions
- State updates correctly
- Animations don't break

#### Test 6.2: Resize During Game
**Actions:**
1. Start game mid-play
2. Resize window multiple times
3. Continue playing

**Assertions:**
- Layout adapts
- Board scales correctly
- Tile previews reposition
- Game state preserved
- No visual glitches

#### Test 6.3: Mouse and Touch Mixed
**Actions:**
1. Use mouse for some actions
2. Use touch for others
3. Verify consistent behavior

**Assertions:**
- Both input methods work
- No conflicts
- State consistent

### Test Execution Strategy

**Unit Tests:**
- Run on every commit
- Cover all game logic functions
- Mock rendering and input
- **Target: 100% line coverage**

**Integration Tests:**
- Run before merge
- Test Redux integration
- Test render pipeline

**E2E Tests:**
- Run on PR and before release
- Use Playwright for automation
- Test on multiple browsers (Chrome, Firefox, Safari)
- Test on multiple screen sizes
- Visual regression with screenshot comparison

**Manual Testing:**
- Test on actual tabletop touch screens
- Test viewing from all angles
- Performance testing on target hardware
- Usability testing with real players

### Test Coverage Goals

- **Unit Tests: 100% line coverage** (repository standard)
- **Integration Tests:** All critical paths
- **E2E Tests:** All user workflows
- **Visual Tests:** Key screens at multiple sizes

---

## Implementation Notes

### Phase 3 Priorities
1. Canvas setup with light background
2. Board hexagon with colored edges
3. Hex position rendering
4. Tile rendering with Bézier flow paths
5. Tile preview by player edge
6. Checkmark/X button overlays
7. Animations
8. Victory modals in corners

### Phase 4 Priorities
1. Touch tap on hex (place tile)
2. Touch tap on tile (rotate left/right)
3. Checkmark button (confirm placement)
4. X button (pick up tile)
5. Mouse tracking with snap behavior
6. Mouse wheel rotation (configurable)
7. Exit buttons in corners

### Performance Considerations

**Rendering:**
- Use requestAnimationFrame for animations
- Minimize canvas redraws (only changed regions)
- Cache Bézier curve calculations

**Touch Response:**
- Touch events processed immediately (< 16ms)
- Visual feedback within one frame
- No blocking operations on UI thread

**Memory:**
- Clear animation timers when not needed
- Reuse canvas contexts
- Efficient flow path calculations

---

**This specification ensures a tabletop-friendly, text-free, multi-angle viewing experience with intuitive tap-based interactions.**
