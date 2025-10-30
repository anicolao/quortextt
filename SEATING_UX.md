# Seating UX Design Document

## Overview

This document defines the user experience and implementation details for the **player seating phase** - a new pre-game phase where players select which edges of the hexagonal game board they will own. This phase occurs after the lobby (where players join with colors) but before the main gameplay begins.

## Current Problem

The current game implementation has a critical gap: it automatically assigns board edges to players in a deterministic way based on player count:
- 2 players: Opposite edges (0 and 3)
- 3 players: Every other edge (0, 2, 4)
- 4-6 players: Consecutive edges (0, 1, 2, ...)

However, the actual game rules specify that:
1. Player order should be **randomized** at game start
2. In turn, each player **chooses** an edge of the board to own
3. The first player (in randomized order) has 6 choices, the second has 5 remaining, etc.
4. After all edges are selected, gameplay begins with the first player
5. **Play order during the game** is clockwise around the hexagon based on selected edges, NOT the randomized seating order

## Design Goals

1. **Follow Official Rules**: Implement the proper seating selection mechanism
2. **Clear Visual Feedback**: Players must easily see available edges and their turn order
3. **Multi-Angle Viewability**: Design works for tabletop displays with players viewing from all angles
4. **Intuitive Interaction**: Simple tap-to-select mechanism
5. **Seamless Integration**: Fit naturally between lobby and gameplay phases

## Game Flow Integration

### Current Flow
```
Lobby (Player Join) → [Automatic Edge Assignment] → Gameplay
```

### New Flow
```
Lobby (Player Join) → Randomize Player Order → Seating Phase → Gameplay
                                                 ↑
                                        Players Choose Edges
```

## Seating Phase UX Specification

### Visual Design

#### Board Display
- Central hexagonal board shown in black
- All 6 edges initially available (no colored borders yet)
- Board fills most of screen, similar to gameplay layout

#### Player Order Indicators
For each available edge, display a **circular button** showing:
- **Player number** (1, 2, 3, etc.) in large, clear digits
- **Player color** as the button's background color
- **Rotation**: Button is rotated to be upright when viewed from outside the hexagon looking toward the center

The button shows which player's turn it is to select. All available edges show the same player number and color simultaneously.

#### Example Visual State
**Initial State (Player 1's turn):**
- All 6 edges show a circular button with "1" in Player 1's color (e.g., blue)
- Each button rotated to face outward from its respective edge

**After Player 1 Selects Top Edge:**
- Top edge now has a blue border (Player 1's color)
- Top edge button disappears
- Remaining 5 edges show circular buttons with "2" in Player 2's color (e.g., orange)

#### Turn Indicator (Optional Enhancement)
In addition to edge buttons, optionally show a center area indicator:
- Current player number and color
- Rotated copies in all four orientations for multi-angle viewing
- Text: "Player N - Choose Your Edge" (or icon-based equivalent)

### Interaction Flow

#### Phase Start
1. Game transitions from lobby to seating phase
2. Player order is **randomized** (using Fisher-Yates shuffle or similar)
3. Store both:
   - `seatingOrder`: Array of player IDs in randomized selection order
   - `seatingIndex`: Current index in the seating order (starts at 0)
4. Display board with player 1's buttons on all available edges

#### Edge Selection
1. **Current player taps** any available edge circular button
2. **Immediate visual feedback**:
   - Button press animation (scale 0.95, 100ms)
   - Selected edge border changes to player's color (200ms fade-in)
   - Button at selected edge disappears
3. **State update**:
   - Assign edge to player: `players[currentPlayerId].edgePosition = selectedEdge`
   - Increment seating index: `seatingIndex++`
   - Remove edge from available edges
4. **Next player indication**:
   - Remaining edges update to show next player's number and color (300ms transition)
   - Buttons fade out old player, fade in new player
5. **Repeat** until all players have selected edges

#### Phase Completion
1. After last player selects their edge:
   - Brief delay (500ms) to show final board state
   - All edges now colored with player borders
2. **Determine gameplay order**:
   - Players are reordered by their edge positions (clockwise around board)
   - Starting player remains the first from the randomized seating order
3. **Transition to gameplay**:
   - Fade transition to main game (600ms)
   - First player's tile appears by their selected edge
   - Normal gameplay begins

### Visual Feedback Details

#### Edge Button Appearance
- **Shape**: Circle (not hexagon, to distinguish from tiles)
- **Size**: Large enough for easy tapping (80-100px diameter)
- **Position**: Centered on each board edge, outside the board boundary
- **Rotation**: Text/number rotated to be upright from that edge's viewing angle
  - Edge 0 (NorthWest): 150° rotation
  - Edge 1 (West): 90° rotation
  - Edge 2 (SouthWest): 30° rotation
  - Edge 3 (SouthEast): 330° rotation (or -30°)
  - Edge 4 (East): 270° rotation (or -90°)
  - Edge 5 (NorthEast): 210° rotation (or -150°)

#### Button States
- **Available**: Full opacity, player color background, white number
- **Selected**: Fade out and disappear (300ms)
- **Transition**: When changing from player N to player N+1:
  - Fade out old player's buttons (150ms)
  - Fade in new player's buttons (150ms)
  - Use sequential timing for smooth transition

#### Edge Border Coloring
- **Unselected**: Black (board default color)
- **Selected**: Player's color with smooth fade-in (200ms)
- **Border width**: Same as gameplay (thick enough to be clearly visible)

### Animation Specifications

#### Button Press
- Scale down to 0.95 for 100ms
- No delay before state update

#### Edge Selection
```
Timeline:
0ms:    Button press animation starts
100ms:  Button press complete, edge assignment begins
100ms:  Edge border color fade-in starts
300ms:  Edge border color fade-in complete
300ms:  Selected button fade-out starts
450ms:  Selected button fully removed
450ms:  Remaining buttons transition to next player starts
600ms:  Next player's buttons fully displayed
```

#### Phase Transition (to Gameplay)
```
0ms:    Last edge selected
500ms:  Brief pause to show completed board
500ms:  Fade transition to gameplay begins
1100ms: Gameplay screen fully visible
1100ms: First player's tile appears
```

## Implementation Details

### State Management

#### New Redux State Fields

Add to `GameState`:
```typescript
// Seating phase state
seatingPhase: {
  active: boolean;              // Whether we're in seating phase
  seatingOrder: string[];       // Player IDs in randomized turn order
  seatingIndex: number;         // Current index in seating order
  availableEdges: number[];     // Edge numbers (0-5) still available
  edgeAssignments: Map<string, number>; // Player ID -> edge number
}
```

#### New Redux Actions

```typescript
// Start seating phase (called after lobby)
interface StartSeatingPhaseAction {
  type: 'START_SEATING_PHASE';
  payload: {
    seatingOrder: string[];  // Randomized player IDs
  };
}

// Player selects an edge
interface SelectEdgeAction {
  type: 'SELECT_EDGE';
  payload: {
    playerId: string;
    edgeNumber: number;      // 0-5
  };
}

// Complete seating and transition to gameplay
interface CompleteSeatingPhaseAction {
  type: 'COMPLETE_SEATING_PHASE';
}
```

#### Modified Existing Actions

**START_GAME** (in lobby):
- Change to initiate seating phase instead of gameplay
- Randomize player order
- Dispatch `START_SEATING_PHASE` action

### Core Functions

#### Randomization
```typescript
/**
 * Randomize player order for seating selection
 * Uses Fisher-Yates shuffle for uniform distribution
 */
function randomizePlayerOrder(playerIds: string[]): string[] {
  const shuffled = [...playerIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
```

#### Edge Assignment Validation
```typescript
/**
 * Check if an edge is available for selection
 */
function isEdgeAvailable(edge: number, availableEdges: number[]): boolean {
  return availableEdges.includes(edge);
}

/**
 * Get the current player who should be selecting
 */
function getCurrentSelectingPlayer(
  seatingOrder: string[],
  seatingIndex: number
): string {
  return seatingOrder[seatingIndex];
}
```

#### Gameplay Order Determination
```typescript
/**
 * After seating is complete, determine gameplay turn order
 * Players are ordered clockwise by their edge positions
 * Starting player is the first from the seating order
 */
function determineGameplayOrder(
  players: Player[],
  seatingOrder: string[]
): string[] {
  // Sort players by edge position (clockwise order)
  const sortedPlayers = [...players].sort(
    (a, b) => a.edgePosition - b.edgePosition
  );
  
  // Find the starting player (first from seating order)
  const startingPlayerId = seatingOrder[0];
  const startIndex = sortedPlayers.findIndex(p => p.id === startingPlayerId);
  
  // Rotate array to start with the starting player
  const gameplayOrder = [
    ...sortedPlayers.slice(startIndex),
    ...sortedPlayers.slice(0, startIndex)
  ];
  
  return gameplayOrder.map(p => p.id);
}
```

### Rendering Implementation

#### Seating Phase Renderer

New renderer class for seating phase:
```typescript
class SeatingRenderer {
  /**
   * Render the seating phase screen
   */
  render(state: GameState, canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear and draw background
    this.drawBackground(ctx, canvas.width, canvas.height);
    
    // Draw central hexagon board (black, no colored edges yet)
    this.drawBoard(ctx, canvas.width, canvas.height, state);
    
    // Draw selected edges with player colors
    this.drawSelectedEdges(ctx, state);
    
    // Draw available edge buttons (current player)
    this.drawEdgeButtons(ctx, state);
    
    // Optional: Draw center turn indicator
    this.drawCenterIndicator(ctx, state);
  }
  
  /**
   * Draw circular buttons on available edges
   */
  private drawEdgeButtons(
    ctx: CanvasRenderingContext2D,
    state: GameState
  ): void {
    const currentPlayer = this.getCurrentPlayer(state);
    const availableEdges = state.seatingPhase.availableEdges;
    
    for (const edge of availableEdges) {
      const position = this.getEdgeButtonPosition(edge);
      const rotation = this.getEdgeRotation(edge);
      
      // Draw circular button
      ctx.save();
      ctx.translate(position.x, position.y);
      ctx.rotate(rotation);
      
      // Background circle
      ctx.fillStyle = currentPlayer.color;
      ctx.beginPath();
      ctx.arc(0, 0, 50, 0, Math.PI * 2);
      ctx.fill();
      
      // Player number text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.getPlayerNumber(currentPlayer), 0, 0);
      
      ctx.restore();
    }
  }
  
  /**
   * Get screen position for edge button
   */
  private getEdgeButtonPosition(edge: number): { x: number; y: number } {
    // Calculate position outside board boundary
    // Position is centered on the edge, displaced outward
    // Implementation depends on board layout calculations
    // See rendering/hexLayout.ts for coordinate system
  }
  
  /**
   * Get rotation angle for edge to make text upright
   */
  private getEdgeRotation(edge: number): number {
    const rotations = [150, 90, 30, -30, -90, -150];
    return (rotations[edge] * Math.PI) / 180;
  }
}
```

#### Edge Button Hit Detection

```typescript
/**
 * Handle touch/click on seating phase screen
 */
function handleSeatingInput(
  x: number,
  y: number,
  state: GameState,
  dispatch: Dispatch
): void {
  // Check if tap is on an available edge button
  for (const edge of state.seatingPhase.availableEdges) {
    const buttonPos = getEdgeButtonPosition(edge);
    const distance = Math.sqrt(
      Math.pow(x - buttonPos.x, 2) + Math.pow(y - buttonPos.y, 2)
    );
    
    if (distance <= 50) {  // Button radius
      const currentPlayer = getCurrentSelectingPlayer(
        state.seatingPhase.seatingOrder,
        state.seatingPhase.seatingIndex
      );
      
      dispatch({
        type: 'SELECT_EDGE',
        payload: {
          playerId: currentPlayer,
          edgeNumber: edge
        }
      });
      
      return;
    }
  }
}
```

### Reducer Logic

#### SELECT_EDGE Handler
```typescript
case 'SELECT_EDGE': {
  const { playerId, edgeNumber } = action.payload;
  const { seatingPhase } = state;
  
  // Validate edge is available
  if (!seatingPhase.availableEdges.includes(edgeNumber)) {
    return state;
  }
  
  // Validate it's this player's turn
  const currentPlayer = seatingPhase.seatingOrder[seatingPhase.seatingIndex];
  if (currentPlayer !== playerId) {
    return state;
  }
  
  // Update edge assignments
  const newEdgeAssignments = new Map(seatingPhase.edgeAssignments);
  newEdgeAssignments.set(playerId, edgeNumber);
  
  // Remove edge from available
  const newAvailableEdges = seatingPhase.availableEdges.filter(
    e => e !== edgeNumber
  );
  
  // Update player's edge position
  const updatedPlayers = state.players.map(p =>
    p.id === playerId ? { ...p, edgePosition: edgeNumber } : p
  );
  
  // Increment seating index
  const newSeatingIndex = seatingPhase.seatingIndex + 1;
  
  // Check if seating is complete
  const seatingComplete = newSeatingIndex >= seatingPhase.seatingOrder.length;
  
  if (seatingComplete) {
    // Transition to gameplay
    const gameplayOrder = determineGameplayOrder(
      updatedPlayers,
      seatingPhase.seatingOrder
    );
    
    // Update current player index to start with first player from seating order
    const startingPlayerId = seatingPhase.seatingOrder[0];
    const currentPlayerIndex = updatedPlayers.findIndex(
      p => p.id === startingPlayerId
    );
    
    return {
      ...state,
      players: updatedPlayers,
      currentPlayerIndex,
      seatingPhase: {
        ...seatingPhase,
        active: false,
        edgeAssignments: newEdgeAssignments,
        availableEdges: newAvailableEdges,
        seatingIndex: newSeatingIndex,
      },
      screen: 'gameplay',
      phase: 'playing',
    };
  }
  
  // Continue seating phase
  return {
    ...state,
    players: updatedPlayers,
    seatingPhase: {
      ...seatingPhase,
      edgeAssignments: newEdgeAssignments,
      availableEdges: newAvailableEdges,
      seatingIndex: newSeatingIndex,
    },
  };
}
```

## Alternative Designs Considered

### Alternative 1: Sequential Highlight
Instead of showing buttons on all available edges:
- Only highlight the current player's potential edges
- Player taps directly on an edge (not a button)
- Less visual clutter

**Rejected because:**
- Less clear which edges are selectable
- Harder to distinguish edge areas from board tiles
- Circular buttons are clearer tap targets

### Alternative 2: Pre-Assigned Edges with Swap
- Assign edges automatically (like current implementation)
- Allow players to swap positions before game starts
- More like physical game where players sit first, then rearrange

**Rejected because:**
- Doesn't follow the official rules (choose edges in order)
- More complex interaction model (who can swap with whom?)
- Doesn't provide the strategic element of edge selection order

### Alternative 3: List-Based Selection
- Show list of players in order on side of screen
- Show list of available edges
- Players select from list rather than tapping board

**Rejected because:**
- Less intuitive than directly tapping board
- Doesn't work well for multi-angle tabletop viewing
- Breaks visual continuity with board-focused design

## Edge Cases and Error Handling

### Invalid Edge Selection
- **Scenario**: Player taps an already-selected edge
- **Handling**: No action, edge button doesn't exist so tap has no target

### Out-of-Turn Selection
- **Scenario**: A player other than the current player tries to select
- **Handling**: Redux reducer validates player turn, ignores action if invalid

### Rapid Tapping
- **Scenario**: Player rapidly taps multiple edges
- **Handling**: First valid tap processes, subsequent taps during animation are ignored via state check

### Window Resize During Seating
- **Scenario**: Screen size changes during edge selection
- **Handling**: Renderer recalculates button positions, maintains state consistency

### Browser Back Button
- **Scenario**: User hits back during seating phase
- **Handling**: Same as corner X buttons - return to lobby, reset seating phase

## Testing Requirements

### Unit Tests
1. **Player order randomization**
   - Test uniform distribution over many runs
   - Test with different player counts (2-6)

2. **Edge assignment validation**
   - Test valid edge selection
   - Test invalid edge selection (already taken)
   - Test out-of-turn selection

3. **Gameplay order determination**
   - Test correct clockwise ordering by edge
   - Test starting player identification
   - Test with different player counts and edge combinations

4. **State transitions**
   - Test lobby → seating transition
   - Test seating → gameplay transition
   - Test state persistence during seating

### Integration Tests
1. **Full seating flow**
   - All players select edges in sequence
   - Verify final edge assignments
   - Verify gameplay order is correct

2. **Animation timing**
   - Button transitions smooth
   - No visual glitches
   - State updates synchronized with animations

### E2E Tests
1. **Complete game flow**
   - Lobby → Seating → Gameplay
   - All players select different edges
   - Game proceeds normally after seating

2. **Multi-player scenarios**
   - Test with 2, 3, 4, 5, and 6 players
   - Verify edge distribution appropriate for each count

3. **User interaction**
   - Tap buttons from different angles (for tabletop)
   - Rapid tapping doesn't break state
   - Visual feedback appears correctly

## Accessibility Considerations

### Color Blindness
- Use the existing color-blind friendly palette
- Player numbers provide non-color identification
- High contrast between button and text

### Touch Target Size
- Circular buttons: 80-100px diameter (exceeds 60px minimum)
- Well-spaced from adjacent elements
- Large enough for all hand sizes

### Multi-Angle Viewing
- Buttons rotated correctly for each edge
- No text that becomes unreadable from different angles
- Consistent circular shape recognizable from any angle

### Visual Feedback
- Clear indication of current player's turn
- Obvious visual change when edge is selected
- Smooth animations provide action feedback

## Performance Considerations

### Rendering
- Seating phase is relatively static (only updates on edge selection)
- Button rendering is lightweight (circles and text)
- Can optimize by caching button positions

### State Management
- Seating state is small (arrays and map)
- Updates are infrequent (one per edge selection)
- No performance concerns expected

### Animation
- Use requestAnimationFrame for smooth 60fps
- Animations are simple (fade, scale)
- No complex physics or particles

## Future Enhancements

### Visual Polish
- Particle effects when edge is selected
- Glow effect on available buttons
- More elaborate transition to gameplay

### Sound Effects
- Button press sound
- Edge selection confirmation sound
- Phase transition sound

### Strategic Information
- Show edge quality indicators (more/fewer connections)
- Highlight advantageous edges for current player count
- Display edge statistics

### Replay and Analysis
- Record edge selection order in game history
- Allow reviewing seating decisions in replays
- Analyze correlation between edge selection and victory

## Summary

The seating phase implementation adds an essential missing step to the game flow, bringing the digital implementation in line with the official rules. The design prioritizes:

1. **Clarity**: Circular buttons with player numbers make turn order obvious
2. **Simplicity**: Direct tap-to-select with minimal steps
3. **Consistency**: Matches the visual language of the existing game UI
4. **Accessibility**: Works for tabletop displays with multi-angle viewing
5. **Correctness**: Implements proper randomization and turn order rules

This phase seamlessly bridges the lobby and gameplay, providing players with the strategic choice of edge selection while maintaining the game's focus on board-centric, icon-based interaction suitable for tabletop displays.
