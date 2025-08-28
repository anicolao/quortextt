use crate::backend::Backend;
use crate::game::*;
use crate::server_protocol::*;
use parking_lot::RwLock;

#[cfg(target_arch = "wasm32")]
mod server_connection {
    use crate::server_protocol::*;
    use parking_lot::RwLock;
    use wasm_sockets::{self, PollingClient};

    pub struct ServerConnection {
        polling_client: RwLock<PollingClient>,
    }

    impl ServerConnection {
        pub fn new(addr: &str) -> Self {
            let polling_client = RwLock::new(PollingClient::new(addr).unwrap());
            Self { polling_client }
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

        pub fn send(&self, message: ClientToServerMessage) {
            self.polling_client
                .read()
                .send_string(&serde_json::to_string(&message).unwrap())
                .unwrap();
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
                    match serde_json::from_str::<ServerToClientMessage>(&line) {
                        Ok(m) => t_message_buffer.write().push_back(m),
                        Err(_) => (),
                    }
                }
            });

            let s = Self {
                stream: RwLock::new(stream),
                message_buffer,
            };
            s.send(ClientToServerMessage::Connect);
            s
        }

        pub fn receive(&self) -> Vec<ServerToClientMessage> {
            self.message_buffer.write().drain(..).collect()
        }

        pub fn send(&self, message: ClientToServerMessage) {
            self.stream
                .write()
                .write(serde_json::to_string(&message).unwrap().as_bytes())
                .unwrap();
            self.stream.write().write(b"\n").unwrap();
        }
    }
}

use server_connection::*;

pub struct ServerBackend {
    viewer: RwLock<GameViewer>,
    actions_received: RwLock<Vec<Action>>,
    connection: ServerConnection,
}

impl ServerBackend {
    pub fn new(addr: &str) -> std::io::Result<Self> {
        Ok(Self {
            viewer: RwLock::new(GameViewer::Spectator),
            actions_received: RwLock::new(Vec::new()),
            connection: ServerConnection::new(addr),
        })
    }

    fn handle_messages(&self) {
        for message in self.connection.receive().into_iter() {
            match message {
                ServerToClientMessage::YouAreGameViewer(game_viewer) => {
                    *self.viewer.write() = game_viewer;
                }
                ServerToClientMessage::AppendAction(action) => {
                    self.actions_received.write().push(action);
                }
            }
        }
    }
}

impl Backend for ServerBackend {
    fn viewer(&self) -> GameViewer {
        self.handle_messages();
        *self.viewer.read()
    }

    fn actions_from_index(&self, index: usize) -> Vec<Action> {
        self.handle_messages();
        self.actions_received
            .read()
            .iter()
            .skip(index)
            .cloned()
            .collect()
    }

    fn submit_action(&self, action: Action) {
        self.handle_messages();
        self.connection
            .send(ClientToServerMessage::SubmitAction(action));
    }
}
