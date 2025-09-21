#![warn(clippy::all, rust_2018_idioms)]

pub mod game;
pub mod legality;
pub mod server_protocol;

#[cfg(feature = "gui")]
pub mod ai_backend;
#[cfg(feature = "gui")]
mod app;
#[cfg(feature = "gui")]
pub mod backend;
#[cfg(feature = "gui")]
pub mod game_ui;
#[cfg(feature = "gui")]
pub mod game_view;
#[cfg(feature = "gui")]
mod server_backend;

#[cfg(feature = "gui")]
pub use app::FlowsApp;
#[cfg(feature = "gui")]
mod widgets;
