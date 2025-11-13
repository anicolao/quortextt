# TODO Summary

This document lists all identified TODO items and unfinished work in the Quortex codebase. It focuses only on tasks already noted in the code or documentation, not speculative future work.

## Code TODOs

### Rendering / UI

#### Tile Placement Preview UI (`src/rendering/gameplayRenderer.ts:1283-1284`)

When a tile is being previewed at a selected position, the following UI enhancements are needed:

- **TODO**: Add red border if illegal placement
  - Show a visual indicator (red border) around the tile preview when the placement would be illegal
  - This provides immediate feedback to the player before they confirm the move

- **TODO**: Show checkmark and X buttons
  - Display interactive buttons to confirm (checkmark) or cancel (X) the tile placement
  - Improves mobile/touch experience by providing clear action buttons

**Location**: `src/rendering/gameplayRenderer.ts`, lines 1283-1284, in the `renderCurrentTilePreview()` method

**Context**: These TODOs are in the tile preview rendering code, specifically when a player has selected a position on the board (`state.ui.selectedPosition` is set).

## Documentation Notes

### Flow Bug Tests (Now Resolved)

The following test files contain comments labeled "BUG" but the tests are now **passing**:

- `tests/flow-bug-move5.test.ts` - Line 51: "BUG: (-2,-1) should have flow but doesn't" - ✅ Test passes
- `tests/flow-bug-two-tiles.test.ts` - Line 61: "BUG: Tile 2 should have flow" - ✅ Test passes

**Status**: These bugs appear to have been fixed. The BUG comments in the tests should be updated or removed to reflect that the tests now pass successfully.

## Multiplayer Implementation Status

Based on `docs/MULTIPLAYER.md` (lines 105-111), the following limitations exist in the current MVP:

### Current Limitations

- **No persistent storage**: Rooms and players are lost on server restart
  - All data is stored in memory only
  
- **No authentication**: Username only, no passwords
  - Basic MVP login without security
  
- **No reconnection handling**: Players can't rejoin after disconnect
  - Connection loss means the player is removed from the game
  
- **Game state synchronization**: Not fully implemented yet
  - Real-time game state sync between client and server needs work
  
- **No spectator mode**: Can't watch games in progress
  
- **No chat functionality**: Players cannot communicate in-game

### Planned Future Enhancements (from MULTIPLAYER.md)

These are documented as planned but not yet implemented:

- Database integration (MongoDB)
- OAuth authentication (Facebook, Google, Discord, Apple)
- Game state persistence and replay
- Reconnection handling
- Chat system
- Leaderboards
- Tournament support

## Testing

### End-to-End Testing

From `docs/MULTIPLAYER.md` (line 172):

- **TODO**: End-to-end multiplayer tests are not yet implemented
  - Need E2E tests for multiplayer functionality
  - Current test suite covers single-player game logic extensively

## Summary

### Immediate Work Items (Code TODOs)

1. Add red border for illegal tile placement preview (gameplayRenderer.ts)
2. Add checkmark and X buttons for tile placement confirmation (gameplayRenderer.ts)

### Update/Cleanup Items

3. Update or remove "BUG" comments in flow bug test files (tests are now passing)

### Multiplayer Work In Progress

4. Complete game state synchronization in multiplayer
5. Implement reconnection handling for multiplayer
6. Add end-to-end tests for multiplayer functionality

### Future Enhancement Tracking

The README.md "Future Enhancements" section (lines 60-67) tracks planned features:
- AI opponents (easy, medium difficulty levels)
- Additional OAuth providers (Facebook, Google, Apple)
- Database persistence (MongoDB)
- Game notation system for replay
- Advanced analytics and statistics
- Additional board sizes and variants

**Note**: This document focuses on immediately necessary work already identified in the codebase. For long-term planning and future features, see README.md and the design documents in `docs/designs/`.
