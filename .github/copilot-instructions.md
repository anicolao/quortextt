# Flows - Tile-Placing Game

Flows is a Rust GUI application built with eframe/egui for creating a tile-placing game. It supports both native desktop and web deployment via WebAssembly, and includes a client-server architecture for multiplayer gaming.

**Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

## Working Effectively

### Bootstrap, Build, and Test the Repository

**Install Linux Dependencies (Required on Linux):**
```bash
sudo apt-get install libxcb-render0-dev libxcb-shape0-dev libxcb-xfixes0-dev libxkbcommon-dev libssl-dev
```

**Install Rust Dependencies:**
```bash
rustup target add wasm32-unknown-unknown
cargo install --locked trunk
```
- Installing Trunk takes 9-10 minutes. NEVER CANCEL. Set timeout to 15+ minutes.

**Core Build Commands:**
```bash
# Check native build (takes 4+ minutes)
cargo check --quiet --workspace --all-targets
# NEVER CANCEL: Set timeout to 8+ minutes

# Check WebAssembly build (takes 1m 45s)  
cargo check --quiet --workspace --all-features --lib --target wasm32-unknown-unknown
# NEVER CANCEL: Set timeout to 4+ minutes

# Native release build (takes 5+ minutes)
cargo build --release
# NEVER CANCEL: Set timeout to 10+ minutes

# Server-only release build (takes 25 seconds)
cargo build --bin server --no-default-features --release
# Timeout: 2+ minutes

# Web build (takes 1m 42s)
trunk build --release
# NEVER CANCEL: Set timeout to 4+ minutes
```

**Test Suite:**
```bash
# Run all tests (takes 6m 30s)
cargo test --quiet --workspace --all-targets --all-features  
# NEVER CANCEL: Set timeout to 10+ minutes

# Run doc tests
cargo test --quiet --workspace --doc
```

**Linting and Formatting:**
```bash
# Fix code formatting
cargo fmt --all

# Check formatting (fails if code needs formatting)
cargo fmt --all -- --check

# Note: Clippy currently has 19 errors that need fixing
# cargo clippy --quiet --workspace --all-targets --all-features -- -D warnings -W clippy::all
# Known clippy issues include: dead code warnings, write! macro usage, unnecessary clones, etc.
```

### Running the Application

**Native GUI Application:**
```bash
cargo run --release
```
- **Cannot run in headless environments** - requires DISPLAY/WAYLAND_DISPLAY environment variables
- In local environments with GUI, this launches the Flows game interface
- Shows a menu with "In-memory" and "Server" connection options

**Server Application:**
```bash
cargo run --bin server --no-default-features --release
```
- Starts a TCP server listening on port 10213
- Supports both WebSocket and raw TCP connections
- Handles up to 2 players, additional connections become spectators
- Server runs indefinitely until manually stopped

**Web Application:**
```bash
# Development server (with hot reload)
trunk serve
# Opens http://127.0.0.1:8080 - append #dev to skip service worker caching

# Production build 
trunk build --release
# Generates dist/ directory with static HTML/WASM files suitable for GitHub Pages
```

## Validation

**Always manually validate any new code by:**
1. Running the native build: `cargo build --release`
2. Running the server build: `cargo build --bin server --no-default-features --release`  
3. Running the web build: `trunk build --release`
4. Running the test suite: `cargo test --workspace --all-features`
5. Testing the format check: `cargo fmt --all -- --check`

**ALWAYS run the full check script before committing:**
```bash
./check.sh
```
- **Current Status: FAILS on clippy errors** - 19 clippy warnings need to be fixed
- Takes approximately 2-3 minutes to run the checks that pass
- Set timeout to 5+ minutes

**ALWAYS run format fixes before your final commit:**
```bash
cargo fmt --all
```

## Common Tasks

### Repository Structure
```
flows/
├── src/
│   ├── app.rs           # Main application UI and state management
│   ├── backend.rs       # In-memory game backend 
│   ├── game.rs          # Core game logic and rules
│   ├── game_ui.rs       # Game rendering and UI interactions
│   ├── game_view.rs     # Game state view abstraction
│   ├── lib.rs           # Library root with feature flags
│   ├── main.rs          # Native GUI application entry point
│   ├── server.rs        # WebSocket/TCP server entry point
│   ├── server_backend.rs # Server communication backend
│   └── server_protocol.rs # Client-server message protocol
├── assets/              # Web assets (icons, service worker)
├── .github/workflows/   # CI/CD pipelines
├── Cargo.toml          # Project configuration with GUI/server features
├── Trunk.toml          # Web build configuration
├── check.sh            # Local CI-like validation script
└── rust-toolchain      # Rust 1.89 with wasm32 target
```

### Key Features and Components

**Feature Flags:**
- `gui` (default): Enables eframe/egui GUI dependencies
- `server`: Enables server-specific functionality

**Build Targets:**
- Native: Desktop GUI application with eframe
- WebAssembly: Browser-based version via Trunk
- Server: Headless multiplayer server

**Game Components:**
- Hexagonal tile-based game board
- Client-server multiplayer architecture  
- In-memory single-player mode
- WebSocket and TCP protocol support

### CI/CD Integration

**GitHub Actions Workflows:**
- `rust.yml`: Main CI pipeline (check, test, fmt, clippy, build)
- `pages.yml`: Auto-deploy web version to GitHub Pages
- `typos.yml`: Spelling check

**Important CI Notes:**
- CI currently fails on clippy step due to 19 warnings
- All other checks (build, test, format) pass successfully
- Web deployment works but requires manual clippy fix first

### Known Issues and Workarounds

1. **Clippy Errors (19 total):**
   - Dead code warnings for unused `admin_view` field
   - Inefficient `write!` macro usage (should use `writeln!`)
   - Unnecessary `.clone()` calls on Copy types
   - Pattern matching that should use `if let`
   - Must be fixed for CI to pass

2. **GUI Limitations:**
   - Cannot run native GUI in headless environments
   - Requires X11/Wayland display server for testing

3. **Build Dependencies:**
   - Trunk installation takes 9+ minutes on first setup
   - Initial builds take 4-5 minutes due to large dependency tree
   - WebAssembly target must be explicitly added to Rust toolchain

### Development Tips

- Always use `--release` builds for performance testing
- Web development: Use `trunk serve` with `#dev` URL suffix to bypass caching
- Server testing: Connect to `localhost:10213` via WebSocket or raw TCP
- Game supports both 2-player competitive and spectator modes
- UI automatically rotates view for different players in multiplayer

Fixes #15.