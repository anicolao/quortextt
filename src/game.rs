use rand::Rng;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize, Deserialize)]
pub struct Rotation(pub u8); // 0 - 5; 1 is 60 degrees clockwise from default rotation

impl Rotation {
    pub fn reversed(&self) -> Self {
        Self((6 - self.0) % 6)
    }

    pub fn as_radians(&self) -> f32 {
        self.0 as f32 * std::f32::consts::PI / 3.0
    }
}

impl std::ops::Add<Rotation> for Rotation {
    type Output = Rotation;

    fn add(self, rhs: Rotation) -> Self::Output {
        Self((self.0 + rhs.0) % 6)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct TilePos {
    pub row: i32,
    pub col: i32,
}

impl TilePos {
    pub fn new(row: i32, col: i32) -> Self {
        Self { row, col }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct TileVec {
    pub row: i32,
    pub col: i32,
}

impl TileVec {
    pub fn new(row: i32, col: i32) -> Self {
        Self { row, col }
    }

    pub fn rotate(self, rotation: Rotation) -> Self {
        // These are the precomputed set of the rotation matrices for the six possible rotations.
        // We compute the rotated vector as follows:
        // | rotated_r | = | dr_r dr_c | * | r |
        // | rotated_c |   | dc_r dc_c |   | c |
        let (dr_r, dr_c, dc_r, dc_c) = [
            (1, 0, 0, 1),
            (1, -1, 1, 0),
            (0, -1, 1, -1),
            (-1, 0, 0, -1),
            (-1, 1, -1, 0),
            (0, 1, -1, 1),
        ][rotation.0 as usize];
        Self {
            row: dr_r * self.row + dr_c * self.col,
            col: dc_r * self.row + dc_c * self.col,
        }
    }
}

impl std::ops::Neg for TileVec {
    type Output = TileVec;

    fn neg(self) -> Self::Output {
        Self {
            row: -self.row,
            col: -self.col,
        }
    }
}

impl std::ops::Add<TileVec> for TilePos {
    type Output = TilePos;

    fn add(self, rhs: TileVec) -> Self::Output {
        Self {
            row: self.row + rhs.row,
            col: self.col + rhs.col,
        }
    }
}

impl std::ops::Sub for TilePos {
    type Output = TileVec;

    fn sub(self, rhs: TilePos) -> Self::Output {
        TileVec {
            row: self.row - rhs.row,
            col: self.col - rhs.col,
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Debug, Hash)]
pub enum Direction {
    SouthWest = 0,
    West = 1,
    NorthWest = 2,
    NorthEast = 3,
    East = 4,
    SouthEast = 5,
}

impl Direction {
    pub fn from_rotation(rotation: Rotation) -> Self {
        match rotation.0 {
            0 => Self::SouthWest,
            1 => Self::West,
            2 => Self::NorthWest,
            3 => Self::NorthEast,
            4 => Self::East,
            5 => Self::SouthEast,
            _ => panic!("Invalid rotation: {}", rotation.0),
        }
    }

    pub fn rotate(&self, rotation: Rotation) -> Self {
        Self::from_rotation(Rotation(((*self as u8) + rotation.0) % 6))
    }

    pub fn reversed(&self) -> Self {
        self.rotate(Rotation(3))
    }

    pub fn all_directions() -> impl Iterator<Item = Self> {
        [
            Self::SouthWest,
            Self::West,
            Self::NorthWest,
            Self::NorthEast,
            Self::East,
            Self::SouthEast,
        ]
        .into_iter()
    }

    // Turn the direction into (row delta, column delta), which are what you need to add to
    // a tile's row and column to get to the adjacent tile in this direction.
    pub fn tile_vec(&self) -> TileVec {
        match self {
            Self::SouthWest => TileVec::new(-1, -1),
            Self::West => TileVec::new(0, -1),
            Self::NorthWest => TileVec::new(1, 0),
            Self::NorthEast => TileVec::new(1, 1),
            Self::East => TileVec::new(0, 1),
            Self::SouthEast => TileVec::new(-1, 0),
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Debug, Serialize, Deserialize)]
pub enum TileType {
    NoSharps = 0,
    OneSharp = 1,
    TwoSharps = 2,
    ThreeSharps = 3,
}

impl TileType {
    pub fn num_sharps(&self) -> usize {
        *self as usize
    }

    pub fn from_num_sharps(n: usize) -> Self {
        match n {
            0 => Self::NoSharps,
            1 => Self::OneSharp,
            2 => Self::TwoSharps,
            3 => Self::ThreeSharps,
            n => panic!("Invalid number of sharps for a tile: {}", n),
        }
    }

    pub fn exit_from_entrance(&self, entrance: Direction) -> Direction {
        let exits = match self {
            Self::NoSharps => [2, 4, 0, 5, 1, 3],
            Self::OneSharp => [5, 3, 4, 1, 2, 0],
            Self::TwoSharps => [5, 4, 3, 2, 1, 0],
            Self::ThreeSharps => [5, 2, 1, 4, 3, 0],
        };
        Direction::from_rotation(Rotation(exits[entrance as usize]))
    }

    pub fn all_flows(&self) -> [(Direction, Direction); 3] {
        // This ordering is a hack to make sure that the straight segment (if there is one) is
        // always returned last. This works because the straight segment always goes from 1 to 4,
        // if it is present on the tile.
        [0u8, 2u8, 3u8, 5u8, 1u8, 4u8]
            .into_iter()
            .filter_map(|i| {
                let entrance = Direction::from_rotation(Rotation(i));
                let exit = self.exit_from_entrance(entrance);
                if entrance < exit {
                    Some((entrance, exit))
                } else {
                    None
                }
            })
            .collect::<Vec<_>>()
            .try_into()
            .expect("Should always return three flows")
    }
}

pub type Player = usize;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct PlacedTile {
    type_: TileType,
    rotation: Rotation,
    // Cached set of the current flowed colour, indexed by the direction of the edge. For each flow,
    flow_cache: [Option<Player>; 6],
}

impl PlacedTile {
    pub fn new(type_: TileType, rotation: Rotation) -> Self {
        Self {
            type_,
            rotation,
            flow_cache: [None; 6],
        }
    }

    pub fn type_(&self) -> TileType {
        self.type_
    }

    pub fn rotation(&self) -> Rotation {
        self.rotation
    }

    pub fn exit_from_entrance(&self, entrance: Direction) -> Direction {
        self.type_
            .exit_from_entrance(entrance.rotate(self.rotation.reversed()))
            .rotate(self.rotation)
    }

    pub fn all_flows(&self) -> [(Direction, Direction); 3] {
        self.type_
            .all_flows()
            .map(|(d1, d2)| (d1.rotate(self.rotation), d2.rotate(self.rotation)))
    }

    pub fn flow_cache(&self, direction: Direction) -> Option<Player> {
        self.flow_cache[direction as usize]
    }

    pub fn set_flow_cache(&mut self, direction: Direction, player: Option<Player>) {
        self.flow_cache[direction as usize] = player;
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum AdjacentTile {
    BoardEdge(Direction),
    Tile(TilePos),
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Tile {
    NotOnBoard,
    Empty,
    Placed(PlacedTile),
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub enum GameViewer {
    Player(Player),
    Spectator,
    Admin,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GameSettings {
    pub num_players: usize,
    pub version: usize,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum Action {
    InitializeGame(GameSettings),
    DrawTile {
        player: Player,
        tile: TileType,
    },
    RevealTile {
        player: Player,
        tile: TileType,
    },
    PlaceTile {
        player: Player,
        tile: TileType,
        pos: TilePos,
        rotation: Rotation,
    },
}

impl Action {
    pub fn visible(&self, game_viewer: GameViewer) -> bool {
        match self {
            Action::InitializeGame(_) | Action::RevealTile { .. } | Action::PlaceTile { .. } => {
                true
            }
            Action::DrawTile { player, .. } => match game_viewer {
                GameViewer::Player(viewing_player) => *player == viewing_player,
                GameViewer::Spectator => false,
                GameViewer::Admin => true,
            },
        }
    }

    /// This function only checks whether the viewer is theoretically allowed to perform the
    /// action. The actual `Game` is responsible for checking whether the action is legal in
    /// context.
    pub fn performable(&self, game_viewer: GameViewer) -> bool {
        match game_viewer {
            GameViewer::Spectator => false,
            GameViewer::Admin => true,
            GameViewer::Player(viewing_player) => match self {
                Action::InitializeGame(_) | Action::DrawTile { .. } => false,
                Action::PlaceTile { player, .. } | Action::RevealTile { player, .. } => {
                    *player == viewing_player
                }
            },
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum GameOutcome {
    Victory(Vec<Player>),
    // TODO: Draw by board full?
}

#[derive(Clone)]
pub struct Game {
    settings: GameSettings,
    /// Mapping from a side of the board to a player. Side 0 corresponds
    /// to rotation 0 (top of the board), 1 is the next side clockwise,
    /// and so on around the board.
    sides: [Option<Player>; 6],
    remaining_tiles: [u8; 4],
    tiles_in_hand: Vec<Option<TileType>>,
    board: [[Tile; 7]; 7],
    action_history: Vec<Action>,
    current_player: Player,
    outcome: Option<GameOutcome>,
}

impl Game {
    pub fn new(settings: GameSettings) -> Self {
        if settings.version != 0 {
            panic!("Invalid version: {}", settings.version);
        }
        if settings.num_players < 2 || settings.num_players > 3 {
            panic!("Invalid number of players: {}", settings.num_players);
        }

        let mut board = [[Tile::Empty; 7]; 7];
        // Fill in Tile::NotOnBoard on top left and bottom right
        for i in 0..3 {
            for j in 0..(3 - i) {
                board[6 - i][j] = Tile::NotOnBoard;
                board[i][6 - j] = Tile::NotOnBoard;
            }
        }

        let mut sides = [None; 6];
        sides[0] = Some(0);
        sides[2] = Some(1);
        if settings.num_players == 3 {
            sides[4] = Some(2);
        }

        Self {
            settings: settings.clone(),
            sides,
            remaining_tiles: [10; 4],
            tiles_in_hand: vec![None; settings.num_players],
            board,
            action_history: vec![Action::InitializeGame(settings)],
            current_player: 0,
            outcome: None,
        }
    }

    pub fn from_actions(action_history: Vec<Action>) -> Result<Self, String> {
        let mut game = match &action_history[0] {
            Action::InitializeGame(settings) => Self::new(settings.clone()),
            action => panic!(
                "First action in history must be InitializeGame, instead found {:?}",
                action
            ),
        };
        match action_history
            .into_iter()
            .skip(1)
            .try_for_each(|action| game.apply_action(action))
        {
            Err(err) => Err(err),
            Ok(()) => Ok(game),
        }
    }

    pub fn apply_action(&mut self, action: Action) -> Result<(), String> {
        match action {
            Action::InitializeGame(_) => return Err("Game initialized twice".into()),
            Action::DrawTile { player, tile } => {
                if self.tiles_in_hand[player].is_some() {
                    return Err("Player already has a tile in hand".into());
                }
                if self.remaining_tiles[tile as usize] == 0 {
                    return Err("No tiles remaining of drawn type".into());
                }
                self.tiles_in_hand[player] = Some(tile);
                self.remaining_tiles[tile as usize] -= 1;
            }
            Action::RevealTile { player, tile } => {
                if self.tiles_in_hand[player].is_some() && self.tiles_in_hand[player] != Some(tile)
                {
                    return Err("Must reveal actual tile that player holds".into());
                }
                self.tiles_in_hand[player] = Some(tile);
            }
            Action::PlaceTile {
                player,
                tile,
                pos,
                rotation,
            } => {
                if self.outcome.is_some() {
                    return Err("Game is already over".into());
                }
                if self.tiles_in_hand[player].is_some() && self.tiles_in_hand[player] != Some(tile)
                {
                    return Err("Player must play the tile from their hand".into());
                }
                if *self.tile(pos) != Tile::Empty {
                    return Err("Can only place tile on an empty space".into());
                }
                if self.current_player != player {
                    return Err("Wrong player's turn".into());
                }

                // Check for legality
                let mut temp_game = self.clone();
                *temp_game.tile_mut(pos).unwrap() = Tile::Placed(PlacedTile::new(tile, rotation));
                temp_game.recompute_flows(); // Needed for win condition check

                if crate::legality::is_move_legal(&temp_game).is_err() {
                    return Err("Illegal move: blocks another player".into());
                }

                // If legal, apply to the actual game
                *self.tile_mut(pos).unwrap() = Tile::Placed(PlacedTile::new(tile, rotation));
                self.tiles_in_hand[player] = None;
                self.recompute_flows();
                if self.outcome.is_none() {
                    self.current_player = (self.current_player + 1) % self.settings.num_players;
                }
            }
        }
        self.action_history.push(action);
        Ok(())
    }

    /// Selects a random tile from the remaining tiles, with odds proportional to how many tiles
    /// remain of each type. Does not modify the game state; if a player is drawing a tile,
    /// `apply_action(DrawTile { .. })` should be called.
    pub fn draw_random_tile<R: Rng>(&self, rng: &mut R) -> TileType {
        let total_tiles = self.remaining_tiles.iter().sum();
        let mut drawn_tile = rng.random_range(0..total_tiles);
        for (sharps, num_tiles) in self.remaining_tiles.iter().enumerate() {
            if drawn_tile < *num_tiles {
                return TileType::from_num_sharps(sharps);
            }
            drawn_tile -= *num_tiles;
        }
        // Should be unreachable
        panic!("Somehow did not select a tile in draw_random_tile")
    }

    /// Perform automatic actions, such as drawing tiles for whichever players need them and revealing the tile of the current player if it hasn't been revealed,
    pub fn do_automatic_actions<R: Rng>(&mut self, rng: &mut R) {
        // Draw tiles for players with no tiles, in order from the current player.
        for player in (self.current_player..self.settings.num_players).chain(0..self.current_player)
        {
            if self.tiles_in_hand[player].is_none() && self.remaining_tiles.iter().sum::<u8>() > 0 {
                let drawn_tile = self.draw_random_tile(rng);
                self.apply_action(Action::DrawTile {
                    player,
                    tile: drawn_tile,
                })
                .unwrap();
            }
        }

        // Check whether the current player has revealed their tile since they last drew.
        let mut tile_is_revealed = false;
        for action in self.action_history.iter().rev() {
            match action {
                Action::InitializeGame(_) | Action::PlaceTile { .. } => (),
                Action::DrawTile { player, .. } => {
                    if *player == self.current_player {
                        // Found the current player drawing a tile before we found them revealing
                        // it, so we should reveal it. We do this by breakout out of the loop and
                        // letting the `tile_is_revealed` check below handle it.
                        break;
                    }
                }
                Action::RevealTile { player, .. } => {
                    if *player == self.current_player {
                        // The player has already revealed their tile.
                        tile_is_revealed = true;
                        break;
                    }
                }
            }
        }
        if !tile_is_revealed {
            if let Some(tile) = self.tiles_in_hand[self.current_player] {
                self.apply_action(Action::RevealTile {
                    player: self.current_player,
                    tile,
                })
                .unwrap()
            }
        }
    }

    /// Returns a copy of the game with the tile placed at the given location and rotation. Does
    /// not do any legality checking.
    pub fn with_tile_placed(&self, tile: TileType, pos: TilePos, rotation: Rotation) -> Self {
        let mut new_game = self.clone();
        // Technically this should at least check that the tile is being placed on the board. Right
        // now you can place a tile in the corners of the square that the board lives within.
        *new_game.tile_mut(pos).unwrap() = Tile::Placed(PlacedTile::new(tile, rotation));
        new_game.recompute_flows();
        new_game
    }

    pub fn action_history_vec(&self) -> &Vec<Action> {
        &self.action_history
    }

    pub fn action_history(&self) -> impl Iterator<Item = &Action> {
        self.action_history.iter()
    }

    pub fn actions_for_viewer(&self, viewer: GameViewer) -> impl Iterator<Item = &Action> {
        self.action_history
            .iter()
            .filter(move |action| action.visible(viewer))
    }

    /// Returns the tile position at the center of the board.
    pub fn center_pos(&self) -> TilePos {
        TilePos { row: 3, col: 3 }
    }

    pub fn num_players(&self) -> usize {
        self.settings.num_players
    }

    pub fn current_player(&self) -> Player {
        self.current_player
    }

    pub fn set_current_player_for_testing(&mut self, player: Player) {
        self.current_player = player;
    }

    pub fn outcome(&self) -> &Option<GameOutcome> {
        &self.outcome
    }

    pub fn player_on_side(&self, rotation: Rotation) -> Option<Player> {
        self.sides[rotation.0 as usize]
    }

    pub fn tile_in_hand(&self, player: Player) -> Option<TileType> {
        self.tiles_in_hand[player]
    }

    pub fn tile_mut(&mut self, pos: TilePos) -> Option<&mut Tile> {
        if pos.row < 0 || pos.col < 0 || pos.row >= 7 || pos.col >= 7 {
            return None;
        }
        Some(&mut self.board[pos.row as usize][pos.col as usize])
    }

    pub fn tile(&self, pos: TilePos) -> &Tile {
        if pos.row < 0 || pos.col < 0 || pos.row >= 7 || pos.col >= 7 {
            return &self.board[6][0]; // Some arbitrary NotOnBoard position so that we can return
                                      // a reference.
        }
        &self.board[pos.row as usize][pos.col as usize]
    }

    pub fn adjacent_tile(&self, pos: TilePos, direction: Direction) -> AdjacentTile {
        let t = self.tile(pos + direction.tile_vec());
        if *t == Tile::NotOnBoard {
            return AdjacentTile::BoardEdge(direction);
        }
        AdjacentTile::Tile(pos + direction.tile_vec())
    }

    pub fn get_neighbor_pos(&self, pos: TilePos, direction: Direction) -> Option<TilePos> {
        let neighbor_pos = pos + direction.tile_vec();
        if *self.tile(neighbor_pos) == Tile::NotOnBoard {
            None
        } else {
            Some(neighbor_pos)
        }
    }

    pub fn get_direction_towards(&self, from: TilePos, to: TilePos) -> Option<Direction> {
        let d = to - from;
        for dir in Direction::all_directions() {
            if dir.tile_vec() == d {
                return Some(dir);
            }
        }
        None
    }

    pub fn is_border_edge(&self, pos: TilePos, dir: Direction) -> bool {
        // An edge is a border edge if the tile on the other side is NotOnBoard.
        let neighbor_pos = pos + dir.tile_vec();
        *self.tile(neighbor_pos) == Tile::NotOnBoard
    }

    pub fn edges_on_board_edge(&self, rotation: Rotation) -> Vec<(TilePos, Direction)> {
        let bottom_edges = vec![
            (TilePos::new(0, 0), Direction::SouthEast),
            (TilePos::new(0, 1), Direction::SouthWest),
            (TilePos::new(0, 1), Direction::SouthEast),
            (TilePos::new(0, 2), Direction::SouthWest),
            (TilePos::new(0, 2), Direction::SouthEast),
            (TilePos::new(0, 3), Direction::SouthWest),
            (TilePos::new(0, 3), Direction::SouthEast),
        ];
        let center = self.center_pos();
        bottom_edges
            .into_iter()
            .map(|(pos, dir)| {
                (
                    center + (pos - center).rotate(rotation),
                    dir.rotate(rotation),
                )
            })
            .collect::<Vec<_>>()
    }

    // Create a board by randomly placing a bunch of tiles. This function does not attempt to obey the
    // 10-instances-per-type of the actual game, and may leave non-board variables in a bad state.
    pub fn random_board_for_testing<R: Rng>(rng: &mut R, p_filled: f32) -> Self {
        let mut g = Self::new(GameSettings {
            num_players: 3,
            version: 0,
        });

        for i in 0..7 {
            for j in 0..7 {
                if g.board[i][j] == Tile::NotOnBoard {
                    continue;
                }
                if rng.random::<f32>() < p_filled {
                    g.board[i][j] = Tile::Placed(PlacedTile::new(
                        TileType::from_num_sharps(rng.random_range(0..4)),
                        Rotation(rng.random_range(0..6)),
                    ));
                }
            }
        }
        g.recompute_flows();

        g
    }

    // Fill a flow in a tile starting from the edge specified by `dir`. If there is an adjacent
    // tile at the other end of the flow, continue flowing into that edge.
    fn floodfill_path(&mut self, player: Player, mut pos: TilePos, mut dir: Direction) {
        loop {
            match self.tile_mut(pos) {
                None | Some(Tile::NotOnBoard) | Some(Tile::Empty) => break,
                Some(Tile::Placed(tile)) => {
                    let exit_dir = tile.exit_from_entrance(dir);
                    tile.set_flow_cache(dir, Some(player));
                    tile.set_flow_cache(exit_dir, Some(player));
                    match self.adjacent_tile(pos, exit_dir) {
                        AdjacentTile::BoardEdge(_) => break,
                        AdjacentTile::Tile(next_pos) => {
                            pos = next_pos;
                            dir = exit_dir.reversed();
                        }
                    }
                }
            }
        }
    }

    pub fn recompute_flows(&mut self) {
        for i in 0..7 {
            for j in 0..7 {
                if let Tile::Placed(mut tile) = self.board[i][j] {
                    tile.flow_cache = [None; 6]
                }
            }
        }

        for side in 0..6 {
            match self.sides[side] {
                None => (),
                Some(player) => {
                    for (pos, dir) in self.edges_on_board_edge(Rotation(side as u8)) {
                        self.floodfill_path(player, pos, dir);
                    }
                }
            }
        }
        self.update_outcome();
    }

    fn update_outcome(&mut self) {
        if self.outcome.is_some() {
            return;
        }

        let mut winners = vec![];
        for side in 0..6 {
            if let Some(player) = self.sides[side] {
                let opposite_side = (side + 3) % 6;
                for (pos, dir) in self.edges_on_board_edge(Rotation(opposite_side as u8)) {
                    if let Tile::Placed(tile) = self.tile(pos) {
                        if tile.flow_cache(dir) == Some(player) {
                            // Player `player` has reached the opposite side.
                            winners.push(player);
                            if let Some(teammate) = self.sides[opposite_side] {
                                winners.push(teammate);
                            }
                        }
                    }
                }
                // We don't break here because multiple players can win on the same turn.
            }
        }

        if !winners.is_empty() {
            winners.sort();
            winners.dedup();
            self.outcome = Some(GameOutcome::Victory(winners));
        }
    }
}

impl std::fmt::Debug for Game {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        for row in (0..7).rev() {
            // Write initial whitespace
            for _ in 0..(7 - row) {
                write!(f, " ")?;
            }
            for col in 0..7 {
                match self.board[row][col] {
                    Tile::NotOnBoard => write!(f, "  ")?,
                    Tile::Empty => write!(f, ". ")?,
                    Tile::Placed(tile) => write!(f, "{} ", tile.type_.num_sharps())?,
                }
            }
            writeln!(f)?;
        }

        // TODO: There is a better way to do this but I can't look it up because I'm on
        // a plane.
        writeln!(f, "Settings: {:?}", self.settings)?;
        writeln!(f, "Sides: {:?}", self.sides)?;
        writeln!(f, "Remaining tiles: {:?}", self.remaining_tiles)?;
        writeln!(f, "Tiles in hand: {:?}", self.tiles_in_hand)?;
        writeln!(f, "Current player: {:?}", self.current_player)?;
        writeln!(f, "Action history: {:?}", self.action_history)?;
        Ok(())
    }
}
