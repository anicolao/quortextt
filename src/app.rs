use crate::game::*;
use egui::{Pos2, Sense, Stroke, Vec2};

pub struct TemplateApp {
    game: Game,
}

impl Default for TemplateApp {
    fn default() -> Self {
        Self {
            game: Game::random_board_for_testing(0.95),
        }
    }
}

impl TemplateApp {
    /// Called once before the first frame.
    pub fn new(cc: &eframe::CreationContext<'_>) -> Self {
        let s: Self = Default::default();
        let game = &s.game;
        println!("{game:?}");

        // This is also where you can customize the look and feel of egui using
        // `cc.egui_ctx.set_visuals` and `cc.egui_ctx.set_fonts`.

        s
    }

    fn draw_flow(
        center: egui::Pos2,
        painter: &egui::Painter,
        hexagon: &Vec<Pos2>,
        sp: usize,
        ep: usize,
        color: egui::Color32,
        thickness: f32,
    ) {
        let start = (hexagon[sp] + hexagon[(sp + 1) % 6].to_vec2()) * 0.5;
        let end = (hexagon[ep] + hexagon[(ep + 1) % 6].to_vec2()) * 0.5;
        let cp1 = (center + start.to_vec2()) * 0.5;
        let cp2 = (center + end.to_vec2()) * 0.5;
        painter.add(egui::epaint::CubicBezierShape {
            points: [start, cp1, cp2, end],
            stroke: Stroke::new(thickness, color).into(),
            fill: egui::Color32::TRANSPARENT,
            closed: false,
        });
    }
    fn draw_inverted_hex(
        bounding_box: egui::Rect,
        center: egui::Pos2,
        hexagon_radius: f32,
        painter: &egui::Painter,
        fill: egui::Color32,
        border: Stroke,
        rotate: f32,
    ) {
        let hexagon = (0..6)
            .map(|i| {
                let angle = i as f32 * std::f32::consts::PI / 3.0
                    + 3.0 * std::f32::consts::PI / 6.0
                    + rotate;
                Pos2::new(
                    center.x + hexagon_radius * angle.cos(),
                    center.y + hexagon_radius * angle.sin(),
                )
            })
            .collect::<Vec<_>>();
        for i in 0..6 {
            let start = hexagon[i];
            let end = hexagon[(i + 1) % 6];
            if start.y != end.y && start.x < center.x {
                let triangle = [
                    Pos2::new(bounding_box.left(), start.y),
                    start,
                    end,
                    Pos2::new(bounding_box.left(), end.y),
                ];
                painter.add(egui::Shape::convex_polygon(triangle.to_vec(), fill, border));
            }
            if start.y != end.y && start.x > center.x {
                let triangle = [
                    Pos2::new(bounding_box.right(), start.y),
                    start,
                    end,
                    Pos2::new(bounding_box.right(), end.y),
                ];
                painter.add(egui::Shape::convex_polygon(triangle.to_vec(), fill, border));
            }
            if (start.y - end.y).abs() <= 1.0 {
                if start.y < center.y {
                    let triangle = [
                        Pos2::new(bounding_box.left(), bounding_box.top()),
                        Pos2::new(bounding_box.right(), bounding_box.top()),
                        Pos2::new(bounding_box.right(), start.y),
                        Pos2::new(bounding_box.left(), start.y),
                    ];
                    painter.add(egui::Shape::convex_polygon(triangle.to_vec(), fill, border));
                } else {
                    let triangle = [
                        Pos2::new(bounding_box.left(), bounding_box.bottom()),
                        Pos2::new(bounding_box.left(), start.y),
                        Pos2::new(bounding_box.right(), start.y),
                        Pos2::new(bounding_box.right(), bounding_box.bottom()),
                    ];
                    painter.add(egui::Shape::convex_polygon(triangle.to_vec(), fill, border));
                }
            }
        }
    }
    fn draw_empty_hex(
        center: egui::Pos2,
        hexagon_radius: f32,
        painter: &egui::Painter,
        fill: egui::Color32,
        border: Stroke,
        rotate: f32,
    ) {
        let hexagon = (0..6)
            .map(|i| {
                let angle = i as f32 * std::f32::consts::PI / 3.0
                    + 3.0 * std::f32::consts::PI / 6.0
                    + rotate;
                Pos2::new(
                    center.x + hexagon_radius * angle.cos(),
                    center.y + hexagon_radius * angle.sin(),
                )
            })
            .collect::<Vec<_>>();
        painter.add(egui::Shape::convex_polygon(hexagon.clone(), fill, border));
    }
    fn draw_hex(
        center: egui::Pos2,
        hexagon_radius: f32,
        painter: &egui::Painter,
        tile: &PlacedTile,
    ) {
        let hexagon = (0..6)
            .map(|i| {
                let angle =
                    i as f32 * std::f32::consts::PI / 3.0 + 3.0 * std::f32::consts::PI / 6.0;
                Pos2::new(
                    center.x + hexagon_radius * angle.cos(),
                    center.y + hexagon_radius * angle.sin(),
                )
            })
            .collect::<Vec<_>>();
        painter.add(egui::Shape::convex_polygon(
            hexagon.clone(),
            egui::Color32::from_rgb(0x33, 0x33, 0x33),
            Stroke::new(2.0, egui::Color32::from_rgb(0xAA, 0xAA, 0xAA)),
        ));
        let thickness = 8.0 / 35.0 * hexagon_radius;
        let flows = tile.all_flows();
        for blank in [true, false] {
            for (e1, e2) in flows.iter() {
                let player = tile.flow_cache(*e1);
                let color = match player {
                    Some(0) => egui::Color32::from_rgb(0xFF, 0, 0),
                    Some(1) => egui::Color32::from_rgb(0, 0xFF, 0),
                    Some(2) => egui::Color32::from_rgb(0, 0, 0xFF),
                    Some(3) => egui::Color32::from_rgb(0xFF, 0xFF, 0),
                    Some(4) => egui::Color32::from_rgb(0, 0xFF, 0xFF),
                    Some(5) => egui::Color32::from_rgb(0xFF, 0, 0xFF),
                    None | Some(_) => egui::Color32::from_rgb(0xAA, 0xAA, 0xAA),
                };
                if blank && player.is_some() {
                    continue;
                }
                if !blank && player.is_none() {
                    continue;
                }
                Self::draw_flow(
                    center,
                    painter,
                    &hexagon,
                    *e1 as usize,
                    *e2 as usize,
                    color,
                    thickness,
                );
            }
        }
        painter.add(egui::Shape::convex_polygon(
            hexagon.clone(),
            egui::Color32::TRANSPARENT,
            Stroke::new(2.0, egui::Color32::from_rgb(0xAA, 0xAA, 0xAA)),
        ));
    }
}

impl eframe::App for TemplateApp {
    /// Called each time the UI needs repainting, which may be many times per second.
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        // Put your widgets into a `SidePanel`, `TopBottomPanel`, `CentralPanel`, `Window` or `Area`.
        // For inspiration and more examples, go to https://emilk.github.io/egui

        egui::TopBottomPanel::top("top_panel").show(ctx, |ui| {
            // The top panel is often a good place for a menu bar:

            egui::menu::bar(ui, |ui| {
                // NOTE: no File->Quit on web pages!
                let is_web = cfg!(target_arch = "wasm32");
                if !is_web {
                    ui.menu_button("File", |ui| {
                        if ui.button("Quit").clicked() {
                            ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                        }
                    });
                    ui.add_space(16.0);
                }

                egui::widgets::global_theme_preference_buttons(ui);
            });
        });

        egui::CentralPanel::default().show(ctx, |ui| {
            let bounding_box = ui.available_size();
            let (window, response) =
                ui.allocate_exact_size(bounding_box, Sense::union(Sense::click(), Sense::hover()));
            let painter = ui.painter();

            let mut hexagon_radius = 40.0;
            if window.width() / 10.0 < 2.0 * hexagon_radius {
                hexagon_radius = window.width() / 20.0;
            }
            if window.height() / 10.0 < 2.0 * hexagon_radius {
                hexagon_radius = window.height() / 20.0;
            }
            let center_offset = hexagon_radius * 0.9;
            // horizontal vector that moves one tile width to the right
            let right = Vec2::new(2.0 * center_offset, 0.0);
            // diagonal vector that moves one hex up and to the right
            let up = Vec2::new(
                2.0 * center_offset * 0.5,
                -2.0 * center_offset * 0.86602540378,
            );
            let rup = Vec2::new(-2.0 * center_offset, 0.0);
            let bgcolor = egui::Color32::from_rgb(0xFE, 0xFE, 0xF0);
            let bgcolors = Stroke::new(2.0, egui::Color32::from_rgb(0xFE, 0xFE, 0xF0));
            let fill = egui::Color32::from_rgb(0xFE, 0xFE, 0xF0);
            let border = Stroke::new(2.0, egui::Color32::from_rgb(0xAA, 0xAA, 0xAA));
            let hborder = Stroke::new(2.0, egui::Color32::from_rgb(0x00, 0xf0, 0x0));
            Self::draw_empty_hex(
                window.center(),
                hexagon_radius * 7.5,
                painter,
                egui::Color32::from_rgb(0x33, 0x33, 0x33),
                border,
                std::f32::consts::PI / 6.0,
            );
            for side in 0..6 {
                match self.game.sides[side] {
                    None => (),
                    Some(player) => {
                        for (pos, dir) in self.game.edges_on_board_edge(Rotation(side as u8)) {
                            let color = match player {
                                0 => egui::Color32::from_rgb(0xFF, 0, 0),
                                1 => egui::Color32::from_rgb(0, 0xFF, 0),
                                2 => egui::Color32::from_rgb(0, 0, 0xFF),
                                3 => egui::Color32::from_rgb(0xFF, 0xFF, 0),
                                4 => egui::Color32::from_rgb(0, 0xFF, 0xFF),
                                5 => egui::Color32::from_rgb(0xFF, 0, 0xFF),
                                _ => egui::Color32::from_rgb(0xAA, 0xAA, 0xAA),
                            };
                            let edge = pos + dir.tile_vec();
                            let col = edge.col;
                            let row = edge.row;
                            let pos = window.center()
                                + up * -3.0
                                + right * col as f32
                                + up * row as f32
                                + rup * row as f32;
                            let fcolor = color;
                            let bcolor = Stroke::new(3.0, color);
                            Self::draw_empty_hex(pos, hexagon_radius, painter, fcolor, bcolor, 0.0);
                        }
                    }
                }
            }
            for col in 0..7 {
                for row in 0..7 {
                    let pos = window.center()
                        + up * -3.0
                        + right * col as f32
                        + up * row as f32
                        + rup * row as f32;
                    let tile = self.game.tile(TilePos::new(row, col));
                    match tile {
                        Tile::NotOnBoard => {}
                        Tile::Empty => {
                            match response.hover_pos() {
                                Some(hover_pos)
                                    if hover_pos.distance(pos) < hexagon_radius * 0.8 =>
                                {
                                    Self::draw_empty_hex(
                                        pos,
                                        hexagon_radius,
                                        painter,
                                        fill,
                                        hborder,
                                        0.0,
                                    );
                                }
                                _ => {
                                    Self::draw_empty_hex(
                                        pos,
                                        hexagon_radius,
                                        painter,
                                        fill,
                                        border,
                                        0.0,
                                    );
                                }
                            };
                        }
                        Tile::Placed(tile) => {
                            Self::draw_hex(pos, hexagon_radius, painter, tile);
                        }
                    };
                }
            }
            Self::draw_inverted_hex(
                window,
                window.center(),
                hexagon_radius * 7.5,
                painter,
                bgcolor,
                bgcolors,
                std::f32::consts::PI / 6.0,
            );
            Self::draw_empty_hex(
                window.center(),
                hexagon_radius * 7.5,
                painter,
                egui::Color32::TRANSPARENT,
                border,
                std::f32::consts::PI / 6.0,
            );
        });
    }
}
