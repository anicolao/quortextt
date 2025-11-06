# Complete Game Testing Infrastructure

This document describes the new infrastructure for complete game e2e testing.

## Overview

The new testing approach uses generated game files to enable deterministic, reproducible e2e tests:

1. **Game Generator** - Generates a random complete game from a seed
2. **File Formats** - Three files per game test:
   - `.actions` - JSONL file of Redux actions
   - `.clicks` - JSONL file of UI click sequence  
   - `.expectations` - Board state expectations for validation
3. **Generic Tests** - Reusable e2e tests that work with any game files

## File Formats

### .actions File

JSONL format (one action per line):
```jsonl
{"type":"ADD_PLAYER","payload":{"color":"#0173B2","edge":0}}
{"type":"START_GAME"}
{"type":"PLACE_TILE","payload":{"position":{"row":-1,"col":1},"rotation":5}}
```

### .clicks File

JSONL format describing UI interactions:
```jsonl
{"type":"click","target":"edge-button","x":123,"y":456,"description":"Click to add player"}
{"type":"wait","delay":200,"description":"Wait for player addition"}
```

### .expectations File

Custom format matching `complete-test-999.expectations`:
```
[P1_FLOWS]
0: -3,0:0 -3,0:1
1: -3,0:5 -3,0:3 -2,0:0

[P2_FLOWS]
0: 3,-3:3 3,-3:4

[MOVE_PREFIXES]
1 p1={0:2,1:2} p2={}
2 p1={0:2,1:4} p2={0:2}
```

## Generating Test Files

Use the CLI script to generate all three files for a seed:

```bash
npx tsx scripts/generate-game-test.ts <seed> <output-dir>

# Example:
npx tsx scripts/generate-game-test.ts 999 tests/e2e/user-stories/005-complete-game/999
```

This creates:
- `999.actions` - All Redux actions for the game
- `999.clicks` - UI click sequence
- `999.expectations` - Board state expectations

## Test Structure

### Directory Layout

```
tests/e2e/user-stories/
├── 005-complete-game/
│   ├── README.md                    # Overview of action-based tests
│   ├── 999/
│   │   ├── 999.actions             # Game actions
│   │   ├── 999.expectations        # Expected board state
│   │   ├── README.md               # Description of this specific game
│   │   └── screenshots/            # Screenshots from test run
│   └── 1234/
│       └── ...
└── 006-complete-game-mouse/
    ├── README.md                    # Overview of click-based tests
    ├── 999/
    │   ├── 999.clicks              # UI click sequence
    │   ├── 999.expectations        # Expected board state
    │   ├── README.md               # Description of this specific game
    │   └── screenshots/            # Screenshots from test run
    └── 1234/
        └── ...
```

## Utilities API

### Game Generator

```typescript
import { generateRandomGameWithState } from './tests/utils/gameGenerator';

// Generate game with actions and final state
const { actions, finalState } = generateRandomGameWithState(seed, maxMoves);

// Or just get actions
const actions = generateRandomGame(seed, maxMoves);
```

### Action Converter

```typescript
import { actionsToClicks, generateExpectations } from './tests/utils/actionConverter';

// Convert actions to UI clicks
const clicks = actionsToClicks(actions);

// Generate expectations from final game state
const expectations = generateExpectations(finalState);
```

## Creating New Tests

### 1. Generate Test Files

```bash
npx tsx scripts/generate-game-test.ts 1234 tests/e2e/user-stories/005-complete-game/1234
```

### 2. Create README for the Game

Document what makes this game interesting (e.g., specific victory condition, blocking scenario, etc.)

### 3. Run the Generic E2E Tests

The generic tests automatically discover and run all games in the directory structure.

## Implementation Status

### ✅ Completed
- Game generator utility
- Action converter utility
- CLI script for generating test files
- Comprehensive unit tests for utilities

### 🚧 Remaining Work
- Create generic e2e test for action replay (005-complete-game)
- Create generic e2e test for click replay (006-complete-game-mouse)
- Refactor existing 005/006 tests to new structure
- Generate READMEs for test directories
- Create example games with different seeds

## Benefits

1. **Deterministic** - Same seed always produces same game
2. **Reproducible** - Can replay exact game sequence
3. **Scalable** - Easy to add new test cases
4. **Debuggable** - Clear action/click sequence for debugging
5. **Documented** - READMEs explain each test case
6. **Automated** - Tests validate board state automatically

## Migration Plan

1. Keep existing 005-complete-game and 006-complete-game-mouse tests as-is initially
2. Generate new test files in subdirectories (e.g., 005-complete-game/999/)
3. Create generic test runners
4. Validate new tests work correctly
5. Deprecate old test files once confident in new approach
6. Update documentation and CI/CD pipelines
