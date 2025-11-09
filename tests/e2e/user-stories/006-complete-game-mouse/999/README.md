# Complete Game Test - Seed 999

## Overview
This test validates a complete game flow from lobby setup through gameplay to completion using seed 999. The game demonstrates deterministic behavior with strategic tile placements that prioritize extending each player's flows.

## Game Configuration
- **Seed**: 999
- **Players**: 2
  - Player 1 - Color: #0173B2, Starting edge: 0
  - Player 2 - Color: #DE8F05, Starting edge: 1
- **Total Actions**: 53
- **Tile Placements**: 16 moves
- **Game Outcome**: finished

## Test Execution

### Step 1: Initial Screen
![Initial Screen](screenshots/0001-initial-screen.png)

**Action**: Application loads
**Expected State**: Game canvas visible, empty configuration screen ready for player setup

---

### Step 2: ADD_PLAYER
![ADD_PLAYER](screenshots/0002-click.png)

**Action**: `ADD_PLAYER`
- Color: #0173B2
- Edge: 0

**Expected State**: Player added to configuration

---

### Step 3: ADD_PLAYER
![ADD_PLAYER](screenshots/0003-click.png)

**Action**: `ADD_PLAYER`
- Color: #DE8F05
- Edge: 1

**Expected State**: Player added to configuration

---

### Step 4: START_GAME
![START_GAME](screenshots/0004-click.png)

**Action**: `START_GAME`

**Expected State**: Transition to seating phase

---

### Step 5: SHUFFLE_TILES
![SHUFFLE_TILES](screenshots/0005-click.png)

**Action**: `SHUFFLE_TILES`

**Expected State**: Tile deck shuffled

---

### Step 6: SELECT_EDGE
![SELECT_EDGE](screenshots/0006-click.png)

**Action**: `SELECT_EDGE`
- Player: P1
- Edge: 0

**Expected State**: Player edge selected, gameplay begins when all players seated

---

### Step 7: SELECT_EDGE
![SELECT_EDGE](screenshots/0007-click.png)

**Action**: `SELECT_EDGE`
- Player: P2
- Edge: 3

**Expected State**: Player edge selected, gameplay begins when all players seated

---

### Step 8: DRAW_TILE
![DRAW_TILE](screenshots/0008-click.png)

**Action**: `DRAW_TILE`

**Expected State**: Current player draws a new tile

---

### Step 9: PLACE_TILE
![PLACE_TILE](screenshots/0009-click.png)

**Action**: `PLACE_TILE`
- Position: (-3, 0)
- Rotation: 1

**Expected State**: Tile placed on board, flows updated

---

### Step 10: NEXT_PLAYER
![NEXT_PLAYER](screenshots/0010-click.png)

**Action**: `NEXT_PLAYER`

**Expected State**: Turn advances to next player

---

### Step 11: DRAW_TILE
![DRAW_TILE](screenshots/0011-click.png)

**Action**: `DRAW_TILE`

**Expected State**: Current player draws a new tile

---

### Step 12: PLACE_TILE
![PLACE_TILE](screenshots/0012-click.png)

**Action**: `PLACE_TILE`
- Position: (2, -3)
- Rotation: 1

**Expected State**: Tile placed on board, flows updated

---

### Step 13: NEXT_PLAYER
![NEXT_PLAYER](screenshots/0013-click.png)

**Action**: `NEXT_PLAYER`

**Expected State**: Turn advances to next player

---

### Step 14: DRAW_TILE
![DRAW_TILE](screenshots/0014-click.png)

**Action**: `DRAW_TILE`

**Expected State**: Current player draws a new tile

---

### Step 15: PLACE_TILE
![PLACE_TILE](screenshots/0015-click.png)

**Action**: `PLACE_TILE`
- Position: (-2, -1)
- Rotation: 0

**Expected State**: Tile placed on board, flows updated

---

### Step 16: NEXT_PLAYER
![NEXT_PLAYER](screenshots/0016-click.png)

**Action**: `NEXT_PLAYER`

**Expected State**: Turn advances to next player

---

### Step 17: DRAW_TILE
![DRAW_TILE](screenshots/0017-click.png)

**Action**: `DRAW_TILE`

**Expected State**: Current player draws a new tile

---

### Step 18: PLACE_TILE
![PLACE_TILE](screenshots/0018-click.png)

**Action**: `PLACE_TILE`
- Position: (2, -2)
- Rotation: 0

**Expected State**: Tile placed on board, flows updated

---

### Step 19: NEXT_PLAYER
![NEXT_PLAYER](screenshots/0019-click.png)

**Action**: `NEXT_PLAYER`

**Expected State**: Turn advances to next player

---

### Step 20: DRAW_TILE
![DRAW_TILE](screenshots/0020-click.png)

**Action**: `DRAW_TILE`

**Expected State**: Current player draws a new tile

---

### Step 21: PLACE_TILE
![PLACE_TILE](screenshots/0021-click.png)

**Action**: `PLACE_TILE`
- Position: (-2, 0)
- Rotation: 0

**Expected State**: Tile placed on board, flows updated

---

### Step 22: NEXT_PLAYER
![NEXT_PLAYER](screenshots/0022-click.png)

**Action**: `NEXT_PLAYER`

**Expected State**: Turn advances to next player

---

### Step 23: DRAW_TILE
![DRAW_TILE](screenshots/0023-click.png)

**Action**: `DRAW_TILE`

**Expected State**: Current player draws a new tile

---

### Step 24: PLACE_TILE
![PLACE_TILE](screenshots/0024-click.png)

**Action**: `PLACE_TILE`
- Position: (3, -3)
- Rotation: 2

**Expected State**: Tile placed on board, flows updated

---

### Step 25: NEXT_PLAYER
![NEXT_PLAYER](screenshots/0025-click.png)

**Action**: `NEXT_PLAYER`

**Expected State**: Turn advances to next player

---

### Step 26: DRAW_TILE
![DRAW_TILE](screenshots/0026-click.png)

**Action**: `DRAW_TILE`

**Expected State**: Current player draws a new tile

---

### Step 27: PLACE_TILE
![PLACE_TILE](screenshots/0027-click.png)

**Action**: `PLACE_TILE`
- Position: (-1, -1)
- Rotation: 1

**Expected State**: Tile placed on board, flows updated

---

### Step 28: NEXT_PLAYER
![NEXT_PLAYER](screenshots/0028-click.png)

**Action**: `NEXT_PLAYER`

**Expected State**: Turn advances to next player

---

### Step 29: DRAW_TILE
![DRAW_TILE](screenshots/0029-click.png)

**Action**: `DRAW_TILE`

**Expected State**: Current player draws a new tile

---

### Step 30: PLACE_TILE
![PLACE_TILE](screenshots/0030-click.png)

**Action**: `PLACE_TILE`
- Position: (1, -2)
- Rotation: 1

**Expected State**: Tile placed on board, flows updated

---

### Step 31: NEXT_PLAYER
![NEXT_PLAYER](screenshots/0031-click.png)

**Action**: `NEXT_PLAYER`

**Expected State**: Turn advances to next player

---

### Step 32: DRAW_TILE
![DRAW_TILE](screenshots/0032-click.png)

**Action**: `DRAW_TILE`

**Expected State**: Current player draws a new tile

---

### Step 33: PLACE_TILE
![PLACE_TILE](screenshots/0033-click.png)

**Action**: `PLACE_TILE`
- Position: (0, -1)
- Rotation: 0

**Expected State**: Tile placed on board, flows updated

---

### Step 34: NEXT_PLAYER
![NEXT_PLAYER](screenshots/0034-click.png)

**Action**: `NEXT_PLAYER`

**Expected State**: Turn advances to next player

---

### Step 35: DRAW_TILE
![DRAW_TILE](screenshots/0035-click.png)

**Action**: `DRAW_TILE`

**Expected State**: Current player draws a new tile

---

### Step 36: PLACE_TILE
![PLACE_TILE](screenshots/0036-click.png)

**Action**: `PLACE_TILE`
- Position: (-1, 0)
- Rotation: 2

**Expected State**: Tile placed on board, flows updated

---

### Step 37: NEXT_PLAYER
![NEXT_PLAYER](screenshots/0037-click.png)

**Action**: `NEXT_PLAYER`

**Expected State**: Turn advances to next player

---

### Step 38: DRAW_TILE
![DRAW_TILE](screenshots/0038-click.png)

**Action**: `DRAW_TILE`

**Expected State**: Current player draws a new tile

---

### Step 39: PLACE_TILE
![PLACE_TILE](screenshots/0039-click.png)

**Action**: `PLACE_TILE`
- Position: (0, -2)
- Rotation: 0

**Expected State**: Tile placed on board, flows updated

---

### Step 40: NEXT_PLAYER
![NEXT_PLAYER](screenshots/0040-click.png)

**Action**: `NEXT_PLAYER`

**Expected State**: Turn advances to next player

---

### Step 41: DRAW_TILE
![DRAW_TILE](screenshots/0041-click.png)

**Action**: `DRAW_TILE`

**Expected State**: Current player draws a new tile

---

### Step 42: PLACE_TILE
![PLACE_TILE](screenshots/0042-click.png)

**Action**: `PLACE_TILE`
- Position: (0, -3)
- Rotation: 1

**Expected State**: Tile placed on board, flows updated

---

### Step 43: NEXT_PLAYER
![NEXT_PLAYER](screenshots/0043-click.png)

**Action**: `NEXT_PLAYER`

**Expected State**: Turn advances to next player

---

### Step 44: DRAW_TILE
![DRAW_TILE](screenshots/0044-click.png)

**Action**: `DRAW_TILE`

**Expected State**: Current player draws a new tile

---

### Step 45: PLACE_TILE
![PLACE_TILE](screenshots/0045-click.png)

**Action**: `PLACE_TILE`
- Position: (1, -1)
- Rotation: 1

**Expected State**: Tile placed on board, flows updated

---

### Step 46: NEXT_PLAYER
![NEXT_PLAYER](screenshots/0046-click.png)

**Action**: `NEXT_PLAYER`

**Expected State**: Turn advances to next player

---

### Step 47: DRAW_TILE
![DRAW_TILE](screenshots/0047-click.png)

**Action**: `DRAW_TILE`

**Expected State**: Current player draws a new tile

---

### Step 48: PLACE_TILE
![PLACE_TILE](screenshots/0048-click.png)

**Action**: `PLACE_TILE`
- Position: (1, -3)
- Rotation: 1

**Expected State**: Tile placed on board, flows updated

---

### Step 49: NEXT_PLAYER
![NEXT_PLAYER](screenshots/0049-click.png)

**Action**: `NEXT_PLAYER`

**Expected State**: Turn advances to next player

---

### Step 50: DRAW_TILE
![DRAW_TILE](screenshots/0050-click.png)

**Action**: `DRAW_TILE`

**Expected State**: Current player draws a new tile

---

### Step 51: PLACE_TILE
![PLACE_TILE](screenshots/0051-click.png)

**Action**: `PLACE_TILE`
- Position: (-3, 1)
- Rotation: 0

**Expected State**: Tile placed on board, flows updated

---

### Step 52: NEXT_PLAYER
![NEXT_PLAYER](screenshots/0052-click.png)

**Action**: `NEXT_PLAYER`

**Expected State**: Turn advances to next player

---

### Step 53: DRAW_TILE
![DRAW_TILE](screenshots/0053-click.png)

**Action**: `DRAW_TILE`

**Expected State**: Current player draws a new tile

---

### Step 54: PLACE_TILE
![PLACE_TILE](screenshots/0054-click.png)

**Action**: `PLACE_TILE`
- Position: (0, 0)
- Rotation: 2

**Expected State**: Tile placed on board, flows updated

---

### Step 55: Final Game State
![Final State](screenshots/final-state.png)

**Game Phase**: finished
**Total Moves**: 16

## Validation Checklist

- [ ] All 53 actions executed successfully
- [ ] 16 tiles placed on board
- [ ] No illegal moves attempted
- [ ] Flow calculations correct at each step
- [ ] Game state matches expectations file
- [ ] Final phase is "finished"
- [ ] 2 players participated
- [ ] Screenshots captured for all actions
- [ ] Test completes without errors
- [ ] Deterministic behavior - same seed produces same game
