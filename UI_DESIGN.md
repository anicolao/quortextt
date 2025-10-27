# UI Design Specification - Phase 3 & 4

This document provides detailed UI specifications for Phase 3 (Rendering System) and Phase 4 (Input & Interaction) of the Quortex/Flows web implementation.

## Target Platforms

### Primary Target: Touch Screen Devices
- **Device Type:** Tablets, touch-enabled laptops, touch screens
- **Primary Interaction:** Tapping on screen
- **Secondary Interaction (Optional):** Dragging for pan/zoom (if needed)
- **Design Goal:** All core gameplay interactions achievable through tapping only

### Secondary Target: Desktop Browser
- **Device Type:** Desktop/laptop with mouse and keyboard
- **Primary Interaction:** Mouse clicks
- **Enhanced Features:** 
  - Hex preview follows mouse pointer before tile placement
  - Keyboard shortcuts for rotation and other actions
  - Mouse wheel for rotation (optional)

## Phase 3: Rendering System - Detailed Specifications

### 3.1 Canvas Layout and Coordinate System

#### Screen Regions
The canvas is divided into distinct regions:

```
┌────────────────────────────────────────┐
│  Top Bar (Info & Controls)            │  15% height
├────────────────────────────────────────┤
│                                        │
│      Main Board Area                   │  70% height
│      (Hexagonal Game Board)            │
│                                        │
├────────────────────────────────────────┤
│  Bottom Bar (Current Tile & Actions)   │  15% height
└────────────────────────────────────────┘
```

**Responsive Behavior:**
- On narrow screens (portrait mobile): Bars stack vertically, board scales to fit
- On wide screens (landscape desktop): Bars are side panels, board is centered
- Minimum board size: 300x300 pixels
- Maximum board size: 90% of smallest viewport dimension

#### Hexagon Layout Parameters

**Coordinate System:**
- Use axial coordinates (row, col) internally
- Convert to pixel coordinates using pointy-top hexagon layout
- Origin (0,0) at board center hex

**Hex Sizing:**
- Calculate hex radius based on available board area
- Formula: `hexRadius = min(boardWidth, boardHeight) / (2 * maxBoardDimension + 2)`
- Where `maxBoardDimension = 5` (for the 37-hex diamond layout)
- Minimum hex radius: 20 pixels
- Maximum hex radius: 80 pixels

**Spacing:**
- No gap between hexes (they share edges)
- Board padding: 10% of hex radius on all sides

### 3.2 Rendering Layers

Render in this order (back to front):

#### Layer 1: Background
- Fill canvas with dark gray/black (#1a1a1a)
- Draw subtle grid lines showing all 37 hex positions
- Grid line color: #333333, width: 1px

#### Layer 2: Board Outline
- Draw hexagonal board outline
- Outline color: #666666, width: 3px
- Draw edge markers for each player's starting edge
- Edge markers use player colors, width: 5px, 20% of edge length

#### Layer 3: Placed Tiles
For each placed tile:
- Fill hex with tile background color (#2a2a2a for empty, or based on flows)
- Draw flow paths on the tile:
  - Path width: 25% of hex radius
  - Path color: Blend of all active flow colors on that tile
  - If multiple flows, draw each path separately
  - Use curves for flow paths (quadratic Bézier curves)
  - Sharp corner tiles use angular paths
- Add subtle tile border (#444444, 1px)

**Tile Flow Path Rendering:**
- Each tile type has specific flow patterns (see DESIGN_DOC.md section 4.2)
- Paths connect from hex edge midpoints
- Use control points for curves:
  - Basketball (no sharps): smooth S-curves
  - Kimono (one sharp): one angular corner, rest smooth
  - Rink (two sharps): two angular corners, one straight
  - Sharps (three sharps): all angular, meet at center

#### Layer 4: Flow Markers
- Draw colored dots/circles on tiles that have active flows
- Marker size: 15% of hex radius
- Position: Near the center of the hex
- Use player colors with 80% opacity
- If multiple player flows on same tile, stack markers in a small cluster

#### Layer 5: Legal Move Indicators
When a tile is in hand and legal moves should be shown:
- Highlight legal positions with green tint (#00ff0040)
- Draw pulsing animation (subtle scale 0.95-1.05, 1s cycle)
- Draw illegal positions (if hovering) with red tint (#ff000040)

#### Layer 6: Hover Highlight
On mouse-based systems only:
- Draw hex outline where mouse is hovering
- Outline color: #ffff00 (yellow), width: 2px
- Show preview of tile at hovered position with 50% opacity
- Update in real-time as mouse moves

#### Layer 7: Selected/Current Tile Preview
- Draw current tile preview in bottom bar
- Show rotation indicator (small arrow or numbered orientation)
- Highlight with player color border
- Display tile type name

#### Layer 8: UI Elements (Text, Buttons, Info)
**Top Bar Contents:**
- Current player indicator (name + color circle)
- Turn counter (e.g., "Turn 5/37")
- Remaining tiles count by type
- Settings icon (top-right corner)

**Bottom Bar Contents:**
- Current tile preview (larger hex, 2x normal size)
- Rotation buttons (left and right arrows) **for touch**
- "Place Tile" button (if position selected)
- "Undo Rotation" button (optional)

**Text Rendering:**
- Font: Sans-serif, clean and readable
- Player name: 24px, bold
- Tile counts: 18px, regular
- Button labels: 20px, medium weight
- All text has 1px dark outline for contrast

### 3.3 Visual Feedback & Animations

#### Tile Placement Animation (200-400ms)
1. Fade in: Tile appears with opacity 0→1 (100ms)
2. Scale: Tile scales from 0.8→1.0 (200ms, ease-out)
3. Flow propagation: If flows extend, animate the flow paths
   - Draw flow paths progressively from source (200ms)
   - Use a "wave" effect moving along the path

#### Flow Update Animation
When a new tile extends a flow:
- Highlight the new flow segments in bright color (300ms pulse)
- Fade to normal flow color (200ms)

#### Rotation Animation
When rotating current tile:
- Smooth rotation over 150ms
- Use ease-in-out easing
- Show rotation direction (clockwise/counter-clockwise indicator)

#### Victory Animation
- Highlight winning flow path with pulsing glow
- Display victory modal overlay:
  - Semi-transparent background (#00000099)
  - Centered card with winner info
  - "New Game" and "View Board" buttons

#### Button Feedback
- On hover (mouse): Lighten color by 20%
- On press: Darken color by 10%, slight scale (0.95)
- Add 100ms transition for all state changes

### 3.4 Color Palette

**Player Colors (Default):**
- Player 1: #ff4444 (Red)
- Player 2: #4444ff (Blue)  
- Player 3: #44ff44 (Green)
- Player 4: #ffff44 (Yellow)
- Player 5: #ff44ff (Magenta)
- Player 6: #44ffff (Cyan)

**UI Colors:**
- Background: #1a1a1a (Very dark gray)
- Board outline: #666666 (Medium gray)
- Grid lines: #333333 (Dark gray)
- Tile background: #2a2a2a (Dark gray)
- Tile border: #444444 (Slightly lighter gray)
- Text: #ffffff (White)
- Button: #4a4a4a (Gray)
- Button hover: #5a5a5a
- Button active: #3a3a3a
- Legal move: #00ff0040 (Transparent green)
- Illegal move: #ff000040 (Transparent red)
- Hover highlight: #ffff00 (Yellow)

**Accessibility:**
- All player colors have sufficient contrast against dark background
- Color-blind mode available (use patterns in addition to colors)
- Minimum touch target size: 44x44 pixels

### 3.5 Responsive Design Breakpoints

**Mobile Portrait (< 600px width):**
- Stack layout vertically
- Reduce hex size to maintain board visibility
- Make bottom bar full-width
- Larger rotation buttons (60x60px minimum)

**Mobile Landscape (600-900px width):**
- Side-by-side layout with board taking 60% width
- Controls in right sidebar
- Normal hex sizing

**Tablet (900-1200px):**
- Optimal layout: board centered, info bars on top/bottom
- Larger touch targets (50x50px)
- Show more tile information

**Desktop (> 1200px):**
- Board centered with ample margin
- Side panels for player info and controls
- Mouse hover previews enabled
- Keyboard shortcuts shown

## Phase 4: Input & Interaction - Detailed Specifications

### 4.1 Touch Screen Interaction (Primary)

All gameplay can be completed with tapping only. No dragging required for core gameplay.

#### Touch Gesture: Tap on Hex Position
**Purpose:** Select position to place tile

**Behavior:**
1. User taps on a hex position on the board
2. System highlights the tapped position
3. If tile can be placed there (legally):
   - Show "Place Tile" button in bottom bar
   - Preview tile at that position with current rotation
4. If tile cannot be placed there:
   - Show red outline briefly (500ms)
   - Display message: "Illegal position" (toast notification)
5. Tapping a different position changes selection
6. Tapping same position again deselects it

**Visual Feedback:**
- Selected hex: Yellow outline, 3px width
- Tile preview: 70% opacity at selected position
- Pulsing animation on preview (subtle)

#### Touch Gesture: Tap Rotation Button
**Purpose:** Rotate the current tile

**UI Elements:**
- Two arrow buttons in bottom bar
- Left button (counter-clockwise): Rotate -60° (one step left)
- Right button (clockwise): Rotate +60° (one step right)
- Buttons are 60x60px minimum
- Show current rotation number (0-5) between buttons

**Behavior:**
1. User taps rotation button
2. Tile rotates immediately (animated 150ms)
3. If position is selected, preview updates immediately
4. No limit on rotations

**Visual Feedback:**
- Button press animation (scale 0.95, 100ms)
- Tile rotates smoothly
- Rotation number updates (0→1→2→3→4→5→0...)

#### Touch Gesture: Tap "Place Tile" Button
**Purpose:** Confirm tile placement

**Conditions to Enable:**
- A hex position must be selected
- The placement must be legal
- It's the current player's turn

**Behavior:**
1. User taps "Place Tile" button
2. Tile is placed with animation
3. Flows update automatically
4. Selection is cleared
5. Turn advances to next player (or game ends if victory/constraint)
6. New tile is drawn for next player

**Visual Feedback:**
- Button is disabled (grayed out) unless conditions met
- On successful placement: tile placement animation
- Flow update animations
- Next player indicator updates

#### Optional Touch Gestures (Enhanced Features)

**Two-finger pinch zoom:**
- Zoom in/out on board
- Minimum zoom: entire board visible
- Maximum zoom: 3x magnification
- Zoom centered on pinch midpoint

**Two-finger pan/drag:**
- Pan the view when zoomed in
- Constrain pan to keep board visible
- Smooth deceleration when gesture ends

**Long-press on placed tile:**
- Show tile information (type, rotation, placed by whom)
- Show all flows passing through this tile
- Dismiss by tapping outside

### 4.2 Mouse/Desktop Interaction (Secondary)

Enhanced experience for desktop users while maintaining same tap-based core.

#### Mouse Action: Click on Hex Position
**Same behavior as tap (see 4.1)**

Additional desktop features:
- Before placing tile, hex under cursor shows preview
- Preview follows mouse as it moves between hexes
- Preview updates with current rotation
- No need to click to see preview

#### Mouse Action: Hover over Hex
**Purpose:** Show preview without selection

**Behavior:**
1. Mouse moves over a hex position
2. If tile is in hand:
   - Show tile preview at that position (50% opacity)
   - Show legality indicator:
     - Green tint if legal
     - Red tint if illegal
3. Preview disappears when mouse leaves hex

**Visual Feedback:**
- Yellow outline on hovered hex
- Semi-transparent tile preview
- Color tint (green/red) for legality

#### Mouse Action: Click Rotation Buttons
**Same as touch tap behavior**

#### Mouse Action: Mouse Wheel Rotation
**Purpose:** Alternative rotation method

**Behavior:**
- Scroll up: Rotate clockwise
- Scroll down: Rotate counter-clockwise
- Each scroll step = 60° rotation
- Works anywhere on canvas (not just on tile preview)

**Visual Feedback:**
- Same rotation animation as buttons
- Brief indicator showing rotation direction (100ms)

#### Keyboard Shortcuts

**R or Right Arrow:** Rotate clockwise
**E or Left Arrow:** Rotate counter-clockwise  
**Space:** Toggle legal move highlighting
**Enter:** Place tile (if position selected and legal)
**Escape:** Clear selection
**1-6:** Quick select position (numbered positions, if helpful)
**Z:** Undo last action (if undo feature implemented)

**Visual Feedback:**
- Show keyboard hint tooltips on hover
- Brief flash on button when keyboard shortcut used
- Show keyboard shortcuts legend in settings

#### Right-Click Menu (Optional)
- Right-click on board: Show options menu
  - "Show Legal Moves"
  - "Toggle Grid"
  - "Reset View" (if zoomed/panned)
  - "Settings"

### 4.3 Game Flow Interactions

#### Starting the Game
**Configuration Screen:**
1. Add Player buttons (tap to add players 1-6)
2. Color selection (tap color circle → color picker)
3. Edge position selection (tap edge number or visual picker)
4. Start Game button (enabled when 2+ players)

**Interaction:**
- All tap-based
- Visual confirmation for each selection
- Validation messages if invalid configuration

#### During Gameplay

**Turn Sequence (from user perspective):**
1. Player sees: "Your turn!" notification
2. Current tile appears in preview area
3. Player rotates tile (optional, using rotation buttons)
4. Player taps hex position to select placement location
5. "Place Tile" button appears/enables
6. Player taps "Place Tile"
7. Tile places with animation
8. Flows update with animation
9. Next player's turn begins (or game ends)

**Always Visible:**
- Current player indicator (name + color)
- Current tile preview
- Rotation controls
- Remaining tile counts

**Optional Toggle:**
- Legal move indicators
- Flow path highlighting
- Grid lines
- Tile type indicators

#### Game End Interaction

**Victory Screen:**
1. Winning flow animates (glowing path)
2. Modal overlay appears with:
   - Winner announcement
   - Victory type (flow connection or constraint)
   - Game statistics (turns, tiles placed)
   - "New Game" button
   - "View Final Board" button (dismisses modal)

**Constraint Victory:**
- Shows the unplayable tile
- Explains why it cannot be placed
- Announces the winner

### 4.4 Error Handling & User Feedback

#### Illegal Move Attempt
**Trigger:** User tries to place tile illegally

**Feedback:**
1. Red flash on illegal position (200ms)
2. Toast notification: "Illegal placement: [reason]"
3. Tile remains in hand
4. Selection clears

**Reasons displayed:**
- "Would block Player X completely"
- "Would force two teams to share a path"
- "No viable path remains for Player X"

#### Network/Technical Errors
**For future multiplayer:**
- Connection lost: "Reconnecting..." overlay
- Sync error: "Reloading game state..."
- Server error: "Error: [message]" with retry button

#### Touch/Click Miss
**Trigger:** User taps/clicks outside interactive elements

**Feedback:**
- No action (silent failure)
- Maintains current state
- No error message (too noisy)

### 4.5 Accessibility Features

#### Touch Accessibility
- All tap targets minimum 44x44px
- Sufficient spacing between buttons (8px minimum)
- High contrast mode option
- Color-blind friendly mode (adds patterns/symbols)

#### Screen Reader Support
- Aria labels on all interactive elements
- Announce current player turn
- Announce tile placements
- Announce game state changes

#### Keyboard Accessibility
- All actions available via keyboard
- Visible focus indicators
- Tab navigation order: top-to-bottom, left-to-right
- Escape key always returns to safe state

#### Visual Accessibility
- Minimum font size: 16px
- High contrast mode (optional)
- Increase UI element size option (+25%, +50%)
- Reduce animations option

## E2E Test Specifications

### Test Suite 1: Rendering Tests

#### Test 1.1: Board Initial Render
**Verify:**
- Canvas initializes with correct dimensions
- 37 hex positions are drawn
- Grid lines visible
- Board outline drawn correctly
- All UI elements present (top bar, bottom bar)

**Assertions:**
- Canvas element exists and has non-zero dimensions
- All expected UI regions rendered
- Color palette matches specification

#### Test 1.2: Tile Rendering
**Setup:** Place a tile on the board via Redux action

**Verify:**
- Tile appears at correct position
- Flow paths drawn correctly for tile type
- Tile has correct rotation
- Tile border visible

**Test each tile type:**
- NoSharps (Basketball)
- OneSharp (Kimono)
- TwoSharps (Rink)
- ThreeSharps (Sharps)

**Test each rotation:** 0-5

#### Test 1.3: Flow Rendering
**Setup:** Place multiple tiles creating a flow

**Verify:**
- Flow markers appear on correct tiles
- Flow color matches player color
- Flow path is continuous
- Multiple flows on same tile render correctly

#### Test 1.4: Animation Rendering
**Verify:**
- Tile placement animation completes
- Flow update animation completes
- Rotation animation smooth
- Victory animation displays

**Use:** Visual regression testing (screenshot comparison)

#### Test 1.5: Responsive Layout
**Test at breakpoints:**
- 400px width (mobile portrait)
- 700px width (mobile landscape)
- 1000px width (tablet)
- 1400px width (desktop)

**Verify:**
- Layout adjusts correctly
- All elements remain visible
- Touch targets maintain minimum size
- Text remains readable

### Test Suite 2: Touch Interaction Tests

#### Test 2.1: Tap to Select Hex
**Actions:**
1. Start game with 2 players
2. Tap on a valid hex position
3. Verify position highlighted
4. Verify "Place Tile" button appears

**Assertions:**
- Selected position state updates in Redux
- Visual highlight rendered
- Button enabled/disabled correctly

#### Test 2.2: Tap Rotation Buttons
**Actions:**
1. Start game
2. Tap clockwise rotation button
3. Verify rotation increases
4. Tap counter-clockwise button
5. Verify rotation decreases

**Assertions:**
- Rotation state updates in Redux (0→1→2→3→4→5→0)
- Preview tile rotates visually
- Rotation number displays correctly

#### Test 2.3: Tap Place Tile Button
**Actions:**
1. Start game
2. Select valid position
3. Tap "Place Tile" button
4. Verify tile placed

**Assertions:**
- Tile added to board in Redux state
- Turn advances to next player
- New tile drawn
- Selection cleared
- Placement animation plays

#### Test 2.4: Illegal Placement Attempt
**Actions:**
1. Set up board state where only some positions legal
2. Tap illegal position
3. Attempt to place

**Assertions:**
- Red flash appears
- Error message shown
- Tile not placed
- Turn does not advance

#### Test 2.5: Complete Turn Sequence
**Actions:**
1. Start 2-player game
2. Rotate tile 2 times
3. Select position
4. Place tile
5. Verify turn advances
6. Second player repeats

**Assertions:**
- Full turn completes correctly
- State updates properly
- Animations play
- Next player's tile appears

### Test Suite 3: Mouse Interaction Tests

#### Test 3.1: Hover Preview
**Actions:**
1. Start game
2. Move mouse over various hex positions
3. Verify preview follows mouse

**Assertions:**
- Hover state updates in Redux
- Preview renders at hovered position
- Preview disappears when mouse leaves
- Legal/illegal indicator shows correctly

#### Test 3.2: Click to Select
**Same as Test 2.1 but with mouse click**

#### Test 3.3: Mouse Wheel Rotation
**Actions:**
1. Start game
2. Scroll mouse wheel up
3. Verify clockwise rotation
4. Scroll wheel down
5. Verify counter-clockwise rotation

**Assertions:**
- Rotation updates on wheel event
- Visual rotation occurs
- Works from any canvas position

#### Test 3.4: Keyboard Shortcuts
**Test each shortcut:**
- R: Rotate clockwise
- E: Rotate counter-clockwise
- Space: Toggle legal moves
- Enter: Place tile (when valid)
- Escape: Clear selection

**Assertions:**
- Each key triggers correct action
- Visual feedback shows
- State updates correctly

### Test Suite 4: Game Flow Tests

#### Test 4.1: Full Game Playthrough
**Actions:**
1. Configure 2-player game
2. Start game
3. Place tiles alternating turns
4. Continue until victory condition met

**Assertions:**
- Game progresses correctly
- No errors occur
- Victory detected correctly
- Victory screen displays

#### Test 4.2: Victory by Flow
**Setup:** Create board state near victory

**Actions:**
1. Place final tile to connect player's edges
2. Verify victory detected

**Assertions:**
- Victory check runs
- Correct winner identified
- Flow connection highlighted
- Victory modal appears

#### Test 4.3: Victory by Constraint
**Setup:** Create board state where next tile cannot be placed

**Actions:**
1. Verify constraint detected
2. Verify correct winner

**Assertions:**
- Constraint check runs
- Last player to move wins
- Victory modal shows reason
- Unplaceable tile displayed

#### Test 4.4: Multi-Player Game
**Test with:**
- 3 players
- 4 players (teams)
- 6 players (teams)

**Assertions:**
- Turn order correct
- Team formation correct
- Victory conditions work for teams
- All players' flows tracked

### Test Suite 5: UI State Tests

#### Test 5.1: Legal Move Indicators
**Actions:**
1. Start game
2. Toggle "Show Legal Moves"
3. Verify indicators appear
4. Toggle off
5. Verify indicators disappear

**Assertions:**
- Legal positions calculated correctly
- Highlights render correctly
- Toggle state persists

#### Test 5.2: Settings Panel
**Actions:**
1. Open settings
2. Change animation speed
3. Toggle color-blind mode
4. Apply changes

**Assertions:**
- Settings panel renders
- Changes apply immediately
- Settings persist in state

#### Test 5.3: Zoom and Pan (Optional)
**Actions:**
1. Pinch zoom in
2. Verify board scales
3. Pan view
4. Verify board position changes
5. Reset view

**Assertions:**
- Zoom level updates
- Pan offset updates
- Board remains usable
- Reset returns to default

### Test Suite 6: Error & Edge Cases

#### Test 6.1: Rapid Clicking
**Actions:**
1. Rapidly click multiple positions
2. Rapidly click rotation buttons
3. Verify state remains consistent

**Assertions:**
- No race conditions
- No duplicate actions
- State updates correctly

#### Test 6.2: Invalid State Recovery
**Setup:** Force invalid state via Redux

**Actions:**
1. Attempt to recover or show error

**Assertions:**
- Error detected
- Graceful handling
- User informed

#### Test 6.3: Resize During Game
**Actions:**
1. Start game mid-game
2. Resize window multiple times
3. Continue playing

**Assertions:**
- Layout adapts
- Game state preserved
- No visual glitches

### Test Execution Strategy

**Unit Tests:**
- Run on every commit
- Cover all game logic functions
- Mock rendering and input

**Integration Tests:**
- Run before merge
- Test Redux integration
- Test render pipeline

**E2E Tests:**
- Run on PR and before release
- Use Playwright for automation
- Test on multiple browsers (Chrome, Firefox, Safari)
- Test on multiple devices (desktop, tablet, mobile viewports)
- Visual regression with screenshot comparison

**Manual Testing:**
- Performed on actual touch devices
- Accessibility audit
- Performance testing on low-end devices
- Usability testing with real users

### Test Coverage Goals

- **Unit Tests:** 90%+ code coverage
- **Integration Tests:** All critical paths
- **E2E Tests:** All user workflows
- **Visual Tests:** Key screens at all breakpoints
- **Accessibility Tests:** WCAG 2.1 AA compliance

---

## Implementation Notes

### Phase 3 Priorities
1. Basic hex rendering (positions and grid)
2. Tile rendering with correct flow paths
3. Flow marker rendering
4. UI bars and text rendering
5. Animations
6. Responsive layout

### Phase 4 Priorities
1. Touch tap on hex (select position)
2. Rotation buttons (tap to rotate)
3. Place tile button (tap to place)
4. Mouse hover preview (desktop enhancement)
5. Keyboard shortcuts
6. Optional: zoom/pan gestures

### Performance Considerations

**Rendering:**
- Use canvas layers to minimize redraws
- Redraw only changed regions when possible
- Use requestAnimationFrame for animations
- Throttle hover events (16ms debounce)

**Touch Response:**
- Touch events processed immediately (< 16ms)
- Visual feedback within one frame
- No blocking operations on UI thread

**Memory:**
- Clear animation timers when components unmount
- Reuse canvas contexts
- Limit history size (100 moves max)

---

**This specification ensures a consistent, accessible, and enjoyable user experience across both touch and mouse-based interactions while maintaining the core tap-based design philosophy.**
