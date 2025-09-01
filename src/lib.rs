#![warn(clippy::all, rust_2018_idioms)]

pub mod game;
pub mod legality;
pub mod server_protocol;

#[cfg(feature = "gui")]
mod app;
#[cfg(feature = "gui")]
mod backend;
#[cfg(feature = "gui")]
mod game_ui;
#[cfg(feature = "gui")]
mod game_view;
#[cfg(feature = "gui")]
mod server_backend;

#[cfg(feature = "gui")]
pub use app::FlowsApp;
