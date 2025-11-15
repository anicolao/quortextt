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

**Scenario 2: Extended Disconnect (30 seconds - 5 minutes)**
- User loses connection for longer period (subway tunnel, phone call, etc.)
- System behavior:
  - Server marks player as "disconnected" but keeps their seat
  - Game continues if it's not the disconnected player's turn
  - If it's the disconnected player's turn, game pauses with countdown timer
  - Other players see "Waiting for [Player Name] to reconnect... (3:45 remaining)"
- Upon reconnection:
  - User sees list of active games: "Resume Game: [Game Name] - Your turn!"
  - User clicks to rejoin
  - Game state fully restores from action history
  - User can continue playing
  - Other players see "[Player Name] has reconnected"

**Scenario 3: App Closure/Browser Closure**
- User closes app, closes tab, or navigates away
- Upon returning later:
  - For authenticated users: Dashboard shows "Active Games" section
  - Each active game shows:
    - Game name
    - Current status (Waiting, Your turn, Opponent's turn)
    - Time since last activity
    - "Resume" button
  - User clicks "Resume" to rejoin
  - Game loads with full history
  - Play continues normally

**Scenario 4: Game Abandoned by One Player**
- If a player doesn't reconnect within timeout (5 minutes default):
  - Other players see options:
    - "Wait longer (extends timeout by 5 minutes)"
    - "End game (all players get draw)"
    - "Replace with AI player (continues game)"
  - Majority vote determines outcome
  - Abandoned player can still reconnect to view final state
  - Abandoned player cannot resume playing after timeout

#### 2.1.2 Authentication Requirements

**Authenticated Users (Google/Discord/Facebook/Apple)**
- Persistent player ID across sessions
- Games persist in user session
- Can reconnect from any device
- Active games list available on login
- Game history saved to user profile

**Anonymous Users**
- Player ID tied to socket connection (ephemeral)
- Can only reconnect from same browser session
- Lose access to games if browser data cleared
- Games auto-cleanup after 24 hours of inactivity
- Warning shown: "Create account to save your games"

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
     connectionState: 'connected' | 'disconnected' | 'abandoned';
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
   - Server periodically creates state snapshots (every 100 actions)
   - Store as `game-{id}.checkpoint-{seq}.json`
   - On reconnect with large gap, load nearest checkpoint + subsequent actions
   - Faster than replaying thousands of actions

3. **Client-Side Replay Queue**
   - Buffer incoming actions during replay
   - Process in correct sequence order
   - Ensure deterministic state reconstruction

#### 2.3.3 Timeout and Cleanup

**Required Implementation:**
1. **Configurable Timeouts**
   ```typescript
   const RECONNECT_TIMEOUTS = {
     quickDisconnect: 30 * 1000,      // 30 seconds - no warnings
     extendedDisconnect: 5 * 60 * 1000, // 5 minutes - show waiting message
     abandonedGame: 15 * 60 * 1000    // 15 minutes - allow game termination
   };
   ```

2. **Timeout Actions**
   - After `extendedDisconnect`: Broadcast waiting message, pause turn timer
   - After `abandonedGame`: Enable "End game" vote for other players
   - After vote or unanimous decision: Mark game as finished, allow cleanup

3. **Cleanup Strategy**
   - Finished games: Move to archive after 7 days
   - Abandoned games: Move to archive immediately after termination
   - Anonymous user games: Delete after 24 hours if all players inactive

#### 2.3.4 UI State Management

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
4. "Waiting for player..." modal (with timeout countdown)
5. "Vote to end game" modal (when timeout exceeded)

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
- Link works even if game is "private"
- Opens game in spectator mode
- All spectator UI features available
- Can share link with others

**Scenario 3: Tournament/Featured Game Spectating**
- Lobby shows "Featured Games" section
- High-level games highlighted
- Multiple spectators can watch simultaneously
- Spectator chat available (optional)
- No limit on spectator count (within reason)

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
- Read game chat (if chat system exists)
- Share spectator link with others

**What Spectators CANNOT Do:**
- Place tiles or make any game moves
- Vote on game decisions (end game, pause, etc.)
- Chat directly with players (separate spectator chat only)
- See any hidden information (N/A for Quortex, but important for other games)
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
- If player leaves game in progress:
  - Option: "Leave and spectate" vs "Leave completely"
  - If "Leave and spectate": Becomes spectator, can watch outcome
  - Player slot may be filled by AI or remain empty
  - Cannot rejoin as player once abandoned

**Disconnected Player as Spectator:**
- If player is disconnected and timeout occurs:
  - Player can still rejoin as spectator to see outcome
  - Marked as "Former player (disconnected)"
  - Can see final result and download replay

### 3.2 Edge Cases to Handle

#### Access Control Edge Cases
1. **Private Game Spectating**
   - Game marked as "private" by host
   - Only players with direct link can spectate
   - Not listed in public games directory
   - Solution: Require game access token in spectator link

2. **Spectator Capacity Limits**
   - Too many spectators could overload server
   - Solution: Set reasonable limit (e.g., 100 spectators per game)
   - Show "Game is full (spectators)" if limit reached
   - Priority to friends/followers

3. **Banned/Blocked Users**
   - Player has blocked a user who tries to spectate
   - Solution: Respect player privacy settings
   - Blocked users see "Cannot access this game"
   - No indication that they're blocked (privacy)

#### State Synchronization Edge Cases
1. **Spectator Joins Mid-Game**
   - Game is 100 moves in
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

3. **Very Long Games (1000+ moves)**
   - Replay timeline becomes unwieldy
   - Solution: Implement "Jump to turn" feature
   - Show major milestones (first tile by each player, major flow connections)
   - Pagination or virtualized timeline

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

**Two Broadcasting Modes:**

1. **Player Room** (existing)
   - All players in the game
   - Receive game actions with write privileges
   - Can post actions to the game

2. **Spectator Room** (new)
   - All spectators watching the game
   - Receive same actions as players (read-only)
   - Cannot post actions
   - Separate socket.io room: `game-{id}-spectators`

**Broadcasting Flow:**
```typescript
// When action is posted:
1. Validate action from player
2. Append to action log (storage)
3. Broadcast to player room: io.to(`game-${gameId}`).emit('action_posted', action)
4. Broadcast to spectator room: io.to(`game-${gameId}-spectators`).emit('action_posted', action)
```

**Optimization:**
- Spectators don't need action acknowledgment
- Can batch actions for spectators if rate is high
- No need for optimistic updates for spectators

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
- Cache compiled game states at intervals (every 50 moves)
- Provide metadata: move count, duration, players, outcome

#### 3.3.4 UI Components

**Spectator-Specific UI Elements:**

1. **Spectator Status Bar**
   - "👁️ Spectating: [Game Name]"
   - Spectator count: "15 watching"
   - "Stop Watching" button

2. **Player Perspectives Toggle**
   - Tabs for each player's view
   - Highlight current turn player
   - Show each player's hand/tiles

3. **Move History Panel**
   - Scrollable list of all moves
   - Click to jump to that point in history
   - Filter by player
   - Search moves

4. **Replay Controls (for finished games)**
   ```
   [<<] [<] [Play/Pause] [>] [>>]
   ─────●─────────────────────────
   Move 42 of 156
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

2. **Week 2: Timeout and Cleanup**
   - Configurable timeout system
   - Vote to end abandoned games
   - Cleanup jobs for old games
   - Testing various disconnect scenarios

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
   - Spectator-specific broadcasting
   - Spectator UI basics

2. **Week 3: Spectator Features**
   - Public games list with spectator counts
   - Move history viewer
   - Spectator notifications
   - Access control (private games)

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
- Reconnect after various timeouts
- Multiple device reconnection
- Anonymous vs authenticated users

**Load Tests:**
- Many simultaneous reconnections
- Large action history replay
- Server restart recovery
- Database corruption scenarios

### 5.2 Spectator Testing

**Unit Tests:**
- Spectator session management
- Action filtering and broadcasting
- Access control logic
- Replay controller

**Integration Tests:**
- Join/leave spectator flows
- Spectator room management
- Action synchronization
- Capacity limits

**End-to-End Tests:**
- Watch live game as spectator
- Replay finished game
- Spectator UI interactions
- Multiple simultaneous spectators
- Transition spectator to player

**Load Tests:**
- 100+ spectators on single game
- Many concurrent spectated games
- Replay of very long games
- Bandwidth usage with spectators

## 6. Success Metrics

### Reconnection Metrics
- **Reconnection Success Rate**: > 95% of disconnects successfully rejoin
- **Reconnection Time**: < 3 seconds average from reconnect to playable state
- **Data Loss Rate**: 0% - no actions lost in reconnection
- **Abandoned Game Rate**: < 5% of games end due to timeout

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
   - Allow AI to take over for timeout players
   - AI difficulty matches player's skill level
   - Player can return to reclaim seat within window

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

1. **Immediate Value**: Phase 1 completes critical reconnection support
2. **Progressive Enhancement**: Spectator mode adds engagement without blocking core gameplay
3. **Future Flexibility**: Architecture supports advanced features when needed
4. **User-Centric Design**: All decisions prioritize player experience and reliability

The event sourcing architecture with action logs already in place provides an excellent foundation for both features. The main work involves:
- Enhanced session management and timeout handling
- Robust reconnection UI and flows
- Spectator-specific broadcasting and access control
- Replay system with timeline navigation

With these features fully implemented, Quortex multiplayer will provide a robust, professional-grade multiplayer experience suitable for casual play, competitive gaming, and tournament spectating.

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-15  
**Status:** Design Specification  
**Authors:** AI Agent (based on TODOS_SUMMARY.md analysis)  
**Next Steps:** Review and approval, then implementation in phases
