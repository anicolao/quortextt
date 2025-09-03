use crate::ai_backend::EasyAiBackend;
use crate::backend::{Backend, InMemoryBackend};
use crate::game::{GameSettings, GameViewer};
use crate::game_ui::GameUi;
use crate::game_view::GameView;
use crate::server_backend::ServerBackend;

struct InMemoryMode {
    #[allow(dead_code)]
    admin_view: GameView,
    player_views: Vec<GameView>,
    player_uis: Vec<GameUi>,
    current_displayed_player: usize,
    displayed_action_count: usize,
    scores: Vec<usize>, // Win count for each player
    num_players: usize,
    last_game_action_count: usize, // To track when a new game starts
}

impl InMemoryMode {
    pub fn new(settings: GameSettings) -> Self {
        let num_players = settings.num_players;
        let backend = InMemoryBackend::new(settings);
        let player_views = (0..num_players)
            .map(|i| GameView::new(Box::new(backend.backend_for_viewer(GameViewer::Player(i)))))
            .collect::<Vec<_>>();
        let admin_view = GameView::new(Box::new(backend));
        Self {
            admin_view,
            player_views,
            player_uis: (0..num_players).map(|_| GameUi::new()).collect(),
            current_displayed_player: 0,
            displayed_action_count: 0,
            scores: vec![0; num_players],
            num_players,
            last_game_action_count: 0,
        }
    }

    pub fn reset_game(&mut self, settings: GameSettings) {
        let backend = InMemoryBackend::new(settings);
        self.player_views = (0..self.num_players)
            .map(|i| GameView::new(Box::new(backend.backend_for_viewer(GameViewer::Player(i)))))
            .collect::<Vec<_>>();
        self.admin_view = GameView::new(Box::new(backend));
        self.current_displayed_player = 0;
        self.displayed_action_count = 0;
        self.last_game_action_count = 0;
        // Note: scores are preserved across game resets
    }

    pub fn update_scores(&mut self, winners: &[usize]) {
        for &winner in winners {
            if winner < self.scores.len() {
                self.scores[winner] += 1;
            }
        }
    }
}

struct EasyAiMode {
    main_backend: EasyAiBackend,
    human_view: GameView,
    human_ui: GameUi,
    scores: Vec<usize>, // Win count for each player (0 = human, 1 = AI)
    last_game_action_count: usize,
}

impl EasyAiMode {
    pub fn new(settings: GameSettings, ai_debugging: bool) -> Self {
        let backend = EasyAiBackend::new(settings, ai_debugging);
        let human_view = GameView::new(Box::new(backend.backend_for_viewer(GameViewer::Player(0))));
        let human_ui = GameUi::new();
        Self {
            main_backend: backend,
            human_view,
            human_ui,
            scores: vec![0; 2], // Human and AI scores
            last_game_action_count: 0,
        }
    }

    pub fn reset_game(&mut self, settings: GameSettings) {
        self.main_backend = EasyAiBackend::new(settings, false);
        self.human_view = GameView::new(Box::new(
            self.main_backend.backend_for_viewer(GameViewer::Player(0)),
        ));
        self.last_game_action_count = 0;
        // Note: scores are preserved across game resets
    }

    pub fn update_scores(&mut self, winners: &[usize]) {
        for &winner in winners {
            if winner < self.scores.len() {
                self.scores[winner] += 1;
            }
        }
    }
}

struct ServerMode {
    player_view: GameView,
    player_ui: GameUi,
}

impl ServerMode {
    pub fn new(server_ip: &str) -> Self {
        let backend = ServerBackend::new(server_ip).unwrap();
        let player_view = GameView::new(Box::new(backend));
        let player_ui = GameUi::new();
        Self {
            player_view,
            player_ui,
        }
    }
}

enum State {
    Menu { server_ip: String },
    InMemoryMode(InMemoryMode),
    EasyAiMode(EasyAiMode),
    ServerMode(ServerMode),
}

pub struct FlowsApp {
    state: State,
    ai_debugging: bool,
}

impl Default for FlowsApp {
    fn default() -> Self {
        let server_ip = if cfg!(target_arch = "wasm32") {
            "ws://127.0.0.1:10213".into()
        } else {
            "127.0.0.1:10213".into()
        };
        Self {
            state: State::Menu { server_ip },
            ai_debugging: false, // Default disabled
        }
    }
}

impl FlowsApp {
    /// Called once before the first frame.
    pub fn new(_cc: &eframe::CreationContext<'_>) -> Self {
        Default::default()
    }

    /// Called once before the first frame with AI debugging setting.
    pub fn new_with_ai_debugging(_cc: &eframe::CreationContext<'_>, ai_debugging: bool) -> Self {
        let server_ip = if cfg!(target_arch = "wasm32") {
            "ws://127.0.0.1:10213".into()
        } else {
            "127.0.0.1:10213".into()
        };
        Self {
            state: State::Menu { server_ip },
            ai_debugging,
        }
    }
}

impl eframe::App for FlowsApp {
    /// Called each time the UI needs repainting, which may be many times per second.
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        let mut new_state = None;
        match &mut self.state {
            State::Menu { server_ip } => {
                egui::CentralPanel::default().show(ctx, |ui| {
                    if ui.button("In-memory").clicked() {
                        new_state = Some(State::InMemoryMode(InMemoryMode::new(GameSettings {
                            num_players: 2,
                            version: 0,
                        })));
                    }

                    if ui.button("Easy AI").clicked() {
                        new_state = Some(State::EasyAiMode(EasyAiMode::new(
                            GameSettings {
                                num_players: 2,
                                version: 0,
                            },
                            self.ai_debugging,
                        )));
                    }

                    ui.text_edit_singleline(server_ip);
                    if ui.button("Server").clicked() {
                        new_state = Some(State::ServerMode(ServerMode::new(server_ip)));
                    }
                });
            }
            State::InMemoryMode(in_memory_mode) => {
                // Check if game just ended and update scores
                let mut winners_to_update: Option<Vec<usize>> = None;
                let current_displayed_player = in_memory_mode.current_displayed_player;

                {
                    let player_view = &mut in_memory_mode.player_views[current_displayed_player];
                    let num_actions = player_view.poll_backend(false);
                    if num_actions > in_memory_mode.displayed_action_count
                        && in_memory_mode.displayed_action_count > 0
                    {
                        in_memory_mode.current_displayed_player += 1;
                        in_memory_mode.current_displayed_player %= in_memory_mode.player_uis.len();
                    }
                    in_memory_mode.displayed_action_count = num_actions;

                    if let Some(game) = player_view.game() {
                        let current_action_count = game.action_history_vec().len();
                        if let Some(outcome) = game.outcome() {
                            match outcome {
                                crate::game::GameOutcome::Victory(winners) => {
                                    // Only update scores once when game ends
                                    if current_action_count > in_memory_mode.last_game_action_count
                                    {
                                        winners_to_update = Some(winners.clone());
                                        in_memory_mode.last_game_action_count =
                                            current_action_count;
                                    }
                                }
                            }
                        }
                    }
                }

                // Update scores after borrowing from player_view is done
                if let Some(winners) = winners_to_update {
                    in_memory_mode.update_scores(&winners);
                }

                let player_view =
                    &mut in_memory_mode.player_views[in_memory_mode.current_displayed_player];
                let ui_response = in_memory_mode.player_uis
                    [in_memory_mode.current_displayed_player]
                    .display(ctx, player_view, &in_memory_mode.scores);

                if ui_response.play_again_requested {
                    in_memory_mode.reset_game(GameSettings {
                        num_players: in_memory_mode.num_players,
                        version: 0,
                    });
                }
            }
            State::EasyAiMode(easy_ai_mode) => {
                // Update the main backend for AI logic
                easy_ai_mode.main_backend.update();

                // Check if game just ended and update scores
                let mut winners_to_update: Option<Vec<usize>> = None;
                {
                    let human_view = &mut easy_ai_mode.human_view;
                    human_view.poll_backend(false);

                    if let Some(game) = human_view.game() {
                        let current_action_count = game.action_history_vec().len();
                        if let Some(outcome) = game.outcome() {
                            match outcome {
                                crate::game::GameOutcome::Victory(winners) => {
                                    // Only update scores once when game ends
                                    if current_action_count > easy_ai_mode.last_game_action_count {
                                        winners_to_update = Some(winners.clone());
                                        easy_ai_mode.last_game_action_count = current_action_count;
                                    }
                                }
                            }
                        }
                    }
                }

                // Update scores after borrowing from human_view is done
                if let Some(winners) = winners_to_update {
                    easy_ai_mode.update_scores(&winners);
                }

                let human_view = &mut easy_ai_mode.human_view;
                let ui_response =
                    easy_ai_mode
                        .human_ui
                        .display(ctx, human_view, &easy_ai_mode.scores);

                if ui_response.play_again_requested {
                    easy_ai_mode.reset_game(GameSettings {
                        num_players: 2,
                        version: 0,
                    });
                }

                ctx.request_repaint_after_secs(1.0 / 60.0); // Keep updating for AI moves
            }
            State::ServerMode(server_mode) => {
                let player_view = &mut server_mode.player_view;
                player_view.poll_backend(false);
                // For now, use empty scores for server mode
                let empty_scores = vec![0; 2];
                let _ui_response = server_mode
                    .player_ui
                    .display(ctx, player_view, &empty_scores);
                ctx.request_repaint_after_secs(1.0 / 60.0);
            }
        }

        // It seems dumb that we have to do this, maybe some nicer way to convince the borrow
        // checker to allow you to just set the state in the match. But this works.
        match new_state {
            None => (),
            Some(s) => self.state = s,
        }
    }
}
