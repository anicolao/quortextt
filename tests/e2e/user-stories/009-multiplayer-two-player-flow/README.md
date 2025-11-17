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

## Test Coverage

This test verifies:
- Anonymous user authentication for multiple users
- Room creation and listing functionality
- Real-time room updates via Socket.IO
- Player synchronization when joining rooms

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

####  001-player1-login-screen.png
**Player 1 Perspective**: Initial login screen showing OAuth options and guest login

#### 002-player1-username-entered.png
**Player 1 Perspective**: Username "Alice" entered, Join Lobby button enabled

#### 003-player1-in-lobby.png
**Player 1 Perspective**: Successfully joined the lobby, can see Create New Room button

#### 004-player2-login-screen.png
**Player 2 Perspective**: Initial login screen - demonstrates cookie isolation

#### 005-player2-username-entered.png
**Player 2 Perspective**: Username "Bob" entered, Join Lobby button enabled

#### 006-player2-in-lobby.png
**Player 2 Perspective**: Successfully joined lobby with own session

### Room Creation and Joining (Steps 7-13)

#### 007-player1-create-room-modal.png
**Player 1 Perspective**: Create room modal with default settings

#### 008-player1-room-settings.png
**Player 1 Perspective**: Room configured as "Alice and Bob Game" with 2 max players

#### 009-player1-in-room-waiting.png
**Player 1 Perspective**: Waiting in the room with Host badge (1/2 players)

#### 010-player2-sees-room.png
**Player 2 Perspective**: Bob sees "Alice and Bob Game" in the lobby room list

#### 011-player2-joined-room.png
**Player 2 Perspective**: Bob successfully joined the room (2/2 players)

#### 012-player1-sees-player2-joined.png
**Player 1 Perspective**: Alice's view with both players in the room

#### 013-player1-ready-to-start.png
**Player 1 Perspective**: Room full and ready (game start flow to be completed)

## User Flow Summary

1. **Player 1 (Alice)** logs in as anonymous user
2. **Player 2 (Bob)** logs in as anonymous user in separate browser context
3. **Alice** creates "Alice and Bob Game" room (2 max players)
4. **Bob** joins the room
5. Both players are in the room together

## Future Enhancements

- Complete game start flow
- Add edge selection demonstration
- Add first move screenshots

## Technical Notes

- **Browser Contexts**: Uses `browser.newContext()` for cookie isolation
- **Anonymous Auth**: Uses `/auth/anonymous` endpoint
- **Socket.IO**: Real-time room updates

## Related Files

- `tests/e2e/multiplayer-two-player-flow.spec.ts`
- `src/multiplayer/components/LoginScreen.svelte`
- `src/multiplayer/components/LobbyScreen.svelte`
- `src/multiplayer/components/RoomScreen.svelte`
- `src/multiplayer/socket.ts`
- `server/src/index.ts`

## Success Criteria

✅ Two separate browser contexts maintain independent sessions  
✅ Both users log in with different anonymous accounts  
✅ Room creation and listing works  
✅ Player can join another player's room  
✅ Screenshots from both perspectives  
⚠️ Game start and gameplay - to be completed
