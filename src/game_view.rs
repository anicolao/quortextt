use crate::backend::Backend;
use crate::game::*;

pub struct GameView {
    backend: Box<dyn Backend>,
    action_count: usize,
    history_cursor: Option<usize>,
    locally_applied_actions: bool,
    game: Option<Game>,
}

impl GameView {
    pub fn new(backend: Box<dyn Backend>) -> Self {
        let mut s = Self {
            backend,
            action_count: 0,
            history_cursor: None,
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

        if !new_actions.is_empty() || self.history_cursor.is_some() {
            if !self.locally_applied_actions && self.game.is_some() && self.history_cursor.is_none()
            {
                self.action_count += new_actions.len();
                let game = self.game.as_mut().unwrap();
                new_actions.into_iter().for_each(|action| {
                    let _ = game.apply_action(action);
                });
            } else {
                let all_actions = self.backend.action_history();
                self.action_count = all_actions.len();

                let actions_to_replay = if let Some(cursor) = self.history_cursor {
                    all_actions.into_iter().take(cursor + 1).collect()
                } else {
                    all_actions
                };

                self.game = Some(Game::from_actions(actions_to_replay).unwrap());
                self.locally_applied_actions = false;
            }
        }
        self.action_count
    }

    pub fn submit_action(&mut self, action: Action) -> Result<(), String> {
        self.history_cursor = None; // Always jump to live on new action
        self.poll_backend(); // Replay to get to latest state before applying the new action
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

    pub fn total_actions(&self) -> usize {
        self.action_count
    }

    pub fn history_cursor(&self) -> Option<usize> {
        self.history_cursor
    }

    pub fn go_to_live(&mut self) {
        if self.history_cursor.is_some() {
            self.history_cursor = None;
            self.poll_backend();
        }
    }

    fn find_prev_move(&self, from_index: usize) -> Option<usize> {
        self.backend
            .action_history()
            .iter()
            .enumerate()
            .take(from_index)
            .rfind(|(_, action)| matches!(action, Action::PlaceTile { .. }))
            .map(|(i, _)| i)
    }

    fn find_next_move(&self, from_index: usize) -> Option<usize> {
        self.backend
            .action_history()
            .iter()
            .enumerate()
            .skip(from_index + 1)
            .find(|(_, action)| matches!(action, Action::PlaceTile { .. }))
            .map(|(i, _)| i)
    }

    pub fn can_history_backward(&self) -> bool {
        let start_index = self.history_cursor.unwrap_or(self.action_count);
        if start_index == 0 {
            return false;
        }
        self.find_prev_move(start_index).is_some()
    }

    pub fn can_history_forward(&self) -> bool {
        if let Some(cursor) = self.history_cursor {
            self.find_next_move(cursor).is_some()
        } else {
            false
        }
    }

    pub fn history_backward(&mut self) {
        let start_index = self.history_cursor.unwrap_or(self.action_count);
        if start_index == 0 {
            return;
        }
        if let Some(prev_move_index) = self.find_prev_move(start_index) {
            self.history_cursor = Some(prev_move_index);
            self.poll_backend();
        }
    }

    pub fn history_forward(&mut self) {
        if let Some(cursor) = self.history_cursor {
            if let Some(next_move_index) = self.find_next_move(cursor) {
                self.history_cursor = Some(next_move_index);
            } else {
                self.history_cursor = None; // Go live
            }
            self.poll_backend();
        }
    }
}
