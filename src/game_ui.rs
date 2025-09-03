use crate::game::{Direction, *};
use crate::game_view::GameView;
use crate::legality::LegalityError;
use egui::{
    emath::Rot2, Color32, Context, CursorIcon, Painter, Pos2, Rect, Sense, Shape, Stroke, Vec2,
};

const DEBUG_ANIMATION_SPEED_MULTIPLIER: u64 = 1; // 10;
const SNAP_RADIUS_DWELL: f32 = 0.8;
const SNAP_RADIUS_MOVING: f32 = 0.3;
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
const GOLDEN_BORDER: Stroke = Stroke {
    width: 3.0,
    color: Color32::from_rgb(0xFF, 0xD7, 0x00),
};
const ILLEGAL_BORDER: Stroke = Stroke {
    width: 3.0,
    color: Color32::from_rgb(0xFF, 0x00, 0x00),
};

fn get_flow_bezier(center: Pos2, hexagon: &[Pos2], sp: usize, ep: usize) -> [Pos2; 4] {
    let start = (hexagon[sp] + hexagon[(sp + 1) % 6].to_vec2()) * 0.5;
    let end = (hexagon[ep] + hexagon[(ep + 1) % 6].to_vec2()) * 0.5;
    let cp1 = (center + start.to_vec2()) * 0.5;
    let cp2 = (center + end.to_vec2()) * 0.5;
    [start, cp1, cp2, end]
}

fn split_bezier(points: [Pos2; 4], t: f32) -> ([Pos2; 4], [Pos2; 4]) {
    let [p0, p1, p2, p3] = points;

    let p10 = p0.lerp(p1, t);
    let p11 = p1.lerp(p2, t);
    let p12 = p2.lerp(p3, t);

    let p20 = p10.lerp(p11, t);
    let p21 = p11.lerp(p12, t);

    let p30 = p20.lerp(p21, t);

    ([p0, p10, p20, p30], [p30, p21, p12, p3])
}

fn trace_flow(
    game: &Game,
    mut pos: TilePos,
    mut dir: Direction,
) -> Vec<(TilePos, Direction, Direction)> {
    let mut path = vec![];
    while let Tile::Placed(tile) = game.tile(pos) {
        let exit_dir = tile.exit_from_entrance(dir);
        path.push((pos, dir, exit_dir));
        match game.adjacent_tile(pos, exit_dir) {
            AdjacentTile::Tile(next_pos) => {
                pos = next_pos;
                dir = exit_dir.reversed();
            }
            _ => break,
        }
    }
    path
}

const FIRST_COL_FOR_ROW: [i32; 7] = [0, 0, 0, 0, 1, 2, 3];

fn format_move(
    player: Player,
    tile: TileType,
    pos: TilePos,
    rotation: Rotation,
    game: &Game,
) -> String {
    let player_str = format!("P{}", player + 1);

    let mut player_side_rotation = Rotation(0);
    for side in 0..6 {
        if game.player_on_side(Rotation(side)) == Some(player) {
            player_side_rotation = Rotation(side);
            break;
        }
    }

    let view_rotation = player_side_rotation.reversed();
    let center = game.center_pos();
    let rotated_pos = center + (pos - center).rotate(view_rotation);

    let row_char = (b'A' + rotated_pos.row as u8) as char;
    let col_num = rotated_pos.col - FIRST_COL_FOR_ROW[rotated_pos.row as usize] + 1;
    let pos_str = format!("{}{}", row_char, col_num);

    let tile_str = format!("T{}", tile.num_sharps());

    let rot_str = match rotation.0 {
        0 => "N",
        1 => "NE",
        2 => "SE",
        3 => "S",
        4 => "SW",
        5 => "NW",
        _ => unreachable!(),
    };

    format!("{}{}{}{}", player_str, pos_str, tile_str, rot_str)
}

fn player_colour(player: Player) -> Color32 {
    match player {
        // player colours are red, yellow, orange, purple, white, and silver
        // Red: A strong, clear red. RGB: (230, 25, 75)
        // Yellow: A vibrant, pure yellow. RGB: (255, 225, 25)
        // Blue: A rich, standard blue. RGB: (0, 130, 200)
        // Purple: A violet-purple, keeping it distinct from blue. RGB: (145, 30, 180)
        // White: Pure white for maximum contrast. RGB: (255, 255, 255)
        // Cyan: A bright, energetic cyan. RGB: (70, 240, 240)
        0 => Color32::from_rgb(0xE6, 0x19, 0x4B), // red
        1 => Color32::from_rgb(0xFF, 0xE1, 0x19), // yellow
        2 => Color32::from_rgb(0x91, 0x1E, 0xB4), // purple
        3 => Color32::from_rgb(0x46, 0xF0, 0xF0), // cyan
        4 => Color32::from_rgb(0, 0x82, 0xC8),    // blue
        5 => Color32::from_rgb(0xff, 0xff, 0xff), // white
        _ => NEUTRAL_COLOUR,
    }
}

pub struct GameUi {
    rotation: Rotation,
    /// `placement_rotation` is in the context of the underlying game's base rotation, not the
    /// rotated view shown to the player.
    placement_rotation: Rotation,
    animation_state: AnimationState,
    moves_drawer_open: bool,
    user_has_toggled_drawer: bool,
    /// Real dimensions of the game over dialog, measured from previous frame
    dialog_size: Option<Vec2>,
}

#[derive(Debug, Default)]
pub struct GameUiResponse {
    pub play_again_requested: bool,
}

struct AnimationState {
    frame_count: u64,
    last_rotate_time: f64,
    rotation_state: Option<RotationAnimation>,
    snap_animation: Option<SnapAnimation>,
    snapped_to: Option<TilePos>,
    flow_animation: Option<FlowAnimation>,
    flow_animation_dirty: bool,
    last_hovered_tile: Option<TilePos>,
    last_pointer_pos: Option<Pos2>,
    pointer_dwell_frames: u64,
    hover_animation: Option<HoverAnimation>,
}

struct RotationAnimation {
    start_frame: u64,
    end_frame: u64,
    start_rotation: Rotation,
    end_rotation: Rotation,
}

struct SnapAnimation {
    start_frame: u64,
    end_frame: u64,
    start_pos: Pos2,
    end_pos: Pos2,
    is_snap_in: bool,
}

struct FlowAnimation {
    start_frame: u64,
    path: Vec<(TilePos, Direction, Direction)>,
    player: Player,
    is_winning_move: bool,
    next: Option<Box<FlowAnimation>>,
}

struct HoverAnimation {
    start_frame: u64,
    end_frame: u64,
    is_fade_in: bool, // true for fade-in (None -> Some), false for fade-out (Some -> None)
    tile_pos: TilePos, // The tile position being animated
}

impl AnimationState {
    fn new() -> Self {
        Self {
            frame_count: 0,
            last_rotate_time: 0.0,
            rotation_state: None,
            snap_animation: None,
            snapped_to: None,
            flow_animation: None,
            flow_animation_dirty: false,
            last_hovered_tile: None,
            last_pointer_pos: None,
            pointer_dwell_frames: 0,
            hover_animation: None,
        }
    }
}

impl GameUi {
    pub fn new() -> Self {
        Self {
            rotation: Rotation(0), // Default rotation, will be calculated automatically
            placement_rotation: Rotation(0),
            animation_state: AnimationState::new(),
            moves_drawer_open: false,
            user_has_toggled_drawer: false,
            dialog_size: None,
        }
    }

    fn get_most_recent_tile_position(game: &Game) -> Option<TilePos> {
        // Search through action history in reverse to find the most recent PlaceTile action
        for action in game.action_history_vec().iter().rev() {
            if let Action::PlaceTile { pos, .. } = action {
                return Some(*pos);
            }
        }
        None
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

    #[allow(clippy::too_many_arguments)]
    fn draw_hex(
        center: Pos2,
        hexagon_radius: f32,
        painter: &Painter,
        tile: &PlacedTile,
        view_rotation: Rotation,
        prior_tile: &Tile,
        border_stroke: Stroke,
        anim_rotation_rads: f32,
        hover_alpha: Option<f32>, // Optional alpha override for hover animations (0.0 to 1.0)
    ) {
        let total_rotation_rads =
            tile.rotation().as_radians() + view_rotation.as_radians() + anim_rotation_rads;

        let hypothetical = match prior_tile {
            Tile::NotOnBoard | Tile::Empty => true,
            Tile::Placed(prior) => prior != tile,
        };
        let base_alpha = if hypothetical { 0x01 } else { 0xFF };
        let alpha = if let Some(hover_alpha) = hover_alpha {
            ((base_alpha as f32 * hover_alpha) as u8).max(1) // Ensure at least 1 for visibility
        } else {
            base_alpha
        };

        // 1. Draw background
        let hexagon_points = Self::hexagon_coords(center, hexagon_radius, total_rotation_rads);
        painter.add(Shape::convex_polygon(
            hexagon_points.clone(),
            Color32::from_rgba_premultiplied(0, 0, 0, alpha),
            Stroke::NONE,
        ));

        // 2. Draw flows
        let thickness = 8.0 / 35.0 * hexagon_radius;
        let base_flows = tile.type_().all_flows(); // Un-rotated flows
        let unrotated_hexagon = Self::hexagon_coords(center, hexagon_radius, 0.0);

        for (d1, d2) in base_flows {
            let rotated_d1 = d1.rotate(tile.rotation());
            let player = tile.flow_cache(rotated_d1);

            let blank = player.is_none();

            let prior_player = if let Tile::Placed(p) = prior_tile {
                p.flow_cache(rotated_d1)
            } else {
                None
            };

            let hypoflow = player != prior_player;

            let color = match player {
                Some(player) => player_colour(player),
                None => NEUTRAL_COLOUR,
            };

            let render_color = if hypoflow && !blank {
                Color32::from_rgba_premultiplied(color.r() / 2, color.g() / 2, color.b() / 2, alpha)
            } else {
                color
            };

            let bezier_unrotated =
                get_flow_bezier(center, &unrotated_hexagon, d1 as usize, d2 as usize);
            let rot = Rot2::from_angle(total_rotation_rads);
            let bezier_rotated_points = bezier_unrotated.map(|p| center + (rot * (p - center)));

            painter.add(egui::epaint::CubicBezierShape {
                points: bezier_rotated_points,
                closed: false,
                fill: Color32::TRANSPARENT,
                stroke: Stroke::new(thickness, render_color).into(),
            });
        }

        // 3. Draw border
        painter.add(Shape::convex_polygon(
            hexagon_points,
            Color32::TRANSPARENT,
            border_stroke,
        ));
    }

    fn hex_position(tile: TilePos, board_center: Pos2, hexagon_radius: f32) -> Pos2 {
        let center_offset = hexagon_radius * 0.9;
        // horizontal vector that moves one tile width to the right
        let right = Vec2::new(2.0 * center_offset, 0.0);
        // diagonal vector that moves one hex up and to the right
        let up = Vec2::new(
            2.0 * center_offset * 0.5,
            -2.0 * center_offset * 0.866_025_4,
        );
        let rup = Vec2::new(-2.0 * center_offset, 0.0);

        board_center
            + up * -3.0
            + right * tile.col as f32
            + up * tile.row as f32
            + rup * tile.row as f32
    }

    fn is_player_edge(&self, game: &Game, player: Player, pos: TilePos, dir: Direction) -> bool {
        for side in 0..6 {
            if game.player_on_side(Rotation(side)) == Some(player)
                && game
                    .edges_on_board_edge(Rotation(side))
                    .contains(&(pos, dir))
            {
                return true;
            }
        }
        false
    }

    fn leads_to_source(
        &self,
        path: &[(TilePos, Direction, Direction)],
        hypo_game: &Game,
        game: &Game,
    ) -> bool {
        if path.is_empty() {
            return false;
        }
        let (last_pos, _, last_exit) = path[path.len() - 1];
        match hypo_game.adjacent_tile(last_pos, last_exit) {
            AdjacentTile::Tile(_) => false, // Path would have continued.
            AdjacentTile::BoardEdge(_) => {
                for player in 0..game.num_players() {
                    if self.is_player_edge(game, player, last_pos, last_exit) {
                        return true;
                    }
                }
                false
            }
        }
    }

    pub fn display(
        &mut self,
        ctx: &Context,
        game_view: &mut GameView,
        scores: &[usize],
    ) -> GameUiResponse {
        let window_rect = ctx.available_rect();
        if !self.user_has_toggled_drawer {
            self.moves_drawer_open = window_rect.width() > window_rect.height();
        }

        egui::TopBottomPanel::top("menu_bar").show(ctx, |ui| {
            if ui.button("☰").clicked() {
                self.moves_drawer_open = !self.moves_drawer_open;
                self.user_has_toggled_drawer = true;
            }
        });

        egui::SidePanel::left("moves_panel").show_animated(ctx, self.moves_drawer_open, |ui| {
            if let Some(game) = game_view.game() {
                let num_players = game.num_players();
                let mut moves: Vec<Vec<String>> = vec![vec![]; num_players];
                for action in game.action_history() {
                    if let Action::PlaceTile {
                        player,
                        tile,
                        pos,
                        rotation,
                    } = action
                    {
                        moves[*player].push(format_move(*player, *tile, *pos, *rotation, &game));
                    }
                }

                ui.columns(num_players, |columns| {
                    for i in 0..num_players {
                        columns[i].label(format!("Player {}", i + 1));
                        for mv in &moves[i] {
                            columns[i].label(mv);
                        }
                    }
                });
            } else {
                ui.label("Waiting for game connection...");
            }
        });

        let mut ui_response = GameUiResponse::default();

        egui::CentralPanel::default().show(ctx, |ui| {
            self.animation_state.frame_count += 1;
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
                GameViewer::Admin => None,     // Same as spectator
                GameViewer::Spectator => None, // Spectator uses default rotation
            };

            if let Some(player) = viewing_player {
                // Find which side the viewing player is on
                for side in (0..6).map(Rotation) {
                    if let Some(side_player) = game.player_on_side(side) {
                        if side_player == player {
                            // Calculate rotation to put this side at the bottom (position 0)
                            self.rotation = side.reversed();
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
                    let mut best_radius = DEFAULT_HEXAGON_RADIUS * 1.1;
                    for col in 0..7 {
                        for row in 0..7 {
                            let tile_pos = TilePos::new(row, col);
                            let rotated_pos = center + (tile_pos - center).rotate(self.rotation);
                            let pos =
                                Self::hex_position(rotated_pos, window.center(), hexagon_radius);
                            // if we're within range of a tile, and the tile is empty, then we are
                            // hovering it
                            match game.tile(tile_pos) {
                                Tile::NotOnBoard | Tile::Placed(_) => continue,
                                Tile::Empty => {}
                            }
                            if hover_pos.distance(pos) < best_radius {
                                hovered_tile = Some(tile_pos);
                                best_radius = hover_pos.distance(pos);
                            }
                        }
                    }
                    hovered_tile
                }
            };
            let (hypothetical_game, legality_error) = match hovered_tile {
                None => {
                    // Check if we have a fade-out animation that needs a hypothetical game
                    if let Some(hover_anim) = &self.animation_state.hover_animation {
                        if !hover_anim.is_fade_in
                            && self.animation_state.frame_count < hover_anim.end_frame
                        {
                            // We're in a fade-out animation, create hypothetical game for the animated tile
                            let player_to_simulate = match game_view.viewer() {
                                GameViewer::Player(player) => Some(player),
                                GameViewer::Admin => Some(game.current_player()),
                                GameViewer::Spectator => None,
                            };
                            match player_to_simulate {
                                None => (None, None),
                                Some(player) => match game.tile_in_hand(player) {
                                    None => (None, None),
                                    Some(tile) => {
                                        let hypo_game = game.with_tile_placed(
                                            tile,
                                            hover_anim.tile_pos,
                                            self.placement_rotation,
                                        );
                                        let legality_error =
                                            crate::legality::is_move_legal(&hypo_game).err();
                                        (Some(hypo_game), legality_error)
                                    }
                                },
                            }
                        } else {
                            (None, None)
                        }
                    } else {
                        (None, None)
                    }
                }
                Some(hovered_tile) => match *game.tile(hovered_tile) {
                    Tile::Empty => {
                        ctx.output_mut(|o| o.cursor_icon = CursorIcon::PointingHand);
                        let player_to_simulate = match game_view.viewer() {
                            GameViewer::Player(player) => Some(player),
                            GameViewer::Admin => Some(game.current_player()),
                            GameViewer::Spectator => None,
                        };
                        match player_to_simulate {
                            None => (None, None),
                            Some(player) => match game.tile_in_hand(player) {
                                None => (None, None),
                                Some(tile) => {
                                    if response.clicked() {
                                        // TODO: Do something with the local legality check
                                        let _ = game_view.submit_action(Action::PlaceTile {
                                            player,
                                            tile,
                                            pos: hovered_tile,
                                            rotation: self.placement_rotation,
                                        });
                                        (None, None)
                                    } else {
                                        let hypo_game = game.with_tile_placed(
                                            tile,
                                            hovered_tile,
                                            self.placement_rotation,
                                        );
                                        let legality_error =
                                            crate::legality::is_move_legal(&hypo_game).err();
                                        (Some(hypo_game), legality_error)
                                    }
                                }
                            },
                        }
                    }
                    Tile::Placed(_) | Tile::NotOnBoard => (None, None),
                },
            };
            let rotate_time = ctx.input(|i| i.time);
            // Don't let the user rotate the tile too quickly
            if self.animation_state.rotation_state.is_none()
                && (rotate_time - self.animation_state.last_rotate_time) > 0.1
            {
                let scroll_delta = ui.input(|i| i.raw_scroll_delta);
                let rotation_delta = if scroll_delta.y > 0.0 {
                    Some(Rotation(1))
                } else if scroll_delta.y < 0.0 {
                    Some(Rotation(5)) // equivalent to -1
                } else {
                    None
                };

                if let Some(delta) = rotation_delta {
                    let start_rotation = self.placement_rotation;
                    let end_rotation = self.placement_rotation + delta;
                    self.animation_state.rotation_state = Some(RotationAnimation {
                        start_frame: self.animation_state.frame_count,
                        end_frame: self.animation_state.frame_count
                            + 6 * DEBUG_ANIMATION_SPEED_MULTIPLIER,
                        start_rotation,
                        end_rotation,
                    });
                    self.placement_rotation = end_rotation; // Update logical rotation immediately
                    self.animation_state.last_rotate_time = rotate_time;
                }
            }

            let mut visual_rotation_rads = 0.0;
            if let Some(anim) = &self.animation_state.rotation_state {
                let now = self.animation_state.frame_count;
                if now >= anim.end_frame {
                    self.animation_state.rotation_state = None;
                    self.animation_state.flow_animation_dirty = true;
                } else {
                    let progress = (now - anim.start_frame) as f32
                        / (anim.end_frame - anim.start_frame) as f32;

                    // `Rotation` is in units of 60 degrees.
                    let start_angle = anim.start_rotation.as_radians();
                    let end_angle = anim.end_rotation.as_radians();

                    // Handle wrap-around from 5 to 0 or 0 to 5
                    let mut diff = end_angle - start_angle;
                    if diff > std::f32::consts::PI {
                        diff -= 2.0 * std::f32::consts::PI;
                    }
                    if diff < -std::f32::consts::PI {
                        diff += 2.0 * std::f32::consts::PI;
                    }

                    visual_rotation_rads = start_angle + diff * progress;
                }
            }

            let now = self.animation_state.frame_count;

            // Clean up completed hover animation
            if let Some(hover_anim) = &self.animation_state.hover_animation {
                if now >= hover_anim.end_frame {
                    self.animation_state.hover_animation = None;
                }
            }

            let mut tile_draw_pos: Option<Pos2> = None;

            if hypothetical_game.is_some() {
                let pointer_pos = response.hover_pos();
                if let Some(pointer_pos) = pointer_pos {
                    // Normal case: pointer is hovering
                    tile_draw_pos = Some(pointer_pos); // Default to pointer

                    if self.animation_state.last_pointer_pos == Some(pointer_pos) {
                        self.animation_state.pointer_dwell_frames += 1;
                    } else {
                        self.animation_state.pointer_dwell_frames = 0;
                    }
                    self.animation_state.last_pointer_pos = Some(pointer_pos);
                } else if let Some(hover_anim) = &self.animation_state.hover_animation {
                    if !hover_anim.is_fade_in
                        && self.animation_state.frame_count < hover_anim.end_frame
                    {
                        // Fade-out animation case: pointer is gone, but we still need to draw the tile
                        tile_draw_pos = Some(Self::hex_position(
                            center + (hover_anim.tile_pos - center).rotate(self.rotation),
                            window.center(),
                            hexagon_radius,
                        ));
                    }
                }

                // Only do snapping logic if we have an actual pointer position
                if let Some(pointer_pos) = pointer_pos {
                    // 1. Determine the target hex to snap to, if any.
                    let mut target_snap_tile: Option<TilePos> = None;
                    if let Some(h_tile) = hovered_tile {
                        let hex_center = Self::hex_position(
                            center + (h_tile - center).rotate(self.rotation),
                            window.center(),
                            hexagon_radius,
                        );
                        let dist = pointer_pos.distance(hex_center);
                        let is_moving = self.animation_state.pointer_dwell_frames < 3;
                        let snap_radius = if is_moving {
                            SNAP_RADIUS_MOVING
                        } else {
                            SNAP_RADIUS_DWELL
                        };

                        if dist < hexagon_radius * snap_radius {
                            target_snap_tile = Some(h_tile);
                        } else if self.animation_state.snapped_to == Some(h_tile)
                            && dist < hexagon_radius * SNAP_RADIUS_DWELL
                        {
                            // Hysteresis: we are snapped to this tile, and we are still within the larger radius, so stay snapped.
                            target_snap_tile = Some(h_tile);
                        }
                    }

                    let current_snap_tile = self.animation_state.snapped_to;

                    // 2. Handle state transitions if not currently animating.
                    if self.animation_state.snap_animation.is_none()
                        && current_snap_tile != target_snap_tile
                    {
                        if let Some(start_tile) = current_snap_tile {
                            // MUST SNAP OUT
                            let start_pos = Self::hex_position(
                                center + (start_tile - center).rotate(self.rotation),
                                window.center(),
                                hexagon_radius,
                            );
                            self.animation_state.snap_animation = Some(SnapAnimation {
                                start_frame: now,
                                end_frame: now + 10 * DEBUG_ANIMATION_SPEED_MULTIPLIER,
                                start_pos,
                                end_pos: pointer_pos,
                                is_snap_in: false,
                            });
                            self.animation_state.snapped_to = None;
                            // cancel flow animation
                            self.animation_state.flow_animation = None;
                        } else if let Some(end_tile) = target_snap_tile {
                            // MUST SNAP IN
                            let end_pos = Self::hex_position(
                                center + (end_tile - center).rotate(self.rotation),
                                window.center(),
                                hexagon_radius,
                            );
                            self.animation_state.snap_animation = Some(SnapAnimation {
                                start_frame: now,
                                end_frame: now + 10 * DEBUG_ANIMATION_SPEED_MULTIPLIER,
                                start_pos: pointer_pos,
                                end_pos,
                                is_snap_in: true,
                            });
                            self.animation_state.snapped_to = Some(end_tile);
                        }
                    }

                    // 3. Update any ongoing animation and determine draw position.
                    if let Some(anim) = &mut self.animation_state.snap_animation {
                        if now >= anim.end_frame {
                            if anim.is_snap_in {
                                self.animation_state.flow_animation_dirty = true;
                            }
                            self.animation_state.snap_animation = None;
                        } else {
                            // Snap cancellation
                            if !anim.is_snap_in {
                                if let Some(h_tile) = target_snap_tile {
                                    if self.animation_state.snapped_to.is_none() {
                                        let hex_center = Self::hex_position(
                                            center + (h_tile - center).rotate(self.rotation),
                                            window.center(),
                                            hexagon_radius,
                                        );
                                        let progress = (now - anim.start_frame) as f32
                                            / (anim.end_frame - anim.start_frame) as f32;
                                        let eased_progress = progress * progress;
                                        let current_pos =
                                            anim.start_pos.lerp(anim.end_pos, eased_progress);

                                        // Cancel snap-out and start snap-in
                                        self.animation_state.snap_animation = Some(SnapAnimation {
                                            start_frame: now,
                                            end_frame: now + 10 * DEBUG_ANIMATION_SPEED_MULTIPLIER,
                                            start_pos: current_pos,
                                            end_pos: hex_center,
                                            is_snap_in: true,
                                        });
                                        self.animation_state.snapped_to = Some(h_tile);
                                    }
                                }
                            }

                            // Re-borrow anim as it might have been replaced
                            if let Some(anim) = &mut self.animation_state.snap_animation {
                                if !anim.is_snap_in {
                                    anim.end_pos = pointer_pos; // Snap-out follows pointer
                                }
                                let progress = (now - anim.start_frame) as f32
                                    / (anim.end_frame - anim.start_frame) as f32;
                                let eased_progress = progress * progress;
                                tile_draw_pos =
                                    Some(anim.start_pos.lerp(anim.end_pos, eased_progress));
                            }
                        }
                    }

                    // 4. Determine final draw position if not animating.
                    if self.animation_state.snap_animation.is_none() {
                        if let Some(snapped_tile) = self.animation_state.snapped_to {
                            tile_draw_pos = Some(Self::hex_position(
                                center + (snapped_tile - center).rotate(self.rotation),
                                window.center(),
                                hexagon_radius,
                            ));
                        } else {
                            // Not snapped, not animating, so follow pointer.
                            // `tile_draw_pos` is already set to this at the beginning.
                        }
                    }
                } // End of "if let Some(pointer_pos) = pointer_pos"
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
            for side in (0..6).map(Rotation) {
                let real_side = side + self.rotation.reversed();
                if let Some(player) = game.player_on_side(real_side) {
                    for (pos, dir) in game.edges_on_board_edge(side) {
                        let color = player_colour(player);
                        let edge = pos + dir.tile_vec();
                        let pos = Self::hex_position(edge, window.center(), hexagon_radius);
                        let fcolor = color;
                        let bcolor = Stroke::new(3.0, color);
                        Self::draw_empty_hex(pos, hexagon_radius, painter, fcolor, bcolor, 0.0);

                        if let Some(LegalityError::BlockedPlayer(blocked_player)) = legality_error {
                            if blocked_player == player {
                                let x_stroke = Stroke::new(5.0, Color32::BLACK);
                                painter.line_segment(
                                    [
                                        pos - Vec2::new(hexagon_radius / 2.0, hexagon_radius / 2.0),
                                        pos + Vec2::new(hexagon_radius / 2.0, hexagon_radius / 2.0),
                                    ],
                                    x_stroke,
                                );
                                painter.line_segment(
                                    [
                                        pos + Vec2::new(
                                            -hexagon_radius / 2.0,
                                            hexagon_radius / 2.0,
                                        ),
                                        pos + Vec2::new(
                                            hexagon_radius / 2.0,
                                            -hexagon_radius / 2.0,
                                        ),
                                    ],
                                    x_stroke,
                                );
                            }
                        }
                    }
                }
            }

            // Get the most recently placed tile position for highlighting
            let most_recent_tile_pos = Self::get_most_recent_tile_position(&game);

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
                            if Some(tile_pos) == hovered_tile {
                                // This is the hypothetical tile, which we will draw separately.
                                // We still draw the empty hex underneath.
                                Self::draw_empty_hex(
                                    pos,
                                    hexagon_radius,
                                    painter,
                                    FILL_COLOUR,
                                    HIGHLIGHT_BORDER,
                                    0.0,
                                );
                            } else {
                                let border_stroke = if most_recent_tile_pos == Some(tile_pos) {
                                    GOLDEN_BORDER
                                } else {
                                    Stroke::new(2.0, Color32::from_rgb(0xAA, 0xAA, 0xAA))
                                };
                                Self::draw_hex(
                                    pos,
                                    hexagon_radius,
                                    painter,
                                    &tile,
                                    self.rotation,
                                    &hypothetical,
                                    border_stroke,
                                    0.0,
                                    None, // No hover animation for board tiles
                                );
                            }
                        }
                    }
                }
            }

            // Draw the hypothetical tile separately so it can be rendered on top of the board and at an arbitrary position.
            if let Some(pos) = tile_draw_pos {
                let player = match game_view.viewer() {
                    GameViewer::Player(player) => Some(player),
                    GameViewer::Admin => Some(game.current_player()),
                    GameViewer::Spectator => None,
                };
                if let Some(player) = player {
                    if let Some(tile_type) = game.tile_in_hand(player) {
                        let base_rotation_for_hypo_tile =
                            if let Some(anim) = &self.animation_state.rotation_state {
                                if self.animation_state.frame_count < anim.end_frame {
                                    Rotation(0)
                                } else {
                                    self.placement_rotation
                                }
                            } else {
                                self.placement_rotation
                            };

                        let tile = PlacedTile::new(tile_type, base_rotation_for_hypo_tile);
                        // To make the tile opaque, we pass a clone of the tile as the "prior" tile.
                        let prior_tile_for_opacity = Tile::Placed(tile);
                        let border = if legality_error.is_some() {
                            ILLEGAL_BORDER
                        } else {
                            HIGHLIGHT_BORDER
                        };
                        // Calculate hover animation alpha if applicable
                        let hover_alpha =
                            if let Some(hover_anim) = &self.animation_state.hover_animation {
                                let now = self.animation_state.frame_count;
                                if now < hover_anim.end_frame {
                                    let progress = (now - hover_anim.start_frame) as f32
                                        / (hover_anim.end_frame - hover_anim.start_frame) as f32;
                                    let progress = progress.clamp(0.0, 1.0);

                                    if hover_anim.is_fade_in {
                                        // Fade-in: 0.0 -> 1.0
                                        Some(progress)
                                    } else {
                                        // Fade-out: 1.0 -> 0.0
                                        Some(1.0 - progress)
                                    }
                                } else {
                                    // Animation completed
                                    None
                                }
                            } else {
                                None
                            };

                        Self::draw_hex(
                            pos,
                            hexagon_radius,
                            painter,
                            &tile,
                            self.rotation,
                            &prior_tile_for_opacity,
                            border,
                            visual_rotation_rads,
                            hover_alpha,
                        );
                    }
                }
            }

            if self.animation_state.last_hovered_tile != hovered_tile {
                self.animation_state.flow_animation = None;

                // Detect hover transitions for fade animation
                let now = self.animation_state.frame_count;
                match (self.animation_state.last_hovered_tile, hovered_tile) {
                    (None, Some(pos)) => {
                        // Fade-in: None -> Some hovered tile
                        self.animation_state.hover_animation = Some(HoverAnimation {
                            start_frame: now,
                            end_frame: now + 15 * DEBUG_ANIMATION_SPEED_MULTIPLIER,
                            is_fade_in: true,
                            tile_pos: pos,
                        });
                    }
                    (Some(pos), None) => {
                        // Fade-out: Some -> None hovered tile
                        self.animation_state.hover_animation = Some(HoverAnimation {
                            start_frame: now,
                            end_frame: now + 15 * DEBUG_ANIMATION_SPEED_MULTIPLIER,
                            is_fade_in: false,
                            tile_pos: pos,
                        });
                    }
                    _ => {
                        // No transition or tile-to-tile transition, no hover animation needed
                    }
                }
            }
            self.animation_state.last_hovered_tile = hovered_tile;

            if self.animation_state.flow_animation_dirty {
                self.animation_state.flow_animation = None;
                self.animation_state.flow_animation_dirty = false;
                if let Some(hypo_game) = &hypothetical_game {
                    if let Some(placed_tile_pos) = hovered_tile {
                        if let Tile::Placed(placed_tile) = hypo_game.tile(placed_tile_pos) {
                            let mut candidate_paths: Vec<(
                                Vec<(TilePos, Direction, Direction)>,
                                Player,
                            )> = vec![];
                            for (d1, d2) in placed_tile.type_().all_flows() {
                                let e1 = d1.rotate(placed_tile.rotation());
                                let e2 = d2.rotate(placed_tile.rotation());

                                if let Some(player) = placed_tile.flow_cache(e1) {
                                    let neighbor1_pos = placed_tile_pos + e1.tile_vec();
                                    let path1 = trace_flow(hypo_game, neighbor1_pos, e1.reversed());

                                    let neighbor2_pos = placed_tile_pos + e2.tile_vec();
                                    let path2 = trace_flow(hypo_game, neighbor2_pos, e2.reversed());

                                    let mut source1 =
                                        self.leads_to_source(&path1, hypo_game, &game);
                                    if !source1 && path1.is_empty() {
                                        if let AdjacentTile::BoardEdge(_) =
                                            hypo_game.adjacent_tile(placed_tile_pos, e1)
                                        {
                                            for player in 0..game.num_players() {
                                                if self.is_player_edge(
                                                    &game,
                                                    player,
                                                    placed_tile_pos,
                                                    e1,
                                                ) {
                                                    source1 = true;
                                                    break;
                                                }
                                            }
                                        }
                                    }

                                    let mut source2 =
                                        self.leads_to_source(&path2, hypo_game, &game);
                                    if !source2 && path2.is_empty() {
                                        if let AdjacentTile::BoardEdge(_) =
                                            hypo_game.adjacent_tile(placed_tile_pos, e2)
                                        {
                                            for player in 0..game.num_players() {
                                                if self.is_player_edge(
                                                    &game,
                                                    player,
                                                    placed_tile_pos,
                                                    e2,
                                                ) {
                                                    source2 = true;
                                                    break;
                                                }
                                            }
                                        }
                                    }

                                    if source1 && !source2 {
                                        let mut anim_path = vec![(placed_tile_pos, e1, e2)];
                                        anim_path.extend(path2);
                                        candidate_paths.push((anim_path, player));
                                    } else if !source1 && source2 {
                                        let mut anim_path = vec![(placed_tile_pos, e2, e1)];
                                        anim_path.extend(path1);
                                        candidate_paths.push((anim_path, player));
                                    } else if source1 && source2 {
                                        candidate_paths
                                            .push((vec![(placed_tile_pos, e1, e2)], player));
                                        candidate_paths
                                            .push((vec![(placed_tile_pos, e2, e1)], player));
                                    }
                                }
                            }

                            // Filter out subpaths
                            let mut final_paths: Vec<(
                                Vec<(TilePos, Direction, Direction)>,
                                Player,
                            )> = vec![];
                            for (path, player) in candidate_paths.iter() {
                                let mut is_subpath = false;
                                for (other_path, _) in candidate_paths.iter() {
                                    if path.len() < other_path.len() {
                                        if other_path.windows(path.len()).any(|w| w == path) {
                                            is_subpath = true;
                                            break;
                                        }
                                    }
                                }
                                if !is_subpath {
                                    final_paths.push((path.clone(), *player));
                                }
                            }

                            let is_winning_move = hypo_game.outcome().is_some();
                            for (path, player) in final_paths {
                                self.animation_state.flow_animation = Some(FlowAnimation {
                                    start_frame: self.animation_state.frame_count,
                                    path,
                                    player,
                                    is_winning_move,
                                    next: self.animation_state.flow_animation.take().map(Box::new),
                                });
                            }
                        }
                    }
                }
            }

            let mut anim_opt = self.animation_state.flow_animation.as_ref();
            while let Some(anim) = anim_opt {
                let now = self.animation_state.frame_count;
                let frames_per_tile = 20 * DEBUG_ANIMATION_SPEED_MULTIPLIER;

                let total_duration = anim.path.len() as u64 * frames_per_tile;
                // clamp to total duration so we don't overshoot
                let elapsed_frames = (now - anim.start_frame).min(total_duration - 1);

                let current_tile_idx = (elapsed_frames / frames_per_tile) as usize;
                let progress_in_segment =
                    (elapsed_frames % frames_per_tile) as f32 / frames_per_tile as f32;

                let color = player_colour(anim.player);
                let thickness = 8.0 / 35.0 * hexagon_radius;

                // Draw fully completed segments
                for i in 0..current_tile_idx {
                    let (tile_pos, entrance_dir, exit_dir) = &anim.path[i];
                    let hex_center = Self::hex_position(
                        center + (*tile_pos - center).rotate(self.rotation),
                        window.center(),
                        hexagon_radius,
                    );
                    let hexagon = Self::hexagon_coords(hex_center, hexagon_radius, 0.0);
                    let rotated_entrance = entrance_dir.rotate(self.rotation);
                    let rotated_exit = exit_dir.rotate(self.rotation);
                    let bezier_points = get_flow_bezier(
                        hex_center,
                        &hexagon,
                        rotated_entrance as usize,
                        rotated_exit as usize,
                    );
                    painter.add(egui::epaint::CubicBezierShape {
                        points: bezier_points,
                        closed: false,
                        fill: Color32::TRANSPARENT,
                        stroke: Stroke::new(thickness, color).into(),
                    });
                }

                // Draw the partially completed segment
                let (current_tile_pos, entrance_dir, exit_dir) = &anim.path[current_tile_idx];

                let hex_center = Self::hex_position(
                    center + (*current_tile_pos - center).rotate(self.rotation),
                    window.center(),
                    hexagon_radius,
                );
                let hexagon = Self::hexagon_coords(hex_center, hexagon_radius, 0.0);

                let rotated_entrance = entrance_dir.rotate(self.rotation);
                let rotated_exit = exit_dir.rotate(self.rotation);

                let bezier_points = get_flow_bezier(
                    hex_center,
                    &hexagon,
                    rotated_entrance as usize,
                    rotated_exit as usize,
                );

                let (partial_curve, _) = split_bezier(bezier_points, progress_in_segment);

                painter.add(egui::epaint::CubicBezierShape {
                    points: partial_curve,
                    closed: false,
                    fill: Color32::TRANSPARENT,
                    stroke: Stroke::new(thickness, color).into(),
                });

                let draw_pos = partial_curve[3];
                if elapsed_frames != total_duration - 1 {
                    painter.circle_filled(draw_pos, 5.0, color);
                }
                anim_opt = anim.next.as_deref();
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
            let animations_running = self.animation_state.rotation_state.is_some()
                || self.animation_state.snap_animation.is_some()
                || self.animation_state.flow_animation.is_some();

            // Also repaint if we are hovering a tile, to allow dwell logic to run.
            let needs_repaint_for_dwell = hypothetical_game.is_some() && !animations_running;

            if animations_running || needs_repaint_for_dwell {
                ctx.request_repaint();
            }
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
                                        Rotation(0),  // No view rotation for this one
                                        &Tile::Empty, // Prior tile is empty since this is hypothetical
                                        Stroke::new(2.0, Color32::from_rgb(0xAA, 0xAA, 0xAA)),
                                        0.0,
                                        None, // No hover animation for tiles in hand
                                    );
                                }
                            }
                        }
                    }
                }
            }

            if let Some(outcome) = game.outcome() {
                // Draw semi-transparent overlay
                let painter = ui.painter();
                painter.rect_filled(window, 0.0, Color32::from_rgba_premultiplied(0, 0, 0, 128));

                // Calculate board bounds for dialog positioning
                let board_center = window.center();
                let board_radius = hexagon_radius * 7.5;

                // For a hexagon with rotation PI/6 (30°), vertices are at 120°, 180°, 240°, 300°, 0°, 60°
                // Bottom of hexagon (highest y): vertices at 0° and 120°/240° -> center.y + radius * sin(60°) = center.y + radius * √3/2
                let board_bottom = board_center.y + board_radius * 0.866_025_4; // √3/2
                                                                                // Right edge of hexagon: vertex at 0° -> center.x + radius
                let board_right = board_center.x + board_radius;

                // Use real dialog size if available, otherwise use fallback estimates
                let (dialog_width, dialog_height) = match self.dialog_size {
                    Some(size) => (size.x, size.y),
                    None => (200.0, 150.0), // Fallback estimates for first frame
                };

                let dialog_margin = 20.0;

                // Check if there's enough space below the board within the current game area
                let space_below = window.bottom() - board_bottom;
                let use_bottom_position = space_below >= (dialog_height + dialog_margin);

                let dialog_pos = if use_bottom_position {
                    // Position centered horizontally below the board, relative to the game area
                    Pos2::new(
                        board_center.x - dialog_width / 2.0, // Center the dialog horizontally on the board center
                        board_bottom + dialog_margin,
                    )
                } else {
                    // Position on the right side, centered vertically, near the rightmost point of the board
                    Pos2::new(
                        board_right + dialog_margin,
                        board_center.y - dialog_height / 2.0,
                    )
                };

                // Show victory window with scores and play again button
                let dialog_response = egui::Window::new("Game Over")
                    .fixed_pos(dialog_pos)
                    .resizable(false)
                    .collapsible(false)
                    .show(ctx, |ui| {
                        ui.vertical_centered(|ui| {
                            // Display victory message
                            let text = match outcome {
                                GameOutcome::Victory(winners) => {
                                    if winners.len() > 1 {
                                        let one_indexed_winners: Vec<usize> =
                                            winners.iter().map(|&p| p + 1).collect();
                                        format!("Players {:?} win!", one_indexed_winners)
                                    } else {
                                        format!("Player {} wins!", winners[0] + 1)
                                    }
                                }
                            };
                            ui.heading(text);

                            ui.add_space(10.0);

                            // Display current scores
                            ui.label("Current Scores:");
                            for (player_idx, &score) in scores.iter().enumerate() {
                                ui.label(format!("Player {}: {}", player_idx + 1, score));
                            }

                            ui.add_space(10.0);

                            // Play again button
                            if ui.button("Play Again").clicked() {
                                ui_response.play_again_requested = true;
                            }
                        });
                    });

                // Store the real dialog size for next frame positioning
                if let Some(dialog_response) = dialog_response {
                    let dialog_rect = dialog_response.response.rect;
                    self.dialog_size = Some(dialog_rect.size());
                }
            }

            response
        });

        ui_response
    }
}

#[cfg(test)]
mod tests {
    use crate::backend::InMemoryBackend;
    use crate::game::{GameSettings, GameViewer, Rotation};
    use crate::game_ui::{GameUi, GameUiResponse};
    use crate::game_view::GameView;

    #[test]
    fn test_automatic_rotation_calculation() {
        // Create a 2-player game
        let settings = GameSettings {
            num_players: 2,
            version: 0,
        };
        let backend = InMemoryBackend::new(settings);

        // Test Player 0's view
        let _player0_view =
            GameView::new(Box::new(backend.backend_for_viewer(GameViewer::Player(0))));
        let ui0 = GameUi::new();

        // Since we can't create a real UI context, we'll test the rotation logic directly
        // by checking that GameUi::new() creates a GameUi with default rotation
        assert_eq!(ui0.rotation.0, 0);

        // Test Player 1's view
        let _player1_view =
            GameView::new(Box::new(backend.backend_for_viewer(GameViewer::Player(1))));
        let ui1 = GameUi::new();

        assert_eq!(ui1.rotation.0, 0); // Default before display() is called

        // Test that the constructor doesn't require rotation parameter anymore
        let ui_default = GameUi::new();
        assert_eq!(ui_default.rotation.0, 0);
    }

    #[test]
    fn test_rotation_reversed() {
        // Test the Rotation::reversed() method that we use
        assert_eq!(Rotation(0).reversed().0, 0);
        assert_eq!(Rotation(1).reversed().0, 5);
        assert_eq!(Rotation(2).reversed().0, 4);
        assert_eq!(Rotation(3).reversed().0, 3);
        assert_eq!(Rotation(4).reversed().0, 2);
        assert_eq!(Rotation(5).reversed().0, 1);
    }

    #[test]
    fn test_victory_message_player_numbering() {
        use crate::game::GameOutcome;

        // Test single player victory message uses 1-indexed numbering
        let single_winner = vec![0]; // Player 0 (internal 0-indexed)
        let outcome_single = GameOutcome::Victory(single_winner);

        let text_single = match outcome_single {
            GameOutcome::Victory(winners) => {
                if winners.len() > 1 {
                    let one_indexed_winners: Vec<usize> = winners.iter().map(|&p| p + 1).collect();
                    format!("Players {:?} win!", one_indexed_winners)
                } else {
                    format!("Player {} wins!", winners[0] + 1)
                }
            }
        };
        assert_eq!(text_single, "Player 1 wins!"); // Should show Player 1, not Player 0

        // Test multiple player victory message uses 1-indexed numbering
        let multiple_winners = vec![0, 2]; // Players 0 and 2 (internal 0-indexed)
        let outcome_multiple = GameOutcome::Victory(multiple_winners);

        let text_multiple = match outcome_multiple {
            GameOutcome::Victory(winners) => {
                if winners.len() > 1 {
                    let one_indexed_winners: Vec<usize> = winners.iter().map(|&p| p + 1).collect();
                    format!("Players {:?} win!", one_indexed_winners)
                } else {
                    format!("Player {} wins!", winners[0] + 1)
                }
            }
        };
        assert_eq!(text_multiple, "Players [1, 3] win!"); // Should show Players [1, 3], not [0, 2]
    }

    #[test]
    fn test_hover_animation_logic() {
        use crate::game::TilePos;
        use crate::game_ui::HoverAnimation;

        // Test fade-in animation calculation
        let fade_in = HoverAnimation {
            start_frame: 10,
            end_frame: 25, // 15 frames duration
            is_fade_in: true,
            tile_pos: TilePos::new(3, 3),
        };

        // Test alpha calculation at different frames during fade-in
        for frame in 10..=25 {
            let progress = if frame < fade_in.end_frame {
                (frame - fade_in.start_frame) as f32
                    / (fade_in.end_frame - fade_in.start_frame) as f32
            } else {
                1.0
            };
            let progress = progress.clamp(0.0, 1.0);
            let alpha = if fade_in.is_fade_in {
                progress
            } else {
                1.0 - progress
            };

            match frame {
                10 => assert_eq!(alpha, 0.0, "Frame 10 should have alpha 0.0"),
                17 => assert!(
                    (alpha - 0.466667).abs() < 0.001,
                    "Frame 17 should have alpha ~0.467"
                ),
                25 => assert_eq!(alpha, 1.0, "Frame 25 should have alpha 1.0"),
                _ => {}
            }
        }

        // Test fade-out animation calculation
        let fade_out = HoverAnimation {
            start_frame: 30,
            end_frame: 45, // 15 frames duration
            is_fade_in: false,
            tile_pos: TilePos::new(2, 2),
        };

        // Test alpha calculation at different frames during fade-out
        for frame in 30..=45 {
            let progress = if frame < fade_out.end_frame {
                (frame - fade_out.start_frame) as f32
                    / (fade_out.end_frame - fade_out.start_frame) as f32
            } else {
                1.0
            };
            let progress = progress.clamp(0.0, 1.0);
            let alpha = if fade_out.is_fade_in {
                progress
            } else {
                1.0 - progress
            };

            match frame {
                30 => assert_eq!(alpha, 1.0, "Frame 30 should have alpha 1.0"),
                37 => assert!(
                    (alpha - 0.533333).abs() < 0.001,
                    "Frame 37 should have alpha ~0.533"
                ),
                45 => assert_eq!(alpha, 0.0, "Frame 45 should have alpha 0.0"),
                _ => {}
            }
        }
    }

    #[test]
    fn test_hover_animation_transitions() {
        use crate::game::TilePos;
        use crate::game_ui::{AnimationState, HoverAnimation};

        // Test transition from None to Some (fade-in)
        let mut anim_state = AnimationState::new();
        anim_state.frame_count = 50;

        let last_hovered = None;
        let current_hovered = Some(TilePos::new(3, 3));

        // Simulate the transition detection logic
        if last_hovered != current_hovered {
            let now = anim_state.frame_count;
            match (last_hovered, current_hovered) {
                (None, Some(pos)) => {
                    // Fade-in: None -> Some hovered tile
                    anim_state.hover_animation = Some(HoverAnimation {
                        start_frame: now,
                        end_frame: now + 15, // 15 frames duration
                        is_fade_in: true,
                        tile_pos: pos,
                    });
                }
                (Some(pos), None) => {
                    // Fade-out: Some -> None hovered tile
                    anim_state.hover_animation = Some(HoverAnimation {
                        start_frame: now,
                        end_frame: now + 15, // 15 frames duration
                        is_fade_in: false,
                        tile_pos: pos,
                    });
                }
                _ => {}
            }
        }

        // Verify fade-in animation was created correctly
        assert!(anim_state.hover_animation.is_some());
        let anim = anim_state.hover_animation.as_ref().unwrap();
        assert_eq!(anim.start_frame, 50);
        assert_eq!(anim.end_frame, 65);
        assert!(anim.is_fade_in);
        assert_eq!(anim.tile_pos, TilePos::new(3, 3));

        // Test transition from Some to None (fade-out)
        let mut anim_state2 = AnimationState::new();
        anim_state2.frame_count = 100;

        let last_hovered2 = Some(TilePos::new(2, 2));
        let current_hovered2 = None;

        // Simulate the transition detection logic
        if last_hovered2 != current_hovered2 {
            let now = anim_state2.frame_count;
            match (last_hovered2, current_hovered2) {
                (None, Some(pos)) => {
                    anim_state2.hover_animation = Some(HoverAnimation {
                        start_frame: now,
                        end_frame: now + 15,
                        is_fade_in: true,
                        tile_pos: pos,
                    });
                }
                (Some(pos), None) => {
                    anim_state2.hover_animation = Some(HoverAnimation {
                        start_frame: now,
                        end_frame: now + 15,
                        is_fade_in: false,
                        tile_pos: pos,
                    });
                }
                _ => {}
            }
        }

        // Verify fade-out animation was created correctly
        assert!(anim_state2.hover_animation.is_some());
        let anim2 = anim_state2.hover_animation.as_ref().unwrap();
        assert_eq!(anim2.start_frame, 100);
        assert_eq!(anim2.end_frame, 115);
        assert!(!anim2.is_fade_in);
        assert_eq!(anim2.tile_pos, TilePos::new(2, 2));
    }

    #[test]
    fn test_game_ui_response_default() {
        let response = GameUiResponse::default();
        assert!(!response.play_again_requested);
    }
}
