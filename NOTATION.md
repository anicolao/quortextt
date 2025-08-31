# NOTATION.md

## Flows Game Notation

This document describes the standard notation for recording Flows games. This notation allows players to record moves in a human-readable format that can be shared and analyzed.

## Board Coordinates

The Flows board is hexagonal with 37 playable tiles arranged in a diamond pattern. Each player views the board from their own perspective, with their starting edge considered the "bottom" of their view.

### Player-Relative Coordinates

For each player, the hexes are numbered using:
- **Rows**: Letters A through G, where A is the row closest to the player's edge
- **Columns**: Numbers 1 through 7, counting from left to right from the player's perspective

### Player Prefix

Each coordinate is prefixed with the player number:
- `P1` for Player 1
- `P2` for Player 2  
- `P3` for Player 3 (in 3-player games)

### Coordinate System Details

The board uses a hexagonal coordinate system where:
- **Row 0** (internal coordinate) maps to different player rows depending on perspective
- **Center tile** is always at position D4 for all players
- Each player's "A" row contains their starting edge hexes

### Example Coordinates

Based on the internal coordinate system:

| Internal (row,col) | Player 1 | Player 2 |
|-------------------|----------|----------|
| (0,0) | P1A1 | P2G1 |
| (0,3) | P1A4 | P2G4 |
| (3,3) | P1D4 | P2D4 |
| (6,3) | P1G4 | P2A4 |
| (6,6) | P1G7 | P2A7 |

## Tile Types

There are four types of tiles in Flows, distinguished by the number of sharp corners:

### Type 0: No Sharp Corners (T0)
- Three curved flow paths that form smooth S-curves and one straight line
- Flow paths: SouthWest↔NorthWest, NorthEast↔SouthEast, West↔East
- Creates flowing, curved connections

### Type 1: One Sharp Corner (T1)  
- One sharp corner where flows meet at a point
- Flow paths: SouthWest↔SouthEast, NorthWest↔East, West↔NorthEast
- One connection is straight across the sharp corner

### Type 2: Two Sharp Corners (T2)
- Two sharp corners creating angular connections
- Flow paths: SouthWest↔SouthEast, NorthWest↔NorthEast, West↔East
- Two sharp angular connections plus one straight connection

### Type 3: Three Sharp Corners (T3)
- Three sharp corners forming a triangular meeting point
- Flow paths: SouthWest↔SouthEast, NorthEast↔East, West↔NorthWest
- All three connections meet at sharp angles

### Direction Reference
```
Hexagonal directions:
      NW(2)  NE(3)
    W(1)       E(4)
      SW(0)  SE(5)
```

### Tile Flow Patterns by Type

**T0 (No Sharps) - Default Orientation:**
- SouthWest ↔ NorthWest (curved S-shape)
- NorthEast ↔ SouthEast (curved S-shape)  
- West ↔ East (straight across)

**T1 (One Sharp) - Default Orientation:**
- SouthWest ↔ SouthEast (meets at sharp point)
- NorthWest ↔ East (curved)
- West ↔ NorthEast (curved)

**T2 (Two Sharps) - Default Orientation:**
- SouthWest ↔ SouthEast (sharp angular)
- NorthWest ↔ NorthEast (sharp angular)
- West ↔ East (straight)

**T3 (Three Sharps) - Default Orientation:**
- SouthWest ↔ SouthEast (sharp angular)
- NorthEast ↔ East (sharp angular)
- West ↔ NorthWest (sharp angular)

## Tile Orientation

The orientation of each tile is specified by indicating where the "north" reference point is positioned:

- `N` - North (default orientation, 0°)
- `NE` - North-East (60° clockwise)
- `SE` - South-East (120° clockwise)  
- `S` - South (180° clockwise)
- `SW` - South-West (240° clockwise)
- `NW` - North-West (300° clockwise)

### North Reference Point

For each tile type, "North" (default) orientation means:

- **T0 (No sharps)**: The straight horizontal flow path (West↔East) runs left-right
- **T1 (One sharp)**: The sharp corner points upward (north)
- **T2 (Two sharps)**: The curved path opening points upward
- **T3 (Three sharps)**: The three sharp corners form connections in standard position

## Complete Move Notation

A complete move is written as: `P[player][position]T[type][orientation]`

### Examples

- `P1A2T0N` - Player 1 places a no-sharp tile at position A2 with north orientation
- `P2B3T1SE` - Player 2 places a one-sharp tile at position B3 with south-east orientation  
- `P1D4T3SW` - Player 1 places a three-sharp tile at the center position with south-west orientation

## Sample Game Record

```
Game: 2-player, Standard Rules
P1A1T0N     ; Player 1 places no-sharp tile at A1, north orientation
P2A4T1NE    ; Player 2 places one-sharp tile at A4, northeast orientation  
P1D4T2SE    ; Player 1 places two-sharp tile at center, southeast orientation
P2G1T0SW    ; Player 2 places no-sharp tile at G1, southwest orientation
P1B3T3S     ; Player 1 places three-sharp tile at B3, south orientation
P2F5T1W     ; Player 2 places one-sharp tile at F5, west orientation
...
```

## Testing the Notation

The notation system has been tested with the following coordinate conversions:

| Player Notation | Internal Coordinates | Valid |
|----------------|---------------------|-------|
| P1A1 | (0,0) | ✓ |
| P1A4 | (0,3) | ✓ |
| P1D4 | (3,3) | ✓ |
| P2A4 | (6,3) | ✓ |  
| P2G1 | (0,0) | ✓ |

Example parsed moves:
- `P1A1T0N` → Player 1 at (0,0) tile T0 rotation 0°
- `P2A4T3S` → Player 2 at (6,3) tile T3 rotation 180°

## Board Layout Reference

### Board Shape (Internal Coordinates)
```
       (6,3)(6,4)(6,5)(6,6)
     (5,2)(5,3)(5,4)(5,5)(5,6)
   (4,1)(4,2)(4,3)(4,4)(4,5)(4,6)
(3,0)(3,1)(3,2)(3,3)(3,4)(3,5)(3,6)  
   (2,0)(2,1)(2,2)(2,3)(2,4)(2,5)
     (1,0)(1,1)(1,2)(1,3)(1,4)
       (0,0)(0,1)(0,2)(0,3)
```

### Player 1 Perspective
```
       G4  G5  G6  G7
     F3  F4  F5  F6  F7
   E2  E3  E4  E5  E6  E7
D1  D2  D3  D4  D5  D6  D7  
   C1  C2  C3  C4  C5  C6
     B1  B2  B3  B4  B5
       A1  A2  A3  A4
```

### Player 2 Perspective  
```
       A4  A5  A6  A7
     B3  B4  B5  B6  B7
   C2  C3  C4  C5  C6  C7
D1  D2  D3  D4  D5  D6  D7
   E1  E2  E3  E4  E5  E6
     F1  F2  F3  F4  F5
       G1  G2  G3  G4
```

Note: The center hex D4 is the same for all players, representing the center of the hexagonal board.