# Complete Game Test - Seed 888

## Overview
This test uses seed 888 to generate a deterministic, complete game sequence from lobby to finish.

## Game Characteristics
- **Seed**: 888
- **Actions**: 113 total actions
- **Result**: Full game with multiple tile placements
- **Players**: 2 (Blue at edge 0, Orange at edge 3)
- **Duration**: Extended game session (50+ moves)

## Files
- `888.actions` - JSONL file with all 113 Redux actions
- `888.expectations` - Board state expectations for final state
- `888.clicks` - UI click sequence for mouse-based replay

## Game Flow
1. **Lobby Phase** - Players join and select colors
2. **Seating Phase** - Players select starting edges
   - Player 2 (Orange) → Edge 0
   - Player 1 (Blue) → Edge 3
3. **Gameplay** - Deterministic tile placements based on seed 888
4. **Completion** - Game runs to natural conclusion

## Actions Sequence Summary
- Setup: 7 actions (add players, start game, select edges, shuffle)
- Gameplay: 106 actions (tile draws, placements, player turns)
- Average: ~2 actions per move (PLACE_TILE + NEXT_PLAYER + DRAW_TILE)

## Test Value
This test validates:
- Complete game flow from start to finish
- Deterministic behavior with seeded random generation
- Legal move selection algorithm
- Game state consistency through extended play
- All Redux actions work correctly in sequence

## Running the Test
```bash
# Generate test files (if not already present)
npx tsx scripts/generate-game-test.ts 888 tests/e2e/user-stories/005-complete-game/888

# Run E2E test with action replay
npm run test:e2e -- tests/e2e/complete-game-actions.spec.ts
```
