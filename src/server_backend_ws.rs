use crate::backend::Backend;
use crate::game::*;
use crate::server_protocol::*;
use parking_lot::RwLock;
use wasm_sockets::{self, PollingClient};

pub struct ServerBackend {
    viewer: RwLock<GameViewer>,
    actions_received: RwLock<Vec<Action>>,
    polling_client: RwLock<PollingClient>,
}

impl ServerBackend {
    pub fn new(addr: &str) -> std::io::Result<Self> {
        let polling_client = RwLock::new(PollingClient::new(addr).unwrap());
        Ok(Self {
            viewer: RwLock::new(GameViewer::Spectator),
            actions_received: RwLock::new(Vec::new()),
            polling_client,
        })
    }

    fn handle_messages(&self) {
        for message in self.polling_client.write().receive().iter() {
            match message {
                wasm_sockets::Message::Text(s) => {
                    match serde_json::from_str::<ServerToClientMessage>(&s) {
                        Ok(m) => match m {
                            ServerToClientMessage::YouAreGameViewer(game_viewer) => {
                                *self.viewer.write() = game_viewer;
                            }
                            ServerToClientMessage::AppendAction(action) => {
                                self.actions_received.write().push(action);
                            }
                        },
                        Err(_) => (),
                    }
                }
                wasm_sockets::Message::Binary(_) => (),
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
        self.polling_client
            .read()
            .send_string(
                &serde_json::to_string(&ClientToServerMessage::SubmitAction(action)).unwrap(),
            )
            .unwrap();
    }
}
