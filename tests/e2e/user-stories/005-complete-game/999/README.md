# Complete Game Test - Seed 999

## Overview
This test uses seed 999 to generate a deterministic game sequence. This seed was originally used in `complete-game-flows.test.ts` and serves as a baseline for the new testing infrastructure.

## Game Characteristics
- **Seed**: 999
- **Actions**: 71 total actions
- **Result**: Complete game with strategic tile placements
- **Players**: 2 (Blue at edge 0, Orange at edge 3)
- **Duration**: Medium-length game

## Files
- `999.actions` - JSONL file with all 71 Redux actions
- `999.expectations` - Board state expectations for validation
- `999.clicks` - UI click sequence for mouse-based replay

## Historical Context
Seed 999 was used in the original `complete-test-999.expectations` file and `complete-game-flows.test.ts`. This test maintains compatibility with that existing test infrastructure while demonstrating the new file-based approach.

## Game Flow
1. **Lobby Phase** - Players join and select colors
2. **Seating Phase** - Players select starting edges
   - Player 1 (Blue) → Edge 0
   - Player 2 (Orange) → Edge 3
3. **Gameplay** - Deterministic tile placements
4. **Completion** - Natural game conclusion

## Actions Sequence Summary
- Setup: 7 actions (lobby and seating)
- Gameplay: 64 actions (approximately 21 moves)
- Pattern: DRAW_TILE → PLACE_TILE → NEXT_PLAYER cycle

## Test Value
This test is valuable because:
- It provides continuity with existing test infrastructure
- Validates the new generator produces consistent results
- Serves as a known-good baseline for comparison
- Demonstrates a typical-length game scenario

## Comparison with Legacy Test
The original `complete-test-999.expectations` used a different action sequence that:
- Started with ADD_PLAYER actions
- Used the same seed (999)
- Validated flow sequences after each move

This new test:
- Uses the same seed for consistency
- Generates the complete action log
- Provides both action-based and click-based replay options
- Maintains compatibility with expectation format

## Running the Test
```bash
# Generate test files (if not already present)
npx tsx scripts/generate-game-test.ts 999 tests/e2e/user-stories/005-complete-game/999

# Run E2E test with action replay
npm run test:e2e -- tests/e2e/complete-game-actions.spec.ts
```
