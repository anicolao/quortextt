# User Story: Flow Propagation from Player Edges

**As a user, I want to understand how flows propagate from player edges to tiles**

## Flow Description

This story demonstrates the critical game mechanic of flow propagation. Flows only appear on tiles when they connect to a player's edge through proper hex directions.

## Screenshots

### 001-initial-state.png
- **Action**: Game started with two players, before any tiles placed
- **State**: Empty board with colored player edges visible
- **What to verify**:
  - Player 1 edge colored (e.g., blue at edge 0)
  - Player 2 edge colored (e.g., orange at edge 3)
  - Board is empty (no tiles placed)
  - Clear distinction between player edges

### 002-no-connection.png
- **Action**: Tile placed NOT adjacent to any player edge
- **State**: Tile visible with GREY flows (no player color)
- **What to verify**:
  - Tile placed at position not touching player edges (e.g., row=-2, col=0)
  - All flow paths on tile are grey
  - No player-colored flows visible
  - Tile is clearly visible but not "activated"

### 003-with-connection.png
- **Action**: Tile placed ON a player's edge
- **State**: Tile shows COLORED flows for connected player
- **What to verify**:
  - Tile placed at player edge position (e.g., row=-3 for edge 0)
  - Flow paths connected to player edge show player's color (blue)
  - Other flow paths on tile remain grey
  - Flows only enter from hex directions aligned with player's edge
  - Player's flow count increased (visible in game state)

## Game Rules Demonstrated

### Flow Entry Rules
- Flows enter a tile only from hex edges that belong to a player's board edge
- For edge 0 (row=-3): flows enter from West and NorthWest directions
- For edge 3 (row=3): flows enter from East and SouthEast directions
- Other edges follow similar directional rules

### Visual Indicators
- **Grey flows**: Tile not connected to any player edge
- **Colored flows**: Tile connected to player edge, showing player's color
- **Partial coloring**: Only connected paths colored, disconnected remain grey

## Test Coverage

This story validates:
- Initial board state with player edges
- Tile placement without edge connection
- Tile placement with edge connection
- Correct flow coloring (grey vs player color)
- Flow propagation only from correct hex directions
- Flow state tracking in Redux store

## Related Files
- Test: `tests/e2e/flow-propagation.spec.ts`
- Flow Logic: `src/game/flows.ts`
- Redux: `src/redux/gameReducer.ts`
- Rendering: `src/rendering/tileRenderer.ts`

## Deterministic Testing
- Uses seed 42 for reproducible tile sequences
- Specific positions chosen to demonstrate edge vs non-edge placement
- Flow behavior is deterministic given same board state
