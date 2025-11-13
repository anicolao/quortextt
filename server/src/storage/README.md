# File-Based Storage System

This directory contains the file-based storage implementation for the Quortex multiplayer server, following the recommendations in the STORAGE_DEBATE design document.

## Overview

The storage system uses append-only `.jsonl` (JSON Lines) files for game data persistence, implementing an event sourcing architecture. This provides a simple, reliable, and cost-effective solution suitable for MVP and early-stage deployment.

## Architecture

### GameStorage

The `GameStorage` class manages game data using event sourcing:

- **Action Files**: Each game has its own file: `game-{gameId}.actions.jsonl`
- **Append-Only Writes**: Actions are only appended, never modified
- **State Reconstruction**: Game state is reconstructed by replaying actions
- **In-Memory Caching**: Frequently accessed games are cached for performance
- **Write Buffering**: Actions are buffered and flushed periodically or when the buffer is full

#### Key Features

1. **Event Sourcing**: Complete game history preserved
2. **Fast Writes**: ~0.1-1ms with buffering
3. **Crash Recovery**: Graceful shutdown ensures data integrity
4. **Simple Debugging**: Just read the `.jsonl` files
5. **Easy Backup**: Copy files to backup storage

### DataStorage

The `DataStorage` class provides simple key-value storage for:
- User sessions (tracking active games for reconnection)
- User preferences and settings
- Other metadata

Uses a single `.jsonl` file where the latest entry for each ID is the current state.

#### Session Storage for Reconnection

The session storage enables players to resume their games after disconnecting:

1. **Session Tracking**: When authenticated users join a game, their session is updated with the game ID
2. **Reconnection**: On reconnect, the server sends the list of active games to the client
3. **Persistent Identity**: Authenticated users maintain the same player ID across connections
4. **Anonymous Users**: Non-authenticated users use socket.id (ephemeral, new each connection)

Example session data:
```json
{
  "userId": "google-oauth-12345",
  "username": "Alice",
  "activeGameIds": ["game-abc", "game-xyz"],
  "lastSeen": 1763073456789
}
```

## Usage

### Initialize Storage

```typescript
import { GameStorage } from './storage/index.js';

const gameStorage = new GameStorage('./data/games');
await gameStorage.initialize();
```

### Create a Game

```typescript
await gameStorage.createGame(
  'game-123',
  'My Game',
  'host-user-id',
  4 // max players
);
```

### Append Actions

```typescript
const action = {
  type: 'JOIN_GAME',
  payload: { player: { id: 'player-1', username: 'Alice' } },
  playerId: 'player-1',
  timestamp: Date.now(),
  sequence: 1
};

await gameStorage.appendAction('game-123', action);
```

### Get Game State

```typescript
const state = await gameStorage.getGameState('game-123');
console.log(state.players); // Current players
console.log(state.status); // waiting | playing | finished
```

### Read Action History

```typescript
const actions = await gameStorage.readActions('game-123');
// Returns all actions in order for replay or analysis
```

### Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
  await gameStorage.shutdown(); // Flushes all pending writes
  process.exit(0);
});
```

## Performance

### Write Performance
- Buffered writes: ~0.1-1ms
- Flushed to disk: Every 5 seconds or 10 actions, whichever comes first
- Critical actions (CREATE_GAME) flush immediately

### Read Performance
- Cached reads: <1ms
- Cold reads: 5-20ms (1000 actions)
- State reconstruction: 10-50ms (1000 actions)

### Caching Strategy
- Active games are kept in memory
- Cache is updated immediately on action append
- Cache can be cleared manually if needed

## File Format

### Action Log Format (`.jsonl`)

Each line is a JSON object representing one action:

```json
{"type":"CREATE_GAME","payload":{"name":"Test Game","hostId":"host-1","maxPlayers":4},"playerId":"host-1","timestamp":1636123456789,"sequence":0}
{"type":"JOIN_GAME","payload":{"player":{"id":"player-1","username":"Alice"}},"playerId":"player-1","timestamp":1636123457890,"sequence":1}
{"type":"START_GAME","payload":{},"playerId":"host-1","timestamp":1636123458901,"sequence":2}
```

## Action Types

### Game Lifecycle Actions
- `CREATE_GAME` - Initialize a new game
- `START_GAME` - Begin gameplay
- `COMPLETE_GAME` - Mark game as finished

### Player Actions
- `JOIN_GAME` - Player joins the game
- `LEAVE_GAME` - Player leaves the game
- `PLAYER_DISCONNECT` - Player disconnected
- `PLAYER_RECONNECT` - Player reconnected

### Game Actions
- Custom game actions (e.g., `PLACE_TILE`) are passed through and stored
- These are handled by the game client, not the storage layer

## Scalability

### Current Limits
- Single server: ~5,000 concurrent users
- Concurrent games: 10,000+ easily
- File system performance is the main bottleneck

### When to Migrate

Consider migrating to MongoDB when:
- Reaching 10,000+ concurrent users
- Need complex analytical queries
- Require multi-region replication
- Multiple application servers accessing same data

### Migration Path

1. **Phase 1 (Current)**: File-based storage
2. **Phase 2**: Add in-memory indexes for queries
3. **Phase 3**: Hybrid (files + SQLite for metadata)
4. **Phase 4**: Migrate to MongoDB if needed

Files can be easily exported to MongoDB using a migration script.

## Backup Strategy

### Simple Backup

```bash
#!/bin/bash
# Backup script
DATE=$(date +%Y%m%d)
tar -czf /backups/quortex-$DATE.tar.gz /var/quortex/data
```

### Restore

```bash
tar -xzf /backups/quortex-20251113.tar.gz
```

## Monitoring

### Key Metrics
- Disk usage (game files accumulate over time)
- Write buffer size (should stay small)
- Cache hit rate (higher is better)
- Flush frequency (should be consistent)

### Maintenance

```bash
# Check disk usage
du -sh /var/quortex/data/games

# Count games
ls /var/quortex/data/games/*.jsonl | wc -l

# Archive old completed games (implement as needed)
```

## Testing

Run the test suite:

```bash
cd server
npm test
```

Tests cover:
- Creating games
- Appending actions
- State reconstruction
- Caching behavior
- Shutdown and flush
- Action application logic

## Design Rationale

See `docs/designs/STORAGE_DEBATE.md` for the full analysis of why file-based storage was chosen over MongoDB for the MVP:

- **50% faster development** (4-7 days vs 9-15 days)
- **Lower cost** (~$35/month vs $45-100/month for 10K users)
- **Simpler operations** (no database server to manage)
- **Perfect fit** for event sourcing
- **Easy migration path** to MongoDB when needed

## Future Enhancements

Potential improvements for later phases:

1. **File Rotation**: Split large game files for performance
2. **Compression**: Gzip old completed games
3. **Indexes**: SQLite for complex queries
4. **Replication**: Rsync to backup servers
5. **Partitioning**: Distribute games across multiple servers
