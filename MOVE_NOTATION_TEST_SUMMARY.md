# Move Notation E2E Test - Implementation Summary

## Objective

Create an end-to-end test to validate the move notation system, specifically testing rotation notation with Type 1 (OneSharp) tiles to make rotation visually obvious.

## Requirements Met

✅ **All requirements from the problem statement have been implemented:**

1. ✅ E2E test with two players
2. ✅ One player on top edge (edge 0 - NW edge)
3. ✅ One player on SW edge (edge 4)
4. ✅ Bag filled with only Type 1 tiles (configured via tile distribution settings)
5. ✅ Each player places a tile on their edge
6. ✅ Tiles placed with sharp corner pointed SE (rotation 5)
7. ✅ Move list pops up showing the notation
8. ✅ Screenshots captured for user validation

## Implementation Details

### Test File
- **Location:** `tests/e2e/move-notation-rotation.spec.ts`
- **Test Suite:** "Move Notation with Rotation"
- **Status:** ✅ Passing

### Configuration
- **Deterministic Seed:** 54321 (for reproducible results)
- **Tile Distribution:** `[0, 1, 0, 0]` (only Type 1/OneSharp tiles)
- **Board Radius:** 3 (default, 37 hexes)

### Player Setup
- **Player P2** (Internal ID): 
  - Edge 0 (NW edge / top of board)
  - Color: Orange (#DE8F05)
  - **Displays as P1 in notation** (first player added)
  
- **Player P1** (Internal ID):
  - Edge 4 (SW edge)
  - Color: Blue (#0173B2)
  - **Displays as P2 in notation** (second player added)

### Tile Placements
Both players placed Type 1 (OneSharp) tiles with **rotation 5**:

1. **First Move (P2 on edge 0):**
   - Position: `(-3, 1)` (internal coordinates)
   - Rotation: 5
   - Notation: **P1A2T1NW**

2. **Second Move (P1 on edge 4):**
   - Position: `(1, -3)` (internal coordinates)
   - Rotation: 5
   - Notation: **P2A3T1NE**

## Key Findings

### Rotation Notation Behavior

**Important Discovery:** Both tiles were placed with the **same internal rotation (5)**, but the notation shows **different orientations**:

- Player on edge 0: rotation 5 → **NW** orientation
- Player on edge 4: rotation 5 → **NE** orientation

**Explanation:** The notation system converts absolute rotation values to player-relative orientations. Each player's edge position acts as their "bottom," and rotations are expressed relative to that perspective.

### Type 1 Tile Characteristics

Type 1 (OneSharp) tiles have:
- One sharp corner connecting SW (dir 0) and SE (dir 5)
- In rotation 0: sharp corner at south (bottom)
- In rotation 5: sharp corner rotates 300° clockwise (60° counter-clockwise)

This makes rotation differences easily visible in the screenshots, fulfilling the requirement.

## Test Artifacts

### Screenshots Generated
1. `001-initial-state.png` - Board after seating, before any moves
2. `002-first-player-placed.png` - After first tile placement
3. `003-second-player-placed.png` - After second tile placement  
4. `004-move-list-opened.png` - **KEY SCREENSHOT** - Move list with notation visible

### Documentation
- `tests/e2e/user-stories/007-move-notation/README.md` - Detailed test documentation
- `docs/testing/user-stories.md` - Updated with user story 007

## Test Execution

```bash
# Run this specific test
npx playwright test tests/e2e/move-notation-rotation.spec.ts

# Run all e2e tests
npm run test:e2e
```

**Current Status:** All 58 e2e tests passing (includes this new test)

## Next Steps for User

The user can now:

1. **Review Screenshots** in `tests/e2e/user-stories/007-move-notation/`
   - Especially `004-move-list-opened.png` showing the notation

2. **Validate Notation**
   - Check if P1A2T1NW and P2A3T1NE match expectations
   - Verify rotation notation (NW vs NE) is correct
   - Identify the specific bug in rotation notation

3. **Provide Expected Notation**
   - Once the user reviews the screenshots, they can specify what the notation *should* be
   - We can then add assertions to the test and fix the bug

## Technical Notes

### Tile Distribution via Settings
As per the new requirement, tile types are controlled via game settings:
```typescript
store.dispatch({ 
  type: 'UPDATE_SETTINGS', 
  payload: { 
    tileDistribution: [0, 1, 0, 0] // [NoSharps, OneSharp, TwoSharps, ThreeSharps]
  } 
});
```

This is passed to `START_GAME` action and used by the tile deck creation system.

### Player Turn Management
After placing a tile, `NEXT_PLAYER` action must be dispatched explicitly to advance the turn:
```typescript
store.dispatch({ type: 'PLACE_TILE', payload: { position, rotation } });
store.dispatch({ type: 'NEXT_PLAYER' });
```

### Notation Module Import
The notation formatting is done in Node.js context (not browser):
```typescript
const { formatMoveHistory } = await import('../../src/game/notation.js');
```

## Conclusion

The test successfully demonstrates the user story and captures all necessary information for validating the move notation system. The screenshots clearly show:
- The board state
- Type 1 tiles with visible rotation
- The move list with notation

The user can now review these results to identify and document the expected notation format, enabling us to add validation and fix any bugs.
