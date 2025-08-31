# Flows (Quortex)

[![Build Status](https://github.com/anicolao/flows/workflows/CI/badge.svg)](https://github.com/anicolao/flows/actions?workflow=CI)

Flows is a strategic tile-placing game also known as "Quortex". Players place hexagonal tiles to create flowing paths from their edge of the board to their goal, while strategically constraining opponents' options.

**Game Overview:**
- 2-6 players, ages 8+
- 25-35 minute play time  
- Strategic tile placement with path-building mechanics
- Both competitive and cooperative elements

You can play Flows natively on your desktop or in your web browser. The game supports both local single-player mode and networked multiplayer.

## Quick Start

**Play Online:** Visit [https://anicolao.github.io/flows/](https://anicolao.github.io/flows/) to play immediately in your browser.

**Local Installation:**
1. [Install Rust](https://rustup.rs/) if you haven't already
2. Clone this repository: `git clone https://github.com/anicolao/flows.git`
3. Run the game: `cargo run --release`

**Game Rules:** See [RULES.md](RULES.md) for complete gameplay instructions.

## How to Play

### Game Components
- **Hexagonal board** with colored border pieces (6 colored, 4 black)
- **40 game tiles** in 4 types (10 of each):
  - **No Sharps** (Basketball): Curved flowing paths
  - **One Sharp** (Kimono): One sharp corner connection  
  - **Two Sharps** (Rink): Two sharp angular connections
  - **Three Sharps** (Sharps): Three sharp angular connections
- **Player flow markers** in 6 colors

### Objective
Create a continuous path of your color from your edge of the board to the opposite side.

### Game Modes
- **2-3 players:** Individual competition - connect your edge to the opposite black edge
- **4-6 players:** Team play - teammates sit opposite each other and try to connect their edges
- **5 players:** One player has no teammate but gets an extra turn

### Basic Gameplay
1. Each player draws a tile face-down and places it anywhere on the board
2. When tiles connect to colored edges or other flowing tiles, flows automatically extend through the new pathways
3. Players must place tiles legally (see Rules for details)
4. First player/team to complete a path wins

For complete rules, strategies, and examples, see [RULES.md](RULES.md).

## Development and Technical Details

### System Requirements

**Linux Prerequisites:**
```bash
sudo apt-get install libxcb-render0-dev libxcb-shape0-dev libxcb-xfixes0-dev libxkbcommon-dev libssl-dev
```

**Fedora Prerequisites:**
```bash
dnf install clang clang-devel clang-tools-extra libxkbcommon-devel pkg-config openssl-devel libxcb-devel gtk3-devel atk fontconfig-devel
```

### Running the Game

**Desktop GUI:**
```bash
cargo run --release
```

**Server Mode (multiplayer):**
```bash
cargo run --bin server --no-default-features --release
```
Server runs on port 10213 and supports WebSocket and TCP connections.

### Web Development

**Setup:**
```bash
rustup target add wasm32-unknown-unknown
cargo install --locked trunk
```

**Development Server:**
```bash
trunk serve
```
Visit `http://127.0.0.1:8080` (append `#dev` to skip service worker caching)

**Production Build:**
```bash
trunk build --release
```
Generates a `dist/` directory for web deployment.

### Architecture

**Technologies:**
- **Language:** Rust 1.89+
- **GUI Framework:** [egui](https://github.com/emilk/egui) with [eframe](https://github.com/emilk/egui/tree/master/crates/eframe)
- **Web Target:** WebAssembly via [Trunk](https://trunkrs.dev/)
- **Networking:** WebSocket and TCP support for multiplayer

**Game Modes:**
- **In-Memory:** Local single-player or pass-and-play
- **Server:** Networked multiplayer with spectator support

### Documentation

- **[RULES.md](RULES.md)** - Complete game rules and strategy
- **[NOTATION.md](NOTATION.md)** - Game notation system for recording moves
- **Source Code** - Well-documented Rust code with examples

### Contributing

This project uses standard Rust development tools:
- `cargo fmt` for code formatting
- `cargo clippy` for linting  
- `cargo test` for testing
- `./check.sh` for comprehensive validation

## License

Licensed under either of:
- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE))
- MIT License ([LICENSE-MIT](LICENSE-MIT))

at your option.
