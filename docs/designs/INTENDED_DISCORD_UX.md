# Intended Discord Activity User Experience

This document outlines the intended user experience (UX) for playing Quortex through Discord Activities. It defines the expected behavior and flow to guide implementation and identify gaps between the current and desired experience.

## Core Principles

1. **One Channel = One Discord Lobby** - Discord's activity implementation constraint: all users launching the activity in the same channel join the same per-channel lobby
2. **Filtered Game Lobby View** - When users launch the activity, they see a filtered view showing only Discord games for their channel
3. **Unlimited Users Per Channel** - Any number of users can join the Discord lobby for their current channel
4. **Multiple Channels = Multiple Lobbies** - Users wanting to be in different lobbies can create new channels and launch the activity separately
5. **Players vs. Spectators** - Users who join games before start can claim playing positions; late arrivals become spectators
6. **Persistent Game History** - Games remain viewable even after all players exit, allowing post-game review

## User Experience Flow

### 1. Launching the Activity

**Action:** A Discord user clicks to launch the Quortex activity

**Expected Behavior:**
- Due to Discord's activity architecture, all users in the same channel who launch the activity join the same Discord lobby
- The lobby is identified by Discord's channel ID (One Channel = One Lobby)
- Users are presented with a filtered game lobby showing only Discord games
- From this lobby, users can create new games or join existing Discord games
- The number of users in a channel's Discord lobby is unlimited

**Example Scenarios:**
- Alice launches Quortex in Channel #general → Enters the #general Discord lobby
- Bob launches Quortex in Channel #general → Joins Alice in the #general Discord lobby (same lobby)
- Carol launches Quortex in Channel #gaming → Enters a separate #gaming Discord lobby
- To be in multiple lobbies simultaneously, a user must create/use different Discord channels

### 2. Discord Lobby Experience

**Action:** A user launches the activity in a Discord channel

**Expected Behavior:**
- User enters the per-channel Discord lobby (filtered game lobby view)
- The lobby shows only games associated with Discord (filtered by platform)
- Multiple users from the same channel see the same lobby and available games
- Users can create new games or join existing ones from this lobby
- The lobby supports unlimited concurrent users from the channel

**Creating a New Game:**
- User clicks to create a new game from the lobby
- This creates a standard Quortex game instance
- The game is added to the channel's Discord lobby list
- Other users in the same channel's lobby can see and join this game

### 3. Joining a Specific Game

**Action:** A user selects a game from the Discord lobby to join

**Expected Behavior:**

#### Before Game Start:
- User sees the game lobby/configuration screen for that specific game
- User can claim an available playing position by selecting a color
- Available positions shown based on game configuration (1-6 players)
- Other users who join the same game can also claim colors
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

### 4. Game Lifecycle

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

### 5. Multiple Concurrent Games

**Scenario:** Users in a Discord channel want to play multiple games simultaneously

**Expected Behavior:**
- Users in the same channel see the same Discord lobby (One Channel = One Lobby)
- Multiple games can be created and listed in the channel's lobby
- Users select which game to join from the lobby view
- Each game is independent with its own state
- Games run in parallel without interference
- Example:
  - Channel #general Discord Lobby contains:
    - Game A (created by Alice)
    - Game B (created by Bob)
    - Game C (created by Carol)
  - All users in #general can see and join any of these games
  - Each game maintains separate state and players

**Room/Channel Mapping:**
- Discord Channel ID → Channel-specific Lobby
- Each game in the lobby has a unique Game/Room ID
- Room ID format: `discord-{channelId}-{gameId}`
- Each game room maintains its own:
  - Player list
  - Game state
  - Turn order
  - Tile bag
  - History

### 6. Spectator Experience

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

### 7. Reconnection and Persistence

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

### 8. Discord Activity Lifecycle

```
User Launches Activity in Discord Channel
      ↓
Enter Channel-Specific Discord Lobby
      ↓
View Filtered List of Discord Games
      ↓
[Create New Game] OR [Join Existing Game]
      ↓
Game Instance Created/Joined
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
Game Persisted (viewable in lobby, marked as completed)
```

## Key UX Requirements Summary

### Must Have:
1. ✅ One channel = one Discord lobby (Discord platform constraint)
2. ✅ Filtered lobby view showing only Discord games for the channel
3. ✅ Unlimited users can join the same channel's Discord lobby
4. ✅ Users can create/join games from the lobby view
5. ✅ Early joiners to games can claim playing positions
6. ✅ Late joiners to games become spectators
7. ✅ Multiple simultaneous games per channel lobby
8. ✅ Game state persists after all players exit
9. ✅ Post-game viewing of completed games

### Should Have:
- Clear lobby interface showing available Discord games
- Clear spectator mode indicators within games
- Player reconnection preserves playing position
- Visible player list and turn order within games
- Game history/replay functionality
- Visual distinction between active and completed games in lobby

### Nice to Have:
- Chat integration with Discord
- Rich presence showing current game state in channel
- Quick join to most recent game in lobby
- Tournament/series tracking across multiple games
- Lobby search/filter for specific game types or states

## Current Implementation Status

**To be filled in during implementation review:**
- [ ] Channel ID properly maps to Discord lobby
- [ ] Filtered lobby view showing only Discord games
- [ ] Multiple games per channel lobby supported
- [ ] Unlimited users can join channel lobby
- [ ] Spectator mode implemented and functional within games
- [ ] Game persistence after all players exit
- [ ] Pre-game position claiming works correctly
- [ ] Post-game state viewable in lobby

## Discord Platform Constraints

**Important Note:** This UX design accounts for Discord's activity implementation constraint where all users launching an activity in the same channel are forced into the same activity instance. This means we cannot implement the originally intended "Each Launch = Unique Game" model.

**Workaround Solution:**
- Use the single activity instance per channel as a **lobby** rather than a game
- Present users with a filtered view of available Discord games
- Allow users to create new games or join existing ones from this lobby
- Support unlimited users in the channel lobby
- Users wanting separate lobbies can use different Discord channels

## Next Steps

1. **Implement Discord Lobby UI** showing filtered game list
2. **Review Current Implementation** against this document
3. **Identify Gaps** between intended and actual UX
4. **Prioritize Fixes** based on core principles
5. **Update Documentation** as implementation evolves
6. **Test Each Scenario** outlined in this document

## Related Documentation

- [DISCORD_ACTIVITY_SETUP.md](../dev/DISCORD_ACTIVITY_SETUP.md) - Technical setup guide
- [DISCORD_DESIGN.md](DISCORD_DESIGN.md) - Architecture and design
- [WEB_MULTIPLAYER.md](WEB_MULTIPLAYER.md) - Multiplayer infrastructure
- [RULES.md](../RULES.md) - Game rules and mechanics
