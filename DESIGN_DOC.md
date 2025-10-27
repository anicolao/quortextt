# Quortex/Flows - TypeScript Implementation Design Document

## 1. Overview

This document outlines the implementation plan for a web-based version of Flows (Quortex) using TypeScript, Redux for state management, and either raw HTML5 Canvas or Threlte for rendering.

### Technology Stack
- **Language:** TypeScript
- **State Management:** Redux
- **Rendering Options:**
  - Option A: Raw HTML5 Canvas (current implementation)
  - Option B: Threlte (Svelte + Three.js wrapper for 3D)
- **Build Tool:** Vite
- **Testing:** Vitest (unit tests), Playwright (e2e tests)

### Design Philosophy
- **Immutable state** managed through Redux
- **Pure functions** for game logic
- **Separation of concerns** between game logic, state management, and rendering
- **Type safety** throughout the codebase

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

```typescript
// Calculate all flows for all players from current board state
function calculateFlows(
  board: Map<string, PlacedTile>,
  players: Player[]
): Map<string, Set<string>>

// Trace a single flow from a starting position
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

### 6.1 Canvas Rendering (Current)

**Hexagon Layout:**
- Use pointy-top hexagons
- Calculate pixel coordinates from axial coordinates
- Support zoom and pan

**Rendering Layers:**
1. **Background:** Board outline and grid
2. **Tiles:** Placed tiles with flow paths
3. **Flows:** Colored flow markers
4. **Highlights:** Legal move indicators, hover effects
5. **UI:** Current tile preview, player info

**Key Components:**
```typescript
class BoardRenderer {
  renderBoard(state: GameState, uiState: UIState): void
  renderTile(tile: PlacedTile, highlight?: boolean): void
  renderFlows(flows: Map<string, Set<string>>, players: Player[]): void
  renderLegalMoves(positions: HexPosition[]): void
  renderCurrentTilePreview(tile: TileType, rotation: Rotation): void
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

### 7.1 Mouse/Touch Input

```typescript
interface InputHandler {
  // Handle clicks on hex positions
  handleClick(pixel: { x: number; y: number }): void
  
  // Handle hover for preview
  handleMove(pixel: { x: number; y: number }): void
  
  // Handle rotation input (scroll wheel, gestures)
  handleRotation(delta: number): void
  
  // Handle pan/zoom
  handlePan(delta: { x: number; y: number }): void
  handleZoom(delta: number): void
}
```

### 7.2 Keyboard Input

```typescript
// Keyboard shortcuts
const KEY_BINDINGS = {
  'r': 'ROTATE_TILE',          // Rotate clockwise
  'e': 'ROTATE_TILE_CCW',      // Rotate counter-clockwise
  'space': 'TOGGLE_LEGAL_MOVES',
  'z': 'UNDO',                 // Future: undo move
  'Escape': 'RETURN_TO_CONFIG',
};
```

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

### Phase 1: Core Game Logic (Foundation)
- [ ] Implement hexagonal coordinate system
- [ ] Define tile types and flow patterns
- [ ] Implement flow propagation algorithm
- [ ] Implement legal move validation
- [ ] Implement victory condition checking
- [ ] Write comprehensive unit tests

### Phase 2: Redux State Management
- [ ] Define complete state structure
- [ ] Implement all action creators
- [ ] Implement game reducer with immutable updates
- [ ] Implement UI reducer
- [ ] Create selectors for derived state
- [ ] Set up Redux DevTools integration

### Phase 3: Rendering System
- [ ] Implement hexagon coordinate-to-pixel conversion
- [ ] Render basic board grid
- [ ] Render placed tiles with flow paths
- [ ] Render flow markers for each player
- [ ] Implement hover and legal move highlighting
- [ ] Add current tile preview
- [ ] Add animations for tile placement

### Phase 4: Input & Interaction
- [ ] Implement mouse click handling
- [ ] Implement hover for position preview
- [ ] Implement tile rotation input
- [ ] Add keyboard shortcuts
- [ ] Implement pan and zoom controls
- [ ] Add touch/mobile support

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

### 10.1 Unit Tests
- Test all pure game logic functions
- Test Redux reducers
- Test selectors
- Mock state for isolated testing

### 10.2 Integration Tests
- Test complete game flows
- Test state transitions
- Test flow propagation with complex boards

### 10.3 E2E Tests
- Test complete game playthrough
- Test UI interactions
- Test victory conditions
- Test illegal move handling

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

### Move Validation
- Validate on client only or server too? **Both for multiplayer**
- Show all legal moves or let players figure it out? **Optional toggle**

### Animations
- Animate tile placement? **Yes, smooth UX**
- Animate flow propagation? **Yes, helps understand game state**
- Speed controls? **Yes, user preference**

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
