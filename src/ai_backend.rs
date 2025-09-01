use crate::backend::{Backend, InMemoryBackend};
use crate::game::*;
use crate::legality::{find_potential_path_for_team, Connection, Node};
use std::collections::{HashMap, HashSet};

/// A backend that adds Easy AI functionality to an InMemoryBackend
/// The AI player is always player 1, human is player 0
#[derive(Clone)]
pub struct EasyAiBackend {
    inner: InMemoryBackend,
    ai_player: Player,
    last_action_count: std::sync::Arc<std::sync::atomic::AtomicUsize>,
    ai_thinking: std::sync::Arc<std::sync::atomic::AtomicBool>,
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
    pub fn new(settings: GameSettings) -> Self {
        let inner = InMemoryBackend::new(settings);
        Self {
            inner,
            ai_player: 1, // AI is always player 1
            last_action_count: std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0)),
            ai_thinking: std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)),
        }
    }

    pub fn backend_for_viewer(&self, viewer: GameViewer) -> Self {
        Self {
            inner: self.inner.backend_for_viewer(viewer),
            ai_player: self.ai_player,
            last_action_count: self.last_action_count.clone(),
            ai_thinking: self.ai_thinking.clone(),
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
            println!(
                "AI: Not my turn (current player: {}, AI player: {}, game over: {:?})",
                current_player, self.ai_player, game_is_over
            );
            return;
        }

        if let Some(tile) = ai_tile {
            // Mark that we're thinking to prevent redundant calculations
            self.ai_thinking
                .store(true, std::sync::atomic::Ordering::Relaxed);

            println!("AI: It's my turn! Looking for moves with tile {:?}", tile);

            // Find the best move for the AI
            if let Some(best_move) = self.find_best_ai_move(tile) {
                println!("AI submitting move: {:?}", best_move);
                self.inner.submit_action(best_move);
                // Update the action count after our move
                let new_action_count = self.inner.action_history().len();
                self.last_action_count
                    .store(new_action_count, std::sync::atomic::Ordering::Relaxed);
            } else {
                println!("AI could not find a valid move with tile {:?}", tile);
            }

            // Mark that we're done thinking
            self.ai_thinking
                .store(false, std::sync::atomic::Ordering::Relaxed);
        } else {
            println!("AI: It's my turn but I have no tile to play");
        }
    }

    /// Find the best move for the AI using the Easy AI strategy
    fn find_best_ai_move(&self, ai_tile: TileType) -> Option<Action> {
        self.inner.with_game(|game| {
            println!("AI: Finding best move for tile {:?}", ai_tile);
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

            println!(
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
                println!("AI: Playing winning move: {:?}", winning_moves[0]);
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

        println!("AI: Best move has score {:.2}: {:?}", best_score, best_move);
        Some(best_move.clone())
    }

    /// Evaluate how good a move is for the AI using path-finding algorithm
    /// Returns a floating point score where higher scores are better
    /// Formula: length(opponent path) / length(my path)
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

            // Use empty sets for claimed edges and internal demands since we're just checking potential paths
            let claimed_edges: HashSet<Node> = HashSet::new();
            let internal_demands: HashMap<TilePos, HashSet<Connection>> = HashMap::new();

            // Find potential paths for both AI and human
            let ai_path = find_potential_path_for_team(
                self.ai_player,
                &test_game,
                &claimed_edges,
                &internal_demands,
            );

            let human_path = find_potential_path_for_team(
                human_player,
                &test_game,
                &claimed_edges,
                &internal_demands,
            );

            match (ai_path, human_path) {
                (Some(ai_path), Some(human_path)) => {
                    let ai_path_length = ai_path.len() as f64;
                    let human_path_length = human_path.len() as f64;

                    // Formula: opponent_path_length / my_path_length
                    // This rewards shorter AI paths (smaller denominator = larger score)
                    // and longer human paths (larger numerator = larger score)
                    if ai_path_length > 0.0 {
                        human_path_length / ai_path_length
                    } else {
                        // AI path length is 0, which shouldn't happen but handle gracefully
                        1000.0
                    }
                }
                (Some(_), None) => {
                    // AI has a path, human doesn't - very good for AI
                    100.0
                }
                (None, Some(_)) => {
                    // Human has a path, AI doesn't - very bad for AI
                    -100.0
                }
                (None, None) => {
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
