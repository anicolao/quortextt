use crate::game::*;
use egui::{Color32, Painter, Pos2, Rect, Response, Sense, Shape, Stroke, Ui, Vec2};

pub struct GameUi {}

const NEUTRAL_COLOUR: Color32 = Color32::from_rgb(0xAA, 0xAA, 0xAA);
const DEFAULT_HEXAGON_RADIUS: f32 = 40.0;
const BG_COLOUR: Color32 = Color32::from_rgb(0xFE, 0xFE, 0xF0);
const BG_COLOUR_STROKE: Stroke = Stroke {
    width: 2.0,
    color: BG_COLOUR,
};
const FILL_COLOUR: Color32 = Color32::from_rgb(0xFE, 0xFE, 0xF0);
const BORDER: Stroke = Stroke {
    width: 2.0,
    color: Color32::from_rgb(0xAA, 0xAA, 0xAA),
};
const HIGHLIGHT_BORDER: Stroke = Stroke {
    width: 2.0,
    color: Color32::from_rgb(0x00, 0xf0, 0x0),
};

fn player_colour(player: Player) -> Color32 {
    match player {
        0 => Color32::from_rgb(0xFF, 0, 0),
        1 => Color32::from_rgb(0, 0xFF, 0),
        2 => Color32::from_rgb(0, 0, 0xFF),
        3 => Color32::from_rgb(0xFF, 0xFF, 0),
        4 => Color32::from_rgb(0, 0xFF, 0xFF),
        5 => Color32::from_rgb(0xFF, 0, 0xFF),
        _ => NEUTRAL_COLOUR,
    }
}

impl GameUi {
    pub fn new() -> Self {
        Self {}
    }

    fn draw_flow(
        center: Pos2,
        painter: &Painter,
        hexagon: &Vec<Pos2>,
        sp: usize,
        ep: usize,
        color: Color32,
        thickness: f32,
    ) {
        let start = (hexagon[sp] + hexagon[(sp + 1) % 6].to_vec2()) * 0.5;
        let end = (hexagon[ep] + hexagon[(ep + 1) % 6].to_vec2()) * 0.5;
        let cp1 = (center + start.to_vec2()) * 0.5;
        let cp2 = (center + end.to_vec2()) * 0.5;
        painter.add(egui::epaint::CubicBezierShape {
            points: [start, cp1, cp2, end],
            stroke: Stroke::new(thickness, color).into(),
            fill: Color32::TRANSPARENT,
            closed: false,
        });
    }

    fn draw_inverted_hex(
        bounding_box: Rect,
        center: Pos2,
        hexagon_radius: f32,
        painter: &Painter,
        fill: Color32,
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
                painter.add(Shape::convex_polygon(triangle.to_vec(), fill, border));
            }
            if start.y != end.y && start.x > center.x {
                let triangle = [
                    Pos2::new(bounding_box.right(), start.y),
                    start,
                    end,
                    Pos2::new(bounding_box.right(), end.y),
                ];
                painter.add(Shape::convex_polygon(triangle.to_vec(), fill, border));
            }
            if (start.y - end.y).abs() <= 1.0 {
                if start.y < center.y {
                    let triangle = [
                        Pos2::new(bounding_box.left(), bounding_box.top()),
                        Pos2::new(bounding_box.right(), bounding_box.top()),
                        Pos2::new(bounding_box.right(), start.y),
                        Pos2::new(bounding_box.left(), start.y),
                    ];
                    painter.add(Shape::convex_polygon(triangle.to_vec(), fill, border));
                } else {
                    let triangle = [
                        Pos2::new(bounding_box.left(), bounding_box.bottom()),
                        Pos2::new(bounding_box.left(), start.y),
                        Pos2::new(bounding_box.right(), start.y),
                        Pos2::new(bounding_box.right(), bounding_box.bottom()),
                    ];
                    painter.add(Shape::convex_polygon(triangle.to_vec(), fill, border));
                }
            }
        }
    }

    fn draw_empty_hex(
        center: Pos2,
        hexagon_radius: f32,
        painter: &Painter,
        fill: Color32,
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
        painter.add(Shape::convex_polygon(hexagon.clone(), fill, border));
    }

    fn draw_hex(center: Pos2, hexagon_radius: f32, painter: &Painter, tile: &PlacedTile) {
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
        painter.add(Shape::convex_polygon(
            hexagon.clone(),
            Color32::from_rgb(0x33, 0x33, 0x33),
            Stroke::new(2.0, Color32::from_rgb(0xAA, 0xAA, 0xAA)),
        ));
        let thickness = 8.0 / 35.0 * hexagon_radius;
        let flows = tile.all_flows();
        for blank in [true, false] {
            for (e1, e2) in flows.iter() {
                let player = tile.flow_cache(*e1);
                let color = match player {
                    Some(player) => player_colour(player),
                    None => NEUTRAL_COLOUR,
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
        painter.add(Shape::convex_polygon(
            hexagon.clone(),
            Color32::TRANSPARENT,
            Stroke::new(2.0, Color32::from_rgb(0xAA, 0xAA, 0xAA)),
        ));
    }

    pub fn display(&mut self, ui: &mut Ui, game: &Game) -> Response {
        let bounding_box = ui.available_size();
        let (window, response) =
            ui.allocate_exact_size(bounding_box, Sense::union(Sense::click(), Sense::hover()));
        let painter = ui.painter();

        let hexagon_radius = DEFAULT_HEXAGON_RADIUS
            .min(window.width() / 17.0)
            .min(window.height() / 15.0);

        let center_offset = hexagon_radius * 0.9;
        // horizontal vector that moves one tile width to the right
        let right = Vec2::new(2.0 * center_offset, 0.0);
        // diagonal vector that moves one hex up and to the right
        let up = Vec2::new(
            2.0 * center_offset * 0.5,
            -2.0 * center_offset * 0.86602540378,
        );
        let rup = Vec2::new(-2.0 * center_offset, 0.0);
        Self::draw_empty_hex(
            window.center(),
            hexagon_radius * 7.5,
            painter,
            Color32::from_rgb(0x33, 0x33, 0x33),
            BORDER,
            std::f32::consts::PI / 6.0,
        );
        let r = 1;
        for side in 0..6 {
            match game.player_on_side(Rotation((side + (6 - r)) % 6)) {
                None => (),
                Some(player) => {
                    for (pos, dir) in game.edges_on_board_edge(Rotation(side)) {
                        let color = player_colour(player);
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
        let center = game.center_pos();
        for col in 0..7 {
            for row in 0..7 {
                let rotation = Rotation(r);
                let tile_pos = TilePos::new(row, col);
                let rotated_pos = center + (tile_pos - center).rotate(rotation);
                let pos = window.center()
                    + up * -3.0
                    + right * rotated_pos.col as f32
                    + up * rotated_pos.row as f32
                    + rup * rotated_pos.row as f32;
                let tile = game.tile(tile_pos);
                match tile {
                    Tile::NotOnBoard => {}
                    Tile::Empty => {
                        let border_stroke = match response.hover_pos() {
                            Some(hover_pos) if hover_pos.distance(pos) < hexagon_radius * 0.8 => {
                                HIGHLIGHT_BORDER
                            }
                            _ => BORDER,
                        };
                        Self::draw_empty_hex(
                            pos,
                            hexagon_radius,
                            painter,
                            FILL_COLOUR,
                            border_stroke,
                            0.0,
                        );
                    }
                    Tile::Placed(tile) => {
                        let mut rendered =
                            PlacedTile::new(tile.type_(), Rotation((tile.rotation().0 + r) % 6));
                        for dir in 0..6 {
                            let f = tile.flow_cache(Direction::from_rotation(Rotation(dir)));
                            let rdir = Direction::from_rotation(Rotation((dir + r) % 6));
                            rendered.set_flow_cache(rdir, f);
                        }
                        Self::draw_hex(pos, hexagon_radius, painter, &rendered);
                    }
                };
            }
        }
        Self::draw_inverted_hex(
            window,
            window.center(),
            hexagon_radius * 7.5,
            painter,
            BG_COLOUR,
            BG_COLOUR_STROKE,
            std::f32::consts::PI / 6.0,
        );
        Self::draw_empty_hex(
            window.center(),
            hexagon_radius * 7.5,
            painter,
            Color32::TRANSPARENT,
            BORDER,
            std::f32::consts::PI / 6.0,
        );

        response
    }
}
