# Quortex/Flows - TypeScript Implementation Design Document

## 1. Overview

This document outlines the implementation plan for a web-based version of Flows (Quortex) using TypeScript, Redux for state management, and either raw HTML5 Canvas or Threlte for rendering.

**Related Documents:**
- **[UI_DESIGN.md](UI_DESIGN.md)** - Detailed UI specifications for Phase 3 (Rendering) and Phase 4 (Input & Interaction), including touch and mouse interaction patterns, visual design, and E2E test specifications
- **[RULES.md](RULES.md)** - Complete game rules and mechanics

### Technology Stack
- **Language:** TypeScript
- **State Management:** Redux
- **Rendering Options:**
  - Option A: Raw HTML5 Canvas (current implementation)
  - Option B: Threlte (Svelte + Three.js wrapper for 3D)
- **Build Tool:** Vite
- **Testing:** Vitest (unit tests), Playwright (e2e tests)
- **Target Platforms:** Touch screens (primary), desktop browsers (secondary)

### Design Philosophy
- **Immutable state** managed through Redux
- **Pure functions** for game logic
- **Separation of concerns** between game logic, state management, and rendering
- **Type safety** throughout the codebase
- **Touch-first design** - all interactions achievable via tapping (no dragging required)

## 2. Architecture Overview

### 2.1 Core Modules

```
src/
├── game/              # Core game logic (pure functions)
│   ├── types.ts       # Game data structures
│   ├── board.ts       # Board representation and utilities
│   ├── tiles.ts       # Tile types and flow patterns
│   ├── legality.ts    # Legal move validation
│   ├── flows.ts       # Flow propagation logic
│   └── victory.ts     # Win condition checking
├── redux/             # State management
│   ├── store.ts       # Redux store configuration
│   ├── types.ts       # State type definitions
│   ├── actions.ts     # Action creators
│   ├── reducers/      # Reducers by domain
│   │   ├── index.ts   # Root reducer
│   │   ├── game.ts    # Game state reducer
│   │   ├── ui.ts      # UI state reducer
│   │   └── players.ts # Player state reducer
│   └── selectors.ts   # Memoized selectors
├── rendering/         # Display layer
│   ├── canvas/        # Canvas-based rendering
│   │   ├── renderer.ts
│   │   ├── board.ts   # Board rendering
│   │   ├── tiles.ts   # Tile rendering
│   │   └── flows.ts   # Flow visualization
│   ├── threlte/       # Alternative: Threlte rendering
│   │   └── ...
│   └── common/        # Shared rendering utilities
│       ├── colors.ts  # Color palette
│       └── layout.ts  # Layout calculations
├── input/             # User interaction
│   ├── mouse.ts       # Mouse/touch handling
│   └── keyboard.ts    # Keyboard handling
└── ai/                # AI opponents (future)
    ├── easy.ts        # Simple heuristic AI
    └── medium.ts      # Alpha-beta search AI

```

## 3. Data Structures

### 3.1 Core Game Types

```typescript
// Hexagonal board position
interface HexPosition {
  readonly row: number;  // Axial coordinates
  readonly col: number;
}

// Tile types based on sharp corners
enum TileType {
  NoSharps = 0,    // Basketball
  OneSharp = 1,    // Kimono
  TwoSharps = 2,   // Rink
  ThreeSharps = 3, // Sharps
}

// Six possible orientations (0-5, each is 60 degrees)
type Rotation = 0 | 1 | 2 | 3 | 4 | 5;

// Six directions on a hexagon
enum Direction {
  SouthWest = 0,
  West = 1,
  NorthWest = 2,
  NorthEast = 3,
  East = 4,
  SouthEast = 5,
}

// A tile placed on the board
interface PlacedTile {
  readonly type: TileType;
  readonly rotation: Rotation;
  readonly position: HexPosition;
}

// Flow connection on a tile (direction pairs)
type FlowConnection = [Direction, Direction];

// Player identification
interface Player {
  readonly id: string;
  readonly color: string;
  readonly edgePosition: number; // 0-5, which edge of hexagon
  readonly isAI: boolean;
}

// Team pairing (for 4-6 player games)
interface Team {
  readonly player1Id: string;
  readonly player2Id: string;
}
```

### 3.2 Game State

```typescript
interface GameState {
  // Game setup
  players: Player[];
  teams: Team[];  // Empty for 2-3 player games
  currentPlayerIndex: number;
  
  // Board state
  board: Map<string, PlacedTile>;  // Key: "row,col"
  availableTiles: TileType[];      // Shuffled deck
  currentTile: TileType | null;    // Tile in hand
  
  // Flow tracking
  flows: Map<string, Set<string>>; // Player ID -> set of hex positions
  
  // Game status
  phase: 'setup' | 'playing' | 'finished';
  winner: string | null;  // Player ID or Team ID
  winType: 'flow' | 'constraint' | 'tie' | null;
  
  // Move history
  moveHistory: Move[];
}

interface Move {
  readonly playerId: string;
  readonly tile: PlacedTile;
  readonly timestamp: number;
}
```

### 3.3 UI State

```typescript
interface UIState {
  // Current screen
  screen: 'configuration' | 'gameplay' | 'game-over';
  
  // Interaction state
  selectedPosition: HexPosition | null;
  hoveredPosition: HexPosition | null;
  currentRotation: Rotation;
  
  // Visual preferences
  showLegalMoves: boolean;
  showFlowMarkers: boolean;
  animationSpeed: number;
  
  // Canvas/viewport
  zoom: number;
  panOffset: { x: number; y: number };
}
```

## 4. Core Game Logic

### 4.1 Board Management

**Board Representation:**
- Use axial coordinates for hexagonal grid
- 37 playable positions in diamond shape
- Store tiles in an immutable Map structure

**Player Edges:**
Each player controls one edge of the hexagonal board. A "player's edge" consists of:
- The specific **hex positions** along that board edge (e.g., 4 hexagons for edge 0)
- The specific **hex edge directions** of those hexagons that face outward toward the board edge

For example, for edge 0 (NorthWest), the player's edge includes:
- Hex at (-3, 0): only the NorthWest hex edge
- Hex at (-3, 1): both West and NorthWest hex edges
- Hex at (-3, 2): both West and NorthWest hex edges
- Hex at (-3, 3): both West and NorthWest hex edges

This is important for flow propagation: flows only enter the board through the **hex edges that belong to the player's board edge**, not through all 6 edges of the hexagons on that board edge.

**Key Functions:**
```typescript
// Get all valid hex positions on the board
function getAllBoardPositions(): HexPosition[]

// Get neighboring positions for a hex
function getNeighbors(pos: HexPosition): HexPosition[]

// Check if a position is on the board
function isValidPosition(pos: HexPosition): boolean

// Get the direction from one position to a neighbor
function getDirection(from: HexPosition, to: HexPosition): Direction | null

// Get edge positions for a player based on their edge number
function getEdgePositions(edgeNumber: number): HexPosition[]

// Get edge positions with their specific hex edge directions
// Returns array of {pos, dir} pairs where dir indicates which hex edge
// faces the board edge and can accept flow from the player's edge
function getEdgePositionsWithDirections(edgeNumber: number): 
  Array<{ pos: HexPosition; dir: Direction }>
```

### 4.2 Tile System

**Tile Flow Patterns:**
Each tile type has predefined flow connections in default orientation:

```typescript
const TILE_FLOWS: Record<TileType, FlowConnection[]> = {
  [TileType.NoSharps]: [
    [Direction.SouthWest, Direction.NorthWest],  // Curved S
    [Direction.NorthEast, Direction.SouthEast],  // Curved S
    [Direction.West, Direction.East],            // Straight
  ],
  [TileType.OneSharp]: [
    [Direction.SouthWest, Direction.SouthEast],  // Sharp corner
    [Direction.NorthWest, Direction.East],       // Curved
    [Direction.West, Direction.NorthEast],       // Curved
  ],
  [TileType.TwoSharps]: [
    [Direction.SouthWest, Direction.SouthEast],  // Sharp
    [Direction.NorthWest, Direction.NorthEast],  // Sharp
    [Direction.West, Direction.East],            // Straight
  ],
  [TileType.ThreeSharps]: [
    [Direction.SouthWest, Direction.SouthEast],  // Sharp
    [Direction.NorthEast, Direction.East],       // Sharp
    [Direction.West, Direction.NorthWest],       // Sharp
  ],
};

// Apply rotation to get actual flow connections
function getFlowConnections(
  type: TileType, 
  rotation: Rotation
): FlowConnection[]

// Get the exit direction for a flow entering from a direction
function getFlowExit(
  tile: PlacedTile, 
  entryDirection: Direction
): Direction | null
```

### 4.3 Flow Propagation

**Flow Calculation:**
Flows spread from player edges through connected tiles.

**Important:** Flows only enter the board through the specific hex edges that belong to a player's board edge. For example, a hex on edge 0 (NorthWest) may have up to 2 of its 6 hex edges as entry points (e.g., both West and NorthWest directions), not all 6 directions. This ensures that flows correctly represent paths that connect from the player's edge.

The flow propagation algorithm:
1. For each player, get their edge positions with specific hex edge directions using `getEdgePositionsWithDirections()`
2. For each (position, direction) pair, trace the flow through connected tiles
3. Flows propagate by following the tile's flow paths from entry direction to exit direction
4. Flows continue into adjacent tiles until they reach a board edge or empty space

```typescript
// Calculate all flows for all players from current board state
function calculateFlows(
  board: Map<string, PlacedTile>,
  players: Player[]
): Map<string, Set<string>>

// Trace a single flow from a starting position and entry direction
function traceFlow(
  board: Map<string, PlacedTile>,
  startPos: HexPosition,
  startDirection: Direction
): Set<string>  // Set of "row,col" positions

// Check if two positions are flow-connected
function areConnected(
  board: Map<string, PlacedTile>,
  pos1: HexPosition,
  pos2: HexPosition,
  playerId: string
): boolean
```

### 4.4 Legal Move Validation

**Legality Check:**
A move is legal if it doesn't completely block any player/team from winning.

```typescript
// Check if placing a tile at a position is legal
function isLegalMove(
  board: Map<string, PlacedTile>,
  tile: PlacedTile,
  players: Player[],
  teams: Team[]
): boolean

// Find all potential paths for a player to victory
function findPotentialPaths(
  board: Map<string, PlacedTile>,
  player: Player,
  targetEdge: number
): HexPosition[][]

// Check if a player/team has any viable path to victory
function hasViablePath(
  board: Map<string, PlacedTile>,
  player: Player,
  targetEdge: number
): boolean
```

### 4.5 Victory Conditions

```typescript
// Check if any player/team has won
function checkVictory(
  board: Map<string, PlacedTile>,
  flows: Map<string, Set<string>>,
  players: Player[],
  teams: Team[]
): { winner: string | null; winType: 'flow' | 'constraint' | 'tie' | null }

// Check if a player's flow connects their edges
function checkFlowVictory(
  flows: Map<string, Set<string>>,
  player: Player,
  targetEdge: number
): boolean

// Check if current tile cannot be placed legally anywhere
function checkConstraintVictory(
  board: Map<string, PlacedTile>,
  currentTile: TileType,
  players: Player[],
  teams: Team[]
): boolean
```

## 5. Redux State Management

### 5.1 Action Types

```typescript
// Setup actions
interface SetupGameAction {
  type: 'SETUP_GAME';
  payload: {
    players: Player[];
    teams: Team[];
  };
}

interface ShuffleTilesAction {
  type: 'SHUFFLE_TILES';
  payload: {
    seed?: number;  // Optional for reproducibility
  };
}

// Gameplay actions
interface DrawTileAction {
  type: 'DRAW_TILE';
}

interface PlaceTileAction {
  type: 'PLACE_TILE';
  payload: {
    position: HexPosition;
    rotation: Rotation;
  };
}

interface RotateTileAction {
  type: 'ROTATE_TILE';
  payload: {
    rotation: Rotation;
  };
}

// UI actions
interface SetHoveredPositionAction {
  type: 'SET_HOVERED_POSITION';
  payload: HexPosition | null;
}

interface SetRotationAction {
  type: 'SET_ROTATION';
  payload: Rotation;
}

interface ToggleLegalMovesAction {
  type: 'TOGGLE_LEGAL_MOVES';
}

// Game flow actions
interface NextPlayerAction {
  type: 'NEXT_PLAYER';
}

interface EndGameAction {
  type: 'END_GAME';
  payload: {
    winner: string;
    winType: 'flow' | 'constraint' | 'tie';
  };
}

interface ResetGameAction {
  type: 'RESET_GAME';
}
```

### 5.2 Reducers

**Game Reducer:**
- Handles tile placement, flow updates, victory checking
- Pure functions with no side effects
- Returns new state objects (immutable updates)

**UI Reducer:**
- Manages interaction state
- Visual preferences
- Canvas viewport state

**Combined Root Reducer:**
```typescript
const rootReducer = combineReducers({
  game: gameReducer,
  ui: uiReducer,
});

type RootState = ReturnType<typeof rootReducer>;
```

### 5.3 Selectors

Use memoized selectors for derived state:

```typescript
// Get legal positions for current tile
const selectLegalPositions = createSelector(
  [(state: RootState) => state.game.board,
   (state: RootState) => state.game.currentTile,
   (state: RootState) => state.ui.currentRotation,
   (state: RootState) => state.game.players,
   (state: RootState) => state.game.teams],
  (board, currentTile, rotation, players, teams) => {
    // Calculate and return legal positions
  }
);

// Get current player
const selectCurrentPlayer = createSelector(
  [(state: RootState) => state.game.players,
   (state: RootState) => state.game.currentPlayerIndex],
  (players, index) => players[index]
);

// Get flows for rendering
const selectFlowsForRendering = createSelector(
  [(state: RootState) => state.game.flows,
   (state: RootState) => state.game.players],
  (flows, players) => {
    // Transform flows into renderable format
  }
);
```

## 6. Rendering

**For detailed rendering specifications, layouts, and visual design, see [UI_DESIGN.md](UI_DESIGN.md)**

### 6.1 Canvas Rendering (Current)

**Target Device:**
- Tabletop touch screen with players viewing from all angles
- No text (icons only)
- Board-focused layout (no UI bars)

**Screen Layout:**
- Board fills almost entire screen
- Light background represents "table" surface
- Exit buttons (X) in corners
- Player tiles appear by their board edges
- Checkmark/X buttons overlay board when tile placed

**Hexagon Layout:**
- Use pointy-top hexagons
- Calculate pixel coordinates from axial coordinates
- Responsive sizing based on viewport

**Rendering Layers:**
1. **Background:** Light "table" color
2. **Board:** Black hexagon with colored player edges
3. **Tiles:** Placed tiles with Bézier curve flow paths
4. **Tile Preview:** Current player's tile by their edge or on board
5. **Action Buttons:** Checkmark/X overlays when tile placed
6. **Exit Buttons:** X buttons in corners

**Key Components:**
```typescript
class BoardRenderer {
  renderBoard(state: GameState, uiState: UIState): void
  renderTile(tile: PlacedTile, highlight?: boolean): void
  renderFlows(flows: Map<string, Set<string>>, players: Player[]): void
  renderTilePreview(tile: TileType, rotation: Rotation, position: HexPosition | EdgePosition): void
  renderActionButtons(position: HexPosition, isLegal: boolean): void
}

// Coordinate conversion
function hexToPixel(hex: HexPosition, layout: Layout): { x: number; y: number }
function pixelToHex(point: { x: number; y: number }, layout: Layout): HexPosition
```

### 6.2 Threlte Alternative (Future)

If using Threlte for 3D rendering:
- 3D hexagonal tiles with proper lighting
- Animated tile placement
- Camera controls for viewing angle
- Smooth flow animations

**Threlte Setup:**
```typescript
// Example Threlte component structure
<Canvas>
  <Camera position={[0, 10, 10]} />
  <Lights />
  <HexBoard board={$gameState.board} />
  <FlowMarkers flows={$gameState.flows} />
  <TilePreview tile={$gameState.currentTile} />
</Canvas>
```

## 7. Input Handling

**For detailed interaction specifications and touch/mouse behaviors, see [UI_DESIGN.md](UI_DESIGN.md)**

### 7.1 Touch Input (Primary Target)

**Core Interactions (Tap Only):**
- Tap on hex position to place tile there
- Tap on tile itself to rotate:
  - Tap left side: rotate counter-clockwise
  - Tap right side: rotate clockwise
- Tap checkmark (✓) button to confirm placement
- Tap X button to pick up tile and return to hand
- No dragging, zoom, or pan gestures needed

```typescript
interface InputHandler {
  // Handle taps/clicks on hex positions
  handleTap(pixel: { x: number; y: number }): void
  
  // Handle taps on tile for rotation
  handleTileRotation(pixel: { x: number; y: number }, tilePosition: Position): void
  
  // Handle action buttons
  handleConfirm(): void
  handleCancel(): void
}
```

### 7.2 Mouse Input (Secondary Target)

**Enhanced Desktop Features:**
- Tile tracks mouse pointer continuously
- Snap-in behavior: after 3s hover on hex, tile snaps in (600ms animation)
- Snap-out behavior: move near hex edge (10%) to snap out (200ms animation)
- Click to immediately snap tile to hex
- Mouse wheel rotation (configurable N scroll steps = 60° rotation)

### 7.3 No Keyboard Support

All interactions via touch/mouse only. No keyboard shortcuts.

## 8. AI Implementation (Future)

### 8.1 Easy AI
- One-move lookahead
- Simple heuristic evaluation
- Avoid immediate losses
- Prioritize immediate wins

```typescript
class EasyAI {
  findBestMove(
    board: Map<string, PlacedTile>,
    tile: TileType,
    player: Player
  ): { position: HexPosition; rotation: Rotation }
  
  // Evaluation function
  evaluatePosition(
    board: Map<string, PlacedTile>,
    player: Player
  ): number
}
```

### 8.2 Medium AI
- Alpha-beta pruning search
- Depth-limited search (3-4 plies)
- Handle tile draw randomness
- Better position evaluation

```typescript
class MediumAI {
  search(
    board: Map<string, PlacedTile>,
    depth: number,
    alpha: number,
    beta: number,
    maximizing: boolean
  ): number
  
  evaluateBoard(
    board: Map<string, PlacedTile>,
    player: Player
  ): number
}
```

## 9. Implementation Phases

### Phase 1: Core Game Logic (Foundation) ✅ COMPLETE
- [x] Implement hexagonal coordinate system
- [x] Define tile types and flow patterns
- [x] Implement flow propagation algorithm
- [x] Implement legal move validation
- [x] Implement victory condition checking
- [x] Write comprehensive unit tests

### Phase 2: Redux State Management ✅ COMPLETE
- [x] Define basic state structure (configuration phase)
- [x] Implement configuration action creators
- [x] Implement configuration reducer with immutable updates
- [x] Expand state structure for gameplay (board, tiles, flows, teams)
- [x] Implement gameplay action creators
- [x] Implement gameplay reducer logic
- [x] Implement UI reducer
- [x] Create selectors for derived state
- [x] Set up Redux DevTools integration

### Phase 3: Rendering System
**For detailed specifications, see [UI_DESIGN.md](UI_DESIGN.md)**

- [ ] Implement hexagon coordinate-to-pixel conversion
- [ ] Render board hexagon with colored player edges on light background
- [ ] Render 37 hex positions
- [ ] Render placed tiles with Bézier curve flow paths
- [ ] Render flow paths in player colors
- [ ] Render current tile by player's edge
- [ ] Implement tile placement on board with preview
- [ ] Add checkmark and X button overlays
- [ ] Add animations for tile placement (200-400ms)
- [ ] Add rotation animation (450ms)
- [ ] Add flow update animation with pulse
- [ ] Responsive board sizing

### Phase 4: Input & Interaction  
**For detailed specifications, see [UI_DESIGN.md](UI_DESIGN.md)**

**Primary (Touch Screen):**
- [ ] Implement tap on hex to place tile
- [ ] Implement tap on tile to rotate (left = CCW, right = CW)
- [ ] Implement checkmark button (confirm placement)
- [ ] Implement X button (pick up tile)
- [ ] Add exit buttons in corners
- [ ] Add visual feedback for all touch interactions

**Secondary (Desktop/Mouse):**
- [ ] Implement tile tracking mouse pointer
- [ ] Implement snap-in behavior (3s hover → 600ms animation)
- [ ] Implement snap-out behavior (near edge → 200ms animation)
- [ ] Implement click to immediate snap
- [ ] Add mouse wheel rotation (configurable scroll steps)

### Phase 5: Game Flow & Polish
- [ ] Connect all pieces: input → actions → reducers → rendering
- [ ] Implement turn management
- [ ] Add player info display
- [ ] Add move history display
- [ ] Implement game over screen
- [ ] Add sound effects (optional)
- [ ] Polish animations and transitions

### Phase 6: AI Opponents (Future)
- [ ] Implement Easy AI
- [ ] Implement Medium AI
- [ ] Add AI difficulty selection to setup
- [ ] Test AI performance and balance

### Phase 7: Multiplayer (Future)
- [ ] Design WebSocket protocol
- [ ] Implement server backend
- [ ] Add lobby system
- [ ] Add spectator mode
- [ ] Handle network synchronization

## 10. Testing Strategy

**For detailed E2E test specifications, see [UI_DESIGN.md](UI_DESIGN.md#e2e-test-specifications)**

### 10.1 Unit Tests
- Test all pure game logic functions
- Test Redux reducers
- Test selectors
- Mock state for isolated testing
- **Target: 100% line coverage** (repository standard)

### 10.2 Integration Tests
- Test complete game flows
- Test state transitions
- Test flow propagation with complex boards
- Test Redux action → reducer → selector pipeline

### 10.3 E2E Tests (Playwright)

**Test Suites:**
1. **Rendering Tests:** Board, tiles, flows, animations, positioning
2. **Touch Interaction Tests:** Tap to place, rotate, confirm, cancel
3. **Mouse Interaction Tests:** Tracking, snap behavior, wheel rotation
4. **Game Flow Tests:** Full games, flow victory, constraint victory
5. **UI State Tests:** Exit dialogs, victory modals
6. **Error & Edge Cases:** Rapid tapping, resize, mixed input

**Test Targets:**
- Multiple browsers (Chrome, Firefox, Safari)
- Multiple screen sizes (800x600 minimum to large displays)
- Visual regression testing (screenshot comparison)

## 11. Performance Considerations

### 11.1 Optimization Strategies
- Use memoized selectors to avoid recalculation
- Implement efficient flow propagation (BFS/DFS)
- Use canvas layering to avoid full redraws
- Debounce hover events
- Use requestAnimationFrame for animations

### 11.2 Scalability
- Keep game logic pure and testable
- Separate rendering from game state
- Design for future features (AI, multiplayer)
- Use TypeScript for maintainability

## 12. Open Questions & Decisions

### Rendering Choice
- **Canvas (Current):** Lightweight, full control, good for 2D
- **Threlte:** More complex setup, beautiful 3D effects, harder to maintain

**Recommendation:** Start with Canvas, keep rendering layer modular to allow Threlte migration later.

### Tile Drawing Randomness
- Should players see the tile before placing? **Yes (per rules)**
- Should the deck be truly random or seeded? **Seeded for reproducibility**
- Display remaining tile counts? **Yes, helpful for strategy**

### Input Method
- **Primary target: Tabletop touch screen** - All gameplay via tapping tile and board (no UI buttons)
- **Rotation:** Tap on tile itself (left = counter-clockwise, right = clockwise)
- **Confirmation:** Checkmark/X buttons overlay board
- **Secondary target: Desktop/mouse** - Enhanced with tile tracking and snap behavior
- **No keyboard support** - Touch/mouse only

### Move Validation
- Validate on client only or server too? **Both for multiplayer**

### Animations
- Animate tile placement? **Yes, smooth UX** (200-400ms)
- Animate flow propagation? **Yes, helps understand game state** (pulse existing, then flow into new)
- Animate rotation? **Yes** (450ms smooth rotation)
- See [UI_DESIGN.md](UI_DESIGN.md) for animation specifications

## 13. Future Enhancements

- **Notation system:** Record and replay games (see NOTATION.md from Rust impl)
- **Game analysis:** Show flow path lengths, suggest moves
- **Tutorials:** Interactive tutorial for new players
- **Variants:** Custom board sizes, different rule sets
- **Statistics:** Track win rates, average game length
- **Themes:** Different visual styles, tile designs
- **Accessibility:** Screen reader support, colorblind modes
- **Mobile app:** Native mobile version with touch optimization

---

This design provides a solid foundation for implementing Quortex/Flows in TypeScript while maintaining flexibility for future enhancements and alternative rendering approaches.
