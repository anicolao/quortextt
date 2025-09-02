use crate::game::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub type UserId = u32;
pub type Username = String;
pub type RoomId = String;
pub type ReconnectToken = String;

#[derive(Serialize, Deserialize, Debug)]
pub enum ClientToServerMessage {
    // === Logging in ===
    LoginAsNewUser {
        username: Username,
    },
    LoginAsExistingUser {
        reconnect_token: ReconnectToken,
    },
    // === Creating and joining rooms ===
    /// Create a new room.
    CreateRoom {
        room_id: RoomId,
        game_settings: GameSettings,
    },
    /// Subscribe to a room and receive updates when their are actions in the game or the room state
    /// changes.
    SubscribeRoom {
        room_id: RoomId,
    },
    /// Join the game in a room.
    JoinRoomGame {
        room_id: RoomId,
    },
    // === Making actions in a game ===
    SubmitAction {
        room_id: RoomId,
        action: Action,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct User {
    pub user_id: UserId,
    pub username: Username,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RoomPreview {
    pub room_id: RoomId,
    pub game_settings: GameSettings,
    pub players: Vec<User>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RoomInfo {
    pub game_settings: GameSettings,
    pub players: Vec<User>,
    pub user_to_game_viewer: HashMap<UserId, GameViewer>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum ServerToClientMessage {
    // Error handling
    InvalidRequest {
        message: ClientToServerMessage,
        reason: String,
    },
    // Logging in
    Connected {
        your_user: User,
        reconnect_token: ReconnectToken,
    },
    // Lobby info
    RoomsList {
        rooms: Vec<RoomPreview>,
    },
    // Room status and updates
    RoomInfo {
        room_id: RoomId,
        room_info: RoomInfo,
    },
    RoomCurrentActions {
        room_id: RoomId,
        actions: Vec<Action>, // Complete history of all actions you can see in the room so far
    },
    RoomAppendAction {
        room_id: RoomId,
        action: Action,
    },
}
