use crate::backend::InMemoryBackend;
use crate::game::{GameSettings, GameViewer};
use crate::game_ui::GameUi;
use crate::game_view::GameView;
use crate::server_backend::ServerBackend;

struct InMemoryMode {
    admin_view: GameView,
    player_views: Vec<GameView>,
    player_uis: Vec<GameUi>,
    current_displayed_player: usize,
    displayed_action_count: usize,
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
        }
    }
}

struct ServerMode {
    player_view: GameView,
    player_ui: GameUi,
}

impl ServerMode {
    pub fn new(server_ip: &String) -> Self {
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
    ServerMode(ServerMode),
}

pub struct FlowsApp {
    state: State,
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
        }
    }
}

impl FlowsApp {
    /// Called once before the first frame.
    pub fn new(_cc: &eframe::CreationContext<'_>) -> Self {
        Default::default()
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

                    ui.text_edit_singleline(server_ip);
                    if ui.button("Server").clicked() {
                        new_state = Some(State::ServerMode(ServerMode::new(&server_ip.clone())));
                    }
                });
            }
            State::InMemoryMode(in_memory_mode) => {
                egui::TopBottomPanel::top("top-panel").show(ctx, |ui| {
                    ui.horizontal(|ui| {
                        for i in 0..in_memory_mode.player_uis.len() {
                            ui.selectable_value(
                                &mut in_memory_mode.current_displayed_player,
                                i,
                                format!("Player {i}"),
                            );
                        }
                    });
                });
                egui::CentralPanel::default().show(ctx, |ui| {
                    let player_view =
                        &mut in_memory_mode.player_views[in_memory_mode.current_displayed_player];
                    let num_actions = player_view.poll_backend();
                    if num_actions > in_memory_mode.displayed_action_count
                        && in_memory_mode.displayed_action_count > 0
                    {
                        in_memory_mode.current_displayed_player += 1;
                        in_memory_mode.current_displayed_player %= in_memory_mode.player_uis.len();
                    }
                    in_memory_mode.displayed_action_count = num_actions;
                    in_memory_mode.player_uis[in_memory_mode.current_displayed_player].display(
                        ui,
                        ctx,
                        player_view,
                    );
                });
            }
            State::ServerMode(server_mode) => {
                egui::CentralPanel::default().show(ctx, |ui| {
                    let player_view = &mut server_mode.player_view;
                    player_view.poll_backend();
                    server_mode.player_ui.display(ui, ctx, player_view);
                });
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
