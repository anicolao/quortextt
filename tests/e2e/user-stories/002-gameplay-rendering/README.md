# User Story: Gameplay Screen Rendering

**As a user, I want to see the game board properly rendered when gameplay begins**

## Flow Description

This story verifies that the gameplay screen renders correctly with all essential visual elements: the hexagonal board, player edges, preview tiles, and proper sizing.

## Screenshots

### 001-two-players.png
- **Action**: Game started with two players
- **State**: Gameplay screen showing full board
- **What to verify**: 
  - Hexagonal game board visible
  - Two player edges colored differently
  - Player edges on opposite sides (edges 0 and 3)
  - Current tile preview shown
  - Canvas has content (not blank)

### 002-board-edges.png
- **Action**: Focus on board edges
- **State**: Hexagonal board with colored player edges
- **What to verify**:
  - Player 1 edge clearly colored
  - Player 2 edge clearly colored
  - Colors are distinct
  - Edges positioned correctly on hexagon

### 003-preview-tile.png
- **Action**: Focus on tile preview area
- **State**: Current tile shown with grey flows (not colored)
- **What to verify**:
  - Tile visible in preview position
  - Flow paths shown in grey (neutral, not player colored)
  - Tile pattern clear and recognizable

### 004-hex-sizing.png
- **Action**: Verify board dimensions
- **State**: Full board with proper hexagon sizing
- **What to verify**:
  - Hex size = min(width, height) / 17
  - Hexagons not distorted
  - Board fits properly in viewport
  - Proper spacing between hexagons

## Test Coverage

This story validates:
- Gameplay screen initialization
- Canvas rendering (not blank)
- Hexagonal board display
- Player edge coloring
- Player edge positioning
- Preview tile rendering
- Neutral flow colors before placement
- Proper hexagon sizing calculations

## Related Files
- Test: `tests/e2e/gameplay.spec.ts`
- Redux: `src/redux/gameReducer.ts`
- Rendering: `src/rendering/gameplayScreen.ts`
- Board Logic: `src/game/board.ts`
