# DESIGN_INSPECTION.md

**Date:** 2025-11-16  
**Purpose:** Document findings of design quality in relation to stated goals  
**Scope:** Server architecture, client architecture, and Redux patterns

## Design Goals Summary

### Server Design Goals
- **Game-agnostic server**: The server should have no game-specific logic
- **Event sources**: Append-only JSONL files that clients can subscribe to and write to
- **No server-side game functionality**: The server should be equally suitable as a shared document editor, chat server, or any other collaborative application
- **Client-driven**: Clients create and subscribe to event sources they're interested in

### Client Design Goals
- **URL-based routing**: One URL per primary function (game, lobby, etc.)
- **Encoded state in URLs**: URLs should encode screen type and event source ID
- **Example**: `.../quortextt/game?id=<id hash>` → subscribe to game hash source → receive game events → update display

### Redux Design Goals
- **Single-purpose actions**: Each action should have one clear function
- **Atomic state changes**: Actions that do more than one thing should be broken up
- **Deterministic replay**: Replaying actions on different clients should result in same state

---

## Server Architecture Analysis

### ✅ GOOD: Event Sourcing Architecture

**Location:** `server/src/storage/GameStorage.ts`, `server/src/storage/README.md`

**Finding:** The server implements a clean event sourcing pattern using append-only JSONL files:
- Each game has its own action log: `game-{gameId}.actions.jsonl`
- Actions are never modified, only appended
- State is reconstructed by replaying actions
- In-memory caching for performance
- Buffered writes with periodic flushing

**Why this is good:**
- Perfect fit for the design goal of "append-only event sources"
- Clients can subscribe to action streams and replay them
- Simple, debuggable, and maintainable
- Easy to backup and migrate

**Evidence:**
```typescript
// From GameStorage.ts lines 10-16
export interface GameAction {
  type: string;
  payload: any;
  playerId: string;
  timestamp: number;
  sequence: number;
}
```

### ⚠️ DESIGN ERROR: Game-Specific Server Logic

**Location:** `server/src/index.ts` lines 649-673

**Finding:** The server contains game-specific business logic that violates the "game-agnostic" principle:

```typescript
// Lines 649-673: START_GAME handler
socket.on('start_game', async (data: { roomId: string }) => {
  // ...
  const isDiscordRoom = roomId.startsWith('discord-');
  
  // Game-specific validation
  if (!isDiscordRoom && state.hostId !== player.id) {
    socket.emit('error', { message: 'Only host can start the game' });
    return;
  }
  
  // Game-specific player count validation
  const minPlayers = isDiscordRoom ? 1 : 2;
  if (state.players.length < minPlayers) {
    socket.emit('error', { message: 'Need at least 2 players to start' });
    return;
  }
```

**Why this is a problem:**
- The server is making decisions about "minimum players," "host privileges," and game rules
- These are game-specific concerns that should be handled by clients
- Makes the server unusable for other types of collaborative applications
- Violates the stated design goal of being equally suitable as "a shared document editor, chat server, whatever"

**Recommendation:**
- Move all validation logic to the client
- Server should only validate action format and sequence, not game semantics
- Server should allow any action to be appended to any event source
- Clients are responsible for enforcing their own rules

### ⚠️ DESIGN ERROR: Server-Side State Reconstruction

**Location:** `server/src/storage/GameStorage.ts` lines 151-247

**Finding:** The server reconstructs game state by applying action logic:

```typescript
// Lines 151-247: applyAction method
private applyAction(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'CREATE_GAME':
      // Game-specific state initialization
    case 'JOIN_GAME':
      // Player management logic
    case 'START_GAME':
      // Status changes
    // ... more game-specific logic
  }
}
```

**Why this is a problem:**
- The server is implementing game state machine logic
- This couples the server to the specific game (Quortex)
- For a truly game-agnostic server, state reconstruction should happen entirely on the client
- The server should only store and replay actions, not interpret them

**Recommendation:**
- Server should be a "dumb" action log
- Remove `GameState` interface from server entirely
- Server only needs to track: `{ gameId, actions: GameAction[] }`
- Clients reconstruct state from actions independently
- Server can optionally cache the last N actions for efficient subscription, but shouldn't interpret them

### ✅ GOOD: Socket.IO Event Broadcasting

**Location:** `server/src/index.ts` lines 707-766

**Finding:** The server correctly broadcasts actions to all subscribers:

```typescript
// Lines 707-766: post_action handler
socket.on('post_action', async (data: { gameId: string; action: any }) => {
  // Append to action log
  const finalAction = await gameStorage.appendAction(gameId, gameAction);
  
  // Broadcast to all subscribers
  io.to(gameId).emit('action_posted', finalAction);
});
```

**Why this is good:**
- Simple pub/sub pattern
- Server acts as message broker, not game engine
- All clients receive same action stream
- Enables deterministic replay

### ⚠️ MINOR ISSUE: Mixed Authentication Concerns

**Location:** `server/src/index.ts` lines 395-413

**Finding:** Authentication middleware is mixed with game logic:

```typescript
// Lines 395-413: JWT authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      socket.data.userId = decoded.userId;
      socket.data.authenticated = true;
    } catch (err) {
      // Allow anonymous connection
    }
  }
  next();
});
```

**Why this is minor:**
- Authentication is a reasonable server concern
- However, it's tightly coupled to the game server
- For a truly generic event server, auth should be a separate middleware

**Recommendation:**
- Keep authentication separate from event sourcing logic
- Make auth pluggable/optional
- Document that this is a general-purpose concern, not game-specific

---

## Client Architecture Analysis

### ❌ DESIGN ERROR: No URL-Based Routing

**Location:** `src/multiplayerMain.ts`, `src/multiplayer/App.svelte`, `index.html`

**Finding:** The client does NOT implement URL-based routing as specified in design goals:

**Evidence from multiplayerMain.ts lines 49-100:**
```typescript
// Listen for game state changes
multiplayerStore.subscribe((state) => {
  if (state.screen === 'game' && state.gameId) {
    console.log('Starting multiplayer game with gameId:', state.gameId);
    // ... show game canvas
  }
});
```

**Evidence from App.svelte lines 9-28:**
```svelte
$: screen = $multiplayerStore.screen;

{#if screen === 'login'}
  <LoginScreen />
{:else if screen === 'lobby'}
  <LobbyScreen />
{:else if screen === 'room'}
  <RoomScreen />
{:else if screen === 'game'}
  <!-- Game screen -->
{/if}
```

**Why this is a major problem:**
- The client uses Svelte store state to control screens, NOT URLs
- There's no way to send someone a direct link to a game: `.../quortextt/game?id=<hash>`
- Users can't bookmark or share specific game states
- Browser back/forward buttons don't work as expected
- Violates the core design goal of "URL per primary function"
- Violates "URLs should encode the information about the type of screen"

**What's missing:**
- No URL parsing on page load
- No URL updates when switching screens
- No query parameter handling for game IDs
- No hash-based or path-based routing

**Recommendation:**
- Implement proper URL routing (use `window.location` or a router library)
- Parse URL on load: `const params = new URLSearchParams(window.location.search)`
- Route patterns needed:
  - `/` or `/lobby` → lobby screen
  - `/game?id=<gameId>` → game screen, subscribe to that game's event source
  - `/room?id=<roomId>` → room setup screen
  - `/profile` → profile screen
- Update URL when navigating: `window.history.pushState()`
- Subscribe to event source based on URL parameter, not internal state

### ⚠️ DESIGN ERROR: Tight Coupling to Quortex Game

**Location:** `src/multiplayerMain.ts` lines 38-100

**Finding:** The multiplayer client is specifically coded for Quortex, not generic:

```typescript
// Lines 38-46: Game-specific canvas initialization
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
let renderer: Renderer | null = null;
let inputHandler: InputHandler | null = null;
let gameCoordinator: GameCoordinator | null = null;
```

**Why this is a problem:**
- While the client is ALLOWED to be game-specific (only server needs to be generic), the architecture doesn't demonstrate the generality of the server
- The design goals imply the server could support ANY collaborative app
- But the client code doesn't show how a different app would use the same server

**Recommendation:**
- This is actually acceptable since the design goal only requires the SERVER to be game-agnostic
- However, adding documentation or a second example client (e.g., chat app) would demonstrate the server's generality
- Consider documenting how a different client would use the same event source infrastructure

---

## Redux Architecture Analysis

### ✅ GOOD: Immutable State Updates

**Location:** `src/redux/gameReducer.ts` throughout

**Finding:** All Redux reducers return new state objects, never mutate:

```typescript
// Lines 260-263: Example of immutable update
return {
  ...state,
  configPlayers: [...state.configPlayers, newPlayer],
};
```

**Why this is good:**
- Enables time-travel debugging
- Makes state changes predictable
- Supports deterministic replay
- Aligns with Redux best practices

### ⚠️ DESIGN ERROR: Multi-Purpose Actions

**Location:** `src/redux/gameReducer.ts`

**Finding 1 - PLACE_TILE does multiple things (lines ~500-570):**

```typescript
case PLACE_TILE: {
  // 1. Validates tile placement
  if (state.currentTile === null) return state;
  if (state.board.has(posKey)) return state;
  
  // 2. Updates board
  const newBoard = new Map(state.board);
  newBoard.set(posKey, placedTile);
  
  // 3. Calculates flows
  const { flows: newFlows, flowEdges: newFlowEdges } = calculateFlows(
    newBoard, state.players, state.boardRadius
  );
  
  // 4. Checks for victory
  const victoryResult = checkVictory(newBoard, state.players, state.teams);
  
  // 5. Updates move history
  const move = { playerId, tile, timestamp };
  
  // 6. Returns new state with all changes
  return {
    ...state,
    board: newBoard,
    currentTile: null,
    flows: newFlows,
    flowEdges: newFlowEdges,
    moveHistory: [...state.moveHistory, move],
    supermoveInProgress: false,
    lastPlacedTilePosition: position,
    // 7. Potentially ends game
    winners: victoryResult.winners,
    winType: victoryResult.winType,
    phase: victoryResult.winners.length > 0 ? 'finished' : 'playing'
  };
}
```

**Why this is a problem:**
- PLACE_TILE does at least 7 different things
- Violates single-purpose principle
- Replaying this action on different clients could lead to inconsistency if:
  - Flow calculation has bugs
  - Victory checking has race conditions
  - Timestamp differs between clients
- Makes testing harder (must test all side effects together)

**Recommendation:**
Break into separate actions:
1. `PLACE_TILE` - only updates board with tile
2. `CALCULATE_FLOWS` - recalculates flows (can be derived/selector)
3. `CHECK_VICTORY` - checks win conditions (can be derived/selector)
4. `RECORD_MOVE` - adds to move history
5. `END_GAME` - transitions to finished state

Or better yet, make flows and victory checking into **selectors** (derived state) rather than stored state.

**Finding 2 - START_GAME does multiple things (lines 317-374):**

```typescript
case START_GAME: {
  // 1. Validates player count
  if (state.configPlayers.length === 0) return state;
  
  // 2. Adds AI opponent if needed
  if (configPlayers.length === 1 && !configPlayers[0].isAI) {
    // ... add AI player
  }
  
  // 3. Randomizes player order
  const seatingOrder = randomizePlayerOrder(playerIds, seed);
  
  // 4. Transitions to seating phase
  // 5. Updates multiple state fields
  return {
    ...state,
    configPlayers,
    screen: "seating",
    phase: "seating",
    boardRadius: action.payload?.boardRadius ?? state.boardRadius,
    seed,
    supermove: action.payload?.supermove ?? state.supermove,
    // ... 6 more fields
  };
}
```

**Why this is a problem:**
- Mixes configuration, AI logic, randomization, and screen transition
- Non-deterministic: adding AI player on the client could differ between clients
- Should be broken up into separate concerns

**Recommendation:**
- `CONFIGURE_GAME` - set board radius, supermove settings
- `ADD_AI_PLAYER` - explicitly add AI (done before START_GAME)
- `RANDOMIZE_SEATING_ORDER` - create seating order with seed
- `BEGIN_SEATING_PHASE` - transition to seating screen
- Each action does ONE thing

### ⚠️ DESIGN ERROR: Non-Deterministic Randomization

**Location:** `src/redux/gameReducer.ts` lines 151-158, 350-353

**Finding:** Player order randomization depends on seed, but timestamp is used elsewhere:

```typescript
// Lines 151-158: shuffleArray with optional seed
function shuffleArray<T>(array: T[], seed?: number): T[] {
  const rng = seed !== undefined ? seededRandom(seed) : Math.random;
  // Fisher-Yates shuffle with rng
}

// Lines 350-353: Seeding is optional
const seed = action.payload?.seed;
const seatingOrder = randomizePlayerOrder(playerIds, seed);

// Lines ~540: Move timestamp uses Date.now()
const move = {
  playerId: state.players[state.currentPlayerIndex].id,
  tile: placedTile,
  timestamp: Date.now(),  // NON-DETERMINISTIC!
};
```

**Why this is a problem:**
- If seed is not provided, randomization uses `Math.random()` which differs between clients
- `timestamp: Date.now()` will be different on each client
- Violates design goal: "A replay of actions on different clients should result in the same state"
- Two clients replaying the same action sequence could end up with different timestamps in move history

**Recommendation:**
1. Always require seed for any randomization
2. Remove `Date.now()` from reducers - timestamp should come from action payload
3. Action creators should generate timestamp once, pass it in payload
4. Document that all actions must be deterministic when replayed

### ⚠️ MINOR ISSUE: Flow Calculation on Every PLACE_TILE

**Location:** `src/redux/gameReducer.ts` lines ~520-530

**Finding:** Flows are recalculated and stored in state on every tile placement:

```typescript
// Calculate new flows
const { flows: newFlows, flowEdges: newFlowEdges } = calculateFlows(
  newBoard,
  state.players,
  state.boardRadius,
);

return {
  ...state,
  flows: newFlows,
  flowEdges: newFlowEdges,
  // ...
};
```

**Why this is a minor issue:**
- Flows are derivable from `board` and `players` - they don't need to be stored
- Increases state size unnecessarily
- Creates potential for inconsistency (what if flows don't match board?)
- Harder to test (must verify flows are correct after every action)

**Recommendation:**
- Remove `flows` and `flowEdges` from state
- Create memoized selectors:
  ```typescript
  const selectFlows = createSelector(
    [state => state.board, state => state.players, state => state.boardRadius],
    (board, players, radius) => calculateFlows(board, players, radius)
  );
  ```
- Flows are computed on-demand, cached automatically
- State stays minimal and canonical

### ✅ GOOD: Pure Functions for Game Logic

**Location:** `src/game/` directory (flows.ts, legality.ts, victory.ts, board.ts)

**Finding:** Core game logic is implemented as pure functions:

```typescript
// From flows.ts
export function calculateFlows(
  board: Map<string, PlacedTile>,
  players: Player[],
  boardRadius: number
): { flows: Map<string, Set<string>>; flowEdges: Map<string, Set<number>> }

// From legality.ts
export function isLegalMove(
  board: Map<string, PlacedTile>,
  tile: PlacedTile,
  players: Player[],
  teams: Team[],
  boardRadius: number
): boolean
```

**Why this is good:**
- Pure functions are deterministic (same inputs → same outputs)
- Easy to test
- Can be called from anywhere (reducers, selectors, middleware)
- Supports deterministic replay goal
- Well-architected separation of concerns

---

## Summary of Findings

### Critical Design Errors

1. **Server is NOT game-agnostic** ❌
   - Contains game-specific validation (min players, host privileges)
   - Reconstructs game state (should only store actions)
   - Violates core design goal

2. **Client has NO URL-based routing** ❌
   - Uses Svelte store for navigation, not URLs
   - Can't share links to games
   - Violates core design goal

3. **Redux actions are NOT single-purpose** ⚠️
   - `PLACE_TILE` does 7+ things
   - `START_GAME` does 6+ things
   - Violates single-purpose principle

4. **Actions are NOT fully deterministic** ⚠️
   - Uses `Date.now()` in reducers
   - Optional seeding for randomization
   - Violates deterministic replay goal

### Good Design Practices

1. **Event sourcing architecture** ✅
   - Append-only JSONL files
   - Clean action log design
   - Proper caching and buffering

2. **Pure function game logic** ✅
   - Flows, legality, victory are pure functions
   - Well-separated from state management
   - Testable and deterministic

3. **Immutable state updates** ✅
   - All reducers return new state
   - No mutations
   - Redux best practices

4. **Socket.IO pub/sub pattern** ✅
   - Clean action broadcasting
   - Server acts as message broker
   - All clients receive same stream

### Priority Recommendations

**High Priority:**
1. Implement URL-based routing (critical for usability)
2. Remove game-specific logic from server (critical for design goal)
3. Break up multi-purpose Redux actions
4. Make all actions deterministic (required timestamps in payload)

**Medium Priority:**
5. Move flows/victory to selectors instead of stored state
6. Document how server can support other apps (demonstrate generality)
7. Separate authentication from event sourcing

**Low Priority:**
8. Add example of non-game client using same server
9. Improve type safety around action payloads
10. Consider Redux Toolkit for better action/reducer patterns

---

## Conclusion

The implementation shows **strong technical execution** in some areas (event sourcing, pure functions, immutability) but **fails to meet key design goals**:

- **Server is NOT game-agnostic** - contains game logic
- **Client lacks URL routing** - can't share game links
- **Redux actions are NOT single-purpose** - do too many things
- **Replay is NOT deterministic** - uses timestamps from reducers

The good news is that the foundation is solid. The event sourcing architecture is well-designed, and the core game logic is properly separated. The issues are fixable with focused refactoring:

1. Strip game logic from server → generic event store
2. Add URL routing to client → shareable game links  
3. Split Redux actions → one purpose per action
4. Remove `Date.now()` from reducers → deterministic replay

These changes would bring the implementation in line with the stated design goals while preserving the strong architectural foundation.
