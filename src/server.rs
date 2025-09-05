use flows::game::*;
use flows::server_protocol::*;

use rand::prelude::SliceRandom;
use rand::{rngs::StdRng, SeedableRng};
use std::collections::HashMap;
use tokio::io::AsyncBufReadExt;
use tokio::sync::{mpsc, oneshot};

use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::protocol::Message;

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
                    match pipe
                        .send(ServerToClientMessage::AppendAction(action.clone()))
                        .await
                    {
                        Ok(()) => (),
                        Err(_) => {
                            // TODO: Drop the connection
                        }
                    }
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
                    ClientToServerMessage::Connect => (),
                    ClientToServerMessage::SubmitAction(action) => {
                        println!(
                            "Server received action from viewer {:?}: {:?}",
                            game_viewer, action
                        );
                        let current_action_count = self.game.action_history_vec().len();
                        if !action.performable(game_viewer) {
                            continue;
                        }
                        if self.game.apply_action(action).is_ok() {
                            let mut rng = StdRng::seed_from_u64(
                                chrono::Utc::now().timestamp_nanos_opt().unwrap() as u64,
                            );
                            self.game.do_automatic_actions(&mut rng);
                            self.update_clients(current_action_count).await;
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
        self.message_tx
            .send(ServerInternalMessage::MessageFromClient {
                game_viewer,
                message,
            })
            .await
            .unwrap();
    }
}

#[cfg(not(target_arch = "wasm32"))]
pub async fn run_server() -> Result<(), Box<dyn std::error::Error>> {
    let listener = tokio::net::TcpListener::bind("0.0.0.0:10213").await?;
    let mut game = Game::new(GameSettings {
        num_players: 2,
        version: 0,
    });
    let mut rng = StdRng::seed_from_u64(chrono::Utc::now().timestamp_nanos_opt().unwrap() as u64);

    // Randomize player order before drawing tiles
    let mut player_order: Vec<Player> = (0..2).collect();
    player_order.shuffle(&mut rng);
    game.apply_action(Action::RandomizePlayerOrder { player_order })
        .unwrap();

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
            let _client_handle = server_c.subscribe_client(game_viewer, tx).await;

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
                                server_c.message_from_client(game_viewer, message).await;
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
                                    server_c.message_from_client(game_viewer, message).await;
                                }
                            }
                        }
                    }
                }
                println!("Websocket connection terminated");
            }
        });
        connections += 1;
    }
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    run_server().await
}
