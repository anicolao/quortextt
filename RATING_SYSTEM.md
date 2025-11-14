# Quortex Rating System Design

## Overview

This document describes the implementation of the Glicko-2 rating system for Quortex. The system tracks player skill levels across different game configurations and provides fair matchmaking data.

## Glicko-2 Rating System

### What is Glicko-2?

Glicko-2 is an improvement over the Elo rating system, originally developed by Mark Glickman. It addresses several limitations of Elo:

1. **Rating Deviation (RD)**: Measures the reliability/uncertainty of a rating. New or inactive players have higher RD, while active players with many games have lower RD.
2. **Rating Volatility (σ)**: Measures the degree of expected fluctuation in a player's rating. Players with erratic performance have higher volatility.
3. **Rating Periods**: Updates happen in discrete periods rather than after each game, which better models actual skill changes.

### Key Parameters

- **Rating (r)**: Player skill level (starts at 1500)
- **Rating Deviation (RD)**: Uncertainty in the rating (starts at 350, minimum clamped to 75)
- **Volatility (σ)**: Expected fluctuation (starts at 0.06)
- **System Constant (τ)**: Constrains volatility changes (set to 0.5)

### Why Glicko-2 for Quortex?

1. **New Player Integration**: RD allows new players to quickly reach their true skill level
2. **Inactivity Handling**: RD increases for inactive players, making their rating less certain
3. **Multiple Game Modes**: We track separate ratings for 2, 3, 4, 5, and 6 player games
4. **Fair Uncertainty**: The RD floor of 75 ensures established players maintain reasonable uncertainty

## Implementation Design

### Data Structures

#### Player Rating Record

Each player maintains separate ratings for each game configuration:

```typescript
interface GlickoRating {
  rating: number;      // Current rating (μ in Glicko-2 scale)
  rd: number;          // Rating Deviation (φ in Glicko-2 scale)
  volatility: number;  // Rating volatility (σ)
  lastUpdated: Date;   // When this rating was last updated
  gamesPlayed: number; // Number of games at this player count
}

interface PlayerRatings {
  twoPlayer: GlickoRating;
  threePlayer: GlickoRating;
  fourPlayer: GlickoRating;
  fivePlayer: GlickoRating;
  sixPlayer: GlickoRating;
}
```

#### Initial Values

When a player account is created:

```typescript
const DEFAULT_RATING = 1500;
const DEFAULT_RD = 350;
const DEFAULT_VOLATILITY = 0.06;
const MIN_RD = 75;  // RD is clamped to max(rd, 75)
```

#### Game Result Record

```typescript
interface GameResult {
  gameId: string;
  playerCount: number;
  players: Array<{
    playerId: string;
    rank: number;        // 1 = winner, 2 = second, etc.
    teamId?: string;     // For team games (4-6 players)
  }>;
  completedAt: Date;
}
```

### Rating Calculation

#### Step 1: Convert to Glicko-2 Scale

```
μ = (r - 1500) / 173.7178
φ = RD / 173.7178
```

#### Step 2: Calculate Rating Updates

For each game result:
1. Convert all player ratings to Glicko-2 scale
2. For each player, calculate their expected score against each opponent
3. Update rating, RD, and volatility based on actual vs. expected performance
4. Convert back to standard scale

#### Step 3: Handle Team Games

For 4-6 player games with teams:
- Teams are treated as competing entities
- Team rating is the average of team member ratings
- Both team members receive the same rating change

#### Step 4: Handle Multiplayer (3+ player games)

For games with 3+ individual players:
- Each player's performance is evaluated against all other players
- Players who finish higher receive rating increases
- Rating changes consider pairwise comparisons (player A vs B, A vs C, etc.)

#### Step 5: Apply Rating Changes

After calculation:
1. Update player's rating, RD, and volatility
2. Apply RD floor: `rd = Math.max(rd, MIN_RD)`
3. Record the change in player's rating history
4. Update the `lastUpdated` timestamp

### Rating Decay (Inactivity)

When a player has been inactive at a specific player count:
- RD increases gradually over time
- Calculation: `RD' = sqrt(RD² + c²)` where c is determined by inactivity period
- This makes the rating less certain but doesn't change the rating value itself

### Integration Points

#### Game Completion Handler

When a game finishes on the client side:
1. Client detects game completion (phase becomes "finished")
2. Client emits `game_completed` event to server with:
   ```typescript
   {
     gameId: string;
     playerCount: number; // 2-6
     results: Array<{
       playerId: string;
       rank: number; // 1 = winner, 2 = second, etc.
       teamId?: string; // For team games
     }>;
     isTeamGame?: boolean; // true for 4-6 player games with teams
   }
   ```
3. Server receives the event in `server/src/index.ts` via `game_completed` socket handler
4. Server calls `processGameCompletion()` from `ratingService.ts`
5. Rating service:
   - Loads current ratings for all players at that player count
   - Calculates new ratings using Glicko-2
   - Updates each player's rating in their profile
   - Records rating changes in rating history
   - Applies RD floor (clamp to max(rd, 75))

**Note**: The current implementation requires manual client-side integration. When the game 
reaches "finished" phase and winners are determined, the client should emit the 
`game_completed` event. This is a future enhancement task.

#### User Profile

Ratings are stored in the user profile:

```typescript
interface IUser {
  // ... existing fields ...
  ratings: PlayerRatings;
  ratingHistory: Array<{
    gameId: string;
    playerCount: number;
    oldRating: number;
    newRating: number;
    oldRD: number;
    newRD: number;
    timestamp: Date;
  }>;
}
```

### API Endpoints

#### Get Player Rating

```
GET /api/users/:userId/ratings
Returns: PlayerRatings object
```

#### Get Rating History

```
GET /api/users/:userId/ratings/history?playerCount=2
Returns: Array of rating changes
```

#### Get Leaderboard

```
GET /api/leaderboard?playerCount=2&limit=100
Returns: Top players sorted by rating
```

## Implementation Phases

### Phase 1: Core Algorithm ✅
- ✅ Implement Glicko-2 calculation functions
- ✅ Create rating update logic
- ✅ Add unit tests for calculations

### Phase 2: Data Model ✅
- ✅ Extend User model with rating fields
- ✅ Add migration for existing users (automatic via default ratings)
- ✅ Initialize new users with default ratings

### Phase 3: Integration ⚠️
- ✅ Create server endpoint for game completion (`game_completed` socket event)
- ✅ Add rating calculation on game completion
- ✅ Store rating history
- ⚠️ **TODO**: Client-side integration to emit `game_completed` event when game finishes
  - Requires detecting when `phase === "finished"` in game reducer
  - Must extract player rankings and team information
  - Emit to server via socket.io

### Phase 4: API & Display 🔜
- 🔜 Create API endpoints for ratings
- 🔜 Add rating display to user profiles
- 🔜 Implement leaderboards

**Current Status**: The rating system is fully implemented on the server side but requires 
client-side integration to detect game completion and send results to the server. This is 
the next step for full functionality.

## Testing Strategy

### Unit Tests
- Test Glicko-2 calculation accuracy
- Test rating updates for different game scenarios
- Test RD clamping and volatility constraints
- Test team game rating calculations
- Test multiplayer (3+ player) calculations

### Integration Tests
- Test full game flow with rating updates
- Test rating history recording
- Test concurrent game completions

### Edge Cases
- Brand new player vs. experienced player
- Inactive player returning
- All players at similar skill levels
- Extreme skill gaps
- Team composition variations

## References

- [Glicko-2 Rating System Paper](http://www.glicko.net/glicko/glicko2.pdf) by Mark Glickman
- [Example Implementation](http://www.glicko.net/glicko/glicko2.pdf) - Step-by-step algorithm

## Future Enhancements

1. **Provisional Ratings**: Mark players with < 10 games as provisional
2. **Confidence Intervals**: Display rating as "1600 ± 100" using RD
3. **Rating Categories**: Assign titles based on rating ranges (Beginner, Intermediate, Expert, etc.)
4. **Matchmaking**: Use ratings to suggest balanced games
5. **Rating Charts**: Visualize rating progression over time
6. **Cross-Player-Count Comparison**: Meta-rating that considers all game types
