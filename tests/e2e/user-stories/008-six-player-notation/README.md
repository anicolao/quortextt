# Move Notation - Six Player Test

This test validates the rotation notation formula by placing Type 1 (OneSharp) tiles with the same absolute rotation (rotation 0) on all 6 edges of the board. Since all tiles have the same absolute orientation, the differences in notation reveal how the formula translates absolute rotations to player-relative orientations.

## Test Setup

- **Players**: 6 players, one on each edge (0, 1, 2, 3, 4, 5)
- **Tile Type**: Type 1 (OneSharp) only - rotation is visually obvious
- **Rotation**: All tiles placed with rotation 0 (sharp corner pointing North in absolute terms)
- **Seed**: 123456 (deterministic)

## Edge Assignments

- Player 1 (P4): Edge 0 (NW / Top edge)
- Player 2 (P3): Edge 1 (NE edge)
- Player 3 (P5): Edge 2 (E / Right edge)
- Player 4 (P6): Edge 3 (SE / Bottom edge)
- Player 5 (P2): Edge 4 (SW edge)
- Player 6 (P1): Edge 5 (W / Left edge)

## Screenshots

### 001-initial-state.png
Initial board state after all 6 players have selected their edges.

![Initial State](001-initial-state.png)

### 002-moves-0-1.png
Move list after players 1 and 2 have placed their tiles:
- **Move 1**: P1A1T1NW (Edge 0, rotation 0 → NW)
- **Move 2**: P2D7T1SW (Edge 1, rotation 0 → SW)

![Moves 1-2](002-moves-0-1.png)

### 003-moves-2-3.png
Move list after players 3 and 4 have placed their tiles:
- **Move 3**: P3A4T1S (Edge 2, rotation 0 → S)
- **Move 4**: P4A4T1SE (Edge 3, rotation 0 → SE)

![Moves 3-4](003-moves-2-3.png)

### 004-moves-4-5.png
Move list after players 5 and 6 have placed their tiles:
- **Move 5**: P5A4T1NW (Edge 4, rotation 0 → NW) - **Note: Uses special case fix**
- **Move 6**: P6A4T1N (Edge 5, rotation 0 → N)

![Moves 5-6](004-moves-4-5.png)

## Test Results - Orientations for Rotation 0

All tiles have **rotation 0** (North in absolute terms), but show different orientations from each player's perspective:

| Edge | Player | Notation | Orientation | Expected per User's Theory |
|------|--------|----------|-------------|---------------------------|
| 0 (NW) | P1 | P1A1T1NW | NW | ? |
| 1 (NE) | P2 | P2D7T1SW | SW | ? |
| 2 (E)  | P3 | P3A4T1S  | S  | ? |
| 3 (SE) | P4 | P4A4T1SE | SE | ? |
| 4 (SW) | P5 | P5A4T1NW | NW | ? |
| 5 (W)  | P6 | P6A4T1N  | N  | ? |

## Current Formula Issues

The current formula `(rotation - playerEdge + 5) % 6` with a special case for edge 4 produces:

```
Edge 0: (0 - 0 + 5) % 6 = 5 → NW
Edge 1: (0 - 1 + 5) % 6 = 4 → SW
Edge 2: (0 - 2 + 5) % 6 = 3 → S
Edge 3: (0 - 3 + 5) % 6 = 2 → SE
Edge 4: (0 - 4 + 5) % 6 = 1 → NE, but special case changes to NW
Edge 5: (0 - 5 + 5) % 6 = 0 → N
```

## User's Proposed Formula

According to the user's comment, the formula should be:
> "rotate the tile by the number of the player's edge, possibly plus some constant mod 6"

This would suggest something like: `(rotation + playerEdge + C) % 6` where C is a constant to determine.

Let's test this theory:
- Edge 0: (0 + 0 + C) % 6 = C → NW (index 5), so C = 5
- Edge 1: (0 + 1 + 5) % 6 = 0 → N (but we got SW)
- This doesn't match either.

Or maybe: `(rotation - playerEdge + C) % 6` (current approach):
- With C = 5, edge 4 gives NE but needs NW
- The pattern suggests we need a different approach

## Awaiting User Validation

User will review these results to identify which moves have correct notation and provide the expected values. This will help determine the correct rotation formula.

## Notes on Position Notation

The position notation (A1, D7, A4, etc.) varies because the tiles aren't all in the same relative position from each player's perspective. Move 1 shows A1 (rightmost position), while others show different columns. This is a separate issue from the rotation notation.
