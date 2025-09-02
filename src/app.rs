use crate::backend::InMemoryBackend;
use crate::game::{GameSettings, GameViewer};
use crate::game_ui::GameUi;
use crate::game_view::GameView;
use crate::server_backend::{ServerBackend, ServerCredentials};
use crate::server_protocol::RoomId;

struct InMemoryMode {
    #[allow(dead_code)]
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

struct ServerModeRoom {
    room_id: RoomId,
    player_view: GameView,
    player_ui: GameUi,
}

struct ServerMode {
    backend: ServerBackend,
    current_room: Option<ServerModeRoom>,
}

impl ServerMode {
    pub fn new(server_ip: &str, username: String) -> Self {
        let backend =
            ServerBackend::new(server_ip, ServerCredentials::NewUser { username }).unwrap();
        Self {
            backend,
            current_room: None,
        }
    }

    pub fn set_current_room(&mut self, room_id: RoomId) {
        if let Some(game_backend) = self.backend.game_backend_for_room(room_id.clone()) {
            let player_view = GameView::new(Box::new(game_backend));
            let player_ui = GameUi::new();
            self.current_room = Some(ServerModeRoom {
                room_id,
                player_view,
                player_ui,
            });
        }
    }
}

enum State {
    Menu { server_ip: String, username: String },
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
            state: State::Menu {
                server_ip,
                username: "Test".into(),
            },
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
            State::Menu {
                server_ip,
                username,
            } => {
                egui::CentralPanel::default().show(ctx, |ui| {
                    if ui.button("In-memory").clicked() {
                        new_state = Some(State::InMemoryMode(InMemoryMode::new(GameSettings {
                            num_players: 2,
                            version: 0,
                        })));
                    }

                    ui.text_edit_singleline(server_ip);
                    ui.text_edit_singleline(username);
                    if ui.button("Server").clicked() {
                        new_state = Some(State::ServerMode(ServerMode::new(
                            &server_ip.clone(),
                            username.clone(),
                        )));
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
                    server_mode.backend.update();
                    let my_user_id = server_mode.backend.my_user.as_ref().map(|x| x.user_id);

                    if let Some(current_room) = &mut server_mode.current_room {
                        let mut go_back = false;
                        if ui.button("Back to lobby").clicked() {
                            go_back = true;
                        }
                        current_room.player_view.poll_backend();
                        current_room
                            .player_ui
                            .display(ui, ctx, &mut current_room.player_view);
                        if go_back {
                            server_mode.current_room = None;
                        }
                    } else {
                        if ui.button("Create 2-person game").clicked() {
                            server_mode.backend.create_room(GameSettings {
                                num_players: 2,
                                version: 0,
                            });
                        }
                        let mut room_to_view = None;
                        egui_extras::TableBuilder::new(ui)
                            .columns(egui_extras::Column::auto(), 3)
                            .column(egui_extras::Column::remainder())
                            .header(20.0, |mut header| {
                                header.col(|ui| {
                                    ui.strong("Room code");
                                });
                                header.col(|ui| {
                                    ui.strong("Settings");
                                });
                                header.col(|ui| {
                                    ui.strong("Players");
                                });
                                header.col(|ui| {
                                    ui.strong("Actions");
                                });
                            })
                            .body(|mut body| {
                                body.rows(20.0, server_mode.backend.rooms.len(), |mut row| {
                                    let room = &server_mode.backend.rooms[row.index()];
                                    row.col(|ui| {
                                        ui.label(&room.room_id);
                                    });
                                    row.col(|ui| {
                                        ui.label(format!(
                                            "{}/{} players",
                                            room.players.len(),
                                            room.game_settings.num_players
                                        ));
                                    });
                                    row.col(|ui| {
                                        let player_names: Vec<String> = room
                                            .players
                                            .iter()
                                            .map(|p| p.username.clone())
                                            .collect();
                                        ui.label(player_names.join(", "));
                                    });
                                    row.col(|ui| {
                                        let room_has_space =
                                            room.players.len() < room.game_settings.num_players;
                                        let user_in_room = room
                                            .players
                                            .iter()
                                            .any(|p| Some(p.user_id) == my_user_id);
                                        if room_has_space && !user_in_room {
                                            if ui.button("Join").clicked() {
                                                server_mode.backend.join_room(room.room_id.clone());
                                                room_to_view = Some(room.room_id.clone());
                                            }
                                        }
                                        if user_in_room {
                                            if ui.button("View").clicked() {
                                                server_mode
                                                    .backend
                                                    .spectate_room(room.room_id.clone());
                                                room_to_view = Some(room.room_id.clone());
                                            }
                                        } else {
                                            if ui.button("Spectate").clicked() {
                                                server_mode
                                                    .backend
                                                    .spectate_room(room.room_id.clone());
                                                room_to_view = Some(room.room_id.clone());
                                            }
                                        }
                                    });
                                });
                            });
                        if let Some(room_id) = room_to_view {
                            server_mode.set_current_room(room_id);
                        }
                    }
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
