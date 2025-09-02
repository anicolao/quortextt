use crate::backend::{Backend, InMemoryBackend};
use crate::game::*;
use crate::legality::{find_potential_path_for_team, Connection, Node};
use std::collections::{HashMap, HashSet, VecDeque};

/// Macro for conditional AI debugging output
macro_rules! ai_debug {
    ($self:expr, $($arg:tt)*) => {
        if $self.ai_debugging {
            println!($($arg)*);
        }
    };
}

/// A backend that adds Easy AI functionality to an InMemoryBackend
/// The AI player is always player 1, human is player 0
#[derive(Clone)]
pub struct EasyAiBackend {
    inner: InMemoryBackend,
    ai_player: Player,
    last_action_count: std::sync::Arc<std::sync::atomic::AtomicUsize>,
    ai_thinking: std::sync::Arc<std::sync::atomic::AtomicBool>,
    ai_debugging: bool,
}

// Helper to create a canonical representation of a node (inter-hex edge).
// The source hex must always be "smaller" than the destination hex.
fn canonical_node(mut pos1: TilePos, mut pos2: TilePos) -> Node {
    if pos1 > pos2 {
        std::mem::swap(&mut pos1, &mut pos2);
    }
    (pos1, pos2)
}

fn get_player_sides(player: Player) -> (Rotation, Rotation) {
    match player {
        0 => (Rotation(0), Rotation(3)),
        1 => (Rotation(2), Rotation(5)),
        2 => (Rotation(4), Rotation(1)),
        _ => panic!("Invalid player"),
    }
}

/// Checks if a set of required connections within a single hex can be
/// fulfilled by any single tile.
fn is_satisfiable(demands: &HashSet<Connection>) -> bool {
    if demands.is_empty() {
        return true;
    }
    // Iterate through all 4 tile types and 6 rotations
    for &tile_type in &[
        TileType::NoSharps,
        TileType::OneSharp,
        TileType::TwoSharps,
        TileType::ThreeSharps,
    ] {
        for i in 0..6 {
            let rotation = Rotation(i);
            let placed_tile = PlacedTile::new(tile_type, rotation);
            let provided_connections = placed_tile
                .all_flows()
                .into_iter()
                .map(|(mut d1, mut d2)| {
                    if d1 > d2 {
                        std::mem::swap(&mut d1, &mut d2);
                    }
                    (d1, d2)
                })
                .collect::<HashSet<_>>();

            if demands.is_subset(&provided_connections) {
                return true; // Found a tile configuration that satisfies all demands
            }
        }
    }
    false // No single tile can fulfill all demands
}

/// Helper function to compare two actions for equality
fn actions_equal(a1: &Action, a2: &Action) -> bool {
    match (a1, a2) {
        (
            Action::PlaceTile {
                player: p1,
                tile: t1,
                pos: pos1,
                rotation: r1,
            },
            Action::PlaceTile {
                player: p2,
                tile: t2,
                pos: pos2,
                rotation: r2,
            },
        ) => p1 == p2 && t1 == t2 && pos1 == pos2 && r1.0 == r2.0,
        (
            Action::DrawTile {
                player: p1,
                tile: t1,
            },
            Action::DrawTile {
                player: p2,
                tile: t2,
            },
        ) => p1 == p2 && t1 == t2,
        (
            Action::RevealTile {
                player: p1,
                tile: t1,
            },
            Action::RevealTile {
                player: p2,
                tile: t2,
            },
        ) => p1 == p2 && t1 == t2,
        (Action::InitializeGame(s1), Action::InitializeGame(s2)) => {
            s1.num_players == s2.num_players && s1.version == s2.version
        }
        _ => false,
    }
}

impl EasyAiBackend {
    pub fn new(settings: GameSettings, ai_debugging: bool) -> Self {
        let inner = InMemoryBackend::new(settings);
        Self {
            inner,
            ai_player: 1, // AI is always player 1
            last_action_count: std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0)),
            ai_thinking: std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)),
            ai_debugging,
        }
    }

    pub fn backend_for_viewer(&self, viewer: GameViewer) -> Self {
        Self {
            inner: self.inner.backend_for_viewer(viewer),
            ai_player: self.ai_player,
            last_action_count: self.last_action_count.clone(),
            ai_thinking: self.ai_thinking.clone(),
            ai_debugging: self.ai_debugging,
        }
    }

    /// Check if it's the AI's turn and make a move if so
    fn maybe_make_ai_move(&self) {
        // Only the main backend (with Admin viewer) should make AI moves
        if self.inner.viewer() != GameViewer::Admin {
            return;
        }

        // Check current action count to see if game state changed
        let current_action_count = self.inner.action_history().len();
        let last_processed = self
            .last_action_count
            .load(std::sync::atomic::Ordering::Relaxed);

        // Only process if the game state has changed and we're not already thinking
        if current_action_count == last_processed
            || self.ai_thinking.load(std::sync::atomic::Ordering::Relaxed)
        {
            return;
        }

        let (is_ai_turn, ai_tile, current_player, game_is_over) = self.inner.with_game(|game| {
            let outcome = game.outcome();
            let current_player = game.current_player();
            let game_is_over = outcome.is_some();

            if game_is_over {
                return (false, None, current_player, game_is_over); // Game is over
            }

            if current_player != self.ai_player {
                return (false, None, current_player, game_is_over); // Not AI's turn
            }

            // Check if AI has a tile to play
            let ai_tile = game.tile_in_hand(self.ai_player);
            (true, ai_tile, current_player, game_is_over)
        });

        if !is_ai_turn {
            // Update our last processed count even if it's not our turn
            self.last_action_count
                .store(current_action_count, std::sync::atomic::Ordering::Relaxed);
            ai_debug!(
                self,
                "AI: Not my turn (current player: {}, AI player: {}, game over: {:?})",
                current_player, self.ai_player, game_is_over
            );
            return;
        }

        if let Some(tile) = ai_tile {
            // Mark that we're thinking to prevent redundant calculations
            self.ai_thinking
                .store(true, std::sync::atomic::Ordering::Relaxed);

            ai_debug!(self, "AI: It's my turn! Looking for moves with tile {:?}", tile);

            // Find the best move for the AI
            if let Some(best_move) = self.find_best_ai_move(tile) {
                ai_debug!(self, "AI submitting move: {:?}", best_move);
                self.inner.submit_action(best_move);
                // Update the action count after our move
                let new_action_count = self.inner.action_history().len();
                self.last_action_count
                    .store(new_action_count, std::sync::atomic::Ordering::Relaxed);
            } else {
                ai_debug!(self, "AI could not find a valid move with tile {:?}", tile);
            }

            // Mark that we're done thinking
            self.ai_thinking
                .store(false, std::sync::atomic::Ordering::Relaxed);
        } else {
            ai_debug!(self, "AI: It's my turn but I have no tile to play");
        }
    }

    /// Find the best move for the AI using the Easy AI strategy
    fn find_best_ai_move(&self, ai_tile: TileType) -> Option<Action> {
        self.inner.with_game(|game| {
            ai_debug!(self, "AI: Finding best move for tile {:?}", ai_tile);
            // Generate all possible legal moves and check for immediate wins/losses
            let mut possible_moves = Vec::new();
            let mut winning_moves = Vec::new();
            let mut losing_moves = Vec::new();

            for row in 0..7 {
                for col in 0..7 {
                    let pos = TilePos::new(row, col);
                    if *game.tile(pos) == Tile::Empty {
                        for rotation in 0..6 {
                            let action = Action::PlaceTile {
                                player: self.ai_player,
                                tile: ai_tile,
                                pos,
                                rotation: Rotation(rotation),
                            };

                            // Check if this move is legal
                            let mut temp_game = game.clone();
                            if temp_game.apply_action(action.clone()).is_ok() {
                                // Check if this move results in a win or loss
                                temp_game.recompute_flows();
                                if let Some(outcome) = temp_game.outcome() {
                                    match outcome {
                                        GameOutcome::Victory(winners)
                                            if winners.contains(&self.ai_player) =>
                                        {
                                            winning_moves.push(action.clone());
                                        }
                                        GameOutcome::Victory(winners)
                                            if !winners.contains(&self.ai_player) =>
                                        {
                                            losing_moves.push(action.clone());
                                        }
                                        _ => {}
                                    }
                                }
                                possible_moves.push(action);
                            }
                        }
                    }
                }
            }

            ai_debug!(
                self,
                "AI: Found {} possible moves, {} winning, {} losing",
                possible_moves.len(),
                winning_moves.len(),
                losing_moves.len()
            );

            if possible_moves.is_empty() {
                return None;
            }

            // Always play a winning move if available
            if !winning_moves.is_empty() {
                ai_debug!(self, "AI: Playing winning move: {:?}", winning_moves[0]);
                return Some(winning_moves[0].clone());
            }

            // Evaluate each move and pick the best one (avoiding losing moves unless necessary)
            if losing_moves.len() == possible_moves.len() {
                // All moves are losing, so we have to pick one
                self.evaluate_moves(game, &possible_moves)
            } else {
                // Filter out losing moves for evaluation
                let non_losing_moves: Vec<Action> = possible_moves
                    .into_iter()
                    .filter(|m| !losing_moves.iter().any(|lm| actions_equal(m, lm)))
                    .collect();

                if non_losing_moves.is_empty() {
                    // This shouldn't happen, but handle gracefully
                    self.evaluate_moves(game, &losing_moves)
                } else {
                    self.evaluate_moves(game, &non_losing_moves)
                }
            }
        })
    }

    /// Evaluate a list of moves and return the best one
    fn evaluate_moves(&self, game: &Game, moves: &[Action]) -> Option<Action> {
        if moves.is_empty() {
            return None;
        }

        let mut best_move = &moves[0];
        let mut best_score = self.evaluate_move(game, &moves[0]);

        for move_action in &moves[1..] {
            let score = self.evaluate_move(game, move_action);
            if score > best_score {
                best_score = score;
                best_move = move_action;
            }
        }

        ai_debug!(self, "AI: Best move has score {:.2}: {:?}", best_score, best_move);
        Some(best_move.clone())
    }

    /// Find potential path starting from existing flows instead of starting edges
    /// This allows players to prioritize extending existing flows rather than starting new ones
    fn find_potential_path_from_existing_flows(
        &self,
        player: Player,
        game: &Game,
    ) -> Option<Vec<Node>> {
        // The queue stores tuples of (path_of_nodes, current_tip_of_path)
        let mut queue: VecDeque<(Vec<Node>, TilePos)> = VecDeque::new();
        let mut visited_nodes: HashSet<Node> = HashSet::new();

        let (_, goal_side) = get_player_sides(player);
        let goal_edges: HashSet<(TilePos, Direction)> =
            game.edges_on_board_edge(goal_side).into_iter().collect();
        let goal_hexes: HashSet<TilePos> = goal_edges.iter().map(|(pos, _)| *pos).collect();

        // 1. Find all existing flow positions for this player
        let mut flow_start_nodes: Vec<(Node, TilePos)> = Vec::new();

        for row in 0..7 {
            for col in 0..7 {
                let pos = TilePos::new(row, col);
                if let Tile::Placed(tile) = game.tile(pos) {
                    // Check each direction of this tile for the player's flow
                    for direction in Direction::all_directions() {
                        if tile.flow_cache(direction) == Some(player) {
                            // This tile has player's flow in this direction
                            // Find the neighbor in that direction to create a node
                            if let Some(neighbor_pos) = game.get_neighbor_pos(pos, direction) {
                                let node = canonical_node(pos, neighbor_pos);
                                // Only add if this edge hasn't been visited
                                if !visited_nodes.contains(&node) {
                                    flow_start_nodes.push((node, neighbor_pos));
                                    visited_nodes.insert(node);
                                }
                            }
                        }
                    }
                }
            }
        }

        ai_debug!(
            self,
            "AI: Found {} existing flow nodes for player {}",
            flow_start_nodes.len(),
            player
        );

        // If we don't have any existing flows, fall back to the original behavior
        if flow_start_nodes.is_empty() {
            ai_debug!(self, "AI: No existing flows found, falling back to standard BFS");
            return find_potential_path_for_team(player, game, &HashSet::new(), &HashMap::new());
        }

        // 2. Initialize queue with paths starting from existing flows
        for (start_node, neighbor_pos) in flow_start_nodes {
            queue.push_back((vec![start_node], neighbor_pos));
        }

        // 3. Perform BFS (similar to the original implementation)
        while let Some((path, current_pos)) = queue.pop_front() {
            let last_node = path.last().unwrap();
            let prev_pos = if last_node.0 == current_pos {
                last_node.1
            } else {
                last_node.0
            };

            // 4. Check for Goal
            if goal_hexes.contains(&current_pos) {
                let entry_dir = game.get_direction_towards(current_pos, prev_pos).unwrap();
                match *game.tile(current_pos) {
                    Tile::Placed(placed_tile) => {
                        let exit_dir = placed_tile.exit_from_entrance(entry_dir);
                        if goal_edges.contains(&(current_pos, exit_dir)) {
                            ai_debug!(
                                self,
                                "AI: Found path from existing flows with length {}",
                                path.len()
                            );
                            return Some(path); // Success!
                        }
                    }
                    Tile::Empty => {
                        // Find the goal directions for this specific hex
                        for (_, goal_exit_dir) in
                            goal_edges.iter().filter(|(pos, _)| *pos == current_pos)
                        {
                            let mut new_demand = (entry_dir, *goal_exit_dir);
                            if new_demand.0 > new_demand.1 {
                                std::mem::swap(&mut new_demand.0, &mut new_demand.1);
                            }
                            let mut all_demands = HashSet::new();
                            all_demands.insert(new_demand);

                            if is_satisfiable(&all_demands) {
                                ai_debug!(
                                    self,
                                    "AI: Found path from existing flows with length {}",
                                    path.len()
                                );
                                return Some(path); // Success!
                            }
                        }
                    }
                    Tile::NotOnBoard => {}
                }
            }

            // 5. Explore Neighbors
            let prev_pos = if last_node.0 == current_pos {
                last_node.1
            } else {
                last_node.0
            };

            match *game.tile(current_pos) {
                Tile::Placed(placed_tile) => {
                    // Path is forced by the tile's connections.
                    let entry_dir = game.get_direction_towards(current_pos, prev_pos).unwrap();
                    let exit_dir = placed_tile.exit_from_entrance(entry_dir);

                    if let Some(next_pos) = game.get_neighbor_pos(current_pos, exit_dir) {
                        let next_node = canonical_node(current_pos, next_pos);
                        if !visited_nodes.contains(&next_node) {
                            let mut new_path = path.clone();
                            new_path.push(next_node);
                            visited_nodes.insert(next_node);
                            queue.push_back((new_path, next_pos));
                        }
                    }
                }
                Tile::Empty => {
                    // Case 2: Path goes through an EMPTY hex. Any direction is possible.
                    for exit_dir in Direction::all_directions() {
                        if let Some(next_pos) = game.get_neighbor_pos(current_pos, exit_dir) {
                            if next_pos == prev_pos {
                                continue;
                            } // Don't go back

                            let next_node = canonical_node(current_pos, next_pos);
                            if visited_nodes.contains(&next_node) {
                                continue;
                            }

                            // Check for internal pathway contention
                            let entry_dir =
                                game.get_direction_towards(current_pos, prev_pos).unwrap();
                            let mut new_demand = (entry_dir, exit_dir);
                            if new_demand.0 > new_demand.1 {
                                std::mem::swap(&mut new_demand.0, &mut new_demand.1);
                            }
                            let mut all_demands = HashSet::new();
                            all_demands.insert(new_demand);

                            if !is_satisfiable(&all_demands) {
                                continue;
                            }

                            // Enqueue new path
                            let mut new_path = path.clone();
                            new_path.push(next_node);
                            visited_nodes.insert(next_node);
                            queue.push_back((new_path, next_pos));
                        }
                    }
                }
                Tile::NotOnBoard => {} // Should not happen in BFS
            }
        }

        None // No path found
    }

    /// Count the number of empty hexes in a path that need tiles to be placed
    /// This represents the number of tiles a player needs to place to complete their path
    fn count_tiles_needed_for_path(&self, path: &[Node], game: &Game) -> usize {
        let mut empty_hexes = HashSet::new();

        for node in path {
            let (pos1, pos2) = *node;

            // Check if either hex in this edge is empty and needs a tile
            if *game.tile(pos1) == Tile::Empty {
                empty_hexes.insert(pos1);
            }
            if *game.tile(pos2) == Tile::Empty {
                empty_hexes.insert(pos2);
            }
        }

        empty_hexes.len()
    }

    /// Evaluate how good a move is for the AI using tile-counting algorithm
    /// Returns a floating point score where higher scores are better
    /// Formula: tiles_human_needs / max(1, tiles_ai_needs)
    /// This prioritizes moves that reduce AI's tiles needed and increase human's tiles needed
    /// Special cases: +1000 for winning move, -1000 for losing move
    fn evaluate_move(&self, game: &Game, action: &Action) -> f64 {
        if let Action::PlaceTile {
            pos,
            rotation,
            tile,
            ..
        } = action
        {
            // Create a game state with this move applied
            let test_game = game.with_tile_placed(*tile, *pos, *rotation);

            // Check for immediate win/loss (this should be caught earlier, but double-check)
            if let Some(outcome) = test_game.outcome() {
                match outcome {
                    GameOutcome::Victory(winners) if winners.contains(&self.ai_player) => {
                        return 1000.0; // AI wins
                    }
                    GameOutcome::Victory(winners) if !winners.contains(&self.ai_player) => {
                        return -1000.0; // AI loses
                    }
                    _ => {}
                }
            }

            let human_player = 1 - self.ai_player; // Assumes 2-player game

            // Find potential paths for both players using the flow-based BFS
            // This allows both players to prioritize extending existing flows
            let ai_path = self.find_potential_path_from_existing_flows(self.ai_player, &test_game);
            let human_path = self.find_potential_path_from_existing_flows(human_player, &test_game);

            match (ai_path, human_path) {
                (Some(ai_path), Some(human_path)) => {
                    let ai_tiles_needed = self.count_tiles_needed_for_path(&ai_path, &test_game);
                    let human_tiles_needed =
                        self.count_tiles_needed_for_path(&human_path, &test_game);

                    ai_debug!(
                        self,
                        "AI: Move evaluation - AI needs {} tiles, Human needs {} tiles",
                        ai_tiles_needed, human_tiles_needed
                    );

                    let score = -30.0 / (human_tiles_needed as f64) - 1.2 * ai_tiles_needed as f64;

                    // Bonus for AI being closer to completion
                    if ai_tiles_needed == 0 {
                        1000.0 // AI can complete immediately
                    } else {
                        score
                    }
                }
                (Some(ai_path), None) => {
                    let ai_tiles_needed = self.count_tiles_needed_for_path(&ai_path, &test_game);
                    ai_debug!(
                        self,
                        "AI: Move evaluation - AI needs {} tiles, Human has no path",
                        ai_tiles_needed
                    );
                    // AI has a path, human doesn't - very good for AI
                    // Bonus for being closer to completion
                    if ai_tiles_needed == 0 {
                        1000.0
                    } else {
                        100.0 / (ai_tiles_needed as f64)
                    }
                }
                (None, Some(human_path)) => {
                    let human_tiles_needed =
                        self.count_tiles_needed_for_path(&human_path, &test_game);
                    ai_debug!(
                        self,
                        "AI: Move evaluation - AI has no path, Human needs {} tiles",
                        human_tiles_needed
                    );
                    // Human has a path, AI doesn't - very bad for AI
                    // Worse if human is closer to completion
                    if human_tiles_needed == 0 {
                        -1000.0
                    } else {
                        -100.0 / (human_tiles_needed as f64)
                    }
                }
                (None, None) => {
                    ai_debug!(self, "AI: Move evaluation - Neither player has a path");
                    // Neither player has a path - neutral
                    0.0
                }
            }
        } else {
            0.0
        }
    }
}

impl Backend for EasyAiBackend {
    fn update(&mut self) {
        self.inner.update();
        self.maybe_make_ai_move();
    }

    fn viewer(&self) -> GameViewer {
        self.inner.viewer()
    }

    fn actions_from_index(&self, index: usize) -> Vec<Action> {
        self.inner.actions_from_index(index)
    }

    fn submit_action(&self, action: Action) {
        self.inner.submit_action(action);
        // Note: We don't call maybe_make_ai_move here to avoid redundant calculations
        // The AI move will be triggered by the next update() call
    }
}
