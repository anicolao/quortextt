use crate::backend::{Backend, InMemoryBackend};
use crate::game::*;

/// A backend that adds Easy AI functionality to an InMemoryBackend
/// The AI player is always player 1, human is player 0
#[derive(Clone)]
pub struct EasyAiBackend {
    inner: InMemoryBackend,
    ai_player: Player,
    last_action_count: std::sync::Arc<std::sync::atomic::AtomicUsize>,
    ai_thinking: std::sync::Arc<std::sync::atomic::AtomicBool>,
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
            // Generate all possible legal moves
            let mut possible_moves = Vec::new();
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
                                possible_moves.push(action);
                            }
                        }
                    }
                }
            }

            println!("AI: Found {} possible moves", possible_moves.len());
            if possible_moves.is_empty() {
                return None;
            }

            // Evaluate each move and pick the best one
            let mut best_move = &possible_moves[0];
            let mut best_score = self.evaluate_move(game, &possible_moves[0]);

            for move_action in &possible_moves[1..] {
                let score = self.evaluate_move(game, move_action);
                if score > best_score {
                    best_score = score;
                    best_move = move_action;
                }
            }

            println!("AI: Best move has score {}: {:?}", best_score, best_move);
            Some(best_move.clone())
        })
    }

    /// Evaluate how good a move is for the AI
    /// Higher scores are better
    fn evaluate_move(&self, game: &Game, action: &Action) -> i32 {
        if let Action::PlaceTile {
            pos,
            rotation,
            tile,
            ..
        } = action
        {
            // Create a game state with this move applied
            let test_game = game.with_tile_placed(*tile, *pos, *rotation);

            // Get the AI's target side (opposite of where AI starts)
            let ai_side = self.get_ai_start_side(&test_game);
            let target_side = (ai_side + 3) % 6;

            // Calculate how close AI flows are to the target
            let ai_progress = self.calculate_flow_progress(&test_game, self.ai_player, target_side);

            // Check if human is about to win and if this move can block
            let human_threat = self.assess_human_threat(&test_game);
            let blocking_value = if human_threat > 0 && self.can_block_human(&test_game, *pos) {
                human_threat * 100 // High priority for blocking
            } else {
                0
            };

            ai_progress + blocking_value
        } else {
            0
        }
    }

    /// Get which side the AI player starts from
    fn get_ai_start_side(&self, game: &Game) -> usize {
        for side in 0..6 {
            if game.player_on_side(Rotation(side as u8)) == Some(self.ai_player) {
                return side;
            }
        }
        2 // Default fallback, should not happen
    }

    /// Calculate how close the player's flows are to reaching the target side
    fn calculate_flow_progress(&self, game: &Game, player: Player, target_side: usize) -> i32 {
        // Check all positions on the target side to see if we have flow there
        for (pos, dir) in game.edges_on_board_edge(Rotation(target_side as u8)) {
            if let Tile::Placed(tile) = game.tile(pos) {
                if tile.flow_cache(dir) == Some(player) {
                    return 1000; // Already reached target = very high score
                }
            }
        }

        // Calculate distance of flows to target side
        // This is a simplified heuristic - count how many tiles have the player's flow
        let mut flow_tiles = 0;
        for row in 0..7 {
            for col in 0..7 {
                let pos = TilePos::new(row, col);
                if let Tile::Placed(tile) = game.tile(pos) {
                    for dir in Direction::all_directions() {
                        if tile.flow_cache(dir) == Some(player) {
                            flow_tiles += 1;
                            break; // Don't double count the same tile
                        }
                    }
                }
            }
        }

        // Simple heuristic: more flow tiles = better progress
        flow_tiles * 10
    }

    /// Assess how much of a threat the human player poses (about to win)
    fn assess_human_threat(&self, game: &Game) -> i32 {
        let human_player = 1 - self.ai_player; // Assumes 2-player game
        let human_side = self.get_human_start_side(game);
        let human_target_side = (human_side + 3) % 6;

        // Check if human can win in one move
        for (pos, dir) in game.edges_on_board_edge(Rotation(human_target_side as u8)) {
            if let Tile::Placed(tile) = game.tile(pos) {
                if tile.flow_cache(dir) == Some(human_player) {
                    return 200; // Human has already won or is very close
                }
            }
        }

        // Simple threat assessment: count human flow tiles near target
        let human_flow_progress =
            self.calculate_flow_progress(game, human_player, human_target_side);
        if human_flow_progress > 50 {
            // Threshold for "close to winning"
            100
        } else {
            0
        }
    }

    /// Get which side the human player starts from
    fn get_human_start_side(&self, game: &Game) -> usize {
        let human_player = 1 - self.ai_player;
        for side in 0..6 {
            if game.player_on_side(Rotation(side as u8)) == Some(human_player) {
                return side;
            }
        }
        0 // Default fallback
    }

    /// Check if placing at this position can block the human player
    fn can_block_human(&self, _game: &Game, pos: TilePos) -> bool {
        // Simple heuristic: placing near the center or human flow paths might block
        // This is a simplified implementation
        let center = TilePos::new(3, 3);
        let distance_to_center = (pos.row - center.row).abs() + (pos.col - center.col).abs();
        distance_to_center <= 2 // Close to center might be blocking
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
