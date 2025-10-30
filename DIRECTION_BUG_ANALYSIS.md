# Direction Vector Bug Analysis

## Executive Summary

After comparing the TypeScript and Rust implementations of direction vectors, **there is a critical difference** between the two implementations. The TypeScript implementation has **incorrect direction vectors** for `SouthWest` and `NorthWest` that differ from the Rust implementation, which appears to be the correct one.

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

| Direction   | Rust (Correct) | TypeScript (Current) | Status |
|-------------|----------------|---------------------|--------|
| SouthWest   | (-1, -1)       | (-1, 0)             | ❌ WRONG |
| West        | (0, -1)        | (0, -1)             | ✓ Correct |
| NorthWest   | (1, 0)         | (1, -1)             | ❌ WRONG |
| NorthEast   | (1, 1)         | (1, 0)              | ❌ WRONG |
| East        | (0, 1)         | (0, 1)              | ✓ Correct |
| SouthEast   | (-1, 0)        | (-1, 1)             | ❌ WRONG |

**4 out of 6 directions are incorrect in the TypeScript implementation!**

## Analysis of the Bug Pattern

Looking at the incorrect mappings, there's a clear pattern:
- The TypeScript version appears to have **rotated the direction vectors clockwise by one position**
- Compare the mappings:
  - Rust SouthWest (-1, -1) → TypeScript shows this as SouthEast's value
  - Rust NorthWest (1, 0) → TypeScript shows this as NorthEast's value  
  - Rust NorthEast (1, 1) → This value doesn't appear in TypeScript at all
  - Rust SouthEast (-1, 0) → TypeScript shows this as SouthWest's value

Actually, looking more carefully at the pattern:
- TypeScript SouthWest (-1, 0) = Rust SouthEast
- TypeScript NorthWest (1, -1) = (not in Rust - this is incorrect)
- TypeScript NorthEast (1, 0) = Rust NorthWest
- TypeScript SouthEast (-1, 1) = (not in Rust - this is incorrect)

The bug appears to be a **systematic offset or misunderstanding** of how the axial coordinate system maps to hex directions.

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

Based on the git history examination:

1. **Rust Implementation (flows branch)**: The direction vectors have been consistent since the initial implementation in commit `e36d828` (August 2025). The Rust version has always used the correct vectors:
   - SouthWest: (-1, -1)
   - West: (0, -1)
   - NorthWest: (1, 0)
   - NorthEast: (1, 1)
   - East: (0, 1)
   - SouthEast: (-1, 0)

2. **TypeScript Implementation (main branch)**: The file `src/game/board.ts` was introduced in commit `35944fa` with the incorrect direction vectors already present. This is a grafted commit, meaning the full history before this point is not available in the current repository.

3. **When was the bug introduced?**: Since the TypeScript implementation shows up in a grafted commit, we cannot definitively determine when the incorrect values were first introduced. However, we can confirm:
   - The Rust implementation has always been correct
   - The TypeScript implementation has had incorrect values from its first appearance in the available git history
   - This suggests the bug was introduced during the TypeScript port/rewrite, not as a later regression

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

The TypeScript implementation has incorrect direction vectors that do not match the (correct) Rust implementation. Four out of six directions are wrong, with a systematic error that suggests a fundamental misunderstanding of the hexagonal coordinate system during the TypeScript port. The bug has been present since the earliest available commit of the TypeScript version, indicating it was introduced during the initial implementation rather than through a later regression.
