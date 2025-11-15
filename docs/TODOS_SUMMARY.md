# TODO Summary

This document lists all identified TODO items and unfinished work in the Quortex codebase. It focuses only on tasks already noted in the code or documentation, not speculative future work.

## Code TODOs

### Rendering / UI

#### Tile Placement Preview UI - ✅ COMPLETED

The following UI enhancements have been implemented:

- ✅ **DONE**: Red border for illegal placement
  - Implemented in `src/rendering/gameplayRenderer.ts` (~line 1403-1420)
  - Shows a red border around the tile preview when placement would be illegal
  - Provides immediate feedback to the player before they confirm the move

- ✅ **DONE**: Checkmark and X buttons
  - Implemented in `src/rendering/gameplayRenderer.ts` (~line 1554-1564)
  - Interactive buttons to confirm (checkmark) or cancel (X) tile placement
  - Buttons are oriented toward the player's edge for better UX
  - Includes rotation buttons at NE and NW corners
  - E2E tests exist in `tests/e2e/complete-game-mouse.spec.ts`

## Documentation Notes

### Flow Bug Tests - ✅ RESOLVED

The flow propagation bugs have been fixed. All 99 tests in the flow bug test suite pass:

- ✅ `tests/flow-bug-move5.test.ts` - All tests pass
- ✅ `tests/flow-bug-two-tiles.test.ts` - All 98 tests pass (including comprehensive two-tile flow tests)

**Action Items:**
- The "BUG" comments in these test files should be updated to reflect that the tests now pass successfully

## Multiplayer Implementation Status

Based on `docs/MULTIPLAYER.md` and `server/src/index.ts`, the multiplayer implementation has made significant progress:

### ✅ Implemented Features (MVP)

- ✅ **File-based persistent storage**: Using event sourcing with `.jsonl` files
  - Game actions are stored as append-only logs
  - Data persists across server restarts
  - Implemented in `server/src/storage/`
  
- ✅ **OAuth authentication**: Google and Discord authentication
  - Implemented in `server/src/auth/` 
  - Anonymous user support with automatic cleanup
  
- ✅ **Game state persistence and replay**: Via action logs
  - All game actions are logged with sequence numbers
  - Can replay entire game from action history
  
- ✅ **Real-time game state synchronization**: 
  - Socket.IO event handlers for `post_action` and `get_actions`
  - Actions are broadcast to all players in a game room
  - Implemented in `server/src/index.ts`

### Current Limitations (MVP)

- ⏳ **Reconnection handling**: Partial implementation
  - Players can disconnect and server tracks it
  - Full reconnection flow needs more work
  
- ❌ **No spectator mode**: Can't watch games in progress
  
- ❌ **No chat functionality**: Players cannot communicate in-game

### Planned Future Enhancements

These are documented as planned but not yet implemented:

- Complete reconnection handling
- Chat system
- Spectator mode
- Leaderboards
- Tournament support
- Migration to MongoDB when scaling needs arise (10K+ concurrent users)

## Testing

### End-to-End Testing

**Single-Player E2E Tests**: ✅ Comprehensive coverage exists
- Tile placement with checkmark/X buttons: `tests/e2e/complete-game-mouse.spec.ts`
- Complete game flows: `tests/e2e/complete-game.spec.ts`, `tests/e2e/complete-game-clicks.spec.ts`
- Flow propagation: `tests/e2e/flow-propagation.spec.ts`, `tests/e2e/multi-tile-flow.spec.ts`
- Blocking detection: `tests/e2e/blocking-sharp-tiles.spec.ts`
- AI gameplay: `tests/e2e/ai-player.spec.ts`, `tests/e2e/ai-gameplay.spec.ts`
- Victory animations: `tests/e2e/victory-animation.spec.ts`
- And many more in `tests/e2e/`

**Multiplayer E2E Tests**: ❌ Not yet implemented
- Need E2E tests for multiplayer room creation and joining
- Need E2E tests for multiplayer game synchronization
- Need E2E tests for disconnect/reconnect scenarios

## Summary

### ✅ Completed Items

1. ~~Add red border for illegal tile placement preview~~ - **DONE** (gameplayRenderer.ts)
2. ~~Add checkmark and X buttons for tile placement confirmation~~ - **DONE** (gameplayRenderer.ts)
3. ~~Fix flow propagation bugs~~ - **DONE** (all tests pass)
4. ~~Implement persistent storage for multiplayer~~ - **DONE** (file-based with event sourcing)
5. ~~Implement OAuth authentication~~ - **DONE** (Google, Discord)
6. ~~Implement game state synchronization~~ - **DONE** (Socket.IO with action logs)

### 🔧 Cleanup/Maintenance Items

1. Update "BUG" comments in flow bug test files (tests now pass successfully)

### 🚧 Work In Progress

1. Complete reconnection handling for multiplayer (partial implementation exists)
2. Add end-to-end tests for multiplayer functionality

### 📋 Future Enhancements

The README.md "Future Enhancements" section tracks planned features:
- AI opponents (easy, medium difficulty levels) - **Note: AI is already implemented!**
- Additional OAuth providers (Facebook, Apple)
- Migration to MongoDB for scaling (10K+ concurrent users)
- Game notation system for replay - **Note: Action logs provide this!**
- Advanced analytics and statistics
- Additional board sizes and variants
- Chat system
- Spectator mode
- Leaderboards
- Tournament support

**Note**: This document focuses on immediately necessary work already identified in the codebase. For long-term planning and future features, see README.md and the design documents in `docs/designs/`.
