# User Story: Player Configuration

**As a user, I want to configure players before starting a game**

## Flow Description

This story demonstrates the complete player configuration flow, from the initial state through adding/removing players, customizing colors, and starting the game.

## Screenshots

### 001-initial-state.png
- **Action**: User loads the application
- **State**: Configuration screen with "Add Player" and "Start Game" buttons
- **What to verify**: Title is visible, no players shown, buttons are present

### 002-player-added.png
- **Action**: User clicks "Add Player" button
- **State**: One player entry appears with default color
- **What to verify**: Player has a color icon, player name/ID, remove button (X)

### 003-multiple-players.png
- **Action**: User clicks "Add Player" two more times
- **State**: Three players listed with different colors
- **What to verify**: Each player has unique color, all have remove buttons

### 004-max-players.png
- **Action**: User continues adding players until maximum reached
- **State**: Six players shown (MAX_PLAYERS = 6)
- **What to verify**: "Add Player" button disabled or not clickable beyond 6

### 005-player-removed.png
- **Action**: User clicks X button on first player
- **State**: One player removed, now showing fewer players
- **What to verify**: Remaining players still have correct colors and positions

### 006-color-picker-open.png
- **Action**: User clicks on a player's color icon
- **State**: Color picker modal/overlay appears
- **What to verify**: Picker shows all available colors in grid, current color highlighted

### 007-color-changed.png
- **Action**: User selects a different color from picker
- **State**: Player's color updated, picker closed
- **What to verify**: Player has new color, picker dismissed

### 008-picker-closed.png
- **Action**: User clicks outside color picker
- **State**: Picker dismissed without color change
- **What to verify**: Player retains original color, picker not visible

### 009-game-started.png
- **Action**: User clicks "Start Game" button with players configured
- **State**: Transitioned to gameplay screen
- **What to verify**: Screen changed to gameplay, board visible, players assigned edges

### 010-two-players-before-swap.png
- **Action**: Two players configured with different colors
- **State**: Ready to demonstrate color swap behavior
- **What to verify**: Two distinct player colors shown

### 011-colors-swapped.png
- **Action**: User selects color already used by another player
- **State**: Colors swapped between the two players
- **What to verify**: Player 1 now has Player 2's original color and vice versa

## Test Coverage

This story validates:
- Initial configuration screen rendering
- Adding players (up to maximum)
- Removing players
- Color picker UI and interaction
- Color selection and changes
- Color swapping when selecting in-use color
- Starting game with valid configuration
- Screen transition to gameplay

## Related Files
- Test: `tests/e2e/configuration.spec.ts`
- Redux: `src/redux/gameReducer.ts`
- Rendering: `src/rendering/configurationScreen.ts`
