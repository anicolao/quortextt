# User Story: Multiplayer Two-Player Flow

## Overview

This user story documents the complete end-to-end flow for two players creating and joining a multiplayer game, from login through the first move. It demonstrates:

1. **Isolated Sessions**: Two separate browser contexts ensure independent cookie sessions
2. **Login Flow**: Both users authenticate as anonymous users with different usernames
3. **Room Creation**: First user creates a game room with custom settings
4. **Room Joining**: Second user joins the created room
5. **Color Selection**: Both users select their player colors
6. **Game Start**: Host (first user) starts the game for both players
7. **Edge Selection**: Both users select their board edges in the seating phase
8. **First Moves**: Both users make their first move in the game

## Key Technical Details

- **Separate Browser Contexts**: Uses `browser.newContext()` to create isolated sessions for each player
- **Cookie Isolation**: Each context has its own cookies, ensuring separate anonymous user sessions
- **Real-time Updates**: Screenshots show how each player's view updates when the other player takes action
- **Canvas Interaction**: Game uses canvas-based rendering requiring coordinate-based clicks

## Test Coverage

This test verifies:
- Anonymous user authentication for multiple users
- Room creation and listing functionality
- Real-time room updates via Socket.IO
- Player synchronization during color selection
- Seating phase with edge selection
- Game state synchronization during gameplay
- Move propagation between clients

## Running the Test

This test requires the backend server to be running:

```bash
# Terminal 1: Start the backend server
npm run dev:server

# Terminal 2: Run the test
npx playwright test tests/e2e/multiplayer-two-player-flow.spec.ts

# Or run with UI mode for debugging
npx playwright test tests/e2e/multiplayer-two-player-flow.spec.ts --ui
```

## Screenshots

### Login and Lobby (Steps 1-6)

#### 001-player1-login-screen.png
**Player 1 Perspective**: Initial login screen
- Shows the multiplayer login page with OAuth options and guest login
- Player 1 (Alice) is about to enter their username

#### 002-player1-username-entered.png
**Player 1 Perspective**: Username entered, ready to join
- Username "Alice" is entered in the input field
- Join Lobby button is now enabled

#### 003-player1-in-lobby.png
**Player 1 Perspective**: Successfully joined the lobby
- Shows the Game Lobby screen
- Alice is logged in and can see available rooms and Create New Room button

#### 004-player2-login-screen.png
**Player 2 Perspective**: Initial login screen
- Shows the same login interface from Player 2's perspective
- Player 2 (Bob) is about to enter their username
- Demonstrates cookie isolation - Player 2 is not automatically logged in as Player 1

#### 005-player2-username-entered.png
**Player 2 Perspective**: Username entered, ready to join
- Username "Bob" is entered in the input field
- Join Lobby button is enabled for Player 2

#### 006-player2-in-lobby.png
**Player 2 Perspective**: Successfully joined the lobby
- Bob is now in the lobby with their own session
- Can see available rooms (may or may not include Alice's room yet)

### Room Creation and Joining (Steps 7-12)

#### 007-player1-create-room-modal.png
**Player 1 Perspective**: Create room modal appears
- Alice clicks "Create New Room" and sees the modal
- Shows default room name and player count options

#### 008-player1-room-settings.png
**Player 1 Perspective**: Configuring room settings
- Room name changed to "Alice and Bob Game"
- Max players set to 2
- Ready to create the room

#### 009-player1-in-room-waiting.png
**Player 1 Perspective**: Waiting in the created room
- Alice is now in the room with "Host" badge
- Room shows 1/2 players
- Waiting for another player to join

#### 010-player2-sees-room.png
**Player 2 Perspective**: Seeing the available room
- Bob's lobby view now shows "Alice and Bob Game" in the room list
- Can see room details (2 players max, 1/2 joined)
- Join button is visible

#### 011-player2-joined-room.png
**Player 2 Perspective**: Successfully joined the room
- Bob is now in the room with Alice
- Can see both players listed
- Room is now full (2/2 players)

#### 012-player1-sees-player2-joined.png
**Player 1 Perspective**: Bob's arrival is visible
- Alice's view updates to show Bob has joined
- Room is now full with both players

### Color Selection (Steps 13-16)

#### 013-player1-color-selection.png
**Player 1 Perspective**: Color selection screen
- Available colors are displayed as selectable options
- Alice can choose from available player colors

#### 014-player1-selected-blue.png
**Player 1 Perspective**: Blue color selected
- Alice has selected Blue as their player color
- Color is marked as selected/chosen

#### 015-player2-color-selection.png
**Player 2 Perspective**: Color selection screen
- Bob sees the color selection interface
- Blue is no longer available (Alice selected it)

#### 016-player2-selected-orange.png
**Player 2 Perspective**: Orange color selected
- Bob has selected Orange as their player color
- Both players now have colors assigned

### Game Start (Steps 17-18)

#### 017-player1-ready-to-start.png
**Player 1 Perspective**: Ready to start the game
- Alice (host) sees "Start Game" button
- Both players have selected colors
- System is ready to begin

#### 018-player1-edge-selection.png
**Player 1 Perspective**: Seating/edge selection phase begins
- Game has started and transitioned to edge selection
- Canvas shows the hexagonal board
- Alice needs to select an edge to play from

#### 019-player2-edge-selection.png
**Player 2 Perspective**: Edge selection screen
- Bob sees the same board from their perspective
- Needs to select their edge after Alice

### Edge Selection and First Moves (Steps 20-28)

#### 020-player1-edge-selected.png
**Player 1 Perspective**: Edge selected
- Alice has clicked on the bottom edge (edge 0)
- Waiting for Bob to select his edge

#### 021-player2-before-edge-selection.png
**Player 2 Perspective**: Before selecting edge
- Bob sees Alice's edge selection (if visible in UI)
- Needs to choose his own edge

#### 022-player2-edge-selected.png
**Player 2 Perspective**: Edge selected
- Bob has clicked on the top edge (edge 3)
- Both players have selected their edges

#### 023-player1-game-started.png
**Player 1 Perspective**: Game has started - gameplay phase
- Board is ready for tile placement
- Alice's edge is marked with Blue
- Bob's edge is marked with Orange
- Current tile is displayed (ready to place)

#### 024-player2-game-started.png
**Player 2 Perspective**: Game view after edge selection
- Bob sees the same board from their perspective
- Both edges are marked with player colors
- Ready for first move

#### 025-player1-first-move.png
**Player 1 Perspective**: After placing first tile
- Alice has placed a tile near the center of the board
- Tile is visible on the board
- Turn passes to Bob

#### 026-player2-sees-player1-move.png
**Player 2 Perspective**: Alice's move is visible
- Bob's view updates to show Alice's placed tile
- Real-time synchronization demonstrated
- Now Bob's turn to play

#### 027-player2-first-move.png
**Player 2 Perspective**: After placing first tile
- Bob has placed his tile on the board
- Both players' tiles are visible
- Turn passes back to Alice

#### 028-player1-sees-player2-move.png
**Player 1 Perspective**: Bob's move is visible
- Alice's view updates to show Bob's placed tile
- Both tiles are visible from Alice's perspective
- Game continues with synchronized state

## User Flow Summary

1. **Player 1 (Alice)** navigates to the multiplayer page and logs in as anonymous user
2. **Player 2 (Bob)** navigates to the multiplayer page in a separate browser context and logs in
3. **Alice** creates a new game room named "Alice and Bob Game" with 2 max players
4. **Bob** sees the room in the lobby and joins it
5. **Alice** selects Blue as her player color
6. **Bob** selects Orange as his player color
7. **Alice** (as host) starts the game, transitioning both players to edge selection
8. **Alice** selects the bottom edge (edge 0)
9. **Bob** selects the top edge (edge 3)
10. **Game starts** with both players' edges marked on the board
11. **Alice** places the first tile
12. **Bob** places the second tile
13. Both players can see both moves, demonstrating full multiplayer synchronization

## Technical Notes

- **Browser Contexts**: Critical for cookie isolation - each `browser.newContext()` creates a fresh session
- **Anonymous Auth**: Both users authenticate via `/auth/anonymous` endpoint with unique user IDs
- **Socket.IO**: Real-time communication keeps both clients synchronized
- **Canvas-Based UI**: Game rendering uses HTML5 canvas, requiring coordinate-based interactions
- **Seating Phase**: Edge selection happens before gameplay begins
- **Turn-Based**: Game properly manages turns between players

## Related Files

- `tests/e2e/multiplayer-two-player-flow.spec.ts` - Test implementation
- `tests/e2e/multiplayer-anonymous.spec.ts` - Single-user authentication tests
- `src/multiplayer/components/LoginScreen.svelte` - Login UI
- `src/multiplayer/components/LobbyScreen.svelte` - Lobby UI
- `src/multiplayer/components/RoomScreen.svelte` - Room UI
- `src/multiplayer/socket.ts` - Socket.IO client
- `server/src/index.ts` - Multiplayer server implementation

## Success Criteria

✅ Two separate browser contexts maintain independent sessions
✅ Both users can log in with different anonymous accounts
✅ Room creation and real-time room listing works
✅ Player can join another player's room
✅ Color selection works for both players with proper exclusivity
✅ Host can start the game for all players
✅ Edge selection works for both players
✅ Game starts when all players have selected edges
✅ First moves are synchronized between both clients
✅ Screenshots capture both perspectives at each key step
