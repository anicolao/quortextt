# Testing Overview

This document provides a comprehensive overview of the testing strategy, infrastructure, and best practices for the Quortex project. It serves as a guide for contributors to understand how to properly test their changes.

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Test Structure](#test-structure)
3. [Test Types](#test-types)
4. [Running Tests](#running-tests)
5. [Writing Tests](#writing-tests)
6. [Test Coverage](#test-coverage)
7. [Test Infrastructure](#test-infrastructure)
8. [Best Practices](#best-practices)
9. [Common Patterns](#common-patterns)
10. [Debugging Tests](#debugging-tests)

## Testing Philosophy

The Quortex project follows a **comprehensive testing approach** with multiple layers:

- **Unit Tests**: Test individual functions and modules in isolation
- **Integration Tests**: Test interactions between modules (e.g., Redux state management)
- **End-to-End Tests**: Test complete user workflows through the UI

### Core Principles

1. **Test-Driven Development (TDD)**: Write tests before or alongside code changes
2. **Immutability Verification**: Ensure Redux state changes are immutable
3. **Visual Regression Testing**: Use screenshots to verify UI rendering
4. **Deterministic Testing**: Use fixed seeds for reproducible test results
5. **Comprehensive Coverage**: Aim for high code coverage (currently 98%+)

## Test Structure

```
tests/
├── e2e/                          # End-to-end Playwright tests
│   ├── user-stories/             # Screenshot-based user story documentation
│   ├── helpers.ts                # Shared E2E test utilities
│   ├── configuration.spec.ts     # Player configuration tests
│   ├── gameplay.spec.ts          # Gameplay interaction tests
│   ├── complete-game.spec.ts     # Complete game flow tests
│   └── ...
├── game/                         # Pure game logic tests
│   ├── board.test.ts             # Board utilities and hex math
│   ├── flows.test.ts             # Flow propagation logic
│   ├── tiles.test.ts             # Tile type and rotation logic
│   ├── legality.test.ts          # Move legality checking
│   ├── victory.test.ts           # Victory condition detection
│   └── ...
├── reducer.test.ts               # Redux reducer tests
├── gameplayReducer.test.ts       # Gameplay state management tests
├── uiReducer.test.ts             # UI state management tests
├── selectors.test.ts             # Redux selector tests
├── animation.test.ts             # Animation system tests
├── coverage.test.ts              # Additional tests for 100% coverage
└── ...
```

## Test Types

### Unit Tests (Vitest)

Unit tests validate individual functions and modules in isolation. They are located in:
- `tests/game/*.test.ts` - Pure game logic (board, flows, tiles, victory)
- `tests/*.test.ts` - Redux reducers, selectors, and other modules

**Key Characteristics:**
- Fast execution (< 3 seconds for all 398 tests)
- No DOM or browser required
- Focus on pure functions and logic
- Use deterministic inputs and seeds

**Example:**
```typescript
describe('board utilities', () => {
  it('should convert position to key', () => {
    expect(positionToKey({ row: 0, col: 0 })).toBe('0,0');
    expect(positionToKey({ row: -3, col: 2 })).toBe('-3,2');
  });
});
```

### Integration Tests (Vitest)

Integration tests verify how multiple modules work together, particularly Redux state management:

- `tests/reducer.test.ts` - Main game reducer integration
- `tests/gameplayReducer.test.ts` - Gameplay phase state management
- `tests/seatingPhase.test.ts` - Player seating phase

**Key Characteristics:**
- Test state transitions across multiple actions
- Verify immutability of state changes
- Test complex scenarios (e.g., color swapping, game setup)

**Example:**
```typescript
it('should handle player seating and game start', () => {
  let state = initialState;
  state = gameReducer(state, addPlayer(PLAYER_COLORS[0], 0));
  state = gameReducer(state, startGame());
  state = gameReducer(state, selectEdge('p1', 0));
  expect(state.phase).toBe('seating');
});
```

### End-to-End Tests (Playwright)

E2E tests verify complete user workflows through the browser UI. They are located in `tests/e2e/*.spec.ts`.

**Two Types of E2E Tests:**

The project uses two complementary approaches for E2E testing. Both types should be written for each user story to ensure comprehensive coverage:

1. **Action-Based Tests** - Dispatch Redux actions directly to test underlying state logic
   - Verify that user stories are possible given the Redux actions
   - Faster execution (no need to locate/click UI elements)
   - Test state transitions and business logic
   - Example: `blocking-sharp-tiles.spec.ts`
   
   ```typescript
   test('action-based test', async ({ page }) => {
     await page.goto('/');
     
     // Dispatch actions directly to Redux store
     await page.evaluate(() => {
       const store = (window as any).__REDUX_STORE__;
       store.dispatch({ type: 'ADD_PLAYER' });
       store.dispatch({ type: 'START_GAME' });
     });
     
     // Verify state changes
     const state = await getReduxState(page);
     expect(state.game.phase).toBe('seating');
   });
   ```

2. **Interaction-Based Tests** - Click buttons and interact with UI elements
   - Verify that user stories are possible via the UI
   - Test the complete user experience
   - Ensure buttons trigger correct actions
   - Example: `complete-game-mouse.spec.ts`, `lobby-interactions.spec.ts`
   
   ```typescript
   test('interaction-based test', async ({ page }) => {
     await page.goto('/');
     
     // Click UI elements
     const addPlayerButton = await getAddPlayerButtonCoords(page);
     await page.mouse.click(addPlayerButton.x, addPlayerButton.y);
     
     const startButton = await getStartButtonCoords(page);
     await page.mouse.click(startButton.x, startButton.y);
     
     // Verify UI state
     const state = await getReduxState(page);
     expect(state.game.phase).toBe('seating');
   });
   ```

**Why Both Types?**
- Action-based tests verify the underlying Redux logic is correct
- Interaction-based tests verify the UI correctly triggers those actions
- Together they ensure both the logic and UI work properly

**Test Categories:**

1. **Configuration Tests** (`configuration.spec.ts`)
   - Adding/removing players
   - Changing player colors
   - Color picker interactions

2. **Gameplay Tests** (`gameplay.spec.ts`, `complete-game.spec.ts`, `complete-game-mouse.spec.ts`)
   - Board rendering
   - Tile placement
   - Turn progression
   - Complete games from start to finish

3. **Flow Tests** (`flow-propagation.spec.ts`, `multi-tile-flow.spec.ts`)
   - Flow visualization
   - Flow propagation across tiles
   - Multi-tile flow chains

4. **UI Interaction Tests** (`lobby-interactions.spec.ts`, `exit-buttons.spec.ts`)
   - Button interactions
   - Navigation between screens
   - Edge case handling

5. **Visual Regression Tests** (`tile-rendering.spec.ts`, `victory-animation.spec.ts`)
   - Tile rendering verification
   - Animation playback
   - Victory screens

**Key Characteristics:**
- Test through actual browser (Chromium)
- Generate screenshot documentation
- Use deterministic seeds for reproducibility
- Organized as user stories

## Running Tests

### Quick Reference

```bash
# Install dependencies
npm install

# Run all unit tests (watch mode)
npm test

# Run unit tests once
npm test -- --run

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui

# Install Playwright browsers (first time only)
npx playwright install chromium

# Run E2E tests
npm run test:e2e

# Run specific E2E test
npx playwright test tests/e2e/configuration.spec.ts

# Build the project
npm run build
```

### Development Workflow

1. **Before Making Changes**
   ```bash
   npm run build
   npm test -- --run
   npm run test:e2e
   ```

2. **During Development**
   ```bash
   npm test  # Watch mode for rapid iteration
   ```

3. **Before Committing**
   ```bash
   npm run build
   npm test -- --run
   npm run test:e2e
   npm run test:coverage
   ```

## Writing Tests

### Unit Test Template

```typescript
import { describe, it, expect } from 'vitest';
import { functionToTest } from '../src/module';

describe('Module Name', () => {
  describe('functionToTest', () => {
    it('should handle basic case', () => {
      const result = functionToTest(input);
      expect(result).toBe(expected);
    });

    it('should handle edge case', () => {
      const result = functionToTest(edgeInput);
      expect(result).toBe(edgeExpected);
    });

    it('should throw on invalid input', () => {
      expect(() => functionToTest(invalid)).toThrow();
    });
  });
});
```

### E2E Test Templates

For each user story, write both action-based and interaction-based tests.

#### Action-Based E2E Test Template

```typescript
import { test, expect } from '@playwright/test';
import { getReduxState } from './helpers';

test.describe('Feature Name - Action-Based', () => {
  test('should complete workflow via Redux actions', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    
    // Dispatch Redux actions to set up state
    await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      store.dispatch({ type: 'ADD_PLAYER' });
      store.dispatch({ type: 'START_GAME' });
    });
    
    await page.waitForTimeout(100);
    
    // Verify state changes
    const state = await getReduxState(page);
    expect(state.game.phase).toBe('seating');
    expect(state.game.players).toHaveLength(1);
  });
});
```

#### Interaction-Based E2E Test Template

```typescript
import { test, expect } from '@playwright/test';
import { getReduxState } from './helpers';

test.describe('Feature Name - Interaction-Based', () => {
  test('should complete workflow via UI interactions', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    
    // Get button coordinates and click
    const addPlayerCoords = await getAddPlayerButtonCoords(page);
    await page.mouse.click(addPlayerCoords.x, addPlayerCoords.y);
    await page.waitForTimeout(100);
    
    const startCoords = await getStartButtonCoords(page);
    await page.mouse.click(startCoords.x, startCoords.y);
    await page.waitForTimeout(100);
    
    // Verify state changes
    const state = await getReduxState(page);
    expect(state.game.phase).toBe('seating');
    expect(state.game.players).toHaveLength(1);
    
    // Screenshot for documentation (optional)
    await page.screenshot({ 
      path: 'tests/e2e/user-stories/NNN-feature/001-step.png' 
    });
  });
});
```

### Testing Game Logic

When testing game logic, focus on:

1. **Board Operations**
   - Position conversions
   - Neighbor calculations
   - Valid position checks

2. **Tile Operations**
   - Connection mappings
   - Rotation calculations
   - Edge directions

3. **Flow Propagation**
   - Single tile flows
   - Multi-tile chains
   - Flow termination conditions
   - Circular path handling

4. **Legality Checking**
   - Valid placements
   - Blocking detection
   - Sharp tile restrictions

5. **Victory Conditions**
   - Flow victory (connecting opposite edges)
   - Blocking victory
   - Tie detection

### Testing Redux State

When testing Redux state management:

1. **Verify Immutability**
   ```typescript
   it('should not mutate state', () => {
     const state = gameReducer(initialState, action);
     expect(state).not.toBe(initialState); // New object
     expect(state.someArray).not.toBe(initialState.someArray); // New array
   });
   ```

2. **Test State Transitions**
   ```typescript
   it('should transition through phases', () => {
     let state = initialState;
     expect(state.phase).toBe('configuration');
     
     state = gameReducer(state, startGame());
     expect(state.phase).toBe('seating');
     
     // Complete seating...
     expect(state.phase).toBe('gameplay');
   });
   ```

3. **Test Action Creators**
   ```typescript
   it('should create correct action', () => {
     const action = addPlayer('#0173B2', 0);
     expect(action.type).toBe('ADD_PLAYER');
     expect(action.payload).toEqual({ color: '#0173B2', edge: 0 });
   });
   ```

### Testing E2E Flows

When testing E2E flows:

1. **Use User Stories**
   - Organize tests as coherent user narratives
   - Save screenshots at key steps
   - Use numbered naming (001-, 002-, etc.)

2. **Use Deterministic Data**
   - Fixed random seeds for tile shuffling
   - Predetermined player colors and positions
   - Reproducible game states

3. **Test Complete Workflows**
   - Start from initial state
   - Complete entire user journey
   - Verify final state

4. **Screenshot Guidelines**
   - One action per screenshot
   - Descriptive file names
   - Clear progression
   - Consistent state

## Test Coverage

The project maintains **98%+ code coverage** for critical modules:

```
File             | % Stmts | % Branch | % Funcs | % Lines
-----------------|---------|----------|---------|--------
game/board.ts    |   100   |   100    |   100   |   100
game/flows.ts    |   100   |   100    |   100   |   100
game/tiles.ts    |   100   |   100    |   100   |   100
game/victory.ts  |   100   |   100    |   100   |   100
redux/reducer.ts |   100   |   100    |   100   |   100
redux/selectors  |   100   |   100    |   100   |   100
```

### Coverage Configuration

Coverage is configured in `vitest.config.ts`:

```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'html', 'lcov'],
  reportsDirectory: './coverage',
  include: ['src/game/**/*.ts', 'src/redux/**/*.ts'],
  exclude: ['src/game/index.ts', 'src/redux/types.ts'],
  clean: true,
}
```

### Coverage Goals

- **Game Logic**: 100% coverage (pure functions, critical logic)
- **Redux State**: 95%+ coverage (state management, reducers)
- **Rendering**: Not covered (Canvas rendering, visual verification via E2E)
- **Input**: Not covered (event handlers, verified via E2E)

### Viewing Coverage Reports

```bash
npm run test:coverage
open coverage/index.html  # Or view in browser
```

## Test Infrastructure

### Vitest Configuration

Located in `vitest.config.ts`:

- **Environment**: Node.js (no DOM needed for unit tests)
- **Globals**: Enabled (describe, it, expect available globally)
- **Exclude**: E2E tests run separately via Playwright
- **Coverage**: V8 provider with HTML reports

### Playwright Configuration

Located in `playwright.config.ts`:

- **Browser**: Chromium (Desktop Chrome)
- **Base URL**: http://localhost:5173 (Vite dev server)
- **Web Server**: Automatically starts/stops dev server
- **Retries**: 2 retries in CI, 0 locally
- **Font Rendering**: Consistent settings for screenshot stability
- **Trace**: On first retry (for debugging)

### Test Helpers

Located in `tests/e2e/helpers.ts`:

1. **`getReduxState(page)`** - Extract Redux state from browser
2. **`completeSeatingPhase(page, numPlayers)`** - Setup game to gameplay phase
3. **`pauseAnimations(page)`** - Stop animations for stable screenshots
4. **`getEdgeButtonCoordinates(page, ...)`** - Calculate UI element positions

### Special Test Files

- **`coverage.test.ts`** - Additional tests to reach 100% coverage
- **`flow-bug-*.test.ts`** - Regression tests for specific bugs
- **`complete-game-flows.test.ts`** - Tests using expectation files

### Expectation Files

Some tests use external expectation files for compact test data:

```
tests/game/complete-test-999.expectations
```

Format:
```
[P1_FLOWS]
0: -3,0:0 -3,0:1
1: -3,0:5 -3,0:3 -2,0:0

[P2_FLOWS]
0: 3,-3:3 3,-3:4

[MOVE_PREFIXES]
1 p1={0:2,1:2} p2={}
```

This format is more compact and maintainable than inline test data (59 lines vs 1198 lines).

## Best Practices

### General Guidelines

1. **Write Tests First** (TDD)
   - Write failing test
   - Implement minimal code to pass
   - Refactor with confidence

2. **Keep Tests Focused**
   - One concept per test
   - Clear test names describing behavior
   - Avoid testing multiple things in one test

3. **Make Tests Deterministic**
   - Use fixed seeds for random operations
   - Avoid time-based conditions
   - Control all external inputs

4. **Test Edge Cases**
   - Empty inputs
   - Boundary values
   - Invalid inputs
   - Error conditions

5. **Avoid Test Interdependence**
   - Each test should be independent
   - Don't rely on test execution order
   - Setup state within each test

### Code-Specific Practices

#### Testing Pure Functions

```typescript
// Good: Test all paths
describe('getNeighborInDirection', () => {
  it('should return neighbor to the east', () => { /* ... */ });
  it('should return neighbor to the west', () => { /* ... */ });
  it('should handle board edges', () => { /* ... */ });
  it('should handle invalid directions', () => { /* ... */ });
});
```

#### Testing Redux Reducers

```typescript
// Good: Test state immutability
it('should create new state object', () => {
  const state = reducer(initialState, action);
  expect(state).not.toBe(initialState);
});

// Good: Test specific state changes
it('should add player to configPlayers', () => {
  const state = reducer(initialState, addPlayer('#0173B2', 0));
  expect(state.configPlayers).toHaveLength(1);
  expect(state.configPlayers[0].color).toBe('#0173B2');
});
```

#### Testing E2E Flows

For each user story, write both action-based and interaction-based tests:

```typescript
// Good: Action-based test (tests Redux logic)
test('player configuration - action-based', async ({ page }) => {
  await page.goto('/');
  
  await page.evaluate(() => {
    const store = (window as any).__REDUX_STORE__;
    store.dispatch({ type: 'ADD_PLAYER' });
    store.dispatch({ type: 'ADD_PLAYER' });
  });
  
  const state = await getReduxState(page);
  expect(state.game.configPlayers).toHaveLength(2);
});

// Good: Interaction-based test (tests UI triggers actions)
test('player configuration - interaction-based', async ({ page }) => {
  await page.goto('/');
  await page.screenshot({ path: 'user-stories/001-initial.png' });
  
  // Click add player button twice
  const coords = await getAddPlayerButtonCoords(page);
  await page.mouse.click(coords.x, coords.y);
  await page.screenshot({ path: 'user-stories/002-first-player.png' });
  
  await page.mouse.click(coords.x, coords.y);
  await page.screenshot({ path: 'user-stories/003-second-player.png' });
  
  const state = await getReduxState(page);
  expect(state.game.configPlayers).toHaveLength(2);
});
```

### Common Mistakes to Avoid

1. **Testing Implementation Details**
   - ❌ Test internal variables
   - ✅ Test public interface and behavior

2. **Brittle Tests**
   - ❌ Hardcode array lengths or exact values
   - ✅ Test relationships and properties

3. **Unclear Test Names**
   - ❌ `test('test 1', () => ...)`
   - ✅ `test('should propagate flow through connected tiles', () => ...)`

4. **Missing Edge Cases**
   - ❌ Only test happy path
   - ✅ Test error conditions, boundaries, empty inputs

5. **Slow Tests**
   - ❌ Unnecessary setup or complex operations
   - ✅ Minimal setup, focused assertions

## Common Patterns

### Testing Flow Propagation

```typescript
it('should trace flow through connected tiles', () => {
  const board = new Map<string, PlacedTile>();
  
  // Setup: Create connected tiles
  const tile1: PlacedTile = {
    type: TileType.NoSharps,
    rotation: 0,
    position: { row: 0, col: 0 },
  };
  board.set(positionToKey(tile1.position), tile1);
  
  // Execute: Trace flow
  const result = traceFlow(board, tile1.position, Direction.West, 'p1');
  
  // Verify: Check flow positions
  expect(result.positions.has(positionToKey(tile1.position))).toBe(true);
});
```

### Testing Victory Conditions

```typescript
it('should detect flow victory when opposite edges connected', () => {
  // Setup: Create winning flow
  const players = [/* ... */];
  const board = new Map<string, PlacedTile>();
  const flows = new Map([['p1', flowConnectingEdges]]);
  
  // Execute: Check victory
  const result = checkVictory(players, board, flows);
  
  // Verify: Winner detected
  expect(result.winners).toContain('p1');
  expect(result.winType).toBe('flow');
});
```

### Testing E2E with Both Approaches

For comprehensive testing, write both action-based and interaction-based tests:

```typescript
// Action-based: Fast, tests Redux logic
test('player configuration - actions', async ({ page }) => {
  await page.goto('/');
  
  await page.evaluate(() => {
    const store = (window as any).__REDUX_STORE__;
    store.dispatch({ type: 'ADD_PLAYER' });
  });
  
  const state = await getReduxState(page);
  expect(state.game.configPlayers).toHaveLength(1);
});

// Interaction-based: Tests UI + screenshots
test('player configuration - interactions', async ({ page }) => {
  const storyDir = 'tests/e2e/user-stories/001-player-configuration';
  let step = 1;
  
  await page.goto('/');
  await page.screenshot({ path: `${storyDir}/${pad(step++)}-initial.png` });
  
  // Click add player button
  await clickAddPlayer(page, 0);
  await page.screenshot({ path: `${storyDir}/${pad(step++)}-first-player.png` });
  
  const state = await getReduxState(page);
  expect(state.game.configPlayers).toHaveLength(1);
});
```

### Testing Color Swapping

```typescript
it('should swap colors when selecting used color', () => {
  // Setup: Two players with different colors
  let state = initialState;
  state = gameReducer(state, addPlayer('#0173B2', 0)); // Blue
  state = gameReducer(state, addPlayer('#DE8F05', 1)); // Orange
  
  const player1Id = state.configPlayers[0].id;
  const player2Id = state.configPlayers[1].id;
  
  // Execute: Player 1 wants Player 2's color
  state = gameReducer(state, changePlayerColor(player1Id, '#DE8F05'));
  
  // Verify: Colors swapped
  const p1 = state.configPlayers.find(p => p.id === player1Id);
  const p2 = state.configPlayers.find(p => p.id === player2Id);
  expect(p1?.color).toBe('#DE8F05'); // Now orange
  expect(p2?.color).toBe('#0173B2'); // Now blue
});
```

## Debugging Tests

### Debugging Unit Tests

1. **Use Vitest UI**
   ```bash
   npm run test:ui
   ```
   - Interactive test runner
   - View test results in browser
   - Filter and run specific tests

2. **Use Console Logging**
   ```typescript
   it('should do something', () => {
     console.log('State:', JSON.stringify(state, null, 2));
     // Test assertions...
   });
   ```

3. **Use Debugger**
   ```typescript
   it('should do something', () => {
     debugger; // Breakpoint
     const result = functionToTest(input);
     expect(result).toBe(expected);
   });
   ```
   Then run with Node debugger:
   ```bash
   npx vitest --inspect-brk
   ```

### Debugging E2E Tests

1. **View Screenshots**
   - Check `tests/e2e/user-stories/` for visual state
   - Compare current vs expected screenshots

2. **Use Playwright Trace**
   ```bash
   npx playwright test --trace on
   npx playwright show-trace trace.zip
   ```

3. **Debug Mode**
   ```bash
   npx playwright test --debug
   ```
   - Step through test execution
   - Inspect page state
   - Modify selectors interactively

4. **Console Output**
   ```typescript
   test('something', async ({ page }) => {
     const state = await getReduxState(page);
     console.log('Redux state:', state);
   });
   ```

5. **Headed Mode**
   ```bash
   npx playwright test --headed
   ```
   - See browser UI during test
   - Useful for visual debugging

### Common Issues

1. **Test Timeout**
   - Increase timeout: `test('...', async ({ page }) => { ... }, 60000)`
   - Check if dev server is running
   - Look for infinite loops

2. **Flaky E2E Tests**
   - Use explicit waits with conditions: `await page.waitForSelector('.element')`
   - Wait for load states: `await page.waitForLoadState('networkidle')`
   - Use stable selectors
   - Ensure animations complete with `pauseAnimations(page)`
   - Check for timing-dependent code

3. **Coverage Not 100%**
   - Check `coverage/index.html` for uncovered lines
   - Add tests in `coverage.test.ts`
   - Some lines may be defensive code (OK to skip)

4. **E2E Screenshot Mismatch**
   - Check font rendering settings in `playwright.config.ts`
   - Verify browser version consistency
   - Use `pauseAnimations(page)` for stable screenshots

## Contributing Tests

When contributing new tests:

1. **Match Existing Patterns**
   - Use similar structure to existing tests
   - Follow naming conventions
   - Use existing test helpers

2. **Document User Stories**
   - For E2E tests, add entry to `docs/testing/user-stories.md`
   - Create user story directory with screenshots
   - Use numbered steps (001-, 002-, etc.)

3. **Update This Document**
   - Add new test categories if needed
   - Document new helpers or patterns
   - Update coverage goals if changed

4. **Verify Test Quality**
   - Tests should be fast (< 1s per test ideally)
   - Tests should be deterministic (no random failures)
   - Tests should be clear and maintainable

## Quick Reference

### Running Tests

| Command | Purpose |
|---------|---------|
| `npm test` | Run unit tests in watch mode |
| `npm test -- --run` | Run unit tests once |
| `npm run test:coverage` | Run with coverage report |
| `npm run test:ui` | Interactive test UI |
| `npm run test:e2e` | Run E2E tests |
| `npx playwright test --debug` | Debug E2E tests |

### Test File Patterns

| Pattern | Location | Purpose |
|---------|----------|---------|
| `*.test.ts` | `tests/` | Unit/integration tests |
| `*.spec.ts` | `tests/e2e/` | E2E tests |
| `*.expectations` | `tests/game/` | Test expectation data |

### Key Testing Modules

| Module | Purpose |
|--------|---------|
| `vitest` | Unit test runner |
| `@playwright/test` | E2E test framework |
| `tests/e2e/helpers.ts` | E2E helper functions |
| `vitest.config.ts` | Unit test configuration |
| `playwright.config.ts` | E2E test configuration |

### Common Test Utilities

| Function | Purpose |
|----------|---------|
| `describe()` | Group related tests |
| `it()` | Define a test case |
| `expect()` | Assert expectations |
| `beforeEach()` | Setup before each test |
| `afterEach()` | Cleanup after each test |
| `vi.spyOn()` | Mock/spy on functions |

## Additional Resources

- **[flow-tests.md](flow-tests.md)** - Complete game flow testing strategy
- **[user-stories.md](user-stories.md)** - E2E user story organization
- **[AGENTS.md](../../AGENTS.md)** - Guidelines for AI agents
- **[DEVELOPMENT.md](../dev/DEVELOPMENT.md)** - Development setup guide

## Summary

The Quortex testing strategy emphasizes:

1. **Multiple test layers** - Unit, integration, and E2E tests
2. **High coverage** - 98%+ for critical game logic and state management
3. **Visual documentation** - Screenshot-based user stories for E2E tests
4. **Deterministic tests** - Fixed seeds and controlled inputs
5. **Fast feedback** - Quick unit tests, comprehensive E2E validation

By following this testing overview, contributors can confidently add features and fix bugs while maintaining the quality and reliability of the Quortex codebase.
