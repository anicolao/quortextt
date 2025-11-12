# User Story 007: Move Notation with Rotation

## Overview

This user story demonstrates the move notation system for tiles with specific rotations, specifically Type 1 (OneSharp) tiles which make rotation clearly visible.

## Test Setup

- **Players**: 2 players
- **Player 1** (P2): Seated on edge 0 (NW edge / top edge) - Orange color (#DE8F05)
- **Player 2** (P1): Seated on edge 4 (SW edge) - Blue color (#0173B2)
- **Tile Distribution**: Only Type 1 (OneSharp) tiles - configured via game settings
- **Tile Rotation**: Both players place tiles with rotation 5
- **Deterministic Seed**: 54321 for reproducible results

## Expected Rotation Behavior

For Type 1 (OneSharp) tiles:
- **Canonical orientation (rotation 0)**: Sharp corner at south (bottom), connecting SW (dir 0) and SE (dir 5)
- **Rotation 5**: The sharp corner rotates 300° clockwise (or 60° counter-clockwise)

## Screenshots

### 001-initial-state.png
Initial game state after seating phase completes, showing both players on their respective edges with an empty board.

### 002-first-player-placed.png
First player (P2 on edge 0) has placed a Type 1 tile at position (-3, 1) with rotation 5.

### 003-second-player-placed.png
Second player (P1 on edge 4) has placed a Type 1 tile at position (1, -3) with rotation 5.

### 004-move-list-opened.png
**The key screenshot** showing the move list dialog with the notation for both moves:
- **Move 1**: P1A2T1NW (Player on edge 0, position A2, Type 1, NW orientation)
- **Move 2**: P2A3T1NE (Player on edge 4, position A3, Type 1, NE orientation)

## Notable Findings

### Internal vs Display Player Numbers
The move notation shows "P1" and "P2" based on the order players were added, not their internal IDs:
- Internal player P2 (edge 0) → displays as P1 in notation
- Internal player P1 (edge 4) → displays as P2 in notation

### Rotation Notation Translation
Both tiles were placed with **internal rotation 5**, which translates to different orientations in the notation:
- Player on edge 0: rotation 5 → **NW** orientation in notation
- Player on edge 4: rotation 5 → **NE** orientation in notation

This demonstrates that the notation system adjusts rotation values based on each player's perspective (edge position).

## Purpose

This test creates a reproducible scenario for validating the move notation system, particularly:
1. Position notation relative to player perspective
2. Rotation/orientation notation relative to player perspective
3. Visual confirmation that Type 1 tiles make rotation differences visible

The user requested this test to identify issues with rotation information in the notation system. The screenshots provide visual evidence of the current behavior for debugging purposes.
