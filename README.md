# Quortex

A web-based game implementation with a player configuration startup screen.

## Features

### Game Configuration Screen

The initial implementation includes a fully functional game configuration screen:

- **Add Players**: Click "Add Player" to add up to 6 players
- **Remove Players**: Click the × button to remove any player
- **Change Colors**: Click on a player's color swatch to open the color picker
- **Color-Blind Friendly**: Uses a scientifically validated palette of 6 colors
- **Start Game**: Begin gameplay once at least one player is configured

All UI is rendered on HTML5 Canvas using TypeScript with Redux state management.

## Technology Stack

- **TypeScript** for type-safe game logic and rendering
- **HTML5 Canvas** for the entire game interface (minimal HTML/CSS)
- **Redux** for state management
- **Vite** for development and building
- **Vitest** for unit testing
- **Playwright** for end-to-end testing

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm (v9 or later)

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

Start the development server:
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

Run unit tests:
```bash
npm test
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
│   ├── input/          # Input handling
│   ├── redux/          # State management
│   │   ├── actions.ts
│   │   ├── reducer.ts
│   │   ├── store.ts
│   │   └── types.ts
│   ├── rendering/      # Canvas rendering
│   │   ├── layout.ts
│   │   └── renderer.ts
│   └── main.ts         # Application entry point
├── tests/
│   ├── e2e/           # End-to-end tests
│   └── reducer.test.ts # Unit tests
├── docs/
│   ├── RULES.md       # Game rules
│   ├── designs/       # Design documents
│   ├── dev/          # Development guides
│   └── testing/      # Testing documentation
├── index.html
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── playwright.config.ts
```

## Documentation

- **[docs/RULES.md](docs/RULES.md)** - Complete game rules and mechanics
- **[docs/designs/](docs/designs/)** - Design documents and specifications
- **[docs/dev/](docs/dev/)** - Development guides and debugging information
- **[docs/testing/](docs/testing/)** - Testing strategies and documentation
- **[AGENTS.md](AGENTS.md)** - Guidelines for AI agents working on this codebase

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

