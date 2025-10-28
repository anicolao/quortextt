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

Screenshots walk through:
1. Initial configuration screen
2. Adding first player
3. Adding multiple players
4. Reaching max players
5. Removing a player
6. Opening color picker
7. Changing player color
8. Closing color picker
9. Starting the game
10. Two players before color swap
11. Colors swapped between players

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
