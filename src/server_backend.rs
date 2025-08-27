use crate::backend::Backend;
use crate::game::*;
use parking_lot::RwLock;
use rand::{rngs::StdRng, SeedableRng};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::net::TcpStream;
use std::sync::Arc;

use std::thread::spawn;
use tokio::io::AsyncBufReadExt;
use tokio::sync::{mpsc, oneshot};

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
        self.stream
            .write()
            .write(
                serde_json::to_string(&ClientToServerMessage::SubmitAction(action))
                    .unwrap()
                    .as_bytes(),
            )
            .unwrap();
        self.stream.write().write(b"\n").unwrap();
    }
}

type Responder<T> = oneshot::Sender<Result<T, String>>;
enum ServerInternalMessage {
    SubscribeClient {
        game_viewer: GameViewer,
        client_writer: mpsc::Sender<ServerToClientMessage>,
        resp: Responder<usize>,
    },
    MessageFromClient {
        game_viewer: GameViewer,
        message: ClientToServerMessage,
    },
}

struct ServerInternal {
    message_rx: mpsc::Receiver<ServerInternalMessage>,
    game: Game,
    client_views: HashMap<usize, (GameViewer, mpsc::Sender<ServerToClientMessage>)>,
    next_id: usize,
}

impl ServerInternal {
    fn new(message_rx: mpsc::Receiver<ServerInternalMessage>, game: Game) -> Self {
        Self {
            message_rx,
            game,
            client_views: HashMap::new(),
            next_id: 0,
        }
    }

    async fn update_clients(&self, num_old_messages: usize) {
        for (viewer, pipe) in self.client_views.values() {
            for action in self.game.action_history_vec().iter().skip(num_old_messages) {
                if action.visible(*viewer) {
                    pipe.send(ServerToClientMessage::AppendAction(action.clone())).await.unwrap();
                }
            }
        }
    }

    async fn run(&mut self) {
        while let Some(message) = self.message_rx.recv().await {
            match message {
                ServerInternalMessage::SubscribeClient {
                    game_viewer,
                    client_writer,
                    resp,
                } => {
                    client_writer
                        .send(ServerToClientMessage::YouAreGameViewer(game_viewer))
                        .await
                        .unwrap();
                    for action in self.game.actions_for_viewer(game_viewer) {
                        client_writer
                            .send(ServerToClientMessage::AppendAction(action.clone()))
                            .await
                            .unwrap();
                    }
                    let id = self.next_id;
                    self.next_id += 1;
                    self.client_views.insert(id, (game_viewer, client_writer));
                    println!("Got a client, they are {:?}", game_viewer);
                    resp.send(Ok(id)).unwrap();
                }
                ServerInternalMessage::MessageFromClient {
                    game_viewer,
                    message,
                } => match message {
                    ClientToServerMessage::SubmitAction(action) => {
                        println!(
                            "Server received action from viewer {:?}: {:?}",
                            game_viewer, action
                        );
                        let current_action_count = self.game.action_history_vec().len();
                        if !action.performable(game_viewer) {
                            continue;
                        }
                        match self.game.apply_action(action) {
                            Ok(()) => {
                                let mut rng = StdRng::seed_from_u64(
                                    chrono::Utc::now().timestamp_nanos_opt().unwrap() as u64,
                                );
                                self.game.do_automatic_actions(&mut rng);
                                self.update_clients(current_action_count).await;
                            },
                            Err(_) => (), // TODO: Send error back to the client?
                        }
                    }
                },
            }
        }
    }
}

#[derive(Clone)]
struct Server {
    message_tx: mpsc::Sender<ServerInternalMessage>,
}

impl Server {
    fn new(game: Game) -> Self {
        let (message_tx, message_rx) = mpsc::channel(32);
        tokio::spawn(async move {
            let mut server_internal = ServerInternal::new(message_rx, game);
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
        game_viewer: GameViewer,
        client_writer: mpsc::Sender<ServerToClientMessage>,
    ) -> usize {
        self.send_message(|resp| ServerInternalMessage::SubscribeClient {
            game_viewer,
            client_writer,
            resp,
        })
        .await
        .unwrap()
    }

    async fn message_from_client(&self, game_viewer: GameViewer, message: ClientToServerMessage) {
        self.message_tx.send(ServerInternalMessage::MessageFromClient {
            game_viewer,
            message,
        }).await.unwrap();
    }
}

pub async fn run_server() -> Result<(), Box<dyn std::error::Error>> {
    let listener = tokio::net::TcpListener::bind("0.0.0.0:10213").await?;
    let mut game = Game::new(GameSettings {
        num_players: 2,
        version: 0,
    });
    let mut rng = StdRng::seed_from_u64(chrono::Utc::now().timestamp_nanos_opt().unwrap() as u64);
    game.do_automatic_actions(&mut rng);
    let server = Server::new(game);

    let mut connections = 0;
    loop {
        let (mut stream, _) = listener.accept().await?;
        let game_viewer = if connections < 2 {
            GameViewer::Player(connections)
        } else {
            GameViewer::Spectator
        };
        let server_c = server.clone();
        tokio::spawn(async move {
            stream.writable().await.unwrap();
            let (tx, mut rx) = mpsc::channel(32);
            let (stream_read, stream_write) = stream.split();
            let mut line_reader = tokio::io::BufReader::new(stream_read).lines();
            let _client_handle = server_c.subscribe_client(game_viewer, tx).await;
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
                            server_c.message_from_client(game_viewer, message).await;
                        }
                    },
                }
            }
        });
        connections += 1;
    }
}
