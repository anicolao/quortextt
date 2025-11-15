# Reconnection and Spectator Mode Design Document

## 1. Overview

This document specifies the user-facing behavior and high-level technical design for full reconnection support and spectator mode in Quortex multiplayer games. These features are identified in TODOS_SUMMARY.md as incomplete or not yet implemented.

**Current State:**
- ✅ Partial reconnection implemented (session tracking, action logs)
- ❌ Full reconnection flow needs completion
- ❌ Spectator mode not yet implemented

**Related Documents:**
- [TODOS_SUMMARY.md](../TODOS_SUMMARY.md) - Current implementation status
- [MULTIPLAYER.md](../MULTIPLAYER.md) - Multiplayer architecture overview
- [UNIFIED_MULTIPLAYER.md](UNIFIED_MULTIPLAYER.md) - Multi-platform architecture
- [server/src/storage/README.md](../../server/src/storage/README.md) - Event sourcing implementation

## 2. Reconnection Support

### 2.1 User-Facing Behavior

#### 2.1.1 Reconnection Scenarios

**Scenario 1: Quick Disconnect/Reconnect (< 30 seconds)**
- User's connection drops briefly (network hiccup, tab backgrounded, etc.)
- Upon reconnection, user sees:
  - "Reconnecting to game..." loading indicator
  - Game state restores automatically
  - All game history replays seamlessly
  - User can immediately continue playing their turn or wait for their turn
  - Other players see brief "Player temporarily disconnected" indicator
  - No data loss, game continues smoothly

**Scenario 2: Extended Disconnect**
- User loses connection for longer period (subway tunnel, phone call, etc.)
- System behavior:
  - Server marks player as "disconnected" but keeps their seat
  - Game waits indefinitely for the player to reconnect
  - Other players see "Waiting for [Player Name] to reconnect..."
  - No timeout - players can wait as long as they want
- Upon reconnection:
  - User sees list of active games: "Resume Game: [Game Name] - Your turn!"
  - User clicks to rejoin
  - Game state fully restores from action history
  - User can continue playing
  - Other players see "[Player Name] has reconnected"

**Scenario 3: App Closure/Browser Closure**
- User closes app, closes tab, or navigates away
- Upon returning later:
  - Dashboard shows "Active Games" section (for both authenticated and anonymous users via cookies)
  - Each active game shows:
    - Game name
    - Current status (Waiting, Your turn, Opponent's turn)
    - Time since last activity
    - "Resume" button
  - User clicks "Resume" to rejoin
  - Game loads with full history
  - Play continues normally

#### 2.1.2 Authentication Requirements

**Authenticated Users (Google/Discord/Facebook/Apple)**
- Persistent player ID across sessions
- Games persist in user session
- Can reconnect from any device
- Active games list available on login
- Game history saved to user profile

**Anonymous Users**
- Player ID stored in persistent cookie (30-day expiry)
- Can reconnect from same browser even after closing
- Cookie enables seamless reconnection without login
- Games auto-cleanup after 30 days of inactivity
- Can claim anonymous account later to preserve games

### 2.2 Edge Cases to Handle

#### Network Edge Cases
1. **Rapid Connect/Disconnect Cycles**
   - Flaky connection causing repeated reconnects
   - Solution: Implement exponential backoff, show "Poor connection" warning
   - Don't spam other players with constant notifications

2. **Simultaneous Disconnect of All Players**
   - All players lose connection simultaneously (server restart, network outage)
   - Solution: Server persists game state; all players rejoin when available
   - Game resumes from last confirmed action

3. **Partial Network Partition**
   - Some players can reach server, others cannot
   - Solution: Server is source of truth; players rejoin when network recovers
   - No split-brain scenarios possible

4. **Client-Server Time Sync Issues**
   - Client clock significantly different from server
   - Solution: Use server timestamp for all actions; client displays relative times
   - Don't rely on client-side time for game logic

#### State Synchronization Edge Cases
1. **Reconnect During Action Processing**
   - Player disconnects while their action is being processed
   - Solution: Action either completes or doesn't; no partial actions
   - On reconnect, player sees result of their action (if completed)

2. **Reconnect With Stale Client State**
   - Client has outdated cached state before disconnect
   - Solution: Always fetch full action history on reconnect
   - Rebuild state from scratch, ignore client cache

3. **Multiple Simultaneous Connections Same User**
   - User opens game in two browser tabs/devices
   - Solution: 
     - Latest connection becomes active
     - Previous connection gets "Connected elsewhere" message and becomes read-only spectator
     - Prevent action posting from non-active connections

4. **Reconnect to Wrong Game**
   - User tries to join game they're not part of
   - Solution: Validate player membership before allowing actions
   - Show "You are not a player in this game" error

#### Data Consistency Edge Cases
1. **Action Log Corruption**
   - Action file becomes corrupted or incomplete
   - Solution: Validate action sequence numbers; detect gaps
   - If corruption detected, mark game as corrupted, notify players

2. **Missing Action in History**
   - Gap in sequence numbers during replay
   - Solution: Request missing actions from server
   - If unavailable, mark game as unrecoverable, offer compensation

3. **Conflicting Actions from Multiple Clients**
   - Two players submit actions at nearly same time
   - Solution: Server sequence numbers determine order
   - Only valid actions according to that order are accepted

4. **Session Data Mismatch**
   - User session says they're in game, but game doesn't list them
   - Solution: Trust game state; update session to match reality
   - Gracefully handle and log inconsistency for debugging

### 2.3 High-Level Technical Design

#### 2.3.1 Session Management Enhancement

**Current Implementation:**
- Session data stored in `sessions.jsonl`
- Tracks `activeGameIds` per user
- Updated on join/leave

**Required Enhancements:**
1. **Heartbeat Mechanism**
   - Client sends periodic heartbeat (every 10 seconds)
   - Server updates `lastSeen` timestamp
   - Detect disconnection if no heartbeat for 15 seconds

2. **Connection State Tracking**
   ```typescript
   interface SessionState {
     userId: string;
     username: string;
     activeGameIds: string[];
     lastSeen: number;
     connectionState: 'connected' | 'disconnected';
     currentSocketId?: string; // Current active socket
     lastKnownState: {
       [gameId: string]: {
         lastActionSequence: number; // Last action they processed
         lastSeenTimestamp: number;
       }
     }
   }
   ```

3. **Reconnection Flow**
   - On `identify` event, check for existing session
   - If session exists with activeGameIds:
     - Send `active_games_list` event to client
     - Client shows "Resume games" UI
   - On `join_room` with existing player:
     - Mark as reconnection
     - Send full action history
     - Update `currentSocketId` in session
     - Broadcast `player_reconnected` to other players

#### 2.3.2 Action Replay System

**Current Implementation:**
- Actions stored in `game-{id}.actions.jsonl`
- Can retrieve full history with `get_actions` event

**Required Enhancements:**
1. **Incremental Sync**
   - Client stores last processed sequence number
   - On reconnect, request only actions since that sequence
   - Server sends `{ actions: Action[], fromSequence: number, toSequence: number }`
   - Reduces bandwidth for long-running games

2. **Checkpointing**
   - Server creates state snapshots periodically (every 20-30 actions)
   - Store as `game-{id}.checkpoint-{seq}.json`
   - On reconnect with large gap, load nearest checkpoint + subsequent actions
   - Note: With max ~40 moves per game, this is rarely needed but helpful for spectator replay

3. **Client-Side Replay Queue**
   - Buffer incoming actions during replay
   - Process in correct sequence order
   - Ensure deterministic state reconstruction

#### 2.3.3 UI State Management

**Client-Side Reconnection State:**
```typescript
interface ReconnectionState {
  status: 'connected' | 'disconnecting' | 'reconnecting' | 'failed';
  attemptCount: number;
  lastConnectedTime: number;
  activeGames: GameSummary[];
}

interface GameSummary {
  gameId: string;
  gameName: string;
  status: 'waiting' | 'your_turn' | 'their_turn' | 'finished';
  playerCount: number;
  lastActivity: number;
  canResume: boolean;
}
```

**UI Components Needed:**
1. Connection status indicator (always visible)
2. "Resume Active Games" screen (on reconnect)
3. "Player Disconnected" overlay (when opponent disconnects)
4. "Waiting for player to reconnect..." message

## 3. Spectator Mode

### 3.1 User-Facing Behavior

#### 3.1.1 Spectating Scenarios

**Scenario 1: Public Game Spectating**
- User browses list of "Live Games" in lobby
- Each game shows:
  - Game name
  - Players (usernames)
  - Current turn
  - Spectator count
  - "Watch" button
- User clicks "Watch"
- Game loads in spectator view:
  - Full board visible
  - Player info panels for all players
  - Move history sidebar
  - "Stop Watching" button
  - No interaction controls (can't place tiles, can't vote)
  - Can see what each player sees (no hidden information in Quortex)

**Scenario 2: Friend Game Spectating**
- User receives link to friend's game: `/game/{gameId}/spectate`
- Opens game in spectator mode
- All spectator UI features available
- Can share link with others

**Scenario 3: Tournament/Featured Game Spectating**
- Lobby shows "Featured Games" section
- High-level games highlighted
- Multiple spectators can watch simultaneously
- Spectator chat available (optional)
- No limit on spectator count (reasonable limit: ~100 per game)

**Scenario 4: Post-Game Replay**
- Finished games can be "watched" as replays
- Timeline scrubber to jump to any point
- Play/pause controls
- Speed controls (0.5x, 1x, 2x, 4x)
- "Download replay" option (exports action log)

#### 3.1.2 Spectator Interactions

**What Spectators CAN Do:**
- View full game board in real-time
- See all player information (names, tiles, scores)
- View move history
- Navigate between past moves (if replay controls enabled)
- See flow animations and effects
- Access help documentation and move list
- Share spectator link with others
- Exit to lobby (not to setup screen - players only)

**What Spectators CANNOT Do:**
- Place tiles or make any game moves (enforced by player ID check)
- Access setup screen or change game options
- Disrupt or interfere with gameplay
- Become a player mid-game (unless slot opens and invited)

#### 3.1.3 Transitioning Between Roles

**Spectator → Player:**
- If a player slot opens (player leaves waiting room):
  - Spectator can be invited by host to join as player
  - Spectator clicks "Join as Player" button
  - Transitions to player view with full controls
  - No longer counted as spectator

**Player → Spectator:**
- If player clicks exit during game:
  - Player is taken back to setup screen (can change options)
  - Can rejoin game as player if desired
- If player leaves game completely:
  - Can rejoin as spectator to watch outcome
  - Cannot rejoin as player

**Disconnected Player:**
- Player automatically reconnects to game when connection restored
- No timeout - game waits indefinitely
- Can continue playing once reconnected

### 3.2 Edge Cases to Handle

#### State Synchronization Edge Cases
1. **Spectator Joins Mid-Game**
   - Game is 20+ moves in
   - Solution: Send full action history to spectator
   - Client rebuilds state from history
   - Same as player reconnection logic

2. **Spectator Lag/Slow Connection**
   - Spectator can't keep up with rapid moves
   - Solution: Buffer actions, process in order
   - Show "Live (delayed by 3s)" indicator if lagging
   - Allow spectator to "catch up" when ready

3. **Spectator Sees Desync**
   - Spectator's view doesn't match players' view
   - Solution: Provide "Refresh/Resync" button
   - Clears local state, reloads from action history
   - Log desync for debugging

4. **Spectator Capacity**
   - Too many spectators could impact performance
   - Solution: Set reasonable limit (~100 spectators per game)
   - Show "Spectator limit reached" if needed
   - Monitor server performance with many spectators

#### Replay Edge Cases
1. **Replay of In-Progress Game**
   - User scrubs back in time while game is live
   - Solution: Clear distinction between "live" and "replay" modes
   - "Return to live" button always visible
   - New actions buffer but don't auto-apply in replay mode

2. **Corrupted Replay Data**
   - Action log has gaps or corruption
   - Solution: Show error: "Replay unavailable (data corruption)"
   - Allow download of partial action log
   - Skip corrupted sections if possible

### 3.3 High-Level Technical Design

#### 3.3.1 Spectator Session Management

**Data Model:**
```typescript
interface SpectatorSession {
  spectatorId: string; // User ID or anonymous ID
  gameId: string;
  username: string;
  joinedAt: number;
  socketId: string;
  viewMode: 'live' | 'replay';
  replayPosition?: number; // Current sequence number if in replay mode
}

interface GameRoom {
  // Existing fields...
  id: string;
  players: Player[];
  status: 'waiting' | 'playing' | 'finished';
  
  // New fields:
  spectators: SpectatorSession[];
  spectatorCount: number; // Redundant but useful for quick access
  allowSpectators: boolean; // Host can disable spectators
  isPublic: boolean; // Show in public games list
  spectatorChatEnabled: boolean; // Optional chat for spectators
}
```

**Socket.IO Events:**
```typescript
// Client → Server
'join_as_spectator' { gameId: string }
'leave_spectator' { gameId: string }
'spectator_heartbeat' { gameId: string }
'set_replay_position' { gameId: string, sequence: number }

// Server → Client
'spectator_joined' { spectator: { id, username }, spectatorCount: number }
'spectator_left' { spectatorId: string, spectatorCount: number }
'spectator_state' { gameState: GameState, actions: Action[] }
```

#### 3.3.2 Action Broadcasting Strategy

#### 3.3.2 Action Broadcasting Strategy

**Single Room Architecture:**

Both players and spectators are in the same socket.io room (`game-{id}`), receiving the same action events. Access control is enforced at the action submission level rather than the room level.

**Broadcasting Flow:**
```typescript
// When action is posted:
1. Validate that posting user is the current active player
2. If not active player, reject action with error
3. If valid, append to action log (storage)
4. Broadcast to entire room: io.to(`game-${gameId}`).emit('action_posted', action)
```

**Action Validation:**
```typescript
// Server-side validation before accepting action
async function validateAction(gameId: string, action: Action, playerId: string): boolean {
  const state = await gameStorage.getGameState(gameId);
  
  // Get the current active player
  const currentPlayerIndex = getCurrentPlayerIndex(state);
  const activePlayerId = state.players[currentPlayerIndex].id;
  
  // Only the active player can post actions
  if (playerId !== activePlayerId) {
    return false; // Reject action
  }
  
  return true; // Allow action
}
```

**Benefits:**
- Simpler architecture with single room per game
- Same events for all participants
- Spectators naturally cannot post actions (wrong player ID)
- Players cannot post actions when it's not their turn
- Fixes existing bug where any player can play any other player's moves

#### 3.3.3 Replay System

**Architecture:**
```typescript
interface ReplayController {
  gameId: string;
  actions: Action[]; // Full action history
  currentSequence: number; // Current position in replay
  playbackSpeed: number; // 0.5x, 1x, 2x, 4x
  isPlaying: boolean; // Auto-advancing or paused
  
  // Methods
  play(): void;
  pause(): void;
  seekToSequence(seq: number): void;
  seekToStart(): void;
  seekToEnd(): void;
  setSpeed(speed: number): void;
  stepForward(): void;
  stepBackward(): void;
}
```

**Client-Side Implementation:**
- Fetch full action history on replay load
- Rebuild state up to desired sequence number
- Provide VCR-style controls (play, pause, rewind, fast-forward)
- Show timeline with hover preview
- Highlight interesting moments (major plays, victories)

**Server-Side Support:**
- Serve action history via REST API for finished games
- Cache compiled game states at intervals (every 20 moves)
- Provide metadata: move count, duration, players, outcome

#### 3.3.4 UI Components

**Spectator-Specific UI Elements:**

1. **Spectator Status Bar**
   - "👁️ Spectating: [Game Name]"
   - Spectator count: "15 watching"
   - "Exit to Lobby" button (not setup screen)

2. **Player Perspectives Toggle**
   - Tabs for each player's view
   - Highlight current turn player
   - Show each player's hand/tiles

3. **Move History Panel**
   - Scrollable list of all moves
   - Click to jump to that point in history
   - Filter by player
   - Access help and move list

4. **Replay Controls (for finished games)**
   ```
   [<<] [<] [Play/Pause] [>] [>>]
   ─────●─────────────────────────
   Move 23 of 37
   Speed: [1x ▼]
   ```

5. **Spectator Chat (optional)**
   - Separate from player chat
   - Spectators can discuss game
   - Players don't see spectator chat
   - Moderation tools for featured games

6. **Share Spectator Link**
   - Copy link button: `/game/{gameId}/spectate`
   - QR code for mobile sharing
   - "Invite friends to watch" feature

## 4. Implementation Priority and Phases

### Phase 1: Complete Reconnection Support (High Priority)
**Effort: 2-3 weeks**

1. **Week 1: Core Reconnection Logic**
   - Implement heartbeat mechanism
   - Enhanced session tracking with connection state
   - Automatic reconnection flow
   - Action replay optimization
   - Cookie-based persistence for anonymous users

2. **Week 2: Infinite Wait Implementation**
   - Remove timeout system (games wait indefinitely)
   - Cleanup jobs for old finished games
   - Testing various disconnect scenarios
   - Handle edge cases (rapid disconnect, simultaneous disconnects)

3. **Week 3: UI and Polish**
   - Resume games screen
   - Connection status indicators
   - Reconnection notifications
   - User testing and refinement

### Phase 2: Basic Spectator Mode (Medium Priority)
**Effort: 3-4 weeks**

1. **Week 1-2: Spectator Foundation**
   - Spectator session management
   - Join/leave as spectator
   - Single room architecture (players + spectators)
   - Action validation (only active player can post)
   - Spectator UI basics

2. **Week 3: Spectator Features**
   - Public games list with spectator counts
   - Move history viewer
   - Spectator notifications
   - Help and move list access for spectators
   - Exit to lobby (not setup) for spectators

3. **Week 4: Testing and Refinement**
   - Load testing with many spectators
   - Edge case handling
   - Performance optimization
   - Documentation

### Phase 3: Replay System (Lower Priority)
**Effort: 2-3 weeks**

1. **Week 1: Replay Infrastructure**
   - Replay controller implementation
   - State checkpointing system
   - Replay API endpoints
   - Timeline navigation

2. **Week 2: Replay UI**
   - VCR controls
   - Timeline scrubber
   - Speed controls
   - Jump to interesting moments

3. **Week 3: Advanced Features**
   - Download replays
   - Share replay links
   - Replay annotations
   - Statistics and analysis

### Phase 4: Advanced Features (Future)
**Effort: Ongoing**

- Spectator chat system
- Tournament spectating with commentary
- Featured games and discovery
- Spectator analytics (view counts, engagement)
- Player streaming integration
- Mobile-optimized spectator experience

## 5. Testing Strategy

### 5.1 Reconnection Testing

**Unit Tests:**
- Session management functions
- Timeout calculations
- Action replay logic
- State reconstruction

**Integration Tests:**
- Socket.IO reconnection flows
- Action log integrity
- Session persistence
- Multi-player scenarios

**End-to-End Tests:**
- Simulate network disconnect
- Rapid connect/disconnect cycles
- Reconnect after extended periods
- Multiple device reconnection
- Anonymous vs authenticated users (cookie persistence)

**Load Tests:**
- Many simultaneous reconnections
- Action history replay (up to ~40 moves)
- Server restart recovery
- Database corruption scenarios

### 5.2 Spectator Testing

**Unit Tests:**
- Spectator session management
- Action validation (active player only)
- Replay controller

**Integration Tests:**
- Join/leave spectator flows
- Single room management (players + spectators)
- Action synchronization
- Capacity limits

**End-to-End Tests:**
- Watch live game as spectator
- Replay finished game
- Spectator UI interactions (help, move list)
- Multiple simultaneous spectators
- Transition spectator to player

**Load Tests:**
- 100+ spectators on single game
- Many concurrent spectated games
- Replay of full games (~40 moves)
- Bandwidth usage with spectators

## 6. Success Metrics

### Reconnection Metrics
- **Reconnection Success Rate**: > 95% of disconnects successfully rejoin
- **Reconnection Time**: < 3 seconds average from reconnect to playable state
- **Data Loss Rate**: 0% - no actions lost in reconnection
- **Cookie Persistence**: Anonymous users can reconnect after browser restart

### Spectator Metrics
- **Spectator Engagement**: Average watch time > 5 minutes
- **Spectator to Player Conversion**: > 10% of spectators later play
- **Concurrent Spectators**: Support 50+ per game without lag
- **Replay Usage**: > 30% of finished games are replayed at least once

### User Satisfaction
- **Reconnection UX Rating**: > 4.0/5.0 from user surveys
- **Spectator UX Rating**: > 4.0/5.0 from user surveys
- **Feature Awareness**: > 60% of users know they can spectate
- **Technical Reliability**: < 1% error rate for both features

## 7. Open Questions and Future Considerations

### Questions to Resolve
1. Should spectators be visible to players? (show spectator count/names?)
2. Maximum spectator count per game - what's reasonable?
3. Should there be a delay for spectators (e.g., 10 second delay to prevent cheating in tournaments)?
4. How long should replays be stored? (storage cost consideration)
5. Should we allow spectators during waiting phase, or only during active games?

### Future Enhancements
1. **AI Replacement for Disconnected Players**
   - Allow AI to take over for players who permanently leave
   - AI difficulty matches player's skill level
   - Optional feature for casual games

2. **Spectator Rewards**
   - Earn points for watching featured games
   - Special badges for dedicated spectators
   - Prediction system (guess who will win)

3. **Advanced Replay Analytics**
   - Heatmaps of tile placements
   - Win probability graphs over time
   - Alternative move suggestions
   - Opening theory analysis

4. **Social Features**
   - Follow favorite players
   - Get notified when they're playing
   - Spectator parties (watch together)
   - Shared spectator chat rooms

5. **Mobile Optimization**
   - Picture-in-picture spectating
   - Background notifications for game updates
   - Simplified spectator UI for small screens
   - Swipe gestures for replay navigation

## 8. Conclusion

This design document provides a comprehensive specification for implementing full reconnection support and spectator mode in Quortex multiplayer. The phased approach allows for:

1. **Immediate Value**: Phase 1 completes critical reconnection support with infinite wait
2. **Progressive Enhancement**: Spectator mode adds engagement without blocking core gameplay
3. **Future Flexibility**: Architecture supports advanced features when needed
4. **User-Centric Design**: All decisions prioritize player experience and reliability

The event sourcing architecture with action logs already in place provides an excellent foundation for both features. The main work involves:
- Enhanced session management with cookie-based persistence for anonymous users
- Infinite wait for disconnected players (no timeout/voting system)
- Robust reconnection UI and flows
- Single room architecture with action validation (only active player can post)
- Spectator access to help/move list, exit to lobby (not setup)
- Replay system with timeline navigation (optimized for ~40 move games)

With these features fully implemented, Quortex multiplayer will provide a robust, professional-grade multiplayer experience suitable for casual play, competitive gaming, and tournament spectating.

---

**Document Version:** 1.1  
**Last Updated:** 2025-11-15  
**Status:** Design Specification  
**Authors:** AI Agent (based on TODOS_SUMMARY.md analysis and user feedback)  
**Next Steps:** Review and approval, then implementation in phases
