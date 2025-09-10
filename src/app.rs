use crate::ai_backend::EasyAiBackend;
use crate::backend::{Backend, InMemoryBackend};
use crate::game::{GameSettings, GameViewer};
use crate::game_ui::GameUi;
use crate::game_view::GameView;
use crate::server_backend::{ServerBackend, ServerCredentials};
use crate::server_protocol::{ReconnectToken, RoomId, Username};

use rand::distr::{SampleString, Uniform};
use rand::{rngs::StdRng, SeedableRng};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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
    pub fn new(server_ip: &str, credentials: ServerCredentials) -> Self {
        let backend = ServerBackend::new(server_ip, credentials).unwrap();
        Self {
            backend,
            current_room: None,
        }
    }

    pub fn create_room(&mut self, game_settings: GameSettings) {
        let mut rng =
            StdRng::seed_from_u64(chrono::Utc::now().timestamp_nanos_opt().unwrap() as u64);
        let alphabetic = Uniform::new('A', 'Z').unwrap();
        let room_id = alphabetic.sample_string(&mut rng, 4);
        self.backend.create_room(room_id.clone(), game_settings);
        self.set_current_room(room_id);
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

struct EasyAiMode {
    main_backend: EasyAiBackend,
    human_view: GameView,
    human_ui: GameUi,
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
        }
    }
}

enum State {
    Menu {
        server_ip: String,
        username: Username,
        reconnect_token: ReconnectToken,
    },
    InMemoryMode(InMemoryMode),
    EasyAiMode(EasyAiMode),
    ServerMode {
        server_ip: String,
        server_mode: ServerMode,
    },
}

#[derive(Serialize, Deserialize, Debug)]
struct ReconnectUser {
    username: Username,
    reconnect_token: ReconnectToken,
}

#[derive(Serialize, Deserialize, Default, Debug)]
struct PersistentState {
    saved_users: HashMap<String, HashMap<String, ReconnectUser>>,
}

const PERSISTENT_STORAGE_KEY: &str = "FLOWS_STATE";

pub struct FlowsApp {
    state: State,
    persistent_state: PersistentState,
    ai_debugging: bool,
}

impl FlowsApp {
    /// Called once before the first frame.
    pub fn new(cc: &eframe::CreationContext<'_>) -> Self {
        Self::new_with_ai_debugging(cc, false)
    }

    /// Called once before the first frame with AI debugging setting.
    pub fn new_with_ai_debugging(cc: &eframe::CreationContext<'_>, ai_debugging: bool) -> Self {
        let persistent_state = match cc.storage {
            None => Default::default(),
            Some(storage) => match storage.get_string(PERSISTENT_STORAGE_KEY) {
                None => Default::default(),
                Some(persistent_state_str) => match serde_json::from_str(&persistent_state_str) {
                    Err(_) => Default::default(),
                    Ok(state) => state,
                },
            },
        };
        println!("Loaded persistent state: {:?}", persistent_state);
        let server_ip = if cfg!(target_arch = "wasm32") {
            "ws://127.0.0.1:10213".into()
        } else {
            "127.0.0.1:10213".into()
        };
        Self {
            state: State::Menu {
                server_ip,
                username: "Test".into(),
                reconnect_token: "".into(),
            },
            persistent_state,
            ai_debugging,
        }
    }
}

impl eframe::App for FlowsApp {
    fn save(&mut self, storage: &mut dyn eframe::Storage) {
        // TODO: Load from storage first to see if some other instance of the app has overwritten
        // our current state and merge them or something.
        storage.set_string(
            PERSISTENT_STORAGE_KEY,
            serde_json::to_string(&self.persistent_state).unwrap(),
        );
        storage.flush();
    }

    /// Called each time the UI needs repainting, which may be many times per second.
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        let mut new_state = None;
        match &mut self.state {
            State::Menu {
                server_ip,
                username,
                reconnect_token,
            } => {
                egui::CentralPanel::default().show(ctx, |ui| {
                    ui.heading("Local");
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

                    ui.separator();

                    ui.heading("Server");

                    egui::Grid::new("server-form")
                        .num_columns(2)
                        .show(ui, |ui| {
                            ui.label("IP");
                            ui.text_edit_singleline(server_ip);
                            ui.end_row();
                            ui.label("Username");
                            ui.text_edit_singleline(username);
                            ui.end_row();
                        });
                    if ui.button("Join server").clicked() {
                        new_state = Some(State::ServerMode {
                            server_ip: server_ip.clone(),
                            server_mode: ServerMode::new(
                                &server_ip.clone(),
                                ServerCredentials::NewUser {
                                    username: username.clone(),
                                },
                            ),
                        });
                    }
                    for (server_ip, users) in self.persistent_state.saved_users.iter_mut() {
                        if users.len() > 0 {
                            ui.label(format!("Rejoin {} as:", server_ip));
                            egui::Grid::new(format!("server-rejoin-{}", server_ip))
                                .num_columns(2)
                                .show(ui, |ui| {
                                    let mut user_id_to_delete = None;
                                    for (user_id, user) in users.iter() {
                                        if ui.button(&user.username).clicked() {
                                            new_state = Some(State::ServerMode {
                                                server_ip: server_ip.clone(),
                                                server_mode: ServerMode::new(
                                                    &server_ip.clone(),
                                                    ServerCredentials::ExistingUser {
                                                        reconnect_token: user
                                                            .reconnect_token
                                                            .clone(),
                                                    },
                                                ),
                                            });
                                        }
                                        if ui.button("X").clicked() {
                                            user_id_to_delete = Some(user_id.clone());
                                        }
                                        ui.end_row();
                                    }
                                    if let Some(user_id) = user_id_to_delete {
                                        users.remove(&user_id);
                                    }
                                });
                        }
                    }
                });
            }
            State::InMemoryMode(in_memory_mode) => {
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
                    ctx,
                    player_view,
                    None,
                );
            }
            State::EasyAiMode(easy_ai_mode) => {
                // Update the main backend for AI logic
                easy_ai_mode.main_backend.update();

                let human_view = &mut easy_ai_mode.human_view;
                human_view.poll_backend();
                easy_ai_mode.human_ui.display(ctx, human_view, None);
                ctx.request_repaint_after_secs(1.0 / 60.0); // Keep updating for AI moves
            }
            State::ServerMode {
                server_ip,
                server_mode,
            } => {
                server_mode.backend.update();
                let my_user = server_mode.backend.my_user.as_ref();
                let my_user_id = my_user.map(|x| x.user_id);
                let my_reconnect_token = server_mode.backend.reconnect_token.as_ref();

                match (my_user, my_reconnect_token) {
                    (Some(user), Some(reconnect_token)) => {
                        self.persistent_state
                            .saved_users
                            .entry(server_ip.clone())
                            .or_default()
                            .insert(
                                user.user_id.to_string(),
                                ReconnectUser {
                                    username: user.username.clone(),
                                    reconnect_token: reconnect_token.clone(),
                                },
                            );
                    }
                    (_, _) => (),
                }

                if let Some(current_room) = &mut server_mode.current_room {
                    let mut go_back = false;
                    current_room.player_view.poll_backend();
                    current_room.player_ui.display(
                        ctx,
                        &mut current_room.player_view,
                        Some(&mut go_back),
                    );
                    if go_back {
                        server_mode.current_room = None;
                    }
                } else {
                    egui::CentralPanel::default().show(ctx, |ui| {
                        ui.horizontal(|ui| {
                            ui.label("Create game: ");
                            for i in vec![2, 3].into_iter() {
                                if ui.button(format!("{}-player", i)).clicked() {
                                    server_mode.create_room(GameSettings {
                                        num_players: i,
                                        version: 0,
                                    });
                                }
                            }
                        });
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
                    });
                }
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
