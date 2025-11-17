# User Story: Multiplayer Two-Player Flow

## Overview

This user story documents the end-to-end flow for two players creating and joining a multiplayer game room. It demonstrates:

1. **Isolated Sessions**: Two separate browser contexts ensure independent cookie sessions
2. **Login Flow**: Both users authenticate as anonymous users with different usernames
3. **Room Creation**: First user creates a game room with custom settings
4. **Room Joining**: Second user joins the created room

## Current Status

✅ **Working**: Login, lobby, room creation, and room joining  
⚠️ **In Progress**: Game start, edge selection, and first moves

This test currently covers the multiplayer flow up to having two players successfully in the same room. Additional work is needed to complete the game start and gameplay portions.

## Key Technical Details

- **Separate Browser Contexts**: Uses `browser.newContext()` to create isolated sessions for each player
- **Cookie Isolation**: Each context has its own cookies, ensuring separate anonymous user sessions
- **Real-time Updates**: Screenshots show how room state updates when the second player joins
- **Programmatic Validation**: Test validates UI state and element visibility at each step

## Test Coverage

This test verifies:
- Anonymous user authentication for multiple users
- Room creation and listing functionality
- Real-time room updates via Socket.IO
- Player synchronization when joining rooms
- UI state consistency across both browser contexts

## Running the Test

This test automatically manages its own server instance:

```bash
# Run the test - it will start/stop its own server with clean state
npx playwright test tests/e2e/multiplayer-two-player-flow.spec.ts

# Or run with UI mode for debugging
npx playwright test tests/e2e/multiplayer-two-player-flow.spec.ts --ui
```

**How it works**:
- Test automatically starts a fresh server instance with a temporary data directory
- Runs the test with completely clean server state
- Automatically stops the server and cleans up the temporary directory after the test completes
- No manual server management required

## Screenshots with Programmatic Validation

### Login and Lobby (Steps 1-6)

#### Step 1: Player 1 Login Screen

![Player 1 Login Screen](001-player1-login-screen.png)

**Validation**: Page title contains "Quortex Multiplayer"  
**Player 1 Perspective**: Initial login screen showing OAuth options (Discord, Google) and guest login section with username input field.

---

#### Step 2: Player 1 Username Entered

![Player 1 Username Entered](002-player1-username-entered.png)

**Validation**: Username input field contains "Alice", Join Lobby button is visible  
**Player 1 Perspective**: Username "Alice" entered in the input field, Join Lobby button becomes enabled (purple background).

---

#### Step 3: Player 1 in Lobby

![Player 1 in Lobby](003-player1-in-lobby.png)

**Validation**: Page heading contains "Game Lobby"  
**Player 1 Perspective**: Successfully joined the lobby. Alice can see the "Create New Room" button and any available rooms. Username "Alice" appears in the header.

---

#### Step 4: Player 2 Login Screen

![Player 2 Login Screen](004-player2-login-screen.png)

**Validation**: Page title contains "Quortex Multiplayer"  
**Player 2 Perspective**: Initial login screen from Player 2's separate browser context. This demonstrates **cookie isolation** - Player 2 is NOT automatically logged in as Player 1 despite being on the same URL.

---

#### Step 5: Player 2 Username Entered

![Player 2 Username Entered](005-player2-username-entered.png)

**Validation**: Username input contains "Bob", Join Lobby button is visible  
**Player 2 Perspective**: Username "Bob" entered, Join Lobby button enabled with the same purple styling.

---

#### Step 6: Player 2 in Lobby

![Player 2 in Lobby](006-player2-in-lobby.png)

**Validation**: Page heading contains "Game Lobby"  
**Player 2 Perspective**: Bob successfully joined the lobby with his own independent session. Username "Bob" appears in the header, confirming separate authentication.

---

### Room Creation and Joining (Steps 7-13)

#### Step 7: Create Room Modal

![Player 1 Create Room Modal](007-player1-create-room-modal.png)

**Validation**: Modal heading contains "Create New Room"  
**Player 1 Perspective**: Alice clicks "Create New Room" button. Modal appears with room name input (pre-filled) and max players dropdown.

---

#### Step 8: Room Settings Configured

![Player 1 Room Settings](008-player1-room-settings.png)

**Validation**: Room name input shows "E2E Test: Alice and Bob", dropdown shows 2 players selected  
**Player 1 Perspective**: Alice has set the room name to "E2E Test: Alice and Bob" and selected 2 as max players. "Create Room" button is ready to click. The test uses a fixed room name for repeatable screenshots with a fresh server instance for each test run.

---

#### Step 9: Player 1 Waiting in Room

![Player 1 in Room Waiting](009-player1-in-room-waiting.png)

**Validation**: "Host" badge is visible on the page  
**Player 1 Perspective**: Alice is now inside the room she created. She has a "👑 You are the host" badge. Room shows "1/2 players". Alice's name appears in the player list. The room is waiting for another player to join.

---

#### Step 10: Player 2 Sees Room in Lobby

![Player 2 Sees Room](010-player2-sees-room.png)

**Validation**: Room card with text "E2E Test: Alice and Bob" is visible  
**Player 2 Perspective**: Bob's lobby view has updated in **real-time via Socket.IO** to show the newly created room "E2E Test: Alice and Bob" in the available rooms list. The room card shows "👥 1/2 players".

---

#### Step 11: Player 2 Joined Room

![Player 2 Joined Room](011-player2-joined-room.png)

**Validation**: Page displays room content (after clicking room card)  
**Player 2 Perspective**: Bob has clicked on the room card and successfully joined the test room. He can see both players in the room (Alice with host icon, and himself). Room now shows "2/2 players".

---

#### Step 12: Player 1 Sees Player 2 Joined

![Player 1 Sees Player 2 Joined](012-player1-sees-player2-joined.png)

**Validation**: Real-time update via Socket.IO  
**Player 1 Perspective**: Alice's view automatically updates to show Bob has joined the room. Both players are now listed. This demonstrates **real-time synchronization** between the two browser contexts.

---

#### Step 13: Room Ready to Start

![Player 1 Ready to Start](013-player1-ready-to-start.png)

**Validation**: Room has 2/2 players  
**Player 1 Perspective**: The room is now full with both players. From this state, the host (Alice) should be able to start the game. *Note: Game start flow implementation is pending.*

---

## User Flow Summary

1. **Player 1 (Alice)** logs in as anonymous user → sees lobby
2. **Player 2 (Bob)** logs in as anonymous user in separate browser context → sees lobby
3. **Alice** creates test room "E2E Test: Alice and Bob" (2 max players) → enters room as host
4. **Bob** sees the test room appear in lobby list → joins that room
5. **Both players** are in the room together → ready for game start

**Note**: The test starts a fresh server instance with a temporary data directory for each test run, ensuring completely clean state and truly repeatable results. The temporary directory is cleaned up after the test completes.

## Programmatic Validations Performed

At each step, the test validates:
- ✅ Page headings and titles match expected screen
- ✅ Input fields contain expected values
- ✅ Buttons and UI elements are visible when expected
- ✅ Navigation between screens works correctly
- ✅ Real-time updates propagate between browser contexts
- ✅ Cookie isolation maintains separate sessions

## Future Enhancements

- Complete game start flow (Start Game button interaction)
- Add edge selection demonstration
- Add first move screenshots
- Validate game state synchronization during gameplay

## Technical Notes

- **Browser Contexts**: Uses `browser.newContext()` for cookie isolation
- **Anonymous Auth**: Uses `/auth/anonymous` endpoint with unique session IDs
- **Socket.IO**: Real-time room updates between clients
- **Fixed Room Name**: Uses "E2E Test: Alice and Bob" for repeatable, stable screenshots
- **Isolated Server**: Test starts its own server instance with a temporary data directory
- **Clean State**: Each test run has completely fresh server state (no pre-existing rooms/users)
- **Automatic Cleanup**: Temporary data directory is removed after test completes
- **Playwright Testing**: Comprehensive e2e testing with visual validation

## Related Files

- `tests/e2e/multiplayer-two-player-flow.spec.ts` - Test implementation
- `src/multiplayer/components/LoginScreen.svelte` - Login UI
- `src/multiplayer/components/LobbyScreen.svelte` - Lobby UI
- `src/multiplayer/components/RoomScreen.svelte` - Room UI
- `src/multiplayer/socket.ts` - Socket.IO client
- `server/src/index.ts` - Multiplayer server

## Success Criteria

✅ Two separate browser contexts maintain independent sessions  
✅ Both users log in with different anonymous accounts  
✅ Room creation and listing works  
✅ Player can join another player's room  
✅ Real-time synchronization via Socket.IO  
✅ Screenshots from both perspectives with validation  
⚠️ Game start and gameplay - to be completed
