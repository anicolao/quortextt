use crate::backend::InMemoryBackend;
use crate::game::{GameSettings, GameViewer, Rotation};
use crate::game_ui::GameUi;
use crate::game_view::GameView;

struct InMemoryMode {
    admin_view: GameView,
    player_views: Vec<GameView>,
}

impl InMemoryMode {
    pub fn new(settings: GameSettings) -> Self {
        let num_players = settings.num_players;
        let backend = InMemoryBackend::new(settings);
        let player_views = (0..num_players)
            .map(|i| GameView::new(Box::new(backend.backend_for_viewer(GameViewer::Player(i)))))
            .collect::<Vec<_>>();
        let admin_view = GameView::new(Box::new(backend));
        Self {
            admin_view,
            player_views,
        }
    }
}

pub struct FlowsApp {
    in_memory_mode: InMemoryMode,
    player_uis: Vec<GameUi>,
    current_displayed_player: usize,
    displayed_action_count: usize,
}

impl Default for FlowsApp {
    fn default() -> Self {
        let num_players = 2;
        let in_memory_mode = InMemoryMode::new(GameSettings {
            num_players,
            version: 0,
        });
        Self {
            in_memory_mode,
            player_uis: (0..num_players)
                .map(|i| GameUi::new(Rotation(i as u8 * 2).reversed()))
                .collect(),
            current_displayed_player: 0,
            displayed_action_count: 0,
        }
    }
}

impl FlowsApp {
    /// Called once before the first frame.
    pub fn new(_cc: &eframe::CreationContext<'_>) -> Self {
        Default::default()
    }
}

impl eframe::App for FlowsApp {
    /// Called each time the UI needs repainting, which may be many times per second.
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        egui::TopBottomPanel::top("top-panel").show(ctx, |ui| {
            ui.horizontal(|ui| {
                for i in 0..self.player_uis.len() {
                    ui.selectable_value(
                        &mut self.current_displayed_player,
                        i,
                        format!("Player {i}"),
                    );
                }
            });
        });
        egui::CentralPanel::default().show(ctx, |ui| {
            let player_view = &mut self.in_memory_mode.player_views[self.current_displayed_player];
            let num_actions = player_view.poll_backend();
            if num_actions > self.displayed_action_count && self.displayed_action_count > 0 {
                self.current_displayed_player += 1;
                self.current_displayed_player %= self.player_uis.len();
            }
            self.displayed_action_count = num_actions;
            self.player_uis[self.current_displayed_player].display(ui, ctx, player_view);
        });
    }
}
