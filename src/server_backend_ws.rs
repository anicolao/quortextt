use crate::backend::Backend;
use crate::game::*;
use crate::server_protocol::*;
use parking_lot::RwLock;
use std::sync::Arc;

pub struct ServerBackend {
    viewer: Arc<RwLock<GameViewer>>,
    actions_received: Arc<RwLock<Vec<Action>>>,
}

impl ServerBackend {
    pub fn new<A: std::net::ToSocketAddrs>(addr: A) -> std::io::Result<Self> {
        panic!("Implement me!")
    }
}

impl Backend for ServerBackend {
    fn viewer(&self) -> GameViewer {
        panic!("Implement me!")
    }

    fn actions_from_index(&self, index: usize) -> Vec<Action> {
        panic!("Implement me!")
    }

    fn submit_action(&self, action: Action) {
        panic!("Implement me!")
    }
}
