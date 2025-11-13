# Storage Architecture Debate: MongoDB vs File-Based Storage

## Executive Summary

This document compares two storage approaches for Quortex game data persistence:

1. **MongoDB** - A fully-featured NoSQL database (current plan per WEB_MULTIPLAYER.md)
2. **File-Based Storage** - Simple append-only `.jsonl` files for game actions

**TL;DR Recommendation:** Start with **file-based storage** for MVP, migrate to MongoDB when you have real scaling needs (5,000+ concurrent users or need advanced querying).

---

## Overview

The Quortex multiplayer system needs to persist:
- User accounts and authentication data
- Game sessions and metadata
- Game actions/moves (for replay and state reconstruction)
- Player statistics and leaderboards
- Active sessions and presence information

Currently, the implementation uses in-memory storage for MVP. The WEB_MULTIPLAYER.md design document proposes MongoDB as the persistence layer. This document evaluates whether a simpler file-based approach might be more appropriate, especially for early stages.

---

## Architecture Comparison

### MongoDB Approach

```
┌─────────────────────────────────────────────────┐
│             Application Server                   │
│  ┌──────────────────────────────────────────┐   │
│  │        Node.js + Express                 │   │
│  │  ┌────────────┐     ┌────────────┐      │   │
│  │  │  Socket.IO │     │  REST API  │      │   │
│  │  └─────┬──────┘     └─────┬──────┘      │   │
│  └────────┼──────────────────┼─────────────┘   │
│           │                  │                  │
│  ┌────────▼──────────────────▼─────────────┐   │
│  │      Mongoose ODM Layer                 │   │
│  └────────┬────────────────────────────────┘   │
└───────────┼──────────────────────────────────┘
            │
┌───────────▼────────────────────────────────────┐
│         MongoDB Database Server                │
│  ┌──────────────────────────────────────────┐  │
│  │  Collections:                            │  │
│  │  - users                                 │  │
│  │  - games                                 │  │
│  │  - moves                                 │  │
│  │  - sessions                              │  │
│  │  - leaderboards                          │  │
│  │                                          │  │
│  │  Indexes, Replication, Sharding          │  │
│  └──────────────────────────────────────────┘  │
└────────────────────────────────────────────────┘
```

**Characteristics:**
- Separate database server process
- Network communication overhead
- Requires MongoDB installation and management
- Uses Mongoose ODM for schema validation
- Complex query capabilities
- Built-in indexing and aggregation

### File-Based Storage Approach

```
┌──────────────────────────────────────────────────┐
│              Application Server                   │
│  ┌───────────────────────────────────────────┐   │
│  │         Node.js + Express                 │   │
│  │  ┌────────────┐     ┌────────────┐       │   │
│  │  │  Socket.IO │     │  REST API  │       │   │
│  │  └─────┬──────┘     └─────┬──────┘       │   │
│  └────────┼──────────────────┼──────────────┘   │
│           │                  │                   │
│  ┌────────▼──────────────────▼──────────────┐   │
│  │      File Storage Manager                │   │
│  │  - Append-only writes                    │   │
│  │  - In-memory caching                     │   │
│  │  - Periodic flushing                     │   │
│  └────────┬─────────────────────────────────┘   │
└───────────┼───────────────────────────────────┘
            │
┌───────────▼──────────────────────────────────────┐
│         Local File System                        │
│  data/                                           │
│  ├── users/                                      │
│  │   └── users.jsonl                            │
│  ├── games/                                      │
│  │   ├── game-{id}.jsonl   (game metadata)     │
│  │   └── game-{id}.actions.jsonl (all moves)   │
│  ├── stats/                                      │
│  │   └── leaderboard.jsonl                      │
│  └── sessions/                                   │
│      └── sessions.jsonl                          │
└──────────────────────────────────────────────────┘
```

**Characteristics:**
- No separate database server needed
- Direct file system access (lower latency)
- Simple deployment (just Node.js)
- Append-only writes (excellent for event sourcing)
- Manual indexing via in-memory structures
- Simple backup (just copy files)

---

## Detailed Comparison

### 1. Development Complexity

#### MongoDB
**Complexity: HIGH**

**Required Skills:**
- MongoDB query language and data modeling
- Mongoose ODM and schema definition
- Index optimization
- Connection pooling and error handling
- Replica sets and sharding (for production)

**Development Time:**
- Schema design: 1-2 days
- Mongoose models: 2-3 days
- Data access layer: 3-5 days
- Testing and debugging: 3-5 days
- **Total: 9-15 days**

**Code Example:**
```typescript
// Complex schema definition
import mongoose, { Schema, Document } from 'mongoose';

export interface IGame extends Document {
  gameId: string;
  playerCount: number;
  players: Array<{
    userId: mongoose.Types.ObjectId;
    playerIndex: number;
    color: string;
    connected: boolean;
  }>;
  status: 'waiting' | 'active' | 'completed';
  boardState: {
    tiles: Map<string, any>;
    availableTiles: Array<string>;
  };
  createdAt: Date;
}

const GameSchema = new Schema<IGame>({
  gameId: { type: String, required: true, unique: true },
  playerCount: { type: Number, required: true, min: 2, max: 6 },
  players: [{ /* nested schema */ }],
  // ... many more fields
});

// Complex indexes
GameSchema.index({ gameId: 1 });
GameSchema.index({ status: 1 });
GameSchema.index({ 'players.userId': 1 });
GameSchema.index({ mode: 1, status: 1 });

export const Game = mongoose.model<IGame>('Game', GameSchema);

// Usage requires async/await, error handling, connection management
try {
  const game = await Game.findOne({ gameId });
  // ... more logic
} catch (error) {
  // Error handling
}
```

#### File-Based Storage
**Complexity: LOW**

**Required Skills:**
- Basic Node.js fs module
- JSON parsing
- Simple file operations
- Understanding of append-only patterns

**Development Time:**
- Storage manager class: 1-2 days
- Read/write functions: 1 day
- In-memory caching: 1-2 days
- Testing: 1-2 days
- **Total: 4-7 days**

**Code Example:**
```typescript
import fs from 'fs/promises';
import path from 'path';

export class GameStorage {
  private dataDir: string;

  constructor(dataDir = './data/games') {
    this.dataDir = dataDir;
  }

  // Append a game action (move, join, leave, etc.)
  async appendAction(gameId: string, action: any): Promise<void> {
    const filename = path.join(this.dataDir, `game-${gameId}.actions.jsonl`);
    const line = JSON.stringify(action) + '\n';
    await fs.appendFile(filename, line, 'utf8');
  }

  // Read all actions for a game (for replay or state reconstruction)
  async readActions(gameId: string): Promise<any[]> {
    const filename = path.join(this.dataDir, `game-${gameId}.actions.jsonl`);
    try {
      const content = await fs.readFile(filename, 'utf8');
      return content
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }

  // Get current game state (read latest or use cache)
  async getGameState(gameId: string): Promise<any> {
    const actions = await this.readActions(gameId);
    // Reconstruct state from actions (event sourcing)
    return this.reconstructState(actions);
  }

  private reconstructState(actions: any[]): any {
    // Redux-like state reconstruction from actions
    return actions.reduce((state, action) => {
      return applyAction(state, action);
    }, initialGameState);
  }
}

// Usage is simple and synchronous-looking
const storage = new GameStorage();
await storage.appendAction(gameId, { type: 'PLACE_TILE', ... });
const gameState = await storage.getGameState(gameId);
```

**Winner: File-Based Storage** - 50% faster to develop, simpler to understand and maintain.

---

### 2. Performance

#### MongoDB
**Throughput: HIGH for reads, MEDIUM for writes**

**Strengths:**
- Excellent for complex queries
- Built-in indexing for fast lookups
- Aggregation pipeline for analytics
- Optimized for random access patterns

**Weaknesses:**
- Network latency (even localhost: 1-2ms per query)
- Write amplification (indexes must be updated)
- Connection pool overhead
- Memory usage for indexes

**Typical Performance:**
- Simple read query: 1-5ms
- Indexed query: 2-10ms
- Write operation: 5-15ms
- Complex aggregation: 10-100ms+

**Benchmark Example:**
```javascript
// Read 100 games by status
await Game.find({ status: 'active' }).limit(100);
// ~10-50ms depending on dataset size

// Write a move
await Move.create({ gameId, moveNumber, ... });
// ~5-15ms including index updates

// Leaderboard query
await Leaderboard.find({ period: 'weekly' })
  .sort({ score: -1 })
  .limit(100);
// ~20-50ms with proper indexes
```

#### File-Based Storage
**Throughput: VERY HIGH for writes, MEDIUM for reads**

**Strengths:**
- Extremely fast append-only writes (<1ms)
- No network overhead
- Sequential I/O (SSD optimized)
- Simple buffering and batching
- Can keep hot data in memory

**Weaknesses:**
- Linear scan for queries (without indexes)
- Must build indexes manually
- Large files need streaming reads
- No built-in aggregation

**Typical Performance:**
- Append action: 0.1-1ms (buffered)
- Read game (cached): 0.1ms
- Read game (cold, 1000 actions): 5-20ms
- Rebuild state from 1000 actions: 10-50ms
- Query across many games: Slow without indexes

**Optimization Strategy:**
```typescript
class OptimizedGameStorage {
  private cache: Map<string, any> = new Map();
  private writeBuffer: Map<string, string[]> = new Map();
  
  // Keep recent games in memory
  async getGameState(gameId: string): Promise<any> {
    if (this.cache.has(gameId)) {
      return this.cache.get(gameId); // <1ms
    }
    
    const actions = await this.readActions(gameId);
    const state = this.reconstructState(actions);
    this.cache.set(gameId, state);
    return state;
  }
  
  // Buffer writes for better throughput
  async appendAction(gameId: string, action: any): Promise<void> {
    const line = JSON.stringify(action);
    
    if (!this.writeBuffer.has(gameId)) {
      this.writeBuffer.set(gameId, []);
    }
    this.writeBuffer.get(gameId)!.push(line);
    
    // Update in-memory cache immediately
    const currentState = this.cache.get(gameId) || {};
    this.cache.set(gameId, applyAction(currentState, action));
    
    // Flush periodically (every 10 actions or 1 second)
    if (this.writeBuffer.get(gameId)!.length >= 10) {
      await this.flush(gameId);
    }
  }
  
  private async flush(gameId: string): Promise<void> {
    const lines = this.writeBuffer.get(gameId);
    if (!lines || lines.length === 0) return;
    
    const filename = path.join(this.dataDir, `game-${gameId}.actions.jsonl`);
    await fs.appendFile(filename, lines.join('\n') + '\n');
    this.writeBuffer.set(gameId, []);
  }
}
```

**Performance Comparison:**

| Operation | MongoDB | File-Based (Optimized) |
|-----------|---------|------------------------|
| Write single action | 5-15ms | 0.1-1ms |
| Read active game | 2-10ms | <1ms (cached) |
| Read inactive game | 2-10ms | 5-20ms (cold) |
| Query 100 games | 10-50ms | Slow (need index) |
| Leaderboard top 100 | 20-50ms | Slow (need index) |
| Game replay | Similar | Similar |

**Winner: Depends on workload**
- **File-based** for write-heavy, event-sourced workloads (game actions)
- **MongoDB** for complex queries (leaderboards, matchmaking)
- **Hybrid** approach might be optimal (files for games, MongoDB for aggregated data)

---

### 3. Scalability

#### MongoDB
**Horizontal Scalability: EXCELLENT**

**Scaling Options:**
- Read replicas for read-heavy workloads
- Sharding for write-heavy workloads
- Connection pooling across app instances
- Built-in replication and failover

**Limits:**
- Single server: ~10,000 writes/sec
- With sharding: 100,000+ writes/sec
- Typical deployment: Handles 10,000+ concurrent users easily

**Cost of Scaling:**
- Replica set (3 nodes): $150-400/month
- Sharded cluster: $500-2000+/month
- MongoDB Atlas managed service: Scales automatically but expensive

**Example Scaling Path:**
1. Start: Single MongoDB instance ($25/month)
2. 1,000 users: Add replica set ($150/month)
3. 10,000 users: Optimize queries, add read replicas ($300/month)
4. 50,000 users: Shard by gameId ($1000+/month)

#### File-Based Storage
**Horizontal Scalability: LIMITED (without additional architecture)**

**Scaling Options:**
- Vertical: Faster SSD, more RAM for caching
- Partitioning: Different game ranges on different servers
- Distribution: Consistent hashing for game files
- Read-only replicas: Rsync files to read servers

**Limits:**
- Single server: ~5,000 writes/sec (SSD)
- Concurrent games: Limited by file system (10,000+ easily)
- Read performance: Depends on cache hit rate

**Challenges:**
- No built-in replication
- Manual sharding required
- Distributed queries are complex
- Lock contention on shared files

**Scaling Strategy:**
```
┌─────────────────────────────────────────┐
│         Load Balancer                   │
└────────┬──────────┬───────────┬─────────┘
         │          │           │
    ┌────▼────┐ ┌───▼─────┐ ┌──▼──────┐
    │ App+DB  │ │ App+DB  │ │ App+DB  │
    │ Games   │ │ Games   │ │ Games   │
    │ 0-3333  │ │3334-6666│ │6667-9999│
    └────┬────┘ └───┬─────┘ └──┬──────┘
         │          │           │
    ┌────▼──────────▼───────────▼──────┐
    │   Shared Network Storage (NFS)    │
    │   or Object Storage (S3)          │
    └───────────────────────────────────┘
```

**Realistic Limits:**
- Single server: 5,000 concurrent users
- With partitioning: 20,000-50,000 users
- Beyond that: Need real database

**Winner: MongoDB** - Much easier to scale horizontally, but file-based is sufficient for small/medium deployments.

---

### 4. Cost Analysis

#### MongoDB

**Development Costs:**
- Initial development: 9-15 days × $100/hour = $7,200-$12,000
- Ongoing maintenance: 2-4 hours/month

**Infrastructure Costs (Monthly):**

| Users | MongoDB Atlas | Self-Hosted | Complexity |
|-------|---------------|-------------|------------|
| 0-100 | $0 (Free tier) | $0 | Low |
| 100-1K | $9-25 | $5-10 | Low |
| 1K-10K | $57-100 | $25-50 | Medium |
| 10K-50K | $200-500 | $100-200 | High |
| 50K+ | $500-2000+ | $300-1000+ | Very High |

**Self-Hosted Example (10K users):**
- Server: $40/month (4GB RAM, 2 CPU)
- MongoDB requires: 2GB RAM + storage
- Backup storage: $5-10/month
- Monitoring: $0-20/month
- **Total: $45-70/month**

**Hidden Costs:**
- Learning curve (1-2 weeks)
- Index optimization
- Query performance tuning
- Backup management
- Version upgrades
- Security patching

#### File-Based Storage

**Development Costs:**
- Initial development: 4-7 days × $100/hour = $3,200-$5,600
- Ongoing maintenance: 1-2 hours/month

**Infrastructure Costs (Monthly):**

| Users | Disk Space | Server | Total |
|-------|------------|--------|-------|
| 0-100 | 100MB | $5 | $5 |
| 100-1K | 1GB | $10 | $10 |
| 1K-10K | 10GB | $20 | $20 |
| 10K-50K | 100GB | $40 | $40 |
| 50K+ | 1TB+ | $100+ | $100+ |

**Storage Calculation:**
- Avg game: 100 actions × 200 bytes = 20KB
- 1000 games/day: 20MB/day = 600MB/month
- With 90-day retention: 18GB storage
- Cost at $0.10/GB: $1.80/month

**Example (10K users, 5000 active games):**
- Server: $20/month (2GB RAM, 1 CPU - sufficient!)
- Storage: 100GB × $0.10 = $10/month
- Backup: $5/month (S3 or similar)
- **Total: $35/month**

**Cost Comparison (10K users):**
- MongoDB: $45-100/month + $7,200-$12,000 development
- File-based: $35/month + $3,200-$5,600 development
- **Savings: $10-65/month + $3,600-$6,400 upfront**

**Break-even Analysis:**
File-based storage pays for itself in development savings alone. The monthly savings are relatively small but add up over time.

**Winner: File-Based Storage** - Especially for bootstrapped projects and MVPs.

---

### 5. Operational Complexity

#### MongoDB

**Setup & Configuration:**
```bash
# Install MongoDB (Ubuntu)
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg

echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
  https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

sudo apt update
sudo apt install -y mongodb-org

# Configure
sudo nano /etc/mongod.conf  # Network, auth, storage settings
sudo systemctl start mongod
sudo systemctl enable mongod

# Create database user
mongosh
use admin
db.createUser({
  user: "quortex",
  pwd: "secure_password",
  roles: ["readWrite"]
})
```

**Monitoring Requirements:**
- MongoDB logs (rotation, analysis)
- Performance metrics (queries/sec, latency)
- Disk usage and I/O
- Connection pool status
- Replica set health (if used)
- Index usage statistics

**Backup Strategy:**
```bash
# Daily backup with mongodump
mongodump --uri="mongodb://user:pass@localhost:27017/quortex" \
  --out=/backups/$(date +%Y%m%d)

# Compress and upload to S3
tar -czf backup.tar.gz /backups/$(date +%Y%m%d)
aws s3 cp backup.tar.gz s3://quortex-backups/

# Restore
mongorestore --uri="mongodb://user:pass@localhost:27017/quortex" \
  /backups/20250113
```

**Common Issues:**
- Connection pool exhaustion
- Index missing warnings
- Slow queries
- Replica lag
- Disk space issues
- Memory pressure

**Maintenance Tasks:**
- Weekly: Review slow query log
- Monthly: Compact databases, review indexes
- Quarterly: Version upgrades
- As needed: Schema migrations

#### File-Based Storage

**Setup & Configuration:**
```bash
# Create directory structure
mkdir -p /var/quortex/data/{games,users,stats,sessions}
chown -R node:node /var/quortex/data
chmod 750 /var/quortex/data

# Configure in .env
DATA_DIR=/var/quortex/data

# That's it! No separate service to install or configure.
```

**Monitoring Requirements:**
- Disk usage (games can accumulate)
- File write errors
- Cache hit rates
- Basic performance metrics

**Backup Strategy:**
```bash
# Simple daily backup
#!/bin/bash
DATE=$(date +%Y%m%d)
tar -czf /backups/quortex-$DATE.tar.gz /var/quortex/data

# Upload to S3
aws s3 cp /backups/quortex-$DATE.tar.gz s3://quortex-backups/

# Keep last 30 days
find /backups -name "quortex-*.tar.gz" -mtime +30 -delete

# Restore is just: tar -xzf
```

**Common Issues:**
- Disk full
- File permission errors
- Large files (need rotation)
- That's mostly it!

**Maintenance Tasks:**
- Weekly: Check disk usage
- Monthly: Archive old game files
- Quarterly: Nothing special needed
- As needed: Add partitioning if growing

**Complexity Comparison:**

| Task | MongoDB | File-Based |
|------|---------|------------|
| Initial setup | 2-4 hours | 15 minutes |
| Backup setup | 1-2 hours | 30 minutes |
| Monitoring setup | 2-4 hours | 1 hour |
| Schema changes | Complex migrations | Just change code |
| Debugging issues | Check logs, explain plans | Check logs, look at files |
| Recovery from crash | May need repair | Usually fine |
| Disaster recovery | Restore from backup | Restore from backup |

**Winner: File-Based Storage** - Dramatically simpler to operate and maintain.

---

### 6. Data Integrity & Reliability

#### MongoDB

**Strengths:**
- ACID transactions (within a document or replica set)
- Write concerns (acknowledged, journaled, replicated)
- Automatic journaling
- Crash recovery
- Schema validation
- Unique constraints and referential integrity

**Data Safety:**
- Default: Acknowledged writes (durable after journal write)
- Option: Wait for replication to N nodes
- Journal: Write-ahead log prevents corruption
- Replica sets: Multiple copies of data

**Failure Scenarios:**
```typescript
// MongoDB handles connection failures gracefully
try {
  await Game.create({ gameId, ... });
} catch (error) {
  if (error.code === 11000) {
    // Duplicate key error
  } else if (error.name === 'MongoNetworkError') {
    // Connection lost - retry logic needed
  }
}
```

**Durability Guarantees:**
- With journaling: Survives process crash
- With replica set: Survives server failure
- With `w: "majority"`: Survives network partition

#### File-Based Storage

**Strengths:**
- Append-only writes (never corrupt existing data)
- File system journaling (ext4, ZFS)
- Simple atomic renames for metadata updates
- Easy to verify integrity (just parse JSON)

**Data Safety:**
- Depends on file system (ext4: journaled, reliable)
- Buffered writes need explicit flushing
- fsync() ensures durability
- No built-in replication (must implement)

**Failure Scenarios:**
```typescript
class SafeGameStorage {
  async appendAction(gameId: string, action: any): Promise<void> {
    const filename = path.join(this.dataDir, `game-${gameId}.actions.jsonl`);
    const tempFilename = `${filename}.tmp`;
    const line = JSON.stringify(action) + '\n';
    
    try {
      // Write to temp file
      const fd = await fs.open(tempFilename, 'a');
      await fd.write(line);
      await fd.sync(); // Force to disk (fsync)
      await fd.close();
      
      // Atomic append (on same filesystem)
      // Most filesystems guarantee append atomicity for small writes
      await fs.appendFile(filename, line, 'utf8');
      await fs.unlink(tempFilename);
    } catch (error) {
      // Cleanup temp file on error
      try { await fs.unlink(tempFilename); } catch {}
      throw error;
    }
  }
  
  // Validate file integrity
  async validateGameFile(gameId: string): Promise<boolean> {
    try {
      const actions = await this.readActions(gameId);
      return actions.every(a => this.isValidAction(a));
    } catch (error) {
      return false; // File is corrupted
    }
  }
}
```

**Durability Guarantees:**
- With fsync(): Survives process crash
- With file system journaling: Survives power failure
- With RAID or ZFS: Survives disk failure
- With backups: Survives server failure

**Data Loss Scenarios:**

| Scenario | MongoDB (no replica) | MongoDB (replica set) | File-Based (no backup) | File-Based (with backup) |
|----------|----------------------|----------------------|------------------------|--------------------------|
| Process crash | ✅ Safe (journal) | ✅ Safe | ⚠️ May lose buffered writes | ⚠️ May lose buffered writes |
| Server crash | ✅ Safe (journal) | ✅ Safe | ✅ Safe (with fsync) | ✅ Safe (with fsync) |
| Disk failure | ❌ Lost | ✅ Safe (other nodes) | ❌ Lost | ✅ Safe (restore backup) |
| Data center failure | ❌ Lost | ⚠️ Depends on setup | ❌ Lost | ✅ Safe (off-site backup) |

**Mitigation for File-Based:**
```typescript
// Ensure durability
class DurableStorage {
  private flushInterval: NodeJS.Timeout;
  
  constructor() {
    // Flush every 5 seconds
    this.flushInterval = setInterval(() => this.flushAll(), 5000);
  }
  
  async appendAction(gameId: string, action: any): Promise<void> {
    // Buffer the write
    this.addToBuffer(gameId, action);
    
    // Update in-memory cache immediately (for reads)
    this.updateCache(gameId, action);
  }
  
  private async flushAll(): Promise<void> {
    for (const [gameId, bufferedActions] of this.buffers) {
      await this.flushToFile(gameId, bufferedActions);
    }
  }
  
  async shutdown(): Promise<void> {
    clearInterval(this.flushInterval);
    await this.flushAll(); // Ensure all data is written
  }
}

// Graceful shutdown to prevent data loss
process.on('SIGTERM', async () => {
  await storage.shutdown();
  process.exit(0);
});
```

**Winner: MongoDB** - Better built-in reliability features, but file-based can achieve similar safety with proper implementation.

---

### 7. Query Capabilities

#### MongoDB

**Built-in Query Features:**
- Rich query language (find, aggregate, etc.)
- Secondary indexes
- Text search
- Geospatial queries
- Aggregation pipeline
- Map-reduce (deprecated but available)

**Example Queries:**
```typescript
// Find all active games
const activeGames = await Game.find({ status: 'active' });

// Find games by player
const userGames = await Game.find({
  'players.userId': userId,
  status: { $in: ['waiting', 'active'] }
}).sort({ createdAt: -1 }).limit(10);

// Complex aggregation - top players this week
const leaderboard = await Game.aggregate([
  {
    $match: {
      completedAt: { $gte: oneWeekAgo },
      status: 'completed'
    }
  },
  {
    $unwind: '$players'
  },
  {
    $group: {
      _id: '$players.userId',
      wins: {
        $sum: {
          $cond: [
            { $eq: ['$winner.userId', '$players.userId'] },
            1,
            0
          ]
        }
      },
      gamesPlayed: { $sum: 1 }
    }
  },
  {
    $sort: { wins: -1 }
  },
  {
    $limit: 100
  }
]);

// Full-text search
const games = await Game.find({
  $text: { $search: 'tournament championship' }
});
```

**Performance:**
- With proper indexes: 1-10ms for simple queries
- Complex aggregations: 10-100ms
- Full collection scans: Slow (avoid)

#### File-Based Storage

**Query Approach:**
Must implement your own indexing and query system.

**Option 1: Load Everything into Memory**
```typescript
class GameIndex {
  private gamesByUser: Map<string, Set<string>> = new Map();
  private gamesByStatus: Map<string, Set<string>> = new Map();
  private allGames: Map<string, any> = new Map();
  
  async buildIndex(): Promise<void> {
    // Read all game files
    const files = await fs.readdir(this.dataDir);
    
    for (const file of files) {
      if (!file.endsWith('.actions.jsonl')) continue;
      
      const gameId = this.extractGameId(file);
      const actions = await this.readActions(gameId);
      const state = this.reconstructState(actions);
      
      this.allGames.set(gameId, state);
      
      // Build indexes
      for (const player of state.players) {
        if (!this.gamesByUser.has(player.userId)) {
          this.gamesByUser.set(player.userId, new Set());
        }
        this.gamesByUser.get(player.userId)!.add(gameId);
      }
      
      if (!this.gamesByStatus.has(state.status)) {
        this.gamesByStatus.set(state.status, new Set());
      }
      this.gamesByStatus.get(state.status)!.add(gameId);
    }
  }
  
  // Query: Find user's active games
  findUserActiveGames(userId: string): any[] {
    const userGameIds = this.gamesByUser.get(userId) || new Set();
    const activeGameIds = this.gamesByStatus.get('active') || new Set();
    
    // Intersection
    const intersection = [...userGameIds].filter(id => activeGameIds.has(id));
    
    return intersection.map(id => this.allGames.get(id));
  }
  
  // Query: All active games
  findActiveGames(): any[] {
    const activeGameIds = this.gamesByStatus.get('active') || new Set();
    return [...activeGameIds].map(id => this.allGames.get(id));
  }
}
```

**Option 2: Separate Index Files**
```typescript
// data/indexes/users.json
{
  "user123": ["game1", "game2", "game5"],
  "user456": ["game3", "game4"]
}

// data/indexes/status.json
{
  "active": ["game1", "game2"],
  "waiting": ["game3"],
  "completed": ["game4", "game5"]
}

// Update indexes when game state changes
class IndexedStorage {
  async updateGameStatus(gameId: string, newStatus: string): Promise<void> {
    // Update the game
    await this.appendAction(gameId, { type: 'UPDATE_STATUS', status: newStatus });
    
    // Update index file
    const statusIndex = await this.readIndex('status');
    
    // Remove from old status
    for (const status in statusIndex) {
      statusIndex[status] = statusIndex[status].filter(id => id !== gameId);
    }
    
    // Add to new status
    if (!statusIndex[newStatus]) statusIndex[newStatus] = [];
    statusIndex[newStatus].push(gameId);
    
    await this.writeIndex('status', statusIndex);
  }
}
```

**Option 3: SQLite for Indexes (Hybrid Approach)**
```typescript
import Database from 'better-sqlite3';

class HybridStorage {
  private db: Database.Database;
  
  constructor() {
    this.db = new Database('./data/indexes.db');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS game_index (
        game_id TEXT PRIMARY KEY,
        status TEXT,
        player_count INTEGER,
        created_at INTEGER,
        updated_at INTEGER
      );
      
      CREATE TABLE IF NOT EXISTS player_games (
        user_id TEXT,
        game_id TEXT,
        PRIMARY KEY (user_id, game_id)
      );
      
      CREATE INDEX idx_status ON game_index(status);
      CREATE INDEX idx_user ON player_games(user_id);
    `);
  }
  
  async findUserActiveGames(userId: string): Promise<any[]> {
    // Query the index (fast)
    const gameIds = this.db.prepare(`
      SELECT pg.game_id
      FROM player_games pg
      JOIN game_index gi ON pg.game_id = gi.game_id
      WHERE pg.user_id = ? AND gi.status = 'active'
    `).all(userId);
    
    // Load full game states from files
    return Promise.all(
      gameIds.map(row => this.getGameState(row.game_id))
    );
  }
}
```

**Query Performance Comparison:**

| Query | MongoDB | File-Based (in-memory) | File-Based (hybrid) |
|-------|---------|------------------------|---------------------|
| Simple lookup | 2-5ms | <1ms | 1-2ms |
| Filtered query | 5-20ms | 1-5ms | 2-10ms |
| Complex join | 20-100ms | 10-50ms | 10-50ms |
| Aggregation | 50-200ms | 20-100ms | 30-150ms |
| Full-text search | 20-100ms | N/A (implement manually) | N/A |

**Winner: MongoDB** - For complex queries. File-based requires manual index management but can be nearly as fast with proper design.

---

### 8. Use Case Fit for Quortex

#### What Quortex Actually Needs

**Primary Operations (90% of traffic):**
1. Append game action (player makes a move)
2. Get current game state (for rendering)
3. List user's active games
4. Get game by ID

**Secondary Operations (9% of traffic):**
5. User authentication and session management
6. List available games (lobby)
7. Player statistics (wins, losses, ranking)
8. Leaderboards (top 100 players)

**Rare Operations (1% of traffic):**
9. Game replay (reconstruct game from history)
10. Analytics queries (admin dashboard)
11. Data export (GDPR compliance)

#### Workload Characteristics

**Write Pattern:**
- Sequential writes (append-only moves)
- Each move is small (200-500 bytes)
- Moves are immutable (never updated)
- Perfect fit for event sourcing

**Read Pattern:**
- Hot data: Current games (5-10% of total)
- Cold data: Completed games (90-95%)
- Reads are by gameId (point queries)
- Cross-game queries are rare

**Data Volume (Projected):**
- Small scale (100 users): 10-50 active games, 100 MB total
- Medium scale (1,000 users): 100-500 active games, 1-5 GB total
- Large scale (10,000 users): 1,000-5,000 active games, 10-50 GB total

#### MongoDB Fit Analysis

**Great For:**
- ✅ Complex user queries (find all games where user X played)
- ✅ Leaderboards with aggregations
- ✅ Flexible schema (easy to add new game features)
- ✅ Built-in indexing for fast lookups

**Overkill For:**
- ❌ Simple append-only writes (MongoDB adds overhead)
- ❌ Small dataset (under 10 GB)
- ❌ Point queries by ID (files with caching are faster)
- ❌ Event sourcing (MongoDB isn't designed for this)

**Best Used When:**
- Complex querying is common
- Dataset is large (100+ GB)
- Multiple writers/readers (distributed system)
- Need built-in replication and sharding

#### File-Based Fit Analysis

**Great For:**
- ✅ Event sourcing architecture (append-only is natural)
- ✅ Small to medium datasets (under 50 GB)
- ✅ Simple point queries (game by ID)
- ✅ Time-travel debugging (full history in files)
- ✅ Easy auditing (just look at the files!)

**Limitations:**
- ⚠️ Complex queries require manual indexes
- ⚠️ No built-in replication (must implement)
- ⚠️ Harder to scale horizontally
- ⚠️ No transactional guarantees across files

**Best Used When:**
- Data is naturally append-only
- Queries are simple (by ID, by user)
- Dataset fits in memory or can be cached
- Operational simplicity is a priority

#### Recommendation Based on Project Stage

**Phase 1: MVP (0-500 users)**
**Use:** File-Based Storage
- Development speed is critical
- Data volume is tiny
- Complex queries aren't needed yet
- Operational simplicity matters

**Phase 2: Early Growth (500-5,000 users)**
**Use:** File-Based + Simple Indexes
- Add in-memory indexes for common queries
- Consider SQLite for aggregated data
- Still simple to operate
- Cost-effective

**Phase 3: Scaling (5,000-50,000 users)**
**Use:** Hybrid or MongoDB
- Migrate to MongoDB if queries become complex
- Or keep files + Redis for caching + SQLite for indexes
- Need better replication and backup strategies

**Phase 4: Large Scale (50,000+ users)**
**Use:** MongoDB (or other database)
- Definitely need a real database at this scale
- Horizontal scaling is essential
- Complex querying for features like tournaments
- Professional operations and monitoring

---

## Hybrid Approach: Best of Both Worlds?

### Architecture

```
┌──────────────────────────────────────────┐
│         Application Server               │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │      Game Action Storage          │  │
│  │      (.jsonl files)               │  │
│  │  - Fast append-only writes        │  │
│  │  - Complete game history          │  │
│  │  - Event sourcing                 │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │      Aggregated Data              │  │
│  │      (SQLite or MongoDB)          │  │
│  │  - User profiles                  │  │
│  │  - Leaderboards                   │  │
│  │  - Game metadata                  │  │
│  │  - Query indexes                  │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │      Cache Layer (Redis)          │  │
│  │  - Active game states             │  │
│  │  - Session data                   │  │
│  │  - Hot data                       │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### Implementation

```typescript
class HybridGameStorage {
  private fileStorage: GameStorage;
  private metadataDb: Database; // SQLite for simplicity
  private cache: RedisClient;
  
  // Write path: Files are source of truth
  async recordMove(gameId: string, move: Move): Promise<void> {
    // 1. Append to file (durable, complete history)
    await this.fileStorage.appendAction(gameId, {
      type: 'PLACE_TILE',
      ...move,
      timestamp: Date.now()
    });
    
    // 2. Update cache (fast reads)
    const currentState = await this.cache.get(`game:${gameId}`);
    const newState = applyMove(currentState, move);
    await this.cache.set(`game:${gameId}`, newState, { EX: 3600 });
    
    // 3. Update metadata for queries (async, fire-and-forget)
    this.updateMetadata(gameId, newState).catch(console.error);
  }
  
  // Read path: Cache first, then file, then reconstruct
  async getGameState(gameId: string): Promise<GameState> {
    // Try cache first (fastest)
    const cached = await this.cache.get(`game:${gameId}`);
    if (cached) return cached;
    
    // Reconstruct from file (source of truth)
    const actions = await this.fileStorage.readActions(gameId);
    const state = this.reconstructState(actions);
    
    // Warm the cache
    await this.cache.set(`game:${gameId}`, state, { EX: 3600 });
    
    return state;
  }
  
  // Query path: Use metadata DB
  async findUserActiveGames(userId: string): Promise<GameSummary[]> {
    // Query the metadata DB (fast)
    const games = this.metadataDb.prepare(`
      SELECT game_id, status, player_count, updated_at
      FROM games
      WHERE status = 'active'
        AND EXISTS (
          SELECT 1 FROM game_players
          WHERE game_id = games.game_id AND user_id = ?
        )
      ORDER BY updated_at DESC
    `).all(userId);
    
    return games;
  }
  
  // Background job: Keep metadata in sync
  private async updateMetadata(gameId: string, state: GameState): Promise<void> {
    this.metadataDb.prepare(`
      INSERT OR REPLACE INTO games (game_id, status, player_count, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(gameId, state.status, state.players.length, Date.now());
    
    // Update player associations
    for (const player of state.players) {
      this.metadataDb.prepare(`
        INSERT OR IGNORE INTO game_players (game_id, user_id)
        VALUES (?, ?)
      `).run(gameId, player.userId);
    }
  }
}
```

### Benefits

1. **Files**: Complete audit trail, easy debugging, event sourcing
2. **Metadata DB**: Fast queries, indexes, aggregations
3. **Cache**: Ultra-fast reads for hot data
4. **Flexibility**: Can swap any component independently

### Downsides

1. **Complexity**: Three storage layers to manage
2. **Consistency**: Metadata might lag behind files
3. **Development Time**: More code to write and test

### When to Use Hybrid

- You have complex query requirements
- You value event sourcing (complete history)
- You want operational simplicity of file-based writes
- You're willing to manage eventual consistency
- You're scaling past pure file-based limits

---

## Migration Path

### Starting with File-Based

**Phase 1: Simple File-Based (MVP)**
```typescript
class SimpleFileStorage {
  // Just files, no indexes, load into memory
  private cache: Map<string, GameState> = new Map();
  
  async getGameState(gameId: string): Promise<GameState> {
    if (this.cache.has(gameId)) {
      return this.cache.get(gameId)!;
    }
    const actions = await this.readActions(gameId);
    const state = this.reconstructState(actions);
    this.cache.set(gameId, state);
    return state;
  }
}
```

**Phase 2: Add In-Memory Indexes**
```typescript
class IndexedFileStorage extends SimpleFileStorage {
  private indexes = {
    byUser: new Map<string, Set<string>>(),
    byStatus: new Map<string, Set<string>>()
  };
  
  async initialize(): Promise<void> {
    // Build indexes on startup
    const gameFiles = await fs.readdir(this.dataDir);
    for (const file of gameFiles) {
      const gameId = this.extractGameId(file);
      const state = await this.getGameState(gameId);
      this.indexGame(gameId, state);
    }
  }
}
```

**Phase 3: Add SQLite for Persistence**
```typescript
class HybridFileStorage extends IndexedFileStorage {
  private db: Database;
  
  constructor() {
    super();
    this.db = new Database('./data/indexes.db');
    this.initializeDb();
  }
  
  // Queries use SQLite
  async findUserGames(userId: string): Promise<GameSummary[]> {
    return this.db.prepare(`
      SELECT * FROM games WHERE user_id = ?
    `).all(userId);
  }
}
```

**Phase 4: Migrate to MongoDB (if needed)**
```typescript
// Keep files as archive, use MongoDB for active data
class MigrationStorage {
  private fileStorage: HybridFileStorage;
  private mongodb: MongoClient;
  
  async migrateGame(gameId: string): Promise<void> {
    // Read from files
    const actions = await this.fileStorage.readActions(gameId);
    const state = this.reconstructState(actions);
    
    // Write to MongoDB
    await this.mongodb.collection('games').insertOne({
      _id: gameId,
      ...state,
      actions: actions // Or keep in separate collection
    });
    
    // Archive file (keep for safety)
    await this.archiveGameFile(gameId);
  }
}
```

### Starting with MongoDB

If you start with MongoDB and want to migrate to files (unlikely but possible):

```typescript
class MongoToFilesMigration {
  async exportGame(gameId: string): Promise<void> {
    // Get all moves from MongoDB
    const moves = await Move.find({ gameId }).sort({ moveNumber: 1 });
    
    // Write to JSONL file
    const lines = moves.map(m => JSON.stringify({
      type: 'PLACE_TILE',
      moveNumber: m.moveNumber,
      position: m.tile.position,
      rotation: m.tile.rotation,
      playerIndex: m.playerIndex,
      timestamp: m.timestamp
    })).join('\n');
    
    await fs.writeFile(
      `./data/games/game-${gameId}.actions.jsonl`,
      lines + '\n',
      'utf8'
    );
  }
}
```

---

## Recommendations

### For Quortex Specifically

Based on the current state of the project:
- ✅ MVP with in-memory storage (current state)
- ✅ Small user base initially
- ✅ Simple queries (by game ID, by user ID)
- ✅ Event-sourced architecture (Redux actions)
- ✅ Need for rapid iteration

**Recommendation: Start with File-Based Storage**

### Implementation Roadmap

**Week 1-2: File-Based Storage MVP**
- [ ] Create `GameStorage` class with append-only writes
- [ ] Implement `readActions` and `reconstructState`
- [ ] Add in-memory caching for active games
- [ ] Write unit tests
- [ ] Deploy with basic monitoring

**Week 3-4: Add Basic Indexes**
- [ ] Build in-memory indexes for user→games and status→games
- [ ] Implement `findUserGames` and `findActiveGames`
- [ ] Add periodic index rebuilding
- [ ] Test with realistic data volumes

**Month 2-3: Production Hardening**
- [ ] Add graceful shutdown (flush buffers)
- [ ] Implement file rotation for large games
- [ ] Set up automated backups to S3
- [ ] Add monitoring and alerting
- [ ] Optimize cache hit rates

**Month 4-6: Scale as Needed**
- [ ] Monitor performance and disk usage
- [ ] Add SQLite for complex queries if needed
- [ ] Consider Redis for session management
- [ ] Evaluate MongoDB if hitting limits

### Decision Matrix

**Choose File-Based Storage if:**
- ✅ You're in MVP/early stage
- ✅ Budget is tight
- ✅ Team is small (1-3 developers)
- ✅ Data is < 50 GB
- ✅ Queries are simple (by ID)
- ✅ You value operational simplicity
- ✅ You want fast development

**Choose MongoDB if:**
- ✅ You need complex queries immediately
- ✅ You have database expertise on team
- ✅ You're building for scale from day 1
- ✅ You need multi-region replication
- ✅ You have budget for infrastructure
- ✅ You're building advanced analytics

**Choose Hybrid if:**
- ✅ You want benefits of both
- ✅ You have 3+ developers
- ✅ You can manage complexity
- ✅ You need audit trails + fast queries

### Risk Analysis

**File-Based Risks:**
- ⚠️ **Scaling limits**: May need to migrate at 10K+ users
- ⚠️ **Query performance**: Complex queries can be slow
- ⚠️ **No replication**: Must implement yourself
- **Mitigation**: Start simple, add features as needed, be ready to migrate

**MongoDB Risks:**
- ⚠️ **Over-engineering**: Premature optimization
- ⚠️ **Learning curve**: Team needs MongoDB expertise
- ⚠️ **Cost**: Higher infrastructure and development costs
- **Mitigation**: Only use if you actually need it

### Final Recommendation

**For Quortex MVP: Use File-Based Storage (.jsonl)**

**Reasons:**
1. **Speed to market**: 50% faster development (4-7 days vs 9-15 days)
2. **Cost savings**: ~$6,000 less development + $20-30/month less infrastructure
3. **Perfect fit**: Append-only moves are exactly what .jsonl is good for
4. **Simplicity**: Easier to debug, operate, and understand
5. **Flexibility**: Easy to migrate to MongoDB later if needed
6. **Event sourcing**: Natural fit for game history and replay

**Migration trigger**: Consider MongoDB when you hit:
- 10,000+ concurrent users
- Complex analytical queries becoming common
- Need for multi-region replication
- Multiple application servers accessing same data
- Team has bandwidth for database management

**Start simple, scale smart.**

---

## Appendix: Code Examples

### Complete File-Based Storage Implementation

```typescript
import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';
import readline from 'readline';

interface GameAction {
  type: string;
  timestamp: number;
  [key: string]: any;
}

interface GameState {
  gameId: string;
  status: 'waiting' | 'active' | 'completed';
  players: any[];
  currentTurn: number;
  // ... other fields
}

export class ProductionGameStorage {
  private dataDir: string;
  private cache: Map<string, GameState> = new Map();
  private writeBuffers: Map<string, string[]> = new Map();
  private flushInterval: NodeJS.Timeout;
  
  constructor(dataDir = './data/games') {
    this.dataDir = dataDir;
    this.ensureDataDir();
    
    // Flush buffers every 5 seconds
    this.flushInterval = setInterval(() => {
      this.flushAll().catch(console.error);
    }, 5000);
  }
  
  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create data directory:', error);
    }
  }
  
  // Append action with buffering
  async appendAction(gameId: string, action: GameAction): Promise<void> {
    const line = JSON.stringify(action);
    
    // Add to buffer
    if (!this.writeBuffers.has(gameId)) {
      this.writeBuffers.set(gameId, []);
    }
    this.writeBuffers.get(gameId)!.push(line);
    
    // Update cache immediately
    if (this.cache.has(gameId)) {
      const state = this.cache.get(gameId)!;
      this.cache.set(gameId, this.applyAction(state, action));
    }
    
    // Flush if buffer is large
    if (this.writeBuffers.get(gameId)!.length >= 10) {
      await this.flush(gameId);
    }
  }
  
  // Read all actions for a game
  async readActions(gameId: string): Promise<GameAction[]> {
    const filename = path.join(this.dataDir, `game-${gameId}.actions.jsonl`);
    
    try {
      const fileStream = createReadStream(filename);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });
      
      const actions: GameAction[] = [];
      for await (const line of rl) {
        if (line.trim()) {
          actions.push(JSON.parse(line));
        }
      }
      
      return actions;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return []; // File doesn't exist yet
      }
      throw error;
    }
  }
  
  // Get current game state (cached or reconstructed)
  async getGameState(gameId: string): Promise<GameState | null> {
    // Check cache first
    if (this.cache.has(gameId)) {
      return this.cache.get(gameId)!;
    }
    
    // Reconstruct from actions
    const actions = await this.readActions(gameId);
    if (actions.length === 0) {
      return null; // Game doesn't exist
    }
    
    const state = this.reconstructState(gameId, actions);
    
    // Cache it
    this.cache.set(gameId, state);
    
    return state;
  }
  
  // Reconstruct state from action history
  private reconstructState(gameId: string, actions: GameAction[]): GameState {
    let state: GameState = {
      gameId,
      status: 'waiting',
      players: [],
      currentTurn: 0
    };
    
    for (const action of actions) {
      state = this.applyAction(state, action);
    }
    
    return state;
  }
  
  // Apply a single action to state (Redux-style reducer)
  private applyAction(state: GameState, action: GameAction): GameState {
    switch (action.type) {
      case 'CREATE_GAME':
        return {
          ...state,
          status: 'waiting',
          players: action.players || []
        };
      
      case 'JOIN_GAME':
        return {
          ...state,
          players: [...state.players, action.player]
        };
      
      case 'START_GAME':
        return {
          ...state,
          status: 'active'
        };
      
      case 'PLACE_TILE':
        return {
          ...state,
          currentTurn: state.currentTurn + 1
        };
      
      case 'COMPLETE_GAME':
        return {
          ...state,
          status: 'completed'
        };
      
      default:
        return state;
    }
  }
  
  // Flush write buffer for a specific game
  private async flush(gameId: string): Promise<void> {
    const buffer = this.writeBuffers.get(gameId);
    if (!buffer || buffer.length === 0) return;
    
    const filename = path.join(this.dataDir, `game-${gameId}.actions.jsonl`);
    const content = buffer.join('\n') + '\n';
    
    try {
      await fs.appendFile(filename, content, 'utf8');
      this.writeBuffers.set(gameId, []);
    } catch (error) {
      console.error(`Failed to flush game ${gameId}:`, error);
      // Don't clear buffer on failure - will retry next time
    }
  }
  
  // Flush all buffers
  private async flushAll(): Promise<void> {
    const gameIds = Array.from(this.writeBuffers.keys());
    await Promise.all(gameIds.map(id => this.flush(id)));
  }
  
  // Graceful shutdown
  async shutdown(): Promise<void> {
    clearInterval(this.flushInterval);
    await this.flushAll();
  }
  
  // Clean up old completed games (archive after 90 days)
  async archiveOldGames(daysOld = 90): Promise<void> {
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    const files = await fs.readdir(this.dataDir);
    
    for (const file of files) {
      if (!file.endsWith('.actions.jsonl')) continue;
      
      const gameId = file.replace('game-', '').replace('.actions.jsonl', '');
      const state = await this.getGameState(gameId);
      
      if (state && state.status === 'completed') {
        const lastAction = (await this.readActions(gameId)).slice(-1)[0];
        
        if (lastAction && lastAction.timestamp < cutoffTime) {
          // Archive (compress and move)
          const sourcePath = path.join(this.dataDir, file);
          const archivePath = path.join(this.dataDir, '../archive', file + '.gz');
          
          // TODO: Implement compression and move
          console.log(`Would archive ${file}`);
        }
      }
    }
  }
}

// Usage
const storage = new ProductionGameStorage();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await storage.shutdown();
  process.exit(0);
});
```

---

## Conclusion

Both MongoDB and file-based storage are viable options for Quortex. The choice depends on your current priorities:

**For MVP and early growth**: File-based storage offers faster development, lower costs, and operational simplicity while still meeting all functional requirements.

**For mature product with scale**: MongoDB provides better querying, easier horizontal scaling, and professional features at the cost of complexity and money.

The beauty of starting with file-based storage is that it doesn't lock you in. The data format (.jsonl) is portable, and you can migrate to MongoDB later if needed. The migration path is well-understood and low-risk.

**Recommended approach**: Start with file-based storage for your MVP. Monitor growth and complexity. Migrate to MongoDB when you have clear evidence that you need it (10K+ users, complex queries causing problems, scaling challenges).

This pragmatic approach balances speed to market with future scalability while minimizing upfront costs and complexity.

---

*Document Version: 1.0*  
*Date: 2025-11-13*  
*Author: GitHub Copilot*
