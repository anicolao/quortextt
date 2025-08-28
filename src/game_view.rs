use crate::backend::Backend;
use crate::game::*;

pub struct GameView {
    backend: Box<dyn Backend>,
    action_count: usize,
    locally_applied_actions: bool,
    game: Option<Game>,
}

impl GameView {
    pub fn new(backend: Box<dyn Backend>) -> Self {
        let mut s = Self {
            backend,
            action_count: 0,
            locally_applied_actions: false,
            game: None,
        };
        s.poll_backend();
        s
    }

    pub fn viewer(&self) -> GameViewer {
        self.backend.viewer()
    }

    pub fn poll_backend(&mut self) -> usize {
        self.backend.update();
        let new_actions = self.backend.actions_from_index(self.action_count);
        if !new_actions.is_empty() {
            if !self.locally_applied_actions && self.game.is_some() {
                self.action_count += new_actions.len();
                let game = self.game.as_mut().unwrap();
                new_actions.into_iter().for_each(|action| {
                    let _ = game.apply_action(action);
                });
            } else {
                // Just replay the whole game from the start
                // TODO: Once we add legality checking for PlaceTile actions, which might be expensive,
                // we'll probably want a way to turn it off while replaying games, and then do one
                // check at the end.
                let actions = self.backend.action_history();
                self.action_count = actions.len();
                self.game = Some(Game::from_actions(actions).unwrap());
                self.locally_applied_actions = false;
            }
        }
        self.action_count
    }

    pub fn submit_action(&mut self, action: Action) -> Result<(), String> {
        self.game
            .as_mut()
            .ok_or("Game not initialized".to_owned())?
            .apply_action(action.clone())?;
        self.locally_applied_actions = true;
        self.backend.submit_action(action);
        Ok(())
    }

    pub fn game(&self) -> &Option<Game> {
        &self.game
    }
}
