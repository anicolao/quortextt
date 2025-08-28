use crate::game::*;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub enum ClientToServerMessage {
    Connect,
    SubmitAction(Action),
}

#[derive(Serialize, Deserialize)]
pub enum ServerToClientMessage {
    YouAreGameViewer(GameViewer),
    AppendAction(Action),
}
