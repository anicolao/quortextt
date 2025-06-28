use crate::game::*;
use parking_lot::RwLock;
use rand::{rngs::StdRng, SeedableRng};
use std::sync::Arc;

/// A `Backend` represents a connection for a specific user to a system which:
/// - shows the history of actions in a game (with any actions the user cannot see hidden)
/// - can be polled for additional actions
/// - accepts actions to take in the game on the user's behalf
///
/// The backend could be a server, a direction connection(s) to peers, or an in-memory local game.
pub trait Backend {
    fn actions_from_index(&self, index: usize) -> Vec<Action>;
    fn submit_action(&self, action: Action);

    fn action_history(&self) -> Vec<Action> {
        self.actions_from_index(0)
    }
}

#[derive(Clone)]
pub struct InMemoryBackend {
    game: Arc<RwLock<Game>>,
    viewer: GameViewer,
}

impl InMemoryBackend {
    pub fn new(settings: GameSettings) -> Self {
        let mut game = Game::new(settings);
        let mut rng =
            StdRng::seed_from_u64(chrono::Utc::now().timestamp_nanos_opt().unwrap() as u64);
        game.do_automatic_actions(&mut rng);
        Self {
            game: Arc::new(RwLock::new(game)),
            viewer: GameViewer::Admin,
        }
    }

    pub fn backend_for_viewer(&self, viewer: GameViewer) -> Self {
        Self {
            game: self.game.clone(),
            viewer,
        }
    }
}

impl Backend for InMemoryBackend {
    fn actions_from_index(&self, index: usize) -> Vec<Action> {
        self.game
            .read()
            .actions_for_viewer(self.viewer)
            .skip(index)
            .cloned()
            .collect()
    }

    fn submit_action(&self, action: Action) {
        if !action.performable(self.viewer) {
            return;
        }
        let mut game = self.game.write();
        // TODO: Do something with the (player-independent) legality of this action
        let _ = game.apply_action(action);
        let mut rng =
            StdRng::seed_from_u64(chrono::Utc::now().timestamp_nanos_opt().unwrap() as u64);
        game.do_automatic_actions(&mut rng);
    }
}
