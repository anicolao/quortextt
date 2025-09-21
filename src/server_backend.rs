use crate::backend::Backend;
use crate::game::*;
use crate::server_protocol::*;
use parking_lot::RwLock;
use std::collections::HashMap;
use std::sync::{Arc, Weak};

#[cfg(target_arch = "wasm32")]
mod server_connection {
    use crate::server_protocol::*;
    use parking_lot::RwLock;
    use std::collections::VecDeque;
    use wasm_sockets::{self, ConnectionStatus, PollingClient};

    pub struct ServerConnection {
        pending_sends: RwLock<VecDeque<ClientToServerMessage>>,
        polling_client: RwLock<PollingClient>,
    }

    impl ServerConnection {
        pub fn new(addr: &str) -> Self {
            let polling_client = RwLock::new(PollingClient::new(addr).unwrap());
            Self {
                pending_sends: RwLock::new(VecDeque::new()),
                polling_client,
            }
        }

        pub fn receive(&self) -> Vec<ServerToClientMessage> {
            let raw_messages = self.polling_client.write().receive();
            raw_messages
                .iter()
                .filter_map(|message| match message {
                    wasm_sockets::Message::Text(s) => {
                        match serde_json::from_str::<ServerToClientMessage>(&s) {
                            Ok(m) => Some(m),
                            Err(_) => None,
                        }
                    }
                    wasm_sockets::Message::Binary(_) => None,
                })
                .collect()
        }

        fn send_internal(&self, message: ClientToServerMessage) {
            self.polling_client
                .read()
                .send_string(&serde_json::to_string(&message).unwrap())
                .unwrap();
        }

        pub fn send_pending(&self) {
            if self.polling_client.read().status() == ConnectionStatus::Connected
                && !self.pending_sends.read().is_empty()
            {
                for message in self.pending_sends.write().drain(..) {
                    self.send_internal(message);
                }
            }
        }

        pub fn send(&self, message: ClientToServerMessage) {
            if self.polling_client.read().status() == ConnectionStatus::Connected {
                self.send_pending();
                self.send_internal(message);
            } else {
                self.pending_sends.write().push_back(message);
            }
        }
    }
}

#[cfg(not(target_arch = "wasm32"))]
mod server_connection {
    use crate::server_protocol::*;
    use parking_lot::RwLock;
    use std::collections::VecDeque;
    use std::io::{BufRead, BufReader, Write};
    use std::net::TcpStream;
    use std::sync::Arc;
    use std::thread::spawn;

    pub struct ServerConnection {
        stream: RwLock<TcpStream>,
        message_buffer: Arc<RwLock<VecDeque<ServerToClientMessage>>>,
    }

    impl ServerConnection {
        pub fn new(addr: &str) -> Self {
            let stream = TcpStream::connect(addr).unwrap();
            let message_buffer = Arc::new(RwLock::new(VecDeque::new()));

            let t_stream = stream.try_clone().unwrap();
            let t_message_buffer = message_buffer.clone();

            let _ = spawn(move || {
                let stream_reader = BufReader::new(t_stream);
                for line in stream_reader.lines() {
                    let line = match line {
                        Ok(line) => line,
                        Err(_) => break,
                    };
                    if let Ok(m) = serde_json::from_str::<ServerToClientMessage>(&line) {
                        t_message_buffer.write().push_back(m)
                    }
                }
            });

            Self {
                stream: RwLock::new(stream),
                message_buffer,
            }
        }

        pub fn receive(&self) -> Vec<ServerToClientMessage> {
            self.message_buffer.write().drain(..).collect()
        }

        pub fn send_pending(&self) {}

        pub fn send(&self, message: ClientToServerMessage) {
            self.stream
                .write()
                .write_all(serde_json::to_string(&message).unwrap().as_bytes())
                .unwrap();
            self.stream.write().write_all(b"\n").unwrap();
        }
    }
}

use server_connection::*;

pub struct RoomData {
    pub room_info: RoomInfo,
    pub actions: Vec<Action>,
}

pub struct ServerBackend {
    connection: Arc<ServerConnection>,
    pub my_user: Option<User>,
    pub reconnect_token: Option<ReconnectToken>,
    pub rooms: Vec<RoomPreview>,
    pub room_datas: HashMap<RoomId, Arc<RwLock<RoomData>>>,
}

pub struct ServerBackendGame {
    my_user: User,
    room_id: RoomId,
    room_data: Arc<RwLock<RoomData>>,
    server_connection: Weak<ServerConnection>,
}

pub enum ServerCredentials {
    NewUser { username: Username },
    ExistingUser { reconnect_token: ReconnectToken },
}

impl ServerBackend {
    pub fn new(addr: &str, credentials: ServerCredentials) -> std::io::Result<Self> {
        let connection = ServerConnection::new(addr);
        match credentials {
            ServerCredentials::NewUser { username } => {
                connection.send(ClientToServerMessage::LoginAsNewUser {
                    username: username.clone(),
                })
            }
            ServerCredentials::ExistingUser { reconnect_token } => {
                connection.send(ClientToServerMessage::LoginAsExistingUser {
                    reconnect_token: reconnect_token.clone(),
                })
            }
        }
        Ok(Self {
            connection: Arc::new(connection),
            my_user: None,
            reconnect_token: None,
            rooms: Vec::new(),
            room_datas: HashMap::new(),
        })
    }

    pub fn update(&mut self) {
        self.connection.send_pending();
        for message in self.connection.receive().into_iter() {
            println!("Received message from server: {:?}", message);
            match message {
                ServerToClientMessage::InvalidRequest { .. } => (),
                ServerToClientMessage::Connected {
                    your_user,
                    reconnect_token,
                } => {
                    self.my_user = Some(your_user);
                    self.reconnect_token = Some(reconnect_token);
                    // TODO: Persist reconnect token somehow
                }
                ServerToClientMessage::RoomsList { rooms } => self.rooms = rooms,
                ServerToClientMessage::RoomInfo { room_id, room_info } => {
                    match self.room_datas.get(&room_id) {
                        Some(room_data) => room_data.write().room_info = room_info,
                        None => {
                            self.room_datas.insert(
                                room_id,
                                Arc::new(RwLock::new(RoomData {
                                    room_info,
                                    actions: Vec::new(),
                                })),
                            );
                        }
                    }
                }
                ServerToClientMessage::RoomCurrentActions { room_id, actions } => {
                    match self.room_datas.get(&room_id) {
                        Some(room_data) => room_data.write().actions = actions,
                        None => (), // It's illegal to send the room's current actions before
                                    // information about the room
                    }
                }
                ServerToClientMessage::RoomAppendAction { room_id, action } => {
                    match self.room_datas.get(&room_id) {
                        Some(room_data) => room_data.write().actions.push(action),
                        None => (), // It's illegal to append an action before sending information about the room
                    }
                }
            }
        }
    }

    pub fn create_room(&self, room_id: RoomId, game_settings: GameSettings) {
        self.connection.send(ClientToServerMessage::CreateRoom {
            room_id,
            game_settings,
        });
    }

    pub fn spectate_room(&self, room_id: RoomId) {
        self.connection
            .send(ClientToServerMessage::SubscribeRoom { room_id });
    }

    pub fn join_room(&self, room_id: RoomId) {
        self.connection
            .send(ClientToServerMessage::JoinRoomGame { room_id });
    }

    pub fn game_backend_for_room(&mut self, room_id: RoomId) -> Option<ServerBackendGame> {
        match &self.my_user {
            None => None,
            Some(my_user) => {
                let room_data = self.room_datas.entry(room_id.clone()).or_insert_with(|| {
                    Arc::new(RwLock::new(RoomData {
                        room_info: RoomInfo {
                            // This is a bit of a hack, but we need to put something in the map
                            // so that once the game does load from the server, we can show it.
                            game_settings: Default::default(),
                            players: Vec::new(),
                            user_to_game_viewer: HashMap::new(),
                        },
                        actions: Vec::new(),
                    }))
                });
                Some(ServerBackendGame {
                    my_user: my_user.clone(),
                    room_id,
                    room_data: room_data.clone(),
                    server_connection: Arc::downgrade(&self.connection),
                })
            }
        }
    }
}

impl Backend for ServerBackendGame {
    fn update(&mut self) {
        // We rely on the underlying ServerBackend being recently updated
    }

    fn viewer(&self) -> GameViewer {
        match self
            .room_data
            .read()
            .room_info
            .user_to_game_viewer
            .get(&self.my_user.user_id)
        {
            Some(game_viewer) => *game_viewer,
            None => GameViewer::Spectator,
        }
    }

    fn actions_from_index(&self, index: usize) -> Vec<Action> {
        self.room_data
            .read()
            .actions
            .iter()
            .skip(index)
            .cloned()
            .collect()
    }

    fn submit_action(&self, action: Action) {
        match self.server_connection.upgrade() {
            Some(connection) => connection.send(ClientToServerMessage::SubmitAction {
                room_id: self.room_id.clone(),
                action,
            }),
            None => (),
        }
    }
}
