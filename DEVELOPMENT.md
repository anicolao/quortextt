# Quortex Development Guide

This document provides instructions for building, testing, and developing the Quortex game.

## Prerequisites

- Node.js 18+ and npm
- Git

## Getting Started

### Installation

```bash
# Clone the repository
git clone https://github.com/anicolao/quortextt.git
cd quortextt

# Install dependencies
npm install
```

## Development Workflow

### Building the Project

Build the TypeScript code and create a production bundle:

```bash
npm run build
```

This command:
1. Compiles TypeScript files using `tsc`
2. Creates an optimized production build using Vite

Always run the build before starting a task to ensure there are no TypeScript errors.

### Running Tests

#### Run All Unit Tests

```bash
npm test
```

This runs all unit tests in watch mode using Vitest.

#### Run Tests Once (CI Mode)

```bash
npm run test:coverage
```

This runs all tests once and generates a coverage report.

#### Run Tests with UI

```bash
npm run test:ui
```

Opens an interactive test UI in your browser.

#### Run E2E Tests

```bash
npm run test:e2e
```

Runs end-to-end tests using Playwright. These tests verify the application's behavior in a real browser environment.

**E2E Testing Strategy**: All E2E tests generate screenshots organized as **user stories**. Each test suite corresponds to a user story with numbered screenshots that tell a coherent narrative.

- Screenshots are saved in `tests/e2e/user-stories/NNN-story-name/`
- Each screenshot is numbered sequentially: `001-description.png`, `002-description.png`
- See `tests/e2e/user-stories/README.md` for complete documentation
- Contributors can verify test expectations by walking through screenshots in order

**User Stories**:
- `001-player-configuration`: Setting up players before a game
- `002-gameplay-rendering`: Initial gameplay screen display
- `003-flow-propagation`: Flow behavior from player edges
- `004-multi-tile-flow`: Multi-tile flow progression

For detailed information on the E2E testing approach, see `tests/e2e/user-stories/README.md`.


### Development Server

Start the development server with hot module replacement:

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or the next available port).

## Project Structure

```
quortextt/
├── src/
│   ├── game/           # Pure game logic (Phase 1 - COMPLETE)
│   │   ├── types.ts    # Core type definitions
│   │   ├── board.ts    # Hexagonal board utilities
│   │   ├── tiles.ts    # Tile types and flow patterns
│   │   ├── flows.ts    # Flow propagation logic
│   │   ├── legality.ts # Legal move validation
│   │   ├── victory.ts  # Victory condition checking
│   │   └── index.ts    # Main export
│   ├── redux/          # State management
│   ├── rendering/      # Display layer
│   └── input/          # User interaction
├── tests/
│   ├── game/           # Game logic unit tests
│   │   ├── board.test.ts
│   │   ├── tiles.test.ts
│   │   ├── flows.test.ts
│   │   ├── legality.test.ts
│   │   └── victory.test.ts
│   ├── e2e/           # End-to-end tests
│   └── reducer.test.ts
├── DESIGN_DOC.md      # Implementation design
├── RULES.md           # Game rules
└── package.json
```

## Testing Guidelines

### Before Starting Any Task

**ALWAYS** build and run tests first:

```bash
npm run build
npm test
```

This ensures:
- No existing TypeScript errors
- All tests pass
- You understand the current state of the codebase

### After Completing Work

**ALWAYS** build and run tests again:

```bash
npm run build
npm test
```

This ensures:
- No regressions were introduced
- All new code compiles correctly
- All tests still pass

### Writing Tests

- All game logic in `src/game/` must have corresponding tests in `tests/game/`
- Tests should be comprehensive and cover edge cases
- Use descriptive test names that explain what is being tested
- Group related tests using `describe` blocks
- Current test coverage: 106 tests covering all Phase 1 game logic

## Phase 1 Status (COMPLETE)

Phase 1 implements the core game logic as pure TypeScript functions with comprehensive unit tests:

- ✅ Hexagonal coordinate system
- ✅ Tile types and flow patterns
- ✅ Flow propagation algorithm
- ✅ Legal move validation
- ✅ Victory condition checking
- ✅ 106 unit tests (all passing)

All Phase 1 code is pure TypeScript with no UI dependencies, following Redux patterns for immutable state management.

## Code Style

- Use TypeScript strict mode
- Follow existing code patterns
- Use readonly for immutable types
- Prefer pure functions without side effects
- Add JSDoc comments for exported functions
- Use descriptive variable and function names

## Git Workflow

1. Work on feature branches
2. Commit frequently with descriptive messages
3. Ensure all tests pass before pushing
4. Create pull requests for review

## Troubleshooting

### Build Errors

If you encounter TypeScript errors:

```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build
```

### Test Failures

If tests fail unexpectedly:

```bash
# Run tests with verbose output
npm test -- --reporter=verbose

# Run a specific test file
npm test -- tests/game/board.test.ts
```

### Coverage Issues

The v8 coverage reporter may show 0% coverage for TypeScript files due to source map issues. This is a known limitation. The actual test coverage is comprehensive (106 tests covering all game logic functions).

## Additional Resources

- [DESIGN_DOC.md](./DESIGN_DOC.md) - Detailed implementation design
- [RULES.md](./RULES.md) - Game rules
- [Vitest Documentation](https://vitest.dev/)
- [Vite Documentation](https://vitejs.dev/)
