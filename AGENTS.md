# Agent Guidelines for Quortex Development

This document provides essential guidelines for AI agents working on the Quortex codebase.

## Core Principles

1. **Follow Existing Patterns**: Study the existing code structure before making changes. This is a TypeScript game implementation with Redux state management and Canvas rendering.

2. **Minimal Changes**: Make the smallest possible changes to accomplish the task. Don't refactor unrelated code.

3. **Test-Driven**: Always run tests before and after changes:
   ```bash
   npm run build
   npm test
   npm run test:e2e
   ```

4. **Documentation Location**: All documentation is organized in the `docs/` directory:
   - `docs/RULES.md` - Game rules and mechanics
   - `docs/designs/` - Design documents and specifications
   - `docs/dev/` - Development guides and debugging information
   - `docs/testing/` - Testing strategies and documentation

## Project Structure

- `src/game/` - Pure game logic (immutable, well-tested)
- `src/redux/` - State management with Redux
- `src/rendering/` - Canvas-based rendering
- `src/input/` - User interaction handling
- `tests/` - Unit and E2E tests

## Before Starting Work

1. Read relevant documentation in `docs/`
2. Understand the game rules in `docs/RULES.md`
3. Review design documents in `docs/designs/`
4. Check development guidelines in `docs/dev/DEVELOPMENT.md`
5. Run the build and tests to understand current state

## Making Changes

1. **Game Logic**: Changes to `src/game/` require corresponding test updates
2. **State Management**: Redux actions and reducers must be immutable
3. **Rendering**: Canvas rendering code should be performant and maintainable
4. **Testing**: Write tests that match existing test patterns

## Common Tasks

### Adding a Feature
1. Review design docs to understand if it aligns with the vision
2. Write tests first (TDD approach)
3. Implement minimal changes
4. Update relevant documentation

### Fixing a Bug
1. Write a failing test that reproduces the bug
2. Fix the bug with minimal changes
3. Verify all tests pass
4. Document if it's a subtle issue

### Refactoring
1. Ensure comprehensive test coverage first
2. Make incremental changes
3. Run tests after each change
4. Don't mix refactoring with feature work

## Documentation Standards

- Keep documentation up to date with code changes
- Use clear, concise language
- Include code examples where helpful
- Reference related documentation

## Quality Standards

- TypeScript strict mode is enabled
- All game logic must have unit tests
- UI changes require E2E tests with screenshots
- **CRITICAL**: When making visual changes to the UI (rendering, colors, layouts, backgrounds, etc.), you **MUST** regenerate all E2E screenshots by running `npm run test:e2e`. Do not skip this step.
- Code should be self-documenting with clear naming
- Add JSDoc comments for exported functions

## Getting Help

If you encounter issues:
1. Review error messages carefully
2. Check relevant documentation in `docs/`
3. Look at similar existing code patterns
4. Run tests with verbose output for more context
