# E2E Testing Strategy: User Story Screenshots

## Overview

This directory contains end-to-end test screenshots organized as **user stories**. Each story represents a complete user flow through the application, with numbered screenshots that tell a coherent narrative.

## Directory Structure

```
user-stories/
├── 001-player-configuration/   # Setting up players before a game
├── 002-gameplay-rendering/     # Initial gameplay screen display
├── 003-flow-propagation/       # Flow behavior from player edges
├── 004-multi-tile-flow/        # Multi-tile flow progression
├── 005-complete-game/          # Complete 2-player game from start to finish
├── 006-tile-rendering/         # Tile rendering verification (all types, all rotations)
└── README.md                   # This file
```

## Naming Convention

### Story Directories
- Use 3-digit prefixes: `001-`, `002-`, `003-`
- Use kebab-case for descriptive names
- Order stories in logical sequence of user interaction

### Screenshot Files
- Use 3-digit step numbers: `001-`, `002-`, `003-`
- Use descriptive names after the number
- Format: `NNN-description.png`
- Example: `001-initial-state.png`, `002-player-added.png`

### Sub-stories
- Create subdirectories when a story has distinct branches
- Example: `001-player-configuration/color-picker/`
- Follow same numbering convention within subdirectories

## User Stories

### 001-player-configuration
**As a user, I want to configure players before starting a game**

This is a **continuous user story** where each screenshot shows the result of a SINGLE user action:
1. Initial configuration screen (0 players)
2. Add Blue player (1 player)
3. Add Orange player (2 players)
4. Add Green player (3 players)
5. Add Yellow player (4 players)
6. Add Purple player (5 players)
7. Add Red player - max reached (6 players)
8. Remove first player (5 players)
9. Remove first player again (4 players)
10. Remove first player again (3 players)
11. Remove first player again (2 players ready)
12. Click Start button (seating screen appears)
13. Player 1 selects seat (1 seated)
14. Player 2 selects seat (both seated, gameplay begins)

Every step is reachable from the previous one with a single click. The test verifies Redux state at each step to ensure the story matches implementation.

### 002-gameplay-rendering
**As a user, I want to see the game board properly rendered**

Screenshots demonstrate:
1. Gameplay screen with two players
2. Board hexagon with colored player edges
3. Preview tile with grey flows
4. Proper hexagon sizing

### 003-flow-propagation
**As a user, I want to understand how flows propagate from player edges**

Screenshots show:
1. Initial state with player edges
2. Tile placed without edge connection (no flow)
3. Tile placed with edge connection (flow visible)

### 004-multi-tile-flow
**As a user, I want to see how flows extend across multiple tiles**

Screenshots document:
1. Initial state with two players
2. First tile placed with blue flow
3. Second tile placed with orange flow
4. Third tile extending blue flow

### 005-complete-game
**As a user, I want to play a complete 2-player game from start to finish**

Screenshots demonstrate:
1. Initial configuration screen
2. Two players added to the game
3. Game started with board and player edges
4-38. Progressive tile placements (35 moves total) showing:
   - Players alternating turns
   - Tiles being placed on the board
   - Flows extending from player edges
   - Strategic positioning across the board
   - Multiple moves leading toward a tie victory

This story shows the complete user experience of:
- Setting up a 2-player game
- Starting the game
- Playing through multiple turns
- Seeing flows propagate as tiles are placed
- The natural progression of a competitive game

### 006-tile-rendering
**As a developer, I want to verify that tiles are rendered correctly in all rotations**

Screenshots demonstrate:
- All 4 tile types (NoSharps, OneSharp, TwoSharps, ThreeSharps) in all 6 rotations
- Edge labels showing direction numbers (0-5) and names (SW, W, NW, NE, E, SE)
- Connection information listing which edges are connected for each rotation
- Visual verification that rendered curves match the logical model

This story helps diagnose rendering bugs by providing:
- Clear labeling of each hex edge with number and direction name
- Documentation of expected connections for each tile/rotation combination
- Visual reference to verify curve paths align with edge positions

### 007-move-notation
**As a developer, I want to verify move notation with specific tile rotations**

Screenshots demonstrate:
1. Initial game state with two players seated on different edges
2. First player (on edge 0/NW) places Type 1 tile with rotation 5
3. Second player (on edge 4/SW) places Type 1 tile with rotation 5
4. Move list showing notation for both moves

This story helps validate the notation system by:
- Using only Type 1 (OneSharp) tiles to make rotation visually obvious
- Placing tiles with the same internal rotation (5) on different player edges
- Showing how rotation notation adjusts based on player perspective
- Documenting actual notation output: P1A2T1NW and P2A3T1NE

Key findings:
- Both tiles have internal rotation 5
- Player on edge 0: shows as NW orientation in notation
- Player on edge 4: shows as NE orientation in notation
- This demonstrates the rotation notation is player-perspective relative

## Testing Strategy

### Creating New User Stories

1. **Identify the User Flow**: What is the user trying to accomplish?
2. **Create Story Directory**: Use next available number with descriptive name
3. **Document Story**: Add entry to this README with story description
4. **Generate Screenshots**: Update test to save screenshots in story directory
5. **Review Flow**: Walk through screenshots to verify story is clear

### Screenshot Guidelines

- **One action per screenshot**: Each screenshot should show the result of one user action
- **Clear progression**: Screenshots should tell a story when viewed in sequence
- **Continuous flow**: Each screenshot must be reachable from the previous one with a single user action (no hidden steps or test restarts between screenshots)
- **Single test execution**: A user story should be generated by ONE continuous test that manipulates the same state throughout
- **State verification**: Tests must verify Redux state at each step to ensure documented behavior matches implementation
- **Descriptive naming**: Names should make the action/state obvious
- **Consistent state**: Use deterministic seeds/data for reproducibility
- **Clean visuals**: Ensure screenshots are clear and representative

### Updating Existing Stories

1. Run the specific E2E test
2. Review generated screenshots
3. Verify screenshots match expected story flow
4. Update story documentation if flow changes

### Verifying Stories

Contributors can verify test expectations by:

1. Opening a story directory
2. Viewing screenshots in numerical order
3. Understanding the flow being tested
4. Comparing new test runs against expected screenshots

## Test File Mapping

- `configuration.spec.ts` → `001-player-configuration/`
- `gameplay.spec.ts` → `002-gameplay-rendering/`
- `flow-propagation.spec.ts` → `003-flow-propagation/`
- `multi-tile-flow.spec.ts` → `004-multi-tile-flow/`
- `complete-game.spec.ts` → `005-complete-game/`
- `tile-rendering.spec.ts` → `006-tile-rendering/`
- `move-notation-rotation.spec.ts` → `007-move-notation/`

## Running E2E Tests

```bash
# Run all E2E tests (regenerates all screenshots)
npm run test:e2e

# Run specific test
npx playwright test tests/e2e/configuration.spec.ts
```

## Benefits of This Approach

1. **Clarity**: Contributors can understand test expectations by viewing screenshots
2. **Documentation**: Screenshots serve as visual documentation of features
3. **Verification**: Easy to verify if changes break expected behavior
4. **Onboarding**: New contributors can understand flows without running tests
5. **Regression Detection**: Visual comparison makes regressions obvious
