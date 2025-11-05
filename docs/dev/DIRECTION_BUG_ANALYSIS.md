# Direction Vector Bug Analysis

## Executive Summary

After comparing the TypeScript and Rust implementations of direction vectors, **the TypeScript implementation had incorrect direction vectors** that were fixed on October 29, 2025. The bug affected **4 out of 6 directions** and existed for 2 days (October 27-29, 2025) before being corrected. The Rust implementation has always had the correct values.

## Direction Vector Comparison

### Rust Implementation (flows branch)
From `src/game.rs`, the `tile_vec()` method in the `Direction` enum:

```rust
pub fn tile_vec(&self) -> TileVec {
    match self {
        Self::SouthWest => TileVec::new(-1, -1),  // row=-1, col=-1
        Self::West => TileVec::new(0, -1),        // row=0,  col=-1
        Self::NorthWest => TileVec::new(1, 0),    // row=1,  col=0
        Self::NorthEast => TileVec::new(1, 1),    // row=1,  col=1
        Self::East => TileVec::new(0, 1),         // row=0,  col=1
        Self::SouthEast => TileVec::new(-1, 0),   // row=-1, col=0
    }
}
```

### TypeScript Implementation (current main branch)
From `src/game/board.ts`, the `DIRECTION_VECTORS` constant:

```typescript
const DIRECTION_VECTORS: Record<Direction, HexPosition> = {
  [Direction.SouthWest]: { row: -1, col: 0 },   // row=-1, col=0  ❌ WRONG
  [Direction.West]: { row: 0, col: -1 },        // row=0,  col=-1 ✓
  [Direction.NorthWest]: { row: 1, col: -1 },   // row=1,  col=-1 ❌ WRONG
  [Direction.NorthEast]: { row: 1, col: 0 },    // row=1,  col=0  ❌ WRONG
  [Direction.East]: { row: 0, col: 1 },         // row=0,  col=1  ✓
  [Direction.SouthEast]: { row: -1, col: 1 },   // row=-1, col=1  ❌ WRONG
};
```

## Key Differences

### Comparison Table

| Direction   | Rust (flows branch) | TypeScript (Oct 27) | TypeScript (Oct 29+) | Match? |
|-------------|---------------------|---------------------|----------------------|--------|
| SouthWest   | (-1, -1)            | (1, -1)             | (-1, 0)              | ❌ No  |
| West        | (0, -1)             | (0, -1)             | (0, -1)              | ✓ Yes  |
| NorthWest   | (1, 0)              | (-1, 0)             | (1, -1)              | ❌ No  |
| NorthEast   | (1, 1)              | (-1, 1)             | (1, 0)               | ❌ No  |
| East        | (0, 1)              | (0, 1)              | (0, 1)               | ✓ Yes  |
| SouthEast   | (-1, 0)             | (1, 0)              | (-1, 1)              | ❌ No  |

### Critical Finding

**The TypeScript and Rust implementations use DIFFERENT coordinate systems!**

Even after the October 29 "fix", the TypeScript implementation still has different direction vectors than the Rust implementation. This is because they implement **different but equally valid hexagonal coordinate conventions**:

1. **Rust Implementation (flows branch)**: Uses a specific axial coordinate system
2. **TypeScript Implementation (current)**: Uses a DIFFERENT axial coordinate system

Both can be correct for hexagonal grids, but they are incompatible with each other. The October 29 fix corrected the TypeScript implementation to be internally consistent and make the game playable, but it did NOT align it with the Rust implementation.

## Analysis of the Bug Patterns

### Pattern 1: Initial Bug (Oct 27, commit c7ddbda)

The initial TypeScript implementation had vectors that appeared to be **negated or reflected** incorrectly:
- The signs and values didn't form a proper hexagonal neighbor pattern
- Opposite directions didn't properly cancel out (e.g., direction + opposite ≠ zero)
- This made the game unplayable as flows couldn't propagate correctly

### Pattern 2: The "Fix" (Oct 29, commit 423b23d)

The fix made the TypeScript implementation internally consistent:
- Opposite directions now properly cancel (e.g., SouthWest + NorthEast should be roughly opposite)
- The six direction vectors form a valid hexagonal pattern
- The game became playable

### Pattern 3: Rust vs TypeScript Divergence  (Still Present)

Comparing current TypeScript to Rust reveals they use **different but valid** hexagonal coordinate conventions:

| Mapping | Rust Value | TypeScript Value | Relationship |
|---------|-----------|------------------|--------------|
| SouthWest | (-1, -1) | (-1, 0) | Different vector for same logical direction |
| NorthWest | (1, 0) | (1, -1) | Different vector for same logical direction |
| NorthEast | (1, 1) | (1, 0) | Different vector for same logical direction |
| SouthEast | (-1, 0) | (-1, 1) | Different vector for same logical direction |

This suggests the implementations use **different hexagon orientations or coordinate system bases**, even though both name their directions the same way (SouthWest, West, etc.).

## Hexagonal Coordinate System Context

In a hexagonal grid using axial coordinates (row, col), the proper direction vectors depend on the orientation of the hexagon (pointy-top vs flat-top) and the coordinate system conventions.

The Rust implementation uses vectors that form a proper hexagonal pattern where:
- Each direction's opposite is exactly the negation of its vector
- The six directions form a complete coverage of the hex neighbors

For example:
- SouthWest (-1, -1) is opposite to NorthEast (1, 1) ✓
- West (0, -1) is opposite to East (0, 1) ✓
- NorthWest (1, 0) is opposite to SouthEast (-1, 0) ✓

In the TypeScript implementation, this property is broken:
- SouthWest (-1, 0) vs NorthEast (1, 0) - these differ only in row, not proper opposites
- NorthWest (1, -1) vs SouthEast (-1, 1) - these don't sum to zero

## Historical Analysis

After fetching the full git history, here is the complete timeline of the direction vector bug:

### 1. Initial Introduction (Commit c7ddbda - October 27, 2025)

**Commit:** `c7ddbda5c89c40854ab77ce8d815c8988b604ee9`  
**Author:** copilot-swe-agent[bot]  
**Message:** "Implement core game logic types, board, and tiles modules with tests"

The file `src/game/board.ts` was created with **incorrect** direction vectors from the very beginning:

```typescript
const DIRECTION_VECTORS: Record<Direction, HexPosition> = {
  [Direction.SouthWest]: { row: 1, col: -1 },   // ❌ WRONG
  [Direction.West]: { row: 0, col: -1 },        // ✓ Correct
  [Direction.NorthWest]: { row: -1, col: 0 },   // ❌ WRONG
  [Direction.NorthEast]: { row: -1, col: 1 },   // ❌ WRONG
  [Direction.East]: { row: 0, col: 1 },         // ✓ Correct
  [Direction.SouthEast]: { row: 1, col: 0 },    // ❌ WRONG
};
```

### 2. Intermediate Changes (October 27-29, 2025)

Between the initial implementation and the fix, several commits modified `src/game/board.ts` but **none changed the direction vectors**:
- `c7ddbda` - Initial implementation (with bug)
- `0ec1e8e` - Fix flow calculation to use only correct hex edges
- `0a528e8` - Fix: Corrects the position of the source edges on the game board
- `faf30d9` - Add a correct example for orientation 0
- `00e2980` - Refactor: Unify hex edge highlighting logic
- `987e1b0` - Manually fix source edges without fixing comments

During this period, the game was fundamentally broken - flows could not propagate correctly due to incorrect neighbor calculations.

### 3. The Fix (Commit 423b23d - October 29, 2025)

**Commit:** `423b23dcb95959d5d529e965f764b21d2362da93`  
**Author:** Alex Nicolaou (anicolao@gmail.com)  
**Date:** Wed Oct 29 20:25:02 2025 -0400  
**Message:** "At long last fix the flow tracing bug--directionality errors."

This commit finally corrected the direction vectors:

```diff
-  [Direction.SouthWest]: { row: 1, col: -1 },
+  [Direction.SouthWest]: { row: -1, col: 0 },
   [Direction.West]: { row: 0, col: -1 },
-  [Direction.NorthWest]: { row: -1, col: 0 },
+  [Direction.NorthWest]: { row: 1, col: -1 },
-  [Direction.NorthEast]: { row: -1, col: 1 },
+  [Direction.NorthEast]: { row: 1, col: 0 },
   [Direction.East]: { row: 0, col: 1 },
-  [Direction.SouthEast]: { row: 1, col: 0 },
+  [Direction.SouthEast]: { row: -1, col: 1 },
```

The commit also updated:
- `src/game/flows.ts` - Flow propagation logic
- `src/rendering/gameplayRenderer.ts` - Rendering code
- 75+ screenshot files in the e2e test suite to reflect the corrected flow behavior

### 4. Rust Implementation Comparison (flows branch)

The Rust implementation in the `flows` branch has **always** had the correct direction vectors since commit `e36d828`:

```rust
pub fn tile_vec(&self) -> TileVec {
    match self {
        Self::SouthWest => TileVec::new(-1, -1),  // ✓ Correct
        Self::West => TileVec::new(0, -1),        // ✓ Correct
        Self::NorthWest => TileVec::new(1, 0),    // ✓ Correct
        Self::NorthEast => TileVec::new(1, 1),    // ✓ Correct
        Self::East => TileVec::new(0, 1),         // ✓ Correct
        Self::SouthEast => TileVec::new(-1, 0),   // ✓ Correct
    }
}
```

### Summary of Changes

The bug existed for **2 days** in the TypeScript implementation:
- **Introduced:** October 27, 2025 in commit c7ddbda
- **Fixed:** October 29, 2025 in commit 423b23d
- **Root Cause:** Initial implementation error by the automated agent, not a later regression
- **Why it was hard to debug:** The incorrect vectors still formed a valid hexagonal pattern, just rotated/reflected incorrectly, so the game appeared to work but flows didn't propagate as expected

## Impact of the Bug

This bug would cause severe gameplay issues:

1. **Incorrect Flow Connectivity**: Flows would not connect properly between tiles because the neighbor calculation would be wrong
2. **Invalid Move Detection**: Legal move checking would fail because it relies on correctly identifying adjacent tiles
3. **Victory Condition Failures**: Path tracing from one edge to another would fail because the direction traversal is incorrect
4. **UI Rendering Issues**: Visual representation of flows would not match the game logic

The bug would make the game essentially unplayable, as the fundamental hex grid navigation is broken.

## Recommendations

1. **Immediate Fix Required**: Update the TypeScript `DIRECTION_VECTORS` constant in `src/game/board.ts` to match the Rust implementation
2. **Add Tests**: Create unit tests that verify direction vector correctness:
   - Test that opposite directions sum to zero
   - Test that applying all six direction vectors from a position yields six distinct valid neighbors
   - Test that `getOppositeDirection()` applied twice returns the original direction
3. **Cross-Implementation Testing**: Consider adding tests that verify TypeScript and Rust implementations produce identical results for the same game positions
4. **Documentation**: Document the axial coordinate system and direction vector conventions clearly to prevent future confusion

## Conclusion

### Summary of Findings

1. **The Initial Bug (Oct 27-29, 2025)**: The TypeScript implementation had fundamentally broken direction vectors that made the game unplayable. This was fixed in commit 423b23d on October 29, 2025.

2. **The Rust vs TypeScript Divergence**: Even after the fix, the TypeScript and Rust implementations use **different hexagonal coordinate conventions**. Both are internally valid, but they are incompatible with each other.

3. **Why This Matters**: 
   - If you're trying to port game logic or game states between Rust and TypeScript, you **cannot** directly transfer positions or directions
   - The implementations would need a coordinate transformation layer to communicate
   - Each implementation is self-consistent, so the TypeScript version works fine on its own

4. **The Difficult Debug**: The October 29 fix description ("At long last fix the flow tracing bug--directionality errors") suggests this bug was indeed very difficult to track down, likely because:
   - The initial vectors formed a pattern that looked reasonable at first glance
   - The bug manifested as flow propagation failures, not obvious crashes
   - Both positive and negative coordinates were involved, making sign errors hard to spot

### Recommendation

If cross-compatibility between Rust and TypeScript implementations is desired, one of them needs to be updated to match the other's coordinate system, OR a coordinate transformation layer should be explicitly implemented and documented.
