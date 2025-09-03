use flows::game::*;
use flows::server_protocol::*;

use rand::distr::{Alphanumeric, SampleString};
use std::collections::{HashMap, HashSet};
use tokio::io::AsyncBufReadExt;
use tokio::sync::{mpsc, oneshot};

use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::protocol::Message;

type ConnectionId = usize;

type Responder<T> = oneshot::Sender<Result<T, String>>;
enum ServerInternalMessage {
    SubscribeClient {
        client_writer: mpsc::Sender<ServerToClientMessage>,
        resp: Responder<ConnectionId>,
    },
    MessageFromClient {
        connection_id: ConnectionId,
        message: ClientToServerMessage,
    },
}

struct UserData {
    username: Username,
    reconnect_token: ReconnectToken,
}

struct RoomData {
    game_settings: GameSettings,
    user_to_game_viewer: HashMap<UserId, GameViewer>,
    players_joined: usize,
    actions_sent: usize,
    game: Game,
}

/// User- and game-related data. Things that would live in the database if we had
/// a database.
struct ServerData {
    next_user_id: UserId,
    reconnect_tokens: HashMap<ReconnectToken, UserId>,
    user_data: HashMap<UserId, UserData>,
    room_data: HashMap<RoomId, RoomData>,
}

impl ServerData {
    fn new() -> Self {
        Self {
            next_user_id: 0,
            reconnect_tokens: HashMap::new(),
            user_data: HashMap::new(),
            room_data: HashMap::new(),
        }
    }

    fn generate_user_id(&mut self) -> UserId {
        let new_user_id = self.next_user_id;
        self.next_user_id += 1;
        new_user_id
    }

    fn generate_reconnect_token(&mut self) -> ReconnectToken {
        let mut rng = rand::rng();
        loop {
            let token = Alphanumeric.sample_string(&mut rng, 16);
            if !self.reconnect_tokens.contains_key(&token) {
                break token;
            }
        }
    }

    fn refresh_reconnect_token(&mut self, user_id: UserId) {
        let existing_token = self
            .user_data
            .get(&user_id)
            .unwrap()
            .reconnect_token
            .clone();
        self.reconnect_tokens.remove(&existing_token);
        let new_token = self.generate_reconnect_token();
        self.reconnect_tokens.insert(new_token.clone(), user_id);
        self.user_data.get_mut(&user_id).unwrap().reconnect_token = new_token;
    }

    fn login_new_user(&mut self, username: Username) -> UserId {
        let reconnect_token = self.generate_reconnect_token();
        let user_id = self.generate_user_id();
        // TODO: Add username collision detection
        let user_data = UserData {
            username,
            reconnect_token: reconnect_token.clone(),
        };
        self.user_data.insert(user_id, user_data);
        self.reconnect_tokens.insert(reconnect_token, user_id);
        user_id
    }

    fn login_existing_user(&mut self, token: ReconnectToken) -> Result<UserId, String> {
        let user_id = *self
            .reconnect_tokens
            .get(&token)
            .ok_or("Invalid reconnect token".to_string())?;
        self.refresh_reconnect_token(user_id);
        Ok(user_id)
    }

    fn create_room(&mut self, room_id: RoomId, game_settings: GameSettings) -> Result<(), String> {
        if self.room_data.contains_key(&room_id) {
            return Err("Room already exists".into());
        }
        let mut rng = rand::rng();
        let mut game = Game::new(game_settings.clone());
        game.do_automatic_actions(&mut rng);
        let actions_sent = game.action_history_vec().len();
        let room_data = RoomData {
            game_settings,
            user_to_game_viewer: HashMap::new(),
            players_joined: 0,
            actions_sent,
            game,
        };
        self.room_data.insert(room_id.clone(), room_data);
        Ok(())
    }

    fn join_room_game(&mut self, user_id: UserId, room_id: RoomId) -> Result<(), String> {
        let room_data = self
            .room_data
            .get_mut(&room_id)
            .ok_or("Room does not exist".to_string())?;
        if room_data.players_joined >= room_data.game_settings.num_players {
            return Err("Game is already full".into());
        }
        if room_data.user_to_game_viewer.contains_key(&user_id) {
            return Err("User already playing in game".into());
        }
        let game_viewer = GameViewer::Player(room_data.players_joined);
        room_data.players_joined += 1;
        room_data.user_to_game_viewer.insert(user_id, game_viewer);
        Ok(())
    }

    fn submit_action(
        &mut self,
        user_id: UserId,
        room_id: RoomId,
        action: Action,
    ) -> Result<(), String> {
        let room_data = self
            .room_data
            .get_mut(&room_id)
            .ok_or("Room does not exist".to_string())?;
        let game_viewer = room_data
            .user_to_game_viewer
            .get(&user_id)
            .ok_or("User is not playing in game".to_string())?;
        if !action.performable(*game_viewer) {
            return Err("Player cannot perform action".into());
        }
        room_data.game.apply_action(action)?;
        let mut rng = rand::rng();
        room_data.game.do_automatic_actions(&mut rng);
        Ok(())
    }

    fn room_info(&self, room_id: &RoomId) -> RoomInfo {
        let room_data = self.room_data.get(room_id).unwrap();
        let players = room_data
            .user_to_game_viewer
            .keys()
            .map(|user_id| User {
                user_id: *user_id,
                username: self.user_data.get(user_id).unwrap().username.clone(),
            })
            .collect::<Vec<_>>();
        RoomInfo {
            game_settings: room_data.game_settings.clone(),
            players,
            user_to_game_viewer: room_data.user_to_game_viewer.clone(),
        }
    }
}

struct ServerInternal {
    // Server internal state. Things that relate to routing connections and messages around.
    message_rx: mpsc::Receiver<ServerInternalMessage>,
    client_writers: HashMap<ConnectionId, mpsc::Sender<ServerToClientMessage>>,
    next_connection_id: ConnectionId,
    connection_to_user_id: HashMap<ConnectionId, UserId>,
    // User- and game-related data.
    server_data: ServerData,
    // Other stuff
    room_listeners: HashMap<RoomId, HashSet<ConnectionId>>,
}

impl ServerInternal {
    fn new(message_rx: mpsc::Receiver<ServerInternalMessage>) -> Self {
        Self {
            message_rx,
            client_writers: HashMap::new(),
            next_connection_id: 0,
            connection_to_user_id: HashMap::new(),
            server_data: ServerData::new(),
            room_listeners: HashMap::new(),
        }
    }

    /// Returns Err(()) if the connection has been dropped.
    async fn send_message(
        &self,
        connection_id: ConnectionId,
        message: ServerToClientMessage,
    ) -> Result<(), ()> {
        let pipe = self.client_writers.get(&connection_id).ok_or(())?;
        pipe.send(message).await.map_err(|_| ())
    }

    async fn update_room_listeners(&mut self, room_id: RoomId) {
        let listeners = match self.room_listeners.get_mut(&room_id) {
            Some(listeners) => listeners,
            None => return,
        };
        let room_info = self.server_data.room_info(&room_id);
        let room_data = self.server_data.room_data.get(&room_id).unwrap();
        let actions_sent = room_data.actions_sent;
        let action_history = room_data.game.action_history_vec();
        listeners.retain(|connection_id| self.connection_to_user_id.contains_key(&connection_id));
        let listeners: Vec<_> = listeners.iter().cloned().collect();
        for connection_id in listeners.iter() {
            let user_id = self.connection_to_user_id.get(&connection_id).unwrap();
            let viewer = room_data
                .user_to_game_viewer
                .get(&user_id)
                .copied()
                .unwrap_or(GameViewer::Spectator);
            // Really, updating the room info (as opposed to the game actions) should be triggered
            // by separate changes and be sent out separately, but I'm being lazy and just sending
            // them both out every time either changes.
            if self
                .send_message(
                    *connection_id,
                    ServerToClientMessage::RoomInfo {
                        room_id: room_id.clone(),
                        room_info: room_info.clone(),
                    },
                )
                .await
                .is_err()
            {
                continue;
            }
            for action in action_history[actions_sent..].iter() {
                if action.visible(viewer) {
                    if self
                        .send_message(
                            *connection_id,
                            ServerToClientMessage::RoomAppendAction {
                                room_id: room_id.clone(),
                                action: action.clone(),
                            },
                        )
                        .await
                        .is_err()
                    {
                        continue;
                    }
                }
            }
        }
        self.server_data
            .room_data
            .get_mut(&room_id)
            .unwrap()
            .actions_sent = action_history.len();
    }

    async fn subscribe_to_room(&mut self, connection_id: ConnectionId, room_id: RoomId) {
        let room_info = self.server_data.room_info(&room_id);
        if self
            .send_message(
                connection_id,
                ServerToClientMessage::RoomInfo {
                    room_id: room_id.clone(),
                    room_info,
                },
            )
            .await
            .is_err()
        {
            return;
        }
        let room_data = self.server_data.room_data.get(&room_id).unwrap();
        let user_id = match self.connection_to_user_id.get(&connection_id) {
            Some(user_id) => user_id,
            None => return,
        };
        let viewer = room_data
            .user_to_game_viewer
            .get(&user_id)
            .copied()
            .unwrap_or(GameViewer::Spectator);
        self.send_message(
            connection_id,
            ServerToClientMessage::RoomCurrentActions {
                room_id: room_id.clone(),
                actions: room_data.game.actions_for_viewer(viewer).cloned().collect(),
            },
        )
        .await;
        self.room_listeners
            .entry(room_id)
            .or_default()
            .insert(connection_id);
    }

    async fn broadcast_rooms_list(&mut self, single_connection: Option<ConnectionId>) {
        let rooms = self
            .server_data
            .room_data
            .keys()
            .map(|room_id| {
                let RoomInfo {
                    game_settings,
                    players,
                    ..
                } = self.server_data.room_info(room_id);
                RoomPreview {
                    room_id: room_id.clone(),
                    game_settings,
                    players,
                }
            })
            .collect::<Vec<_>>();
        let connection_id_list = match single_connection {
            Some(cid) => vec![cid],
            None => self.client_writers.keys().copied().collect(),
        };
        for connection_id in connection_id_list.into_iter() {
            self.send_message(
                connection_id,
                ServerToClientMessage::RoomsList {
                    rooms: rooms.clone(),
                },
            )
            .await;
        }
    }

    fn generate_connection_id(&mut self) -> ConnectionId {
        let new_connection_id = self.next_connection_id;
        self.next_connection_id += 1;
        new_connection_id
    }

    async fn handle_message(
        &mut self,
        connection_id: ConnectionId,
        message: ClientToServerMessage,
    ) {
        println!("Connection {}: {:?}", connection_id, message);
        match message {
            ClientToServerMessage::LoginAsNewUser { username } => {
                let user_id = self.server_data.login_new_user(username);
                self.connection_to_user_id.insert(connection_id, user_id);
                let user_data = self.server_data.user_data.get(&user_id).unwrap();
                self.send_message(
                    connection_id,
                    ServerToClientMessage::Connected {
                        your_user: User {
                            user_id,
                            username: user_data.username.clone(),
                        },
                        reconnect_token: user_data.reconnect_token.clone(),
                    },
                )
                .await;
                self.broadcast_rooms_list(Some(connection_id)).await;
            }
            ClientToServerMessage::LoginAsExistingUser { reconnect_token } => {
                let user_id = match self.server_data.login_existing_user(reconnect_token) {
                    Ok(user_id) => user_id,
                    Err(err) => {
                        println!("Error logging in user: {}", err);
                        // TODO: Send error to client
                        return;
                    }
                };
                self.connection_to_user_id.insert(connection_id, user_id);
                let user_data = self.server_data.user_data.get(&user_id).unwrap();
                self.send_message(
                    connection_id,
                    ServerToClientMessage::Connected {
                        your_user: User {
                            user_id,
                            username: user_data.username.clone(),
                        },
                        reconnect_token: user_data.reconnect_token.clone(),
                    },
                )
                .await;
                self.broadcast_rooms_list(Some(connection_id)).await;
            }
            ClientToServerMessage::CreateRoom {
                room_id,
                game_settings,
            } => {
                let user_id = match self.connection_to_user_id.get(&connection_id) {
                    Some(user_id) => user_id,
                    None => {
                        println!("Non-user tried to create a game");
                        // TODO: Send error to client
                        return;
                    }
                };
                match self.server_data.create_room(room_id.clone(), game_settings) {
                    Ok(()) => {
                        // Joining the brand new game should always succeed!
                        self.server_data
                            .join_room_game(*user_id, room_id.clone())
                            .unwrap();
                        // Subscribe the connection to the room
                        self.subscribe_to_room(connection_id, room_id).await;
                        self.broadcast_rooms_list(None).await;
                    }
                    Err(err) => {
                        println!("Error creating room {}: {}", room_id, err);
                        // TODO: Send error to client
                        return;
                    }
                }
            }
            ClientToServerMessage::SubscribeRoom { room_id } => {
                self.subscribe_to_room(connection_id, room_id).await;
            }
            ClientToServerMessage::JoinRoomGame { room_id } => {
                let user_id = match self.connection_to_user_id.get(&connection_id) {
                    Some(user_id) => user_id,
                    None => {
                        // TODO: Send error to client
                        return;
                    }
                };
                match self.server_data.join_room_game(*user_id, room_id.clone()) {
                    Ok(()) => {
                        self.subscribe_to_room(connection_id, room_id.clone()).await;
                        self.update_room_listeners(room_id).await;
                        self.broadcast_rooms_list(None).await;
                    }
                    Err(err) => {
                        println!("Error joining game in room {}: {}", room_id, err);
                        // TODO: Send error to client
                        return;
                    }
                }
            }
            ClientToServerMessage::SubmitAction { room_id, action } => {
                let user_id = match self.connection_to_user_id.get(&connection_id) {
                    Some(user_id) => user_id,
                    None => {
                        // TODO: Send error to client
                        return;
                    }
                };
                match self
                    .server_data
                    .submit_action(*user_id, room_id.clone(), action)
                {
                    Ok(()) => {
                        self.update_room_listeners(room_id.clone()).await;
                        // Hacky temporary game saving mechanism
                        match std::env::var("GAME_SAVE_DIR") {
                            Err(_) => (),
                            Ok(game_save_dir) => {
                                let path = std::path::Path::new(&game_save_dir).join(&room_id);
                                tokio::fs::write(
                                    &path,
                                    format!(
                                        "{:?}",
                                        self.server_data
                                            .room_data
                                            .get(&room_id)
                                            .unwrap()
                                            .game
                                            .action_history_vec()
                                    )
                                    .as_bytes(),
                                )
                                .await;
                            }
                        }
                    }
                    Err(err) => {
                        println!("Error joining game in room {}: {}", room_id, err);
                        // TODO: Send error to client
                        return;
                    }
                }
            }
        }
    }

    async fn run(&mut self) {
        while let Some(message) = self.message_rx.recv().await {
            match message {
                ServerInternalMessage::SubscribeClient {
                    client_writer,
                    resp,
                } => {
                    let connection_id = self.generate_connection_id();
                    self.client_writers.insert(connection_id, client_writer);
                    resp.send(Ok(connection_id)).unwrap();
                }
                ServerInternalMessage::MessageFromClient {
                    connection_id,
                    message,
                } => self.handle_message(connection_id, message).await,
            }
        }
    }
}

#[derive(Clone)]
struct Server {
    message_tx: mpsc::Sender<ServerInternalMessage>,
}

impl Server {
    fn new() -> Self {
        let (message_tx, message_rx) = mpsc::channel(32);
        tokio::spawn(async move {
            let mut server_internal = ServerInternal::new(message_rx);
            server_internal.run().await
        });
        Self { message_tx }
    }

    async fn send_message<R, F>(&self, message: F) -> Result<R, String>
    where
        F: FnOnce(Responder<R>) -> ServerInternalMessage,
    {
        let (tx, rx) = oneshot::channel();
        let result = self.message_tx.send(message(tx)).await;
        match result {
            Ok(()) => (),
            Err(err) => return Err(err.to_string()),
        };
        match rx.await {
            Ok(res) => res,
            Err(err) => Err(err.to_string()),
        }
    }

    async fn subscribe_client(
        &self,
        client_writer: mpsc::Sender<ServerToClientMessage>,
    ) -> ConnectionId {
        self.send_message(|resp| ServerInternalMessage::SubscribeClient {
            client_writer,
            resp,
        })
        .await
        .unwrap()
    }

    async fn message_from_client(
        &self,
        connection_id: ConnectionId,
        message: ClientToServerMessage,
    ) {
        self.message_tx
            .send(ServerInternalMessage::MessageFromClient {
                connection_id,
                message,
            })
            .await
            .unwrap();
    }
}

#[cfg(not(target_arch = "wasm32"))]
pub async fn run_server() -> Result<(), Box<dyn std::error::Error>> {
    let listener = tokio::net::TcpListener::bind("0.0.0.0:10213").await?;
    let server = Server::new();

    loop {
        let (mut stream, _) = listener.accept().await?;
        let server_c = server.clone();

        // Special multiplexing hack
        // The TCP connection must send some non-"GET " bytes before it will receive anything,
        // which it accomplishes by sending a Connect message which just gets ignored (but
        // eventually could contain a handshake or something).
        let mut buf = [0u8; 4];
        let _bytes_read = stream.peek(&mut buf).await;
        let is_websocket = buf == "GET ".as_bytes();

        tokio::spawn(async move {
            stream.writable().await.unwrap();
            let (tx, mut rx) = mpsc::channel(32);
            let connection_id = server_c.subscribe_client(tx).await;

            if !is_websocket {
                let (stream_read, stream_write) = stream.split();
                let mut line_reader = tokio::io::BufReader::new(stream_read).lines();
                loop {
                    tokio::select! {
                        from_server = rx.recv() => {
                            stream_write.try_write(
                                serde_json::to_string(&from_server)
                                    .unwrap()
                                    .as_bytes(),
                            ).unwrap();
                            stream_write.try_write(b"\n").unwrap();
                        },
                        from_client = line_reader.next_line() => {
                            if let Some(line) = from_client.unwrap() {
                                let message = serde_json::from_str::<ClientToServerMessage>(&line).unwrap();
                                server_c.message_from_client(connection_id, message).await;
                            }
                        },
                    }
                }
            } else {
                let mut ws_stream = accept_async(stream).await.unwrap();
                loop {
                    tokio::select! {
                        from_server = rx.recv() => {
                            ws_stream.send(Message::text(serde_json::to_string(&from_server).unwrap())).await.unwrap();
                        },
                        from_client = ws_stream.next() => {
                            if let Some(Ok(line)) = from_client {
                                if let Ok(s) = line.to_text() {
                                    if s.is_empty() {
                                        break;
                                    }
                                    let message = serde_json::from_str::<ClientToServerMessage>(s).unwrap();
                                    server_c.message_from_client(connection_id, message).await;
                                }
                            }
                        }
                    }
                }
                println!("Websocket connection terminated");
            }
        });
    }
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    run_server().await
}
