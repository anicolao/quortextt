use crate::backend::Backend;
use crate::game::*;
use crate::server_protocol::*;
use parking_lot::RwLock;
use std::io::{BufRead, BufReader, Write};
use std::net::TcpStream;
use std::sync::Arc;

use std::thread::spawn;
pub struct ServerBackend {
    viewer: Arc<RwLock<GameViewer>>,
    actions_received: Arc<RwLock<Vec<Action>>>,
    stream: RwLock<TcpStream>,
}

impl ServerBackend {
    pub fn new<A: std::net::ToSocketAddrs>(addr: A) -> std::io::Result<Self> {
        let stream = TcpStream::connect(addr)?;
        let t_stream = stream.try_clone().unwrap();
        let viewer = Arc::new(RwLock::new(GameViewer::Spectator));
        let actions_received = Arc::new(RwLock::new(Vec::new()));

        let t_viewer = viewer.clone();
        let t_actions_received = actions_received.clone();
        let _ = spawn(move || {
            let stream_reader = BufReader::new(t_stream);
            for line in stream_reader.lines() {
                let line = match line {
                    Ok(line) => line,
                    Err(_) => break,
                };
                println!("Client received line from server: {}", line);
                match serde_json::from_str::<ServerToClientMessage>(&line) {
                    Ok(m) => match m {
                        ServerToClientMessage::YouAreGameViewer(game_viewer) => {
                            *t_viewer.write() = game_viewer;
                        }
                        ServerToClientMessage::AppendAction(action) => {
                            t_actions_received.write().push(action);
                        }
                    },
                    Err(_) => (),
                }
            }
        });
        let s = Self {
            viewer,
            actions_received,
            stream: RwLock::new(stream),
        };
        s.write_message(ClientToServerMessage::Connect);
        Ok(s)
    }

    fn write_message(&self, message: ClientToServerMessage) {
        self.stream
            .write()
            .write(serde_json::to_string(&message).unwrap().as_bytes())
            .unwrap();
        self.stream.write().write(b"\n").unwrap();
    }
}

impl Backend for ServerBackend {
    fn viewer(&self) -> GameViewer {
        *self.viewer.read()
    }

    fn actions_from_index(&self, index: usize) -> Vec<Action> {
        self.actions_received
            .read()
            .iter()
            .skip(index)
            .cloned()
            .collect()
    }

    fn submit_action(&self, action: Action) {
        self.write_message(ClientToServerMessage::SubmitAction(action));
    }
}
