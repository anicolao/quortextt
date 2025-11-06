# User Story: Complete 2-Player Game with Mouse Interactions

**As a user, I want to play a complete 2-player game using only mouse clicks**

## Flow Description

This story demonstrates a full game experience from initial configuration through multiple turns, using only mouse interactions. Unlike test 005 which uses Redux actions directly, this test validates that the UI correctly handles all user interactions including tile rotation, placement, and confirmation through mouse clicks.

## Test Scenario

- **Seed**: 999
- **Players**: 2 (assigned to adjacent edges 1 and 2)
- **Input Method**: Mouse clicks only (no Redux action cheating)
- **Interactions**:
  - Click to rotate tiles
  - Click to select hex positions
  - Click checkmark to confirm placement
  - Click X to cancel placement
- **Outcome**: Victory determined by flow connections

## Screenshots

### 0001-initial-screen.png

![0001-initial-screen](./0001-initial-screen.png)

- **Action**: User loads the application
- **State**: Configuration screen ready for player setup
- **What to verify**: Clean configuration interface, ready for player addition

### 0002-players-added.png

![0002-players-added](./0002-players-added.png)

- **Action**: Two players added to the game
- **State**: Configuration screen with two players
- **What to verify**: 
  - Two player entries displayed
  - Each player has a unique color
  - "Start Game" button available

### 0003-game-started.png

![0003-game-started](./0003-game-started.png)

- **Action**: Game started with two players
- **State**: Gameplay screen with empty board
- **What to verify**:
  - Hexagonal game board visible
  - Player 1 edge (blue) at position 1 (right side)
  - Player 2 edge (orange) at position 2 (top side)
  - Preview tile shown at player's edge position
  - Board ready for first move

### Move Sequences (0004-* onwards)

Each move consists of multiple screenshots showing the complete interaction:

#### Before Move Screenshots
- **0004-before-move-1.png**, **0008-before-move-2.png**, etc.
- Shows the game state before the player makes their move
- Current tile is displayed at the player's edge position

#### Rotation Screenshots
- **0005-move-1-rotation-1.png**, **0006-move-1-rotation-2.png**, etc.
- Shows the tile being rotated by clicking on it
- Each click rotates the tile 60 degrees clockwise
- Demonstrates that rotation is achieved through mouse interaction

#### Tile Placed Screenshots
- **0007-move-1-tile-placed.png**, etc.
- Shows the tile after clicking on a hex position
- Tile is now at the selected position with confirmation buttons visible
- Checkmark (✓) and X buttons appear for confirming or canceling

#### Move Complete Screenshots
- **0008-move-1-complete.png**, etc.
- Shows the board after clicking the checkmark to confirm
- Tile is committed to the board
- Flows update to show connections
- Turn advances to next player automatically

### What to Verify Across All Moves

- **Mouse-only interaction**: All actions performed via mouse clicks
- **Rotation mechanism**: Tile rotates when clicked, no Redux ROTATE action
- **Placement mechanism**: Tile moves to hex when position is clicked
- **Confirmation mechanism**: Checkmark commits, X cancels
- **Automatic progression**: Next player's tile appears automatically after confirm
- **Flow propagation**: Flows update correctly after each placement
- **Legal move enforcement**: UI prevents illegal moves (doesn't show checkmark for illegal placements)
- **Turn management**: Players alternate correctly
- **Board state**: Consistent throughout the game

### victory-final.png

![victory-final](./victory-final.png)

- **Action**: Final game state reached
- **State**: Game concluded with victory condition met
- **What to verify**:
  - Game phase: finished
  - Victory screen displayed
  - Winner(s) identified correctly
  - Final board state shows complete game

## Game Mechanics Demonstrated

### Mouse Interaction Flow

1. **Rotation**: Click on tile preview to rotate (multiple clicks for multiple rotations)
2. **Selection**: Click on hex position to place tile there (tentatively)
3. **Confirmation**: Click checkmark (✓) to commit or X to cancel
4. **Automatic progression**: After commit, next player's tile appears automatically

### UI Validation

- Legal moves are enforced by the UI
- Checkmark button only appears for legal placements
- Illegal moves are rejected silently (no error messages, just no action)
- Turn transitions happen automatically after confirmation

### Flow Propagation

- Flows enter from player edges
- Connected tiles propagate player colors
- Disconnected tiles remain grey
- Flow networks extend naturally
- Multiple player flows coexist independently

## Test Coverage

This story validates:
- Complete game flow using only mouse interactions
- UI-based tile rotation (no Redux ROTATE action)
- UI-based tile placement (clicking hex positions)
- Confirmation/cancellation buttons work correctly
- Legal move enforcement through UI
- Automatic turn progression
- Flow propagation with UI-placed tiles
- Victory detection with mouse-driven gameplay

## Differences from Test 005

- **Input method**: Mouse clicks only vs Redux actions
- **Legality**: UI enforces legality vs Redux accepts all moves
- **Screenshot granularity**: Shows each rotation, placement, confirmation step
- **Determinism**: Same seed and edge positions ensure comparable gameplay

## Related Files

- Test: `tests/e2e/complete-game-mouse.spec.ts`
- Redux: `src/redux/gameReducer.ts`
- Input Handling: `src/input/gameplayInputHandler.ts`
- Flow Logic: `src/game/flows.ts`
- Legality Logic: `src/game/legality.ts`

## Deterministic Testing

- **Seed 999**: Ensures reproducible tile shuffle (same as test 005)
- **Edge positions 1 and 2**: Matches test 005 for consistency
- **Systematic positions**: Tiles placed in predictable pattern
- **Mouse coordinates**: Calculated deterministically from hex layout
- Same game plays out identically on each test run
