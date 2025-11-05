# Quortex

A web-based implementation of **Quortex** (also known as **Flows**), a strategic tile-placing game where players create flowing paths across a hexagonal board.

**[Play the game online](https://anicolao.github.io/quortextt/)**

## About the Game

Quortex is a strategic tile-placement game for 2-6 players where you build flowing paths across a hexagonal board. Players take turns drawing and placing tiles, trying to connect their board edge to the opposite side (or to their teammate's edge in multiplayer games) while preventing opponents from completing their own paths.

### Key Features

- **2-6 Players**: Supports individual play (2-3 players) and team play (4-6 players)
- **Strategic Depth**: Every placement must maintain legal paths for all players, creating complex tactical decisions
- **Canvas-Based Rendering**: Smooth animations and touch-optimized interface
- **Flow Visualization**: Real-time flow propagation showing connected paths for each player
- **Multiple Victory Conditions**: Win by completing your flow path or by constraining opponents' options

For complete game rules and mechanics, see **[docs/RULES.md](docs/RULES.md)**.

## Current Implementation Status

### ✅ Fully Implemented

- **Complete Game Logic** (398 unit tests, 98% coverage)
  - Hexagonal board system with configurable radius
  - All four tile types with rotation
  - Flow propagation algorithm
  - Legal move validation
  - Victory condition checking (flow completion and constraint)
  
- **Full Game Flow**
  - Player configuration screen (2-6 players)
  - Seating phase with edge selection
  - Complete gameplay with turn management
  - Game over screen with victory animations
  
- **Interactive Features**
  - Touch and mouse input handling
  - Tile placement and rotation
  - Supermove mechanic (pick up and replace tiles)
  - Legal move highlighting
  - Animated flow propagation
  
- **Rendering & UI**
  - Canvas-based rendering with layered architecture
  - Responsive hexagonal board layout
  - Flow visualization in player colors
  - Smooth animations for tile placement, rotation, and victory
  - Touch-optimized interface for tabletop play

### 🚧 Future Enhancements

- AI opponents (easy, medium difficulty levels)
- Multiplayer over network
- Game notation system for replay
- Advanced analytics and statistics
- Additional board sizes and variants

## Technology Stack

- **TypeScript** - Type-safe game logic and rendering
- **HTML5 Canvas** - Entire game interface rendered on canvas
- **Redux** - Immutable state management
- **Vite** - Fast development server and optimized production builds
- **Vitest** - Unit testing with 398 tests and 98% coverage
- **Playwright** - End-to-end testing with visual regression tests
- **GitHub Actions** - CI/CD pipeline with automated testing and deployment

## Getting Started

### Prerequisites

- **Node.js** v18 or later
- **npm** v9 or later

### Installation

1. Clone the repository:
```bash
git clone https://github.com/anicolao/quortextt.git
cd quortextt
```

2. Install dependencies:
```bash
npm install
```

### Development

Start the development server with hot module replacement:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Building

Build for production:
```bash
npm run build
```

The built files will be in the `dist` directory.

### Testing

Run unit tests in watch mode:
```bash
npm test
```

Run unit tests with coverage:
```bash
npm run test:coverage
```

Run end-to-end tests (requires Playwright browsers):
```bash
npx playwright install chromium
npm run test:e2e
```

## Project Structure

```
quortextt/
├── src/
│   ├── game/            # Pure game logic (immutable, fully tested)
│   │   ├── board.ts     # Hexagonal board utilities
│   │   ├── tiles.ts     # Tile types and flow patterns
│   │   ├── flows.ts     # Flow propagation algorithm
│   │   ├── legality.ts  # Legal move validation
│   │   ├── victory.ts   # Victory condition checking
│   │   └── types.ts     # Core type definitions
│   ├── redux/           # State management
│   │   ├── actions.ts   # Action creators
│   │   ├── gameReducer.ts # Game state reducer
│   │   ├── uiReducer.ts  # UI state reducer
│   │   ├── selectors.ts  # Memoized selectors
│   │   └── store.ts     # Redux store configuration
│   ├── rendering/       # Canvas rendering
│   │   ├── renderer.ts  # Main renderer
│   │   ├── lobbyRenderer.ts      # Configuration screen
│   │   ├── seatingRenderer.ts    # Seating phase
│   │   ├── gameplayRenderer.ts   # Active gameplay
│   │   ├── gameOverRenderer.ts   # Victory screen
│   │   └── layout.ts    # Layout calculations
│   ├── animation/       # Animation system
│   │   ├── registry.ts  # Animation registry
│   │   ├── processor.ts # Animation processing
│   │   └── victoryAnimations.ts # Victory celebrations
│   ├── input/           # User interaction handling
│   └── main.ts          # Application entry point
├── tests/
│   ├── game/            # Game logic unit tests
│   ├── e2e/            # End-to-end tests with screenshots
│   └── *.test.ts       # Redux and integration tests
├── docs/
│   ├── RULES.md        # Complete game rules and mechanics
│   ├── designs/        # Design documents and specifications
│   ├── dev/           # Development guides and debugging
│   └── testing/       # Testing strategies and documentation
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
└── playwright.config.ts
```

## Documentation

### For Players
- **[docs/RULES.md](docs/RULES.md)** - Complete game rules and strategy guide

### For Developers
- **[AGENTS.md](AGENTS.md)** - Guidelines for AI agents and contributors
- **[docs/dev/DEVELOPMENT.md](docs/dev/DEVELOPMENT.md)** - Development workflow and testing
- **[docs/designs/DESIGN_DOC.md](docs/designs/DESIGN_DOC.md)** - Architecture and implementation design
- **[docs/designs/UI_DESIGN.md](docs/designs/UI_DESIGN.md)** - Detailed UI specifications
- **[docs/dev/DEPLOYMENT.md](docs/dev/DEPLOYMENT.md)** - Deployment guide for GitHub Pages

### Testing Documentation
- **[docs/testing/user-stories.md](docs/testing/user-stories.md)** - E2E test scenarios
- **[docs/testing/flow-tests.md](docs/testing/flow-tests.md)** - Flow propagation test cases

## Contributing

Contributions are welcome! Before starting work:

1. Read **[AGENTS.md](AGENTS.md)** for development guidelines
2. Review **[docs/dev/DEVELOPMENT.md](docs/dev/DEVELOPMENT.md)** for workflow
3. Check **[docs/designs/DESIGN_DOC.md](docs/designs/DESIGN_DOC.md)** for architecture
4. Run tests before and after changes:
   ```bash
   npm run build
   npm test
   npm run test:e2e
   ```

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

Quortex/Flows is a strategic board game. This is an independent web implementation created for educational purposes and to make the game accessible online.

