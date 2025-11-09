# Complete Game Test - Seed 999

## Overview
This test validates a complete game flow from lobby setup through gameplay to completion using seed 999. The game demonstrates deterministic behavior with mouse click interactions.

## Game Configuration
- **Seed**: 999
- **Players**: 2
  - Player 1 - Color: #0173B2, Starting edge: 0
  - Player 2 - Color: #DE8F05, Starting edge: 1
- **Total Clicks**: 31
- **Tile Placements**: 10 moves
- **Game Outcome**: finished

## Test Execution

Each screenshot shows the result of a user click action.

### Step 1: Initial Screen
![Initial Screen](screenshots/0001-initial-screen.png)

**User Action**: Application loads
**Expected State**: Game canvas visible, empty configuration screen ready for player setup

---

### Step 2: Click to add player (#0173B2 at edge 0)
![Click to add player (#0173B2 at edge 0)](screenshots/0002-click.png)

**User Action**: Click to add player (#0173B2 at edge 0)
**Expected State**: Player added to configuration, color button appears

---

### Step 3: Click to add player (#DE8F05 at edge 1)
![Click to add player (#DE8F05 at edge 1)](screenshots/0003-click.png)

**User Action**: Click to add player (#DE8F05 at edge 1)
**Expected State**: Player added to configuration, color button appears

---

### Step 4: Select edge 0 for player P1
![Select edge 0 for player P1](screenshots/0004-click.png)

**User Action**: Select edge 0 for player P1
**Expected State**: Player seated at chosen edge, waiting for other players

---

### Step 5: Select edge 3 for player P2
![Select edge 3 for player P2](screenshots/0005-click.png)

**User Action**: Select edge 3 for player P2
**Expected State**: Player seated at chosen edge, waiting for other players

---

### Step 6: Click hex at (-3, 0)
![Click hex at (-3, 0)](screenshots/0006-click.png)

**User Action**: Click hex at (-3, 0)
**Expected State**: Tile preview appears at selected hex position

---

### Step 7: Click checkmark to confirm
![Click checkmark to confirm](screenshots/0007-click.png)

**User Action**: Click checkmark to confirm
**Expected State**: Tile placed on board, flows updated, turn advances

---

### Step 8: Click hex at (2, -3)
![Click hex at (2, -3)](screenshots/0008-click.png)

**User Action**: Click hex at (2, -3)
**Expected State**: Tile preview appears at selected hex position

---

### Step 9: Rotate tile (rotation 1)
![Rotate tile (rotation 1)](screenshots/0009-click.png)

**User Action**: Rotate tile (rotation 1)
**Expected State**: Preview tile rotates to new orientation

---

### Step 10: Click checkmark to confirm
![Click checkmark to confirm](screenshots/0010-click.png)

**User Action**: Click checkmark to confirm
**Expected State**: Tile placed on board, flows updated, turn advances

---

### Step 11: Click hex at (-2, -1)
![Click hex at (-2, -1)](screenshots/0011-click.png)

**User Action**: Click hex at (-2, -1)
**Expected State**: Tile preview appears at selected hex position

---

### Step 12: Rotate tile (rotation 1)
![Rotate tile (rotation 1)](screenshots/0012-click.png)

**User Action**: Rotate tile (rotation 1)
**Expected State**: Preview tile rotates to new orientation

---

### Step 13: Click checkmark to confirm
![Click checkmark to confirm](screenshots/0013-click.png)

**User Action**: Click checkmark to confirm
**Expected State**: Tile placed on board, flows updated, turn advances

---

### Step 14: Click hex at (2, -2)
![Click hex at (2, -2)](screenshots/0014-click.png)

**User Action**: Click hex at (2, -2)
**Expected State**: Tile preview appears at selected hex position

---

### Step 15: Click checkmark to confirm
![Click checkmark to confirm](screenshots/0015-click.png)

**User Action**: Click checkmark to confirm
**Expected State**: Tile placed on board, flows updated, turn advances

---

### Step 16: Click hex at (-1, -2)
![Click hex at (-1, -2)](screenshots/0016-click.png)

**User Action**: Click hex at (-1, -2)
**Expected State**: Tile preview appears at selected hex position

---

### Step 17: Click checkmark to confirm
![Click checkmark to confirm](screenshots/0017-click.png)

**User Action**: Click checkmark to confirm
**Expected State**: Tile placed on board, flows updated, turn advances

---

### Step 18: Click hex at (3, -3)
![Click hex at (3, -3)](screenshots/0018-click.png)

**User Action**: Click hex at (3, -3)
**Expected State**: Tile preview appears at selected hex position

---

### Step 19: Rotate tile (rotation 1)
![Rotate tile (rotation 1)](screenshots/0019-click.png)

**User Action**: Rotate tile (rotation 1)
**Expected State**: Preview tile rotates to new orientation

---

### Step 20: Rotate tile (rotation 2)
![Rotate tile (rotation 2)](screenshots/0020-click.png)

**User Action**: Rotate tile (rotation 2)
**Expected State**: Preview tile rotates to new orientation

---

### Step 21: Click checkmark to confirm
![Click checkmark to confirm](screenshots/0021-click.png)

**User Action**: Click checkmark to confirm
**Expected State**: Tile placed on board, flows updated, turn advances

---

### Step 22: Click hex at (-1, -1)
![Click hex at (-1, -1)](screenshots/0022-click.png)

**User Action**: Click hex at (-1, -1)
**Expected State**: Tile preview appears at selected hex position

---

### Step 23: Click checkmark to confirm
![Click checkmark to confirm](screenshots/0023-click.png)

**User Action**: Click checkmark to confirm
**Expected State**: Tile placed on board, flows updated, turn advances

---

### Step 24: Click hex at (1, -2)
![Click hex at (1, -2)](screenshots/0024-click.png)

**User Action**: Click hex at (1, -2)
**Expected State**: Tile preview appears at selected hex position

---

### Step 25: Rotate tile (rotation 1)
![Rotate tile (rotation 1)](screenshots/0025-click.png)

**User Action**: Rotate tile (rotation 1)
**Expected State**: Preview tile rotates to new orientation

---

### Step 26: Rotate tile (rotation 2)
![Rotate tile (rotation 2)](screenshots/0026-click.png)

**User Action**: Rotate tile (rotation 2)
**Expected State**: Preview tile rotates to new orientation

---

### Step 27: Rotate tile (rotation 3)
![Rotate tile (rotation 3)](screenshots/0027-click.png)

**User Action**: Rotate tile (rotation 3)
**Expected State**: Preview tile rotates to new orientation

---

### Step 28: Click checkmark to confirm
![Click checkmark to confirm](screenshots/0028-click.png)

**User Action**: Click checkmark to confirm
**Expected State**: Tile placed on board, flows updated, turn advances

---

### Step 29: Click hex at (0, -2)
![Click hex at (0, -2)](screenshots/0029-click.png)

**User Action**: Click hex at (0, -2)
**Expected State**: Tile preview appears at selected hex position

---

### Step 30: Click checkmark to confirm
![Click checkmark to confirm](screenshots/0030-click.png)

**User Action**: Click checkmark to confirm
**Expected State**: Tile placed on board, flows updated, turn advances

---

### Step 31: Click hex at (1, -1)
![Click hex at (1, -1)](screenshots/0031-click.png)

**User Action**: Click hex at (1, -1)
**Expected State**: Tile preview appears at selected hex position

---

### Step 32: Click checkmark to confirm
![Click checkmark to confirm](screenshots/0032-click.png)

**User Action**: Click checkmark to confirm
**Expected State**: Tile placed on board, flows updated, turn advances

---

### Step 33: Final Game State
![Final State](screenshots/final-state.png)

**Game Phase**: finished
**Total Moves**: 10

## Validation Checklist

- [ ] All 31 clicks executed successfully
- [ ] 10 tiles placed on board
- [ ] No illegal moves attempted
- [ ] Flow calculations correct at each step
- [ ] Game state matches expectations file
- [ ] Final phase is "finished"
- [ ] 2 players participated
- [ ] Screenshots captured for all clicks
- [ ] Test completes without errors
- [ ] Deterministic behavior - same seed produces same game
