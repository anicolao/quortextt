use crate::backend::Backend;
use crate::game::*;
use parking_lot::RwLock;
use rand::{rngs::StdRng, SeedableRng};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Arc;

use std::thread::spawn;

pub struct ServerBackend {
    viewer: Arc<RwLock<GameViewer>>,
    actions_received: Arc<RwLock<Vec<Action>>>,
    stream: RwLock<TcpStream>,
}

#[derive(Serialize, Deserialize)]
enum ClientToServerMessage {
    SubmitAction(Action),
}

#[derive(Serialize, Deserialize)]
enum ServerToClientMessage {
    YouAreGameViewer(GameViewer),
    AppendAction(Action),
}

impl ServerBackend {
    pub fn new<A: std::net::ToSocketAddrs>(addr: A) -> std::io::Result<Self> {
        let stream = TcpStream::connect(addr)?;
        let t_stream = stream.try_clone().unwrap();
        let viewer = Arc::new(RwLock::new(GameViewer::Spectator));
        let actions_received = Arc::new(RwLock::new(Vec::new()));

        let t_viewer = viewer.clone();
        let t_actions_received = actions_received.clone();
        let thread = spawn(move || {
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
        Ok(Self {
            viewer,
            actions_received,
            stream: RwLock::new(stream),
        })
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
        self.stream.write().write(
            serde_json::to_string(&ClientToServerMessage::SubmitAction(action))
                .unwrap()
                .as_bytes(),
        );
        self.stream.write().write(b"\n");
    }
}

fn handle_client(stream: TcpStream, game: Arc<RwLock<Game>>, game_viewer: GameViewer) {
    let mut write_stream = stream.try_clone().unwrap();
    let mut buf_reader = BufReader::new(stream);
    println!("A client connected, they are {:?}", game_viewer);
    // First, tell them about all the actions so far.
    buf_reader.get_mut().write(
        serde_json::to_string(&ServerToClientMessage::YouAreGameViewer(game_viewer))
            .unwrap()
            .as_bytes(),
    );
    buf_reader.get_mut().write(b"\n");
    let mut sent_actions = 0;
    for action in game.read().actions_for_viewer(game_viewer) {
        sent_actions += 1;
        buf_reader.get_mut().write(
            serde_json::to_string(&ServerToClientMessage::AppendAction(action.clone()))
                .unwrap()
                .as_bytes(),
        );
        buf_reader.get_mut().write(b"\n");
    }

    let t_game = game.clone();
    spawn(move || {
        for line in buf_reader.lines() {
            let line = match line {
                Ok(line) => line,
                Err(_) => break,
            };
            println!(
                "Server received line from viewer {:?}: {}",
                game_viewer, line
            );
            match serde_json::from_str::<ClientToServerMessage>(&line) {
                Ok(m) => {
                    match m {
                        ClientToServerMessage::SubmitAction(action) => {
                            // Check whether the player can perform the action
                            if !action.performable(game_viewer) {
                                continue;
                            }
                            t_game.write().apply_action(action);
                            let mut rng = StdRng::seed_from_u64(
                                chrono::Utc::now().timestamp_nanos_opt().unwrap() as u64,
                            );
                            t_game.write().do_automatic_actions(&mut rng);
                        }
                    }
                }
                Err(_) => (),
            }
        }
        println!("Client reached end of stream");
    });

    loop {
        for action in game
            .read()
            .actions_for_viewer(game_viewer)
            .skip(sent_actions)
        {
            sent_actions += 1;
            write_stream.write(
                serde_json::to_string(&ServerToClientMessage::AppendAction(action.clone()))
                    .unwrap()
                    .as_bytes(),
            );
            write_stream.write(b"\n");
        }
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
}

pub fn run_server() -> std::io::Result<()> {
    let listener = TcpListener::bind("127.0.0.1:10213")?;
    let mut game = Arc::new(RwLock::new(Game::new(GameSettings {
        num_players: 2,
        version: 0,
    })));
    let mut rng = StdRng::seed_from_u64(chrono::Utc::now().timestamp_nanos_opt().unwrap() as u64);
    game.write().do_automatic_actions(&mut rng);

    let mut connections = 0;
    for stream in listener.incoming() {
        let stream = stream?;
        let game_viewer = if connections < 2 {
            GameViewer::Player(connections)
        } else {
            GameViewer::Spectator
        };
        let t_game = game.clone();
        spawn(move || {
            handle_client(stream, t_game, game_viewer);
        });
        connections += 1;
    }

    Ok(())
}
