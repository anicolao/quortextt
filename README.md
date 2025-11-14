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

### 🚧 In Progress

- **Multiplayer Server** - Node.js + Socket.IO backend with Discord OAuth authentication
  - Real-time gameplay support
  - Discord OAuth 2.0 login
  - JWT-based session management
  - Event sourcing architecture for game state

- **Discord Activity** - Play Quortex directly within Discord
  - Embedded web app using Discord Activities API
  - Discord SDK authentication
  - Full game experience in Discord client
  - See [Discord Activity Setup Guide](docs/dev/DISCORD_ACTIVITY_SETUP.md)

### 🚧 Future Enhancements

- AI opponents (easy, medium difficulty levels)
- Additional OAuth providers (Facebook, Google, Apple)
- Database persistence (MongoDB)
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

The application will be available at `http://localhost:5173` with:
- Multiplayer experience at `/` (default)
- Tabletop experience at `/tabletop.html`
- Discord Activity at `/discord/`

### Discord Activity

Play Quortex directly within Discord using Discord Activities:

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

**Setup Discord Activity:**

1. Create a Discord application at [Discord Developer Portal](https://discord.com/developers/applications)
2. Enable Activities in your application settings
3. Configure Activity URL: `http://localhost:5173/discord/` (development) or your production URL
4. Set `VITE_DISCORD_CLIENT_ID` in `.env` file
5. See [Discord Activity Setup Guide](docs/dev/DISCORD_ACTIVITY_SETUP.md) for detailed instructions

The Discord Activity at `http://localhost:5173/discord/` embeds the full game within Discord.

### Multiplayer Server

The multiplayer server provides real-time gameplay with authentication:

```bash
# Start the multiplayer server
npm run dev:server
```

The server will run on `http://localhost:3001`

**Setup OAuth Authentication:**

1. Create a Discord application at [Discord Developer Portal](https://discord.com/developers/applications)
2. Configure OAuth redirect: `http://localhost:3001/auth/discord/callback`
3. Create `.env` file with credentials (see `.env.example`)
4. See [docs/dev/OAUTH_SETUP.md](docs/dev/OAUTH_SETUP.md) for detailed setup instructions

**Test the OAuth flow:**

Open `auth-test.html` in a browser to test authentication. See [docs/dev/TESTING_OAUTH.md](docs/dev/TESTING_OAUTH.md) for testing guide.

### Building

Build for production:
```bash
npm run build
```

The built files will be in the `dist` directory:
- `dist/index.html` - Multiplayer experience (served at `/`)
- `dist/tabletop.html` - Tabletop experience (served at `/tabletop`)
- `dist/assets/` - Bundled JavaScript and CSS

For production deployment instructions, see **[PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md)**.

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
- **[PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md)** - Production deployment guide
- **[docs/dev/DEVELOPMENT.md](docs/dev/DEVELOPMENT.md)** - Development workflow and testing
- **[docs/designs/DESIGN_DOC.md](docs/designs/DESIGN_DOC.md)** - Architecture and implementation design
- **[docs/designs/UI_DESIGN.md](docs/designs/UI_DESIGN.md)** - Detailed UI specifications
- **[docs/dev/DEPLOYMENT.md](docs/dev/DEPLOYMENT.md)** - Detailed deployment options and strategies

### Multiplayer & Authentication
- **[docs/designs/WEB_MULTIPLAYER.md](docs/designs/WEB_MULTIPLAYER.md)** - Multiplayer architecture design
- **[docs/dev/OAUTH_SETUP.md](docs/dev/OAUTH_SETUP.md)** - OAuth authentication setup guide
- **[docs/dev/TESTING_OAUTH.md](docs/dev/TESTING_OAUTH.md)** - OAuth testing instructions

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

Quortex/Flows game design is Copyright 2025 Alexander Nicolaou. All rights reserved.

This is a web implementation created to make the game accessible online.

