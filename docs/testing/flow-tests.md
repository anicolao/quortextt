# Complete Game Flow Tests

This directory contains tests that validate ordered flow sequences across complete games using different seeds.

## File Structure

- `complete-game-flows.test.ts` - Generic test that loads expectations from files
- `complete-test-SEED.expectations` - Expectations files for specific seeds (e.g., `complete-test-999.expectations`)

## Expectations File Format

The expectations files use a compact text format:

```
# Comments start with #

[P1_FLOWS]
0: -3,0:0 -3,0:1
1: -3,0:5 -3,0:3 -2,0:0 -2,0:2 ...

[P2_FLOWS]
0: 3,-3:3 3,-3:4 ...

[MOVE_PREFIXES]
1 p1={0:2,1:2} p2={}
2 p1={0:2,1:2,2:2,3:2} p2={}
```

Each flow is represented as space-separated `position:direction` pairs. Move prefixes indicate how many elements of each flow exist at each move.

## Adding a New Test Seed

To add a test for a new seed (e.g., seed 1234):

1. Create a script to generate the expectations (or modify the generation script to use your seed)
2. Run the script to generate `complete-test-1234.expectations`
3. Add the test in `complete-game-flows.test.ts`:
   ```typescript
   runCompleteGameTest(1234);
   ```

The test will automatically load and validate the expectations from the file.

## Why This Format?

- **Compact**: 59 lines vs 1198 lines for the same data
- **Readable**: Each flow is on one line, easy to scan
- **Maintainable**: Separates test logic from test data
- **Reusable**: Same test code works for any seed
- **Version control friendly**: Small diffs when flows change
