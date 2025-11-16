# Intended Discord Activity User Experience

This document outlines the intended user experience (UX) for playing Quortex through Discord Activities. It defines the expected behavior and flow to guide implementation and identify gaps between the current and desired experience.

## Core Principles

1. **Each Activity Launch = One Game** - Every time a user launches the Quortex activity from Discord, they create or join a unique game instance
2. **Players vs. Spectators** - Users who join before game start can claim playing positions; late arrivals become spectators
3. **Multiple Concurrent Games** - Different activity launches create independent games that can run simultaneously
4. **Persistent Game History** - Games remain viewable even after all players exit, allowing post-game review

## User Experience Flow

### 1. Launching the Activity

**Action:** A Discord user clicks to launch the Quortex activity

**Expected Behavior:**
- Each "Launch" action creates or connects to a unique game instance
- The instance is identified by Discord's Activity Instance ID
- Multiple users can launch separate instances, creating different concurrent games
- Each game instance is completely independent

**Example Scenarios:**
- Alice launches Quortex → Game Instance A is created
- Bob launches Quortex separately → Game Instance B is created (different from A)
- Carol clicks on Alice's existing activity → Joins Game Instance A

### 2. Joining a Game

**Action:** A user opens/joins an activity instance

**Expected Behavior:**

#### Before Game Start:
- User sees the game lobby/configuration screen
- User can claim an available playing position by selecting a color
- Available positions shown based on game configuration (1-6 players)
- Other users who join the same instance can also claim colors
- All positions are initially unclaimed and available
- Users can join and choose not to claim a color, becoming spectators

#### After Game Start:
- New joiners become **spectators**
- Spectators can view the game in real-time
- Spectators cannot claim playing positions
- Spectators see the full game state and all player actions
- UI clearly indicates spectator status

**Position Claiming:**
- Players claim positions by selecting their preferred color
- Each color can only be claimed by one player
- Board edge selection happens after the game starts (during the seating phase)
- Selecting an edge opposite another player forms an implicit team (shared victory)
- Once players have claimed their desired colors, anyone can start the game
- If only one player claims a color and starts the game, they play against AI

### 3. Game Lifecycle

#### Phase 1: Pre-Game (Game Setup - Choosing Colors & Options)
**Duration:** From activity launch until game start

**Behavior:**
- Players join and claim colors
- Anyone can configure game settings
- All joined users can see who has claimed which colors
- Late arrivals can still claim unclaimed colors
- Anyone can initiate game start when ready

**Transition to Seating Phase:**
- Anyone clicks "Start Game" (arrow button in the color picking UI)
- All colors are locked
- Game state transitions to seating phase where players select board edges
- Any new joiners from this point become spectators

#### Phase 2: Seating Phase (Board Edge Selection)
**Duration:** After game start, before first turn

**Behavior:**
- Players who claimed colors now select their board edges
- Each edge can only be claimed by one player
- Players selecting opposite edges form an implicit team
- After all players select edges, gameplay begins

#### Phase 3: Active Gameplay
**Duration:** From game start until game end

**Behavior:**
- Players take turns placing tiles according to game rules
- All participants (players + spectators) see real-time updates
- Game state synchronized via WebSocket
- Players can exit and rejoin without ending the game for others
- If all players disconnect, game state is preserved

#### Phase 4: Game Over
**Duration:** After victory condition is met

**Behavior:**
- Victory animation and results displayed
- Final game state is preserved
- Players can review the completed game
- Spectators can continue viewing

#### Phase 5: Post-Game
**Duration:** After all players have exited

**Behavior:**
- Activity instance remains accessible
- Anyone opening the activity sees the final game state
- Game history is viewable (board state, tile placements, winner)
- **Critical:** The game does not automatically reset or disappear
- Users can review strategy and game progression
- Launching a NEW activity instance creates a fresh game

### 4. Multiple Concurrent Games

**Scenario:** Different users launch separate activity instances

**Expected Behavior:**
- Each launch creates an independent game with unique Instance ID
- Games run in parallel without interference
- Example:
  - Activity Launch 1 → Game A (Instance ID: abc123)
  - Activity Launch 2 → Game B (Instance ID: xyz789)
  - Game A and Game B are completely independent
  - Players in Game A cannot see or interact with Game B

**Room/Instance Mapping:**
- Activity Instance ID → Unique Game/Room ID
- Room ID format: `discord-{instanceId}`
- Each room maintains its own:
  - Player list
  - Game state
  - Turn order
  - Tile bag
  - History

### 5. Spectator Experience

**When Users Become Spectators:**
- Joining after game has started
- Joining when all playing positions are claimed
- Joining before game start and not claiming a color

**Spectator Capabilities:**
- View full game board in real-time
- See current player's turn
- Watch tile placements and animations
- View player scores/flows
- Access game rules and help

**Spectator Limitations:**
- Cannot place tiles
- Cannot claim playing positions
- Cannot influence game state
- Cannot become a player mid-game

**UI Indicators:**
- Clear "Spectator Mode" label
- Different UI presentation (no turn controls)
- List of active players visible
- Indication of whose turn it is

### 6. Reconnection and Persistence

#### Player Reconnection:
**Scenario:** A player closes Discord or loses connection

**Expected Behavior:**
- Player's position is reserved
- Game continues for other players
- Upon reconnection to same instance, player rejoins as player (not spectator)
- Player sees current game state
- Player can resume taking turns when it's their turn

#### Game Persistence:
**Scenario:** All players exit the game

**Expected Behavior:**
- Game state is saved
- Activity instance remains accessible
- Anyone opening the instance sees the final state
- Game is in "archived" or "completed" state
- No new turns can be taken
- Full game history is reviewable

### 7. Instance Lifecycle

```
Activity Launch
      ↓
Create Instance (unique ID)
      ↓
Players Join & Claim Colors
      ↓
Anyone Starts Game → Lock Colors
      ↓
Seating Phase (Select Board Edges)
      ↓
Active Gameplay
      ↓
Victory Condition Met
      ↓
Game Over State
      ↓
All Players Exit
      ↓
Instance Persisted (viewable but inactive)
```

## Key UX Requirements Summary

### Must Have:
1. ✅ Each activity launch = unique game instance
2. ✅ Early joiners can claim playing positions
3. ✅ Late joiners become spectators
4. ✅ Multiple simultaneous games via different launches
5. ✅ Game state persists after all players exit
6. ✅ Post-game viewing of completed games

### Should Have:
- Clear spectator mode indicators
- Player reconnection preserves playing position
- Host controls for game start
- Visible player list and turn order
- Game history/replay functionality

### Nice to Have:
- Chat integration with Discord
- Rich presence showing current game state
- Invite links to specific game instances
- Tournament/series tracking across multiple games

## Current Implementation Status

**To be filled in during implementation review:**
- [ ] Instance ID properly maps to unique game rooms
- [ ] Spectator mode implemented and functional
- [ ] Game persistence after all players exit
- [ ] Multiple concurrent games support
- [ ] Pre-game position claiming works correctly
- [ ] Post-game state viewable

## Next Steps

1. **Review Current Implementation** against this document
2. **Identify Gaps** between intended and actual UX
3. **Prioritize Fixes** based on core principles
4. **Update Documentation** as implementation evolves
5. **Test Each Scenario** outlined in this document

## Related Documentation

- [DISCORD_ACTIVITY_SETUP.md](docs/dev/DISCORD_ACTIVITY_SETUP.md) - Technical setup guide
- [DISCORD_DESIGN.md](docs/designs/DISCORD_DESIGN.md) - Architecture and design
- [WEB_MULTIPLAYER.md](docs/designs/WEB_MULTIPLAYER.md) - Multiplayer infrastructure
- [RULES.md](docs/RULES.md) - Game rules and mechanics
