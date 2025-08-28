#![warn(clippy::all, rust_2018_idioms)]

#[cfg(feature = "gui")]
mod app;
mod backend;
mod game;
#[cfg(feature = "gui")]
mod game_ui;
#[cfg(feature = "gui")]
mod game_view;
pub mod server_backend;

#[cfg(feature = "gui")]
pub use app::FlowsApp;
