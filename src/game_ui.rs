use crate::game::*;
use crate::game_view::GameView;
use egui::{
    Color32, Context, CursorIcon, Painter, Pos2, Rect, Response, Sense, Shape, Stroke, Ui, Vec2,
};

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

pub struct GameUi {
    rotation: Rotation,
    /// `placement_rotation` is in the context of the underlying game's base rotation, not the
    /// rotated view shown to the player.
    placement_rotation: Rotation,
    last_rotate_time: f64,
}

impl GameUi {
    pub fn new() -> Self {
        Self {
            rotation: Rotation(0), // Default rotation, will be calculated automatically
            placement_rotation: Rotation(0),
            last_rotate_time: 0.0,
        }
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

    fn hexagon_coords(center: Pos2, radius: f32, rotate: f32) -> Vec<Pos2> {
        (0..6)
            .map(|i| {
                let angle = i as f32 * std::f32::consts::PI / 3.0
                    + 3.0 * std::f32::consts::PI / 6.0
                    + rotate;
                Pos2::new(
                    center.x + radius * angle.cos(),
                    center.y + radius * angle.sin(),
                )
            })
            .collect()
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
        let hexagon = Self::hexagon_coords(center, hexagon_radius, rotate);
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
        let hexagon = Self::hexagon_coords(center, hexagon_radius, rotate);
        painter.add(Shape::convex_polygon(hexagon.clone(), fill, border));
    }

    fn draw_hex(
        center: Pos2,
        hexagon_radius: f32,
        painter: &Painter,
        tile: &PlacedTile,
        prior_tile: &Tile,
    ) {
        let hexagon = Self::hexagon_coords(center, hexagon_radius, 0.0);
        let hypothetical = match prior_tile {
            Tile::NotOnBoard | Tile::Empty => true,
            Tile::Placed(prior) => prior != tile,
        };
        let alpha = if hypothetical { 0x01 } else { 0xFF };
        painter.add(Shape::convex_polygon(
            hexagon.clone(),
            Color32::from_rgba_premultiplied(0x33, 0x33, 0x33, alpha),
            Stroke::new(
                2.0,
                Color32::from_rgba_premultiplied(0xAA, 0xAA, 0xAA, alpha),
            ),
        ));
        let thickness = 8.0 / 35.0 * hexagon_radius;
        let flows = tile.all_flows();
        for blank in [true, false] {
            for (e1, e2) in flows.iter() {
                let player = tile.flow_cache(*e1);
                if blank && player.is_some() {
                    continue;
                }
                if !blank && player.is_none() {
                    continue;
                }
                let color = match player {
                    Some(player) => player_colour(player),
                    None => NEUTRAL_COLOUR,
                };
                let hypoflow = match prior_tile {
                    Tile::NotOnBoard | Tile::Empty => true,
                    Tile::Placed(prior) => prior.flow_cache(*e1) != tile.flow_cache(*e1),
                };
                let render_color = if hypoflow && !blank {
                    Color32::from_rgba_premultiplied(
                        color.r() / 2,
                        color.g() / 2,
                        color.b() / 2,
                        alpha,
                    )
                } else {
                    color
                };
                Self::draw_flow(
                    center,
                    painter,
                    &hexagon,
                    *e1 as usize,
                    *e2 as usize,
                    render_color,
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

    fn hex_position(tile: TilePos, board_center: Pos2, hexagon_radius: f32) -> Pos2 {
        let center_offset = hexagon_radius * 0.9;
        // horizontal vector that moves one tile width to the right
        let right = Vec2::new(2.0 * center_offset, 0.0);
        // diagonal vector that moves one hex up and to the right
        let up = Vec2::new(
            2.0 * center_offset * 0.5,
            -2.0 * center_offset * 0.86602540378,
        );
        let rup = Vec2::new(-2.0 * center_offset, 0.0);

        board_center
            + up * -3.0
            + right * tile.col as f32
            + up * tile.row as f32
            + rup * tile.row as f32
    }

    pub fn display(&mut self, ui: &mut Ui, ctx: &Context, game_view: &mut GameView) -> Response {
        let bounding_box = ui.available_size();
        let (window, response) =
            ui.allocate_exact_size(bounding_box, Sense::union(Sense::click(), Sense::hover()));

        let hexagon_radius = DEFAULT_HEXAGON_RADIUS
            .min(window.width() / 17.0)
            .min(window.height() / 15.0);

        // Figure out what the user is interacting with. It's necessary to do this early so that we
        // can floodfill hypthetical paths that might be drawn before we get to the actual tile the
        // user is hovering.
        let game = match game_view.game() {
            Some(game) => game.clone(),
            None => {
                // TODO: Draw something to say that the backend is not connected yet
                return response;
            }
        };

        // Calculate rotation to put the viewing player's side on the bottom
        let viewing_player = match game_view.viewer() {
            GameViewer::Player(player) => Some(player),
            GameViewer::Admin => Some(game.current_player()), // Admin sees from current player's perspective
            GameViewer::Spectator => None, // Spectator uses default rotation
        };

        if let Some(player) = viewing_player {
            // Find which side the viewing player is on
            for side in (0..6).map(Rotation) {
                if let Some(side_player) = game.player_on_side(side) {
                    if side_player == player {
                        // Calculate rotation to put this side at the bottom (position 3)
                        self.rotation = Rotation(3) + side.reversed();
                        break;
                    }
                }
            }
        }
        let center = game.center_pos();
        let hovered_tile = match response.hover_pos() {
            None => None,
            Some(hover_pos) => {
                let mut hovered_tile = None;
                for col in 0..7 {
                    for row in 0..7 {
                        let tile_pos = TilePos::new(row, col);
                        let rotated_pos = center + (tile_pos - center).rotate(self.rotation);
                        let pos = Self::hex_position(rotated_pos, window.center(), hexagon_radius);
                        if hover_pos.distance(pos) < hexagon_radius * 0.8 {
                            hovered_tile = Some(tile_pos);
                            break;
                        }
                    }
                    if hovered_tile.is_some() {
                        break;
                    }
                }
                hovered_tile
            }
        };
        let hypothetical_game = match hovered_tile {
            None => None,
            Some(hovered_tile) => match game.tile(hovered_tile).clone() {
                Tile::Empty => {
                    ctx.output_mut(|o| o.cursor_icon = CursorIcon::PointingHand);
                    let player_to_simulate = match game_view.viewer() {
                        GameViewer::Player(player) => Some(player),
                        GameViewer::Admin => Some(game.current_player()),
                        GameViewer::Spectator => None,
                    };
                    match player_to_simulate {
                        None => None,
                        Some(player) => match game.tile_in_hand(player) {
                            None => None,
                            Some(tile) => {
                                if response.clicked() {
                                    // TODO: Do something with the local legality check
                                    let _ = game_view.submit_action(Action::PlaceTile {
                                        player,
                                        tile,
                                        pos: hovered_tile,
                                        rotation: self.placement_rotation,
                                    });
                                    None
                                } else {
                                    Some(game.with_tile_placed(
                                        tile,
                                        hovered_tile,
                                        self.placement_rotation,
                                    ))
                                }
                            }
                        },
                    }
                }
                Tile::Placed(_) | Tile::NotOnBoard => None,
            },
        };
        let rotate_time = ctx.input(|i| i.time);
        // Don't let the user rotate the tile too quickly
        if (rotate_time - self.last_rotate_time) > 0.1 {
            let scroll_delta = ui.input(|i| i.raw_scroll_delta);
            if scroll_delta.y > 0.0 {
                self.placement_rotation = self.placement_rotation + Rotation(1);
                self.last_rotate_time = rotate_time;
            } else if scroll_delta.y < 0.0 {
                self.placement_rotation = self.placement_rotation + Rotation(5);
                self.last_rotate_time = rotate_time;
            }
        }

        // Draw the board
        let painter = ui.painter();
        Self::draw_empty_hex(
            window.center(),
            hexagon_radius * 7.5,
            painter,
            Color32::from_rgb(0x33, 0x33, 0x33),
            BORDER,
            std::f32::consts::PI / 6.0,
        );
        for side in (0..6).map(|x| Rotation(x)) {
            match game.player_on_side(side + self.rotation.reversed()) {
                None => (),
                Some(player) => {
                    for (pos, dir) in game.edges_on_board_edge(side) {
                        let color = player_colour(player);
                        let edge = pos + dir.tile_vec();
                        let pos = Self::hex_position(edge, window.center(), hexagon_radius);
                        let fcolor = color;
                        let bcolor = Stroke::new(3.0, color);
                        Self::draw_empty_hex(pos, hexagon_radius, painter, fcolor, bcolor, 0.0);
                    }
                }
            }
        }
        for col in 0..7 {
            for row in 0..7 {
                let tile_pos = TilePos::new(row, col);
                let rotated_pos = center + (tile_pos - center).rotate(self.rotation);
                let pos = Self::hex_position(rotated_pos, window.center(), hexagon_radius);
                let (tile_to_draw, hypothetical) = match game.tile(tile_pos) {
                    Tile::NotOnBoard => (Tile::NotOnBoard, Tile::NotOnBoard),
                    Tile::Empty => {
                        // Check whether the tile is present on the hypothetical game board
                        match &hypothetical_game {
                            None => (Tile::Empty, Tile::Empty),
                            Some(hypothetical_game) => {
                                (*hypothetical_game.tile(tile_pos), Tile::Empty)
                            }
                        }
                    }
                    Tile::Placed(tile) => match &hypothetical_game {
                        None => (Tile::Placed(*tile), Tile::Placed(*tile)),
                        Some(hypothetical_game) => {
                            // return the hypothetical tile if it is different than the current one
                            let current = Tile::Placed(*tile);
                            (*hypothetical_game.tile(tile_pos), current)
                        }
                    },
                };
                match tile_to_draw {
                    Tile::NotOnBoard => {}
                    Tile::Empty => {
                        let border_stroke = if hovered_tile == Some(tile_pos) {
                            HIGHLIGHT_BORDER
                        } else {
                            BORDER
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
                            PlacedTile::new(tile.type_(), tile.rotation() + self.rotation);
                        for dir in (0..6).map(Rotation) {
                            let f = tile.flow_cache(Direction::from_rotation(dir));
                            let rdir = Direction::from_rotation(dir + self.rotation);
                            rendered.set_flow_cache(rdir, f);
                        }
                        match hypothetical {
                            Tile::NotOnBoard | Tile::Empty => {
                                Self::draw_hex(
                                    pos,
                                    hexagon_radius,
                                    painter,
                                    &rendered,
                                    &hypothetical,
                                );
                            }
                            Tile::Placed(hypothetical) => {
                                let mut prior = PlacedTile::new(
                                    hypothetical.type_(),
                                    hypothetical.rotation() + self.rotation,
                                );
                                for dir in (0..6).map(Rotation) {
                                    let f = hypothetical.flow_cache(Direction::from_rotation(dir));
                                    let rdir = Direction::from_rotation(dir + self.rotation);
                                    prior.set_flow_cache(rdir, f);
                                }
                                let prior_tile = Tile::Placed(prior);
                                Self::draw_hex(
                                    pos,
                                    hexagon_radius,
                                    painter,
                                    &rendered,
                                    &prior_tile,
                                );
                            }
                        }
                    }
                }
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

        // Find the current player's side and draw their piece behind their edge
        let current_player = game.current_player();
        let mut current_player_side = None;
        for side in (0..6).map(Rotation) {
            if let Some(player) = game.player_on_side(side + self.rotation.reversed()) {
                if player == current_player {
                    current_player_side = Some(side);
                    break;
                }
            }
        }

        for side in (0..6).map(Rotation) {
            match game.player_on_side(side + self.rotation.reversed()) {
                None => (),
                Some(player) => {
                    // If this is the current player's side, draw their piece behind the center of their edge
                    if Some(side) == current_player_side {
                        if let Some(tile_type) = game.tile_in_hand(player) {
                            let edges = game.edges_on_board_edge(side);
                            if !edges.is_empty() {
                                // Find the center edge position
                                let center_edge_idx = edges.len() / 2;
                                let (center_pos, center_dir) = edges[center_edge_idx];
                                let (_offset_pos, offset_dir) = edges[center_edge_idx - 1];

                                // Calculate position further out from center, behind the edge
                                let edge_pos = center_pos + center_dir.tile_vec();
                                let behind_edge_pos = edge_pos + center_dir.tile_vec();
                                let bottom_pos = Self::hex_position(
                                    behind_edge_pos,
                                    window.center(),
                                    hexagon_radius,
                                );
                                let top_pos = Self::hex_position(
                                    edge_pos + offset_dir.tile_vec(),
                                    window.center(),
                                    hexagon_radius,
                                );
                                // find the midpoint of these two positions
                                let screen_pos = (bottom_pos + top_pos.to_vec2()) * 0.5;

                                // Create a placed tile for rendering
                                let placed_tile = PlacedTile::new(tile_type, Rotation(0));

                                // Draw the tile (without flows since it's not placed yet)
                                Self::draw_hex(
                                    screen_pos,
                                    hexagon_radius * 0.8, // Slightly smaller than board tiles
                                    painter,
                                    &placed_tile,
                                    &Tile::Empty, // Prior tile is empty since this is hypothetical
                                );
                            }
                        }
                    }
                }
            }
        }

        response
    }
}
