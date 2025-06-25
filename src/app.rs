use crate::game::{Game, GameSettings, Rotation};
use crate::game_ui::GameUi;
use rand::{rngs::StdRng, SeedableRng};

pub struct FlowsApp {
    game: Game,
    game_ui: GameUi,
}

impl Default for FlowsApp {
    fn default() -> Self {
        let mut rng =
            StdRng::seed_from_u64(chrono::Utc::now().timestamp_nanos_opt().unwrap() as u64);
        let mut game = //Game::new(GameSettings {
            //num_players: 2,
            //version: 0,
        //});
        Game::random_board_for_testing(&mut rng, 0.8);
        game.do_automatic_actions(&mut rng);
        Self {
            game,
            game_ui: GameUi::new(Rotation(1)),
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
