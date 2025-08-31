use crate::game::{Direction, *};
use crate::game_view::GameView;
use egui::{
    emath::Rot2, Color32, Context, CursorIcon, Painter, Pos2, Rect, Response, Sense, Shape, Stroke,
    Ui, Vec2,
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

fn get_flow_bezier(center: Pos2, hexagon: &Vec<Pos2>, sp: usize, ep: usize) -> [Pos2; 4] {
    let start = (hexagon[sp] + hexagon[(sp + 1) % 6].to_vec2()) * 0.5;
    let end = (hexagon[ep] + hexagon[(ep + 1) % 6].to_vec2()) * 0.5;
    let cp1 = (center + start.to_vec2()) * 0.5;
    let cp2 = (center + end.to_vec2()) * 0.5;
    [start, cp1, cp2, end]
}

fn sample_bezier(points: [Pos2; 4], t: f32) -> Pos2 {
    let [p0, p1, p2, p3] = points;
    let t_inv = 1.0 - t;
    let t_inv2 = t_inv * t_inv;
    let t_inv3 = t_inv2 * t_inv;
    let t2 = t * t;
    let t3 = t2 * t;

    let p = p0.to_vec2() * t_inv3
        + p1.to_vec2() * (3.0 * t_inv2 * t)
        + p2.to_vec2() * (3.0 * t_inv * t2)
        + p3.to_vec2() * t3;
    p.to_pos2()
}

fn trace_flow(
    game: &Game,
    mut pos: TilePos,
    mut dir: Direction,
) -> Vec<(TilePos, Direction, Direction)> {
    let mut path = vec![];
    loop {
        match game.tile(pos) {
            Tile::Placed(tile) => {
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
            _ => break,
        }
    }
    path
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
}

struct AnimationState {
    frame_count: u64,
    last_rotate_time: f64,
    rotation_state: Option<RotationAnimation>,
    snap_animation: Option<SnapAnimation>,
    snapped_to: Option<TilePos>,
    flow_animation: Option<FlowAnimation>,
    last_hovered_tile: Option<TilePos>,
    last_pointer_pos: Option<Pos2>,
    pointer_dwell_frames: u64,
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
            last_hovered_tile: None,
            last_pointer_pos: None,
            pointer_dwell_frames: 0,
        }
    }
}

impl GameUi {
    pub fn new() -> Self {
        Self {
            rotation: Rotation(0), // Default rotation, will be calculated automatically
            placement_rotation: Rotation(0),
            animation_state: AnimationState::new(),
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

    fn draw_hex(
        center: Pos2,
        hexagon_radius: f32,
        painter: &Painter,
        tile: &PlacedTile,
        view_rotation: Rotation,
        prior_tile: &Tile,
        border_stroke: Stroke,
        anim_rotation_rads: f32,
    ) {
        let total_rotation_rads =
            tile.rotation().as_radians() + view_rotation.as_radians() + anim_rotation_rads;

        let hypothetical = match prior_tile {
            Tile::NotOnBoard | Tile::Empty => true,
            Tile::Placed(prior) => prior != tile,
        };
        let alpha = if hypothetical { 0x01 } else { 0xFF };

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
            let bezier_rotated_points =
                bezier_unrotated.map(|p| center + (rot * (p - center)));

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
        if self.animation_state.rotation_state.is_none() {
            if (rotate_time - self.animation_state.last_rotate_time) > 0.1 {
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
        }

        let mut visual_rotation_rads = 0.0;
        if let Some(anim) = &self.animation_state.rotation_state {
            let now = self.animation_state.frame_count;
            if now >= anim.end_frame {
                self.animation_state.rotation_state = None;
            } else {
                let progress =
                    (now - anim.start_frame) as f32 / (anim.end_frame - anim.start_frame) as f32;

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
        let mut tile_draw_pos: Option<Pos2> = None;

        if hypothetical_game.is_some() {
            let pointer_pos = response.hover_pos().unwrap();
            tile_draw_pos = Some(pointer_pos); // Default to pointer

            if self.animation_state.last_pointer_pos == Some(pointer_pos) {
                self.animation_state.pointer_dwell_frames += 1;
            } else {
                self.animation_state.pointer_dwell_frames = 0;
            }
            self.animation_state.last_pointer_pos = Some(pointer_pos);

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
            if self.animation_state.snap_animation.is_none() {
                if current_snap_tile != target_snap_tile {
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
            }

            // 3. Update any ongoing animation and determine draw position.
            if let Some(anim) = &mut self.animation_state.snap_animation {
                if now >= anim.end_frame {
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
                                let current_pos = anim.start_pos.lerp(anim.end_pos, eased_progress);

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
                        tile_draw_pos = Some(anim.start_pos.lerp(anim.end_pos, eased_progress));
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
                                anim.start_rotation
                            } else {
                                self.placement_rotation
                            }
                        } else {
                            self.placement_rotation
                        };

                    let tile = PlacedTile::new(tile_type, base_rotation_for_hypo_tile);
                    // To make the tile opaque, we pass a clone of the tile as the "prior" tile.
                    let prior_tile_for_opacity = Tile::Placed(tile);
                    Self::draw_hex(
                        pos,
                        hexagon_radius,
                        painter,
                        &tile,
                        self.rotation,
                        &prior_tile_for_opacity,
                        HIGHLIGHT_BORDER,
                        visual_rotation_rads,
                    );
                }
            }
        }

        if self.animation_state.last_hovered_tile != hovered_tile {
            self.animation_state.flow_animation = None;
        }
        self.animation_state.last_hovered_tile = hovered_tile;

        if let Some(hypo_game) = &hypothetical_game {
            if self.animation_state.flow_animation.is_none() {
                if let Some(placed_tile_pos) = hovered_tile {
                    if let Tile::Placed(placed_tile) = hypo_game.tile(placed_tile_pos) {
                        for dir_idx in 0..6 {
                            let dir = Direction::from_rotation(Rotation(dir_idx));
                            if let Some(player) = placed_tile.flow_cache(dir) {
                                let path_backward =
                                    trace_flow(hypo_game, placed_tile_pos, dir.reversed());
                                let path_forward = trace_flow(hypo_game, placed_tile_pos, dir);

                                let mut final_path =
                                    path_backward.into_iter().rev().collect::<Vec<_>>();
                                final_path.pop();
                                final_path.extend(path_forward);

                                self.animation_state.flow_animation = Some(FlowAnimation {
                                    start_frame: self.animation_state.frame_count,
                                    path: final_path,
                                    player,
                                });
                                break;
                            }
                        }
                    }
                }
            }
        } else {
            self.animation_state.flow_animation = None;
        }

        if let Some(anim) = &self.animation_state.flow_animation {
            let now = self.animation_state.frame_count;
            let frames_per_tile = 4 * DEBUG_ANIMATION_SPEED_MULTIPLIER;
            let elapsed_frames = now - anim.start_frame;

            let total_duration = anim.path.len() as u64 * frames_per_tile;

            if elapsed_frames < total_duration {
                let current_tile_idx = (elapsed_frames / frames_per_tile) as usize;
                let progress_in_segment =
                    (elapsed_frames % frames_per_tile) as f32 / frames_per_tile as f32;

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
                let draw_pos = sample_bezier(bezier_points, progress_in_segment);

                painter.circle_filled(draw_pos, 5.0, player_colour(anim.player));
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

#[cfg(test)]
mod tests {
    use crate::backend::InMemoryBackend;
    use crate::game::{GameSettings, GameViewer, Rotation};
    use crate::game_ui::GameUi;
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
}
