use crate::backend::{Backend, InMemoryBackend};
use crate::game::*;
use crate::legality::Connection;
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
    evaluator: Box<dyn EvaluationStrategy>,
    last_action_count: std::sync::Arc<std::sync::atomic::AtomicUsize>,
    ai_thinking: std::sync::Arc<std::sync::atomic::AtomicBool>,
    ai_debugging: bool,
}

/// Trait for different AI evaluation strategies
pub trait EvaluationStrategy: Send + Sync {
    fn evaluate(&self, game: &Game, player: Player, ai_debugging: bool) -> f64;
    fn clone_box(&self) -> Box<dyn EvaluationStrategy>;
}

impl Clone for Box<dyn EvaluationStrategy> {
    fn clone(&self) -> Box<dyn EvaluationStrategy> {
        self.clone_box()
    }
}

/// An evaluation strategy based on the shortest path length for each player
#[derive(Clone)]
pub struct PathLengthEvaluator;

impl PathLengthEvaluator {
    pub fn new() -> Self {
        Self
    }

    /// Follow a flow of a single player's color from a starting position and direction
    /// until it hits an empty hex, a different player's flow, or the edge of the board.
    fn follow_flow(
        &self,
        mut pos: TilePos,
        mut entry_dir: Direction,
        player: Player,
        game: &Game,
    ) -> (TilePos, Direction) {
        loop {
            match *game.tile(pos) {
                Tile::Placed(tile) if tile.flow_cache(entry_dir) == Some(player) => {
                    let exit_dir = tile.exit_from_entrance(entry_dir);
                    if let Some(next_pos) = game.get_neighbor_pos(pos, exit_dir) {
                        pos = next_pos;
                        entry_dir = exit_dir.reversed();
                    } else {
                        return (pos, exit_dir); // Reached edge of board
                    }
                }
                _ => return (pos, entry_dir.reversed()), // Flow ended
            }
        }
    }

    /// Find the shortest path for a player to win, measured in the number of tiles
    /// that need to be placed.
    fn get_shortest_path_len(&self, player: Player, game: &Game) -> Option<usize> {
        let (start_side, goal_side) = get_player_sides(player);
        let goal_edges: HashSet<(TilePos, Direction)> =
            game.edges_on_board_edge(goal_side).into_iter().collect();

        // Dijkstra's algorithm
        let mut costs = HashMap::new(); // pos -> cost
        let mut predecessors = HashMap::new(); // pos -> prev_pos
        let mut pq = VecDeque::new(); // (cost, pos, prev_pos)

        // Initialize queue with all hexes on the starting side
        for (pos, dir) in game.edges_on_board_edge(start_side) {
            if *game.tile(pos) == Tile::Empty {
                pq.push_back((1, pos, pos)); // Cost 1, pos, dummy predecessor
                costs.insert(pos, 1);
                predecessors.insert(pos, pos);
            } else if let Tile::Placed(tile) = game.tile(pos) {
                if tile.flow_cache(dir) == Some(player) {
                    let (end_pos, _) = self.follow_flow(pos, dir, player, game);
                    if costs.get(&end_pos).map_or(true, |&c| c > 0) {
                        pq.push_back((0, end_pos, end_pos)); // Cost 0, pos, dummy predecessor
                        costs.insert(end_pos, 0);
                        predecessors.insert(end_pos, end_pos);
                    }
                }
            }
        }

        while let Some((cost, pos, prev_pos)) = pq.pop_front() {
            if cost > *costs.get(&pos).unwrap_or(&usize::MAX) {
                continue;
            }
            predecessors.insert(pos, prev_pos);

            // Check for goal condition
            if game.is_on_board_edge(pos, goal_side) {
                let entry_dir = game.get_direction_towards(pos, prev_pos).unwrap();
                for (_, goal_exit_dir) in goal_edges.iter().filter(|(p, _)| *p == pos) {
                    let mut new_demand = (entry_dir, *goal_exit_dir);
                    if new_demand.0 > new_demand.1 {
                        std::mem::swap(&mut new_demand.0, &mut new_demand.1);
                    }
                    if is_satisfiable(&HashSet::from([new_demand])) {
                        return Some(cost);
                    }
                }
            }

            // Explore neighbors
            for dir in Direction::all_directions() {
                if let Some(next_pos) = game.get_neighbor_pos(pos, dir) {
                    if *game.tile(next_pos) == Tile::Empty {
                        let new_cost = cost + 1;
                        if new_cost < *costs.get(&next_pos).unwrap_or(&usize::MAX) {
                            costs.insert(next_pos, new_cost);
                            pq.push_back((new_cost, next_pos, pos));
                        }
                    } else if let Tile::Placed(tile) = game.tile(next_pos) {
                        let entry_dir = dir.reversed();
                        if tile.flow_cache(entry_dir) == Some(player) {
                            let (end_pos, _) = self.follow_flow(next_pos, entry_dir, player, game);
                            if cost < *costs.get(&end_pos).unwrap_or(&usize::MAX) {
                                costs.insert(end_pos, cost);
                                pq.push_back((cost, end_pos, pos));
                            }
                        }
                    }
                }
            }
        }
        None // No path found
    }
}

impl EvaluationStrategy for PathLengthEvaluator {
    fn clone_box(&self) -> Box<dyn EvaluationStrategy> {
        Box::new(self.clone())
    }

    fn evaluate(&self, game: &Game, player: Player, ai_debugging: bool) -> f64 {
        if let Some(outcome) = game.outcome() {
            return match outcome {
                GameOutcome::Victory(winners) if winners.contains(&player) => {
                    if winners.len() == 1 {
                        1000.0 // Solo victory
                    } else {
                        500.0 // Shared victory (tie)
                    }
                }
                GameOutcome::Victory(_) => -1000.0, // A loss
            };
        }

        let opponent_player = 1 - player;

        let ai_tiles_needed = self.get_shortest_path_len(player, game);
        let human_tiles_needed = self.get_shortest_path_len(opponent_player, game);

        match (ai_tiles_needed, human_tiles_needed) {
            (Some(ai_needed), Some(human_needed)) => {
                if ai_debugging {
                    println!(
                        "AI Eval: ai_needed: {}, human_needed: {}",
                        ai_needed, human_needed
                    );
                }
                -1.2 * (ai_needed as f64) - 30.0 / (human_needed as f64)
            }
            (Some(ai_needed), None) => {
                if ai_debugging {
                    println!("AI Eval: ai_needed: {}, human_needed: None", ai_needed);
                }
                100.0 / (ai_needed as f64)
            }
            (None, Some(human_needed)) => {
                if ai_debugging {
                    println!("AI Eval: ai_needed: None, human_needed: {}", human_needed);
                }
                -100.0 / (human_needed as f64)
            }
            (None, None) => {
                if ai_debugging {
                    println!("AI Eval: ai_needed: None, human_needed: None");
                }
                0.0
            }
        }
    }
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
            evaluator: Box::new(PathLengthEvaluator::new()),
            last_action_count: std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0)),
            ai_thinking: std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)),
            ai_debugging,
        }
    }

    pub fn backend_for_viewer(&self, viewer: GameViewer) -> Self {
        Self {
            inner: self.inner.backend_for_viewer(viewer),
            ai_player: self.ai_player,
            evaluator: self.evaluator.clone(),
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
                current_player,
                self.ai_player,
                game_is_over
            );
            return;
        }

        if let Some(tile) = ai_tile {
            // Mark that we're thinking to prevent redundant calculations
            self.ai_thinking
                .store(true, std::sync::atomic::Ordering::Relaxed);

            ai_debug!(
                self,
                "AI: It's my turn! Looking for moves with tile {:?}",
                tile
            );

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
            let mut winning_moves = Vec::new();
            let mut losing_moves = Vec::new();

            let possible_moves = get_legal_moves(game, self.ai_player, ai_tile);

            for action in &possible_moves {
                // Check if this move results in a win or loss
                let mut temp_game = game.clone();
                if temp_game.apply_action(action.clone()).is_ok() {
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

        let mut best_move = None;
        let mut best_score = -f64::INFINITY;

        for move_action in moves {
            if let Action::PlaceTile {
                pos,
                rotation,
                tile,
                ..
            } = move_action
            {
                let test_game = game.with_tile_placed(*tile, *pos, *rotation);
                let score =
                    self.evaluator
                        .evaluate(&test_game, self.ai_player, self.ai_debugging);
                if score > best_score {
                    best_score = score;
                    best_move = Some(move_action.clone());
                }
            }
        }

        ai_debug!(
            self,
            "AI: Best move has score {:.2}: {:?}",
            best_score,
            best_move
        );
        best_move
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

/// A backend that adds Medium AI functionality to an InMemoryBackend
/// This AI uses alpha-beta search to find the best move.
#[derive(Clone)]
pub struct MediumAiBackend {
    inner: InMemoryBackend,
    ai_player: Player,
    evaluator: Box<dyn EvaluationStrategy>,
    search_depth: usize,
    last_action_count: std::sync::Arc<std::sync::atomic::AtomicUsize>,
    ai_thinking: std::sync::Arc<std::sync::atomic::AtomicBool>,
    ai_debugging: bool,
}

/// Helper to get all legal moves for a player
fn get_legal_moves(game: &Game, player: Player, tile: TileType) -> Vec<Action> {
    let mut moves = Vec::new();
    let unique_rotations = TileType::get_unique_rotations(tile);
    for row in 0..7 {
        for col in 0..7 {
            let pos = TilePos::new(row, col);
            if *game.tile(pos) == Tile::Empty {
                for &rotation in &unique_rotations {
                    let action = Action::PlaceTile {
                        player,
                        tile,
                        pos,
                        rotation,
                    };
                    let mut temp_game = game.clone();
                    if temp_game.apply_action(action.clone()).is_ok() {
                        moves.push(action);
                    }
                }
            }
        }
    }
    moves
}

impl MediumAiBackend {
    pub fn new(settings: GameSettings, search_depth: usize, ai_debugging: bool) -> Self {
        let inner = InMemoryBackend::new(settings);
        Self {
            inner,
            ai_player: 1, // AI is always player 1
            evaluator: Box::new(PathLengthEvaluator::new()),
            search_depth,
            last_action_count: std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0)),
            ai_thinking: std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)),
            ai_debugging,
        }
    }

    pub fn backend_for_viewer(&self, viewer: GameViewer) -> Self {
        Self {
            inner: self.inner.backend_for_viewer(viewer),
            ai_player: self.ai_player,
            evaluator: self.evaluator.clone(),
            search_depth: self.search_depth,
            last_action_count: self.last_action_count.clone(),
            ai_thinking: self.ai_thinking.clone(),
            ai_debugging: self.ai_debugging,
        }
    }

    /// Check if it's the AI's turn and make a move if so
    fn maybe_make_ai_move(&self) {
        if self.inner.viewer() != GameViewer::Admin {
            return;
        }

        let current_action_count = self.inner.action_history().len();
        let last_processed = self
            .last_action_count
            .load(std::sync::atomic::Ordering::Relaxed);

        if current_action_count == last_processed
            || self.ai_thinking.load(std::sync::atomic::Ordering::Relaxed)
        {
            return;
        }

        let (is_ai_turn, ai_tile) = self.inner.with_game(|game| {
            if game.outcome().is_some() || game.current_player() != self.ai_player {
                (false, None)
            } else {
                (true, game.tile_in_hand(self.ai_player))
            }
        });

        if !is_ai_turn {
            self.last_action_count
                .store(current_action_count, std::sync::atomic::Ordering::Relaxed);
            return;
        }

        if let Some(tile) = ai_tile {
            self.ai_thinking
                .store(true, std::sync::atomic::Ordering::Relaxed);
            ai_debug!(self, "AI (Medium): Thinking with tile {:?}...", tile);

            if let Some(best_move) = self.find_best_ai_move(tile) {
                ai_debug!(self, "AI (Medium) submitting move: {:?}", best_move);
                self.inner.submit_action(best_move);
                let new_action_count = self.inner.action_history().len();
                self.last_action_count
                    .store(new_action_count, std::sync::atomic::Ordering::Relaxed);
            } else {
                ai_debug!(
                    self,
                    "AI (Medium) could not find a valid move with tile {:?}",
                    tile
                );
            }

            self.ai_thinking
                .store(false, std::sync::atomic::Ordering::Relaxed);
        }
    }

    /// Find the best move for the AI using alpha-beta search
    fn find_best_ai_move(&self, ai_tile: TileType) -> Option<Action> {
        self.inner.with_game(|game| {
            let (_, best_move) = self.alpha_beta_search(
                game,
                self.search_depth,
                -f64::INFINITY,
                f64::INFINITY,
                true,
                ai_tile,
            );
            ai_debug!(self, "AI (Medium) chose move: {:?}", best_move);
            best_move
        })
    }

    /// Alpha-beta search implementation
    fn alpha_beta_search(
        &self,
        game: &Game,
        depth: usize,
        mut alpha: f64,
        mut beta: f64,
        maximizing_player: bool,
        tile_for_this_turn: TileType,
    ) -> (f64, Option<Action>) {
        if depth == 0 || game.outcome().is_some() {
            let score = self.evaluator.evaluate(game, self.ai_player, self.ai_debugging);
            return (score, None);
        }

        let current_player = game.current_player();
        let possible_moves = get_legal_moves(game, current_player, tile_for_this_turn);

        if possible_moves.is_empty() {
            return (self.evaluator.evaluate(game, self.ai_player, self.ai_debugging), None);
        }

        if maximizing_player {
            let mut max_eval = -f64::INFINITY;
            let mut best_move = possible_moves.get(0).cloned();
            for action in possible_moves {
                let mut temp_game = game.clone();
                if temp_game.apply_action(action.clone()).is_ok() {
                    // Opponent's turn is a chance node
                    let mut worst_case_eval = f64::INFINITY;
                    let possible_tiles = [
                        TileType::NoSharps,
                        TileType::OneSharp,
                        TileType::TwoSharps,
                        TileType::ThreeSharps,
                    ];
                    for tile_type in possible_tiles {
                        let (eval, _) = self.alpha_beta_search(
                            &temp_game,
                            depth - 1,
                            alpha,
                            beta,
                            false,
                            tile_type,
                        );
                        worst_case_eval = worst_case_eval.min(eval);
                    }

                    if worst_case_eval > max_eval {
                        max_eval = worst_case_eval;
                        best_move = Some(action);
                    }
                    alpha = alpha.max(worst_case_eval);
                    if beta <= alpha {
                        break;
                    }
                }
            }
            (max_eval, best_move)
        } else {
            // Minimizing player
            let mut min_eval = f64::INFINITY;
            let mut best_move = possible_moves.get(0).cloned();
            for action in possible_moves {
                let mut temp_game = game.clone();
                if temp_game.apply_action(action.clone()).is_ok() {
                    // AI's next turn is a chance node
                    let mut worst_case_eval = f64::INFINITY;
                    let possible_tiles = [
                        TileType::NoSharps,
                        TileType::OneSharp,
                        TileType::TwoSharps,
                        TileType::ThreeSharps,
                    ];
                    for tile_type in possible_tiles {
                        let (eval, _) = self.alpha_beta_search(
                            &temp_game,
                            depth - 1,
                            alpha,
                            beta,
                            true,
                            tile_type,
                        );
                        worst_case_eval = worst_case_eval.min(eval);
                    }

                    if worst_case_eval < min_eval {
                        min_eval = worst_case_eval;
                        best_move = Some(action);
                    }
                    beta = beta.min(worst_case_eval);
                    if beta <= alpha {
                        break;
                    }
                }
            }
            (min_eval, best_move)
        }
    }
}

impl Backend for MediumAiBackend {
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
    }
}
