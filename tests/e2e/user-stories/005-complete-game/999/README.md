# Complete Game Test - Seed 999

## Overview
This test validates a complete game flow from lobby setup through gameplay to completion using seed 999. The game demonstrates deterministic behavior with strategic tile placements that prioritize extending each player's flows.

## Game Configuration
- **Seed**: 999
- **Players**: 2
  - Player 1 - Color: #0173B2, Starting edge: 0
  - Player 2 - Color: #DE8F05, Starting edge: 1
- **Total Actions**: 35
- **Tile Placements**: 10 moves
- **Game Outcome**: finished

## Test Execution

### Step 1: Initial Screen
![Initial Screen](screenshots/001-initial-screen.png)

**Action**: Application loads
**Expected State**: Game canvas visible, empty configuration screen ready for player setup

---

### Step 2: ADD_PLAYER
![ADD_PLAYER](screenshots/002-add_player.png)

**Action**: `ADD_PLAYER`
- Color: #0173B2
- Edge: 0

**Expected State**: Player added to configuration

---

### Step 3: ADD_PLAYER
![ADD_PLAYER](screenshots/003-add_player.png)

**Action**: `ADD_PLAYER`
- Color: #DE8F05
- Edge: 1

**Expected State**: Player added to configuration

---

### Step 4: START_GAME
![START_GAME](screenshots/004-start_game.png)

**Action**: `START_GAME`

**Expected State**: Transition to seating phase

---

### Step 5: SHUFFLE_TILES
![SHUFFLE_TILES](screenshots/005-shuffle_tiles.png)

**Action**: `SHUFFLE_TILES`

**Expected State**: Tile deck shuffled

---

### Step 6: SELECT_EDGE
![SELECT_EDGE](screenshots/006-select_edge.png)

**Action**: `SELECT_EDGE`
- Player: P1
- Edge: 0

**Expected State**: Player edge selected, gameplay begins when all players seated

---

### Step 7: SELECT_EDGE
![SELECT_EDGE](screenshots/007-select_edge.png)

**Action**: `SELECT_EDGE`
- Player: P2
- Edge: 3

**Expected State**: Player edge selected, gameplay begins when all players seated

---

### Step 8: DRAW_TILE
![DRAW_TILE](screenshots/008-draw_tile.png)

**Action**: `DRAW_TILE`

**Expected State**: Current player draws a new tile

---

### Step 9: PLACE_TILE
![PLACE_TILE](screenshots/009-place_tile.png)

**Action**: `PLACE_TILE`
- Position: (-3, 3)
- Rotation: 0

**Expected State**: Tile placed on board, flows updated

---

### Step 10: NEXT_PLAYER
![NEXT_PLAYER](screenshots/010-next_player.png)

**Action**: `NEXT_PLAYER`

**Expected State**: Turn advances to next player

---

### Step 11: DRAW_TILE
![DRAW_TILE](screenshots/011-draw_tile.png)

**Action**: `DRAW_TILE`

**Expected State**: Current player draws a new tile

---

### Step 12: PLACE_TILE
![PLACE_TILE](screenshots/012-place_tile.png)

**Action**: `PLACE_TILE`
- Position: (3, -2)
- Rotation: 2

**Expected State**: Tile placed on board, flows updated

---

### Step 13: NEXT_PLAYER
![NEXT_PLAYER](screenshots/013-next_player.png)

**Action**: `NEXT_PLAYER`

**Expected State**: Turn advances to next player

---

### Step 14: DRAW_TILE
![DRAW_TILE](screenshots/014-draw_tile.png)

**Action**: `DRAW_TILE`

**Expected State**: Current player draws a new tile

---

### Step 15: PLACE_TILE
![PLACE_TILE](screenshots/015-place_tile.png)

**Action**: `PLACE_TILE`
- Position: (-2, 2)
- Rotation: 4

**Expected State**: Tile placed on board, flows updated

---

### Step 16: NEXT_PLAYER
![NEXT_PLAYER](screenshots/016-next_player.png)

**Action**: `NEXT_PLAYER`

**Expected State**: Turn advances to next player

---

### Step 17: DRAW_TILE
![DRAW_TILE](screenshots/017-draw_tile.png)

**Action**: `DRAW_TILE`

**Expected State**: Current player draws a new tile

---

### Step 18: PLACE_TILE
![PLACE_TILE](screenshots/018-place_tile.png)

**Action**: `PLACE_TILE`
- Position: (2, -2)
- Rotation: 1

**Expected State**: Tile placed on board, flows updated

---

### Step 19: NEXT_PLAYER
![NEXT_PLAYER](screenshots/019-next_player.png)

**Action**: `NEXT_PLAYER`

**Expected State**: Turn advances to next player

---

### Step 20: DRAW_TILE
![DRAW_TILE](screenshots/020-draw_tile.png)

**Action**: `DRAW_TILE`

**Expected State**: Current player draws a new tile

---

### Step 21: PLACE_TILE
![PLACE_TILE](screenshots/021-place_tile.png)

**Action**: `PLACE_TILE`
- Position: (-1, 2)
- Rotation: 4

**Expected State**: Tile placed on board, flows updated

---

### Step 22: NEXT_PLAYER
![NEXT_PLAYER](screenshots/022-next_player.png)

**Action**: `NEXT_PLAYER`

**Expected State**: Turn advances to next player

---

### Step 23: DRAW_TILE
![DRAW_TILE](screenshots/023-draw_tile.png)

**Action**: `DRAW_TILE`

**Expected State**: Current player draws a new tile

---

### Step 24: PLACE_TILE
![PLACE_TILE](screenshots/024-place_tile.png)

**Action**: `PLACE_TILE`
- Position: (1, -1)
- Rotation: 1

**Expected State**: Tile placed on board, flows updated

---

### Step 25: NEXT_PLAYER
![NEXT_PLAYER](screenshots/025-next_player.png)

**Action**: `NEXT_PLAYER`

**Expected State**: Turn advances to next player

---

### Step 26: DRAW_TILE
![DRAW_TILE](screenshots/026-draw_tile.png)

**Action**: `DRAW_TILE`

**Expected State**: Current player draws a new tile

---

### Step 27: PLACE_TILE
![PLACE_TILE](screenshots/027-place_tile.png)

**Action**: `PLACE_TILE`
- Position: (-1, 1)
- Rotation: 3

**Expected State**: Tile placed on board, flows updated

---

### Step 28: NEXT_PLAYER
![NEXT_PLAYER](screenshots/028-next_player.png)

**Action**: `NEXT_PLAYER`

**Expected State**: Turn advances to next player

---

### Step 29: DRAW_TILE
![DRAW_TILE](screenshots/029-draw_tile.png)

**Action**: `DRAW_TILE`

**Expected State**: Current player draws a new tile

---

### Step 30: PLACE_TILE
![PLACE_TILE](screenshots/030-place_tile.png)

**Action**: `PLACE_TILE`
- Position: (0, 0)
- Rotation: 1

**Expected State**: Tile placed on board, flows updated

---

### Step 31: NEXT_PLAYER
![NEXT_PLAYER](screenshots/031-next_player.png)

**Action**: `NEXT_PLAYER`

**Expected State**: Turn advances to next player

---

### Step 32: DRAW_TILE
![DRAW_TILE](screenshots/032-draw_tile.png)

**Action**: `DRAW_TILE`

**Expected State**: Current player draws a new tile

---

### Step 33: PLACE_TILE
![PLACE_TILE](screenshots/033-place_tile.png)

**Action**: `PLACE_TILE`
- Position: (0, 1)
- Rotation: 4

**Expected State**: Tile placed on board, flows updated

---

### Step 34: NEXT_PLAYER
![NEXT_PLAYER](screenshots/034-next_player.png)

**Action**: `NEXT_PLAYER`

**Expected State**: Turn advances to next player

---

### Step 35: DRAW_TILE
![DRAW_TILE](screenshots/035-draw_tile.png)

**Action**: `DRAW_TILE`

**Expected State**: Current player draws a new tile

---

### Step 36: PLACE_TILE
![PLACE_TILE](screenshots/036-place_tile.png)

**Action**: `PLACE_TILE`
- Position: (1, 0)
- Rotation: 4

**Expected State**: Tile placed on board, flows updated

---

### Step 37: Final Game State
![Final State](screenshots/final-state.png)

**Game Phase**: finished
**Total Moves**: 10

## Validation Checklist

- [ ] All 35 actions executed successfully
- [ ] 10 tiles placed on board
- [ ] No illegal moves attempted
- [ ] Flow calculations correct at each step
- [ ] Game state matches expectations file
- [ ] Final phase is "finished"
- [ ] 2 players participated
- [ ] Screenshots captured for all actions
- [ ] Test completes without errors
- [ ] Deterministic behavior - same seed produces same game
