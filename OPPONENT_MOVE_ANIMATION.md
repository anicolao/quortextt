# Opponent Move Animation - Testing Guide

## What Was Implemented

This implementation adds automatic flow animation when new moves are received from opponents, making it obvious when a new move has been played.

### Key Changes Made

1. **Animation State Tracking** (`src/game_ui.rs`):
   - Added `last_known_action_count` field to `AnimationState` to track when new actions arrive
   - This field is initialized to 0 and gets updated each frame

2. **Move Detection Logic** (`src/game_ui.rs` lines ~601-609):
   - Added logic in the `display()` method to detect when `game.action_history_vec().len()` increases
   - When new actions are detected, it automatically triggers flow animation for the most recently placed tile
   - Updates the `last_known_action_count` to prevent triggering animations repeatedly for the same moves

3. **Animation Trigger Method** (`src/game_ui.rs` lines ~225-320):
   - Extracted the existing flow animation logic into a reusable `trigger_flow_animation_for_tile()` method
   - This method uses the same logic as hover animations but works on any placed tile
   - Takes a game state and tile position, analyzes flows, and creates appropriate animations

4. **Helper Function** (`src/game_ui.rs` lines ~220-224):
   - Made `get_most_recent_tile_position()` public and added logic to find the most recently placed tile
   - Searches through action history in reverse to find the latest `PlaceTile` action

## How It Works

### Flow of Execution

1. **Every Frame**: The `display()` method checks if `current_action_count` > `last_known_action_count`
2. **New Move Detected**: When this condition is true, it means new actions have arrived from the backend
3. **Find Recent Tile**: Uses `get_most_recent_tile_position()` to find which tile was just placed
4. **Trigger Animation**: Calls `trigger_flow_animation_for_tile()` with the recently placed tile position
5. **Update Counter**: Sets `last_known_action_count = current_action_count` to prevent duplicate animations

### Animation Logic

The `trigger_flow_animation_for_tile()` method:
- Analyzes all flows on the placed tile
- Traces paths in both directions from each flow 
- Determines which flows lead to player sources (board edges or existing flows)
- Creates animation paths showing how flow extends from the new tile
- Uses the same visual effects as user-placed tile animations

## Testing Instructions

### Prerequisites
1. Build the application: `cargo build --release`
2. For multiplayer testing, also build the server: `cargo build --bin server --no-default-features --release`

### Test Scenario 1: Local Two-Player Game
1. Run `cargo run --release`
2. Select "In-memory" mode
3. The game will automatically switch between players after each move
4. When it switches to show the other player's view, the most recent opponent move should animate
5. You should see the flow animation play automatically, showing how the opponent's tile connects flows

### Test Scenario 2: Server Multiplayer
1. Start the server: `cargo run --bin server --no-default-features --release`
2. Open two browser windows/tabs to connect as different players
3. When one player places a tile, the other player should immediately see the flow animation
4. The animation shows the same flow effects as when placing your own tiles

### Test Scenario 3: AI Game Mode  
1. Run `cargo run --release`
2. Select "Easy AI" mode
3. Place your tile and watch the AI respond
4. When the AI places its tile, you should see the flow animation automatically play
5. This makes it clear what the AI just did

### Expected Behavior

- **Automatic Animation**: No user interaction needed - animations trigger when moves arrive
- **Same Visual Style**: Uses identical animation logic as user-placed tiles
- **Flow Visualization**: Shows how flows extend through and from the newly placed tile
- **Multiple Flows**: If a tile creates multiple flow paths, all are animated
- **Winning Moves**: Winning flow animations also work automatically

### What You Should See

When an opponent places a tile that creates or extends flows:
1. The new tile appears on the board
2. Colored flow lines automatically animate outward from the tile
3. The animation traces the complete flow path(s) created by the new tile
4. Animation uses the same speed and visual effects as manual tile placement

## Code Structure

```
src/game_ui.rs:
├── AnimationState struct (added last_known_action_count field)
├── display() method (added move detection logic at ~601-609)
├── get_most_recent_tile_position() (made public, used to find recent tiles)
└── trigger_flow_animation_for_tile() (new method, ~225-320)
    ├── Analyzes tile flows using placed_tile.type_().all_flows()
    ├── Traces flow paths using trace_flow() 
    ├── Determines flow sources using leads_to_source()
    └── Creates FlowAnimation structs for rendering
```

## Technical Notes

- **Performance**: The detection logic runs every frame but is very lightweight (just an integer comparison)
- **Compatibility**: Works with all game modes (in-memory, server, AI)
- **Thread Safety**: Uses existing game state, no additional synchronization needed
- **Animation Queueing**: Multiple animations can be chained using the existing `next` field in `FlowAnimation`

This implementation satisfies the requirement: "When a new move is played by an opponent, animate it first to show the change using the same logic as for placing our own tiles, so that the incoming move is obvious."