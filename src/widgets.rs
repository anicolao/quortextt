use crate::game::{GameSettings, TILE_DISTRIBUTION_CLASSIC, TILE_DISTRIBUTION_SKEWED};
use egui::Ui;

pub fn game_settings(ui: &mut Ui, game_settings: &mut GameSettings, show_players: bool) {
    if show_players {
        ui.horizontal(|ui| {
            ui.label("Players");
            for num_players in [2, 3].iter() {
                ui.selectable_value(
                    &mut game_settings.num_players,
                    *num_players,
                    format!("{}", num_players),
                );
            }
        });
    }
    ui.horizontal(|ui| {
        ui.label("Tiles");
        for (name, distribution) in [
            ("Classic", TILE_DISTRIBUTION_CLASSIC),
            ("Skewed", TILE_DISTRIBUTION_SKEWED),
        ]
        .iter()
        {
            ui.selectable_value(&mut game_settings.tiles, *distribution, *name);
        }
        for count in game_settings.tiles.iter_mut() {
            ui.add(egui::DragValue::new(count).range(0..=40));
        }
        // Force the number of tiles to be at least 37. This could be a bit nicer UI-wise.
        let total_num_tiles = game_settings.tiles.iter().map(|x| *x as u32).sum::<u32>();
        if total_num_tiles < 37 {
            game_settings.tiles[3] += 37 - (total_num_tiles as u8);
        }
    });
}
