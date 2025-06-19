use crate::game::Game;
use crate::game_ui::GameUi;

pub struct FlowsApp {
    game: Game,
    game_ui: GameUi,
}

impl Default for FlowsApp {
    fn default() -> Self {
        Self {
            game: Game::random_board_for_testing(0.95),
            game_ui: GameUi::new(),
        }
    }
}

impl FlowsApp {
    /// Called once before the first frame.
    pub fn new(_cc: &eframe::CreationContext<'_>) -> Self {
        let s: Self = Default::default();
        let game = &s.game;
        println!("{game:?}");

        // This is also where you can customize the look and feel of egui using
        // `cc.egui_ctx.set_visuals` and `cc.egui_ctx.set_fonts`.

        s
    }
}

impl eframe::App for FlowsApp {
    /// Called each time the UI needs repainting, which may be many times per second.
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        egui::CentralPanel::default().show(ctx, |ui| {
            self.game_ui.display(ui, &self.game);
        });
    }
}
