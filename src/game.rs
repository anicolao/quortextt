use rand::prelude::*;

#[derive(Clone, Copy, PartialEq, Eq)]
pub struct Rotation(pub u8); // 0 - 5; 1 is 60 degrees clockwise from default rotation

impl Rotation {
    fn reversed(self) -> Self {
        Self(5 - self.0)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
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

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Debug)]
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

    pub fn rotate(self, rotation: Rotation) -> Self {
        Self::from_rotation(Rotation(((self as u8) + rotation.0) % 6))
    }

    pub fn reversed(self) -> Self {
        self.rotate(Rotation(3))
    }

    // Turn the direction into (row delta, column delta), which are what you need to add to
    // a tile's row and column to get to the adjacent tile in this direction.
    pub fn tile_vec(self) -> TileVec {
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

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum TileType {
    NoSharps = 0,
    OneSharp = 1,
    TwoSharps = 2,
    ThreeSharps = 3,
}

impl TileType {
    pub fn num_sharps(self) -> usize {
        self as usize
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

    pub fn exit_from_entrance(self, entrance: Direction) -> Direction {
        let exits = match self {
            Self::NoSharps => [2, 4, 0, 5, 1, 3],
            Self::OneSharp => [5, 3, 4, 1, 2, 0],
            Self::TwoSharps => [5, 4, 3, 2, 1, 0],
            Self::ThreeSharps => [5, 2, 1, 4, 3, 0],
        };
        Direction::from_rotation(Rotation(exits[entrance as usize]))
    }

    pub fn all_flows(self) -> [(Direction, Direction); 3] {
        (0u8..6)
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

type Player = usize;

#[derive(Clone, Copy, PartialEq, Eq)]
pub struct PlacedTile {
    type_: TileType,
    rotation: Rotation,
    // Cached set of the current flowed colour, indexed by the direction of the edge. For each flow,
    flows: [Option<Player>; 6],
}

impl PlacedTile {
    pub fn new(type_: TileType, rotation: Rotation) -> Self {
        Self {
            type_,
            rotation,
            flows: [None; 6],
        }
    }

    pub fn exit_from_entrance(self, entrance: Direction) -> Direction {
        self.type_
            .exit_from_entrance(entrance.rotate(self.rotation.reversed()))
            .rotate(self.rotation)
    }

    pub fn all_flows(self) -> [(Direction, Direction); 3] {
        self.type_
            .all_flows()
            .map(|(d1, d2)| (d1.rotate(self.rotation), d2.rotate(self.rotation)))
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum AdjacentTile {
    BoardEdge(Option<Player>),
    Tile(TilePos),
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Tile {
    NotOnBoard,
    Empty,
    Placed(PlacedTile),
}

pub struct Game {
    num_players: usize,
    board: [[Tile; 7]; 7],
    sides: [Option<Player>; 6], // Mapping from a side of the board to a player. Side 0 corresponds
                                // to rotation 0 (top of the board), 1 is the next side clockwise,
                                // and so on around the board.
}

impl Game {
    pub fn new(num_players: usize) -> Self {
        if num_players < 2 || num_players > 3 {
            panic!("Invalid number of players: {}", num_players);
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
        if num_players == 3 {
            sides[4] = Some(2);
        }

        Self {
            num_players,
            board,
            sides,
        }
    }

    pub fn center_pos(&self) -> TilePos {
        TilePos { row: 3, col: 3 }
    }

    pub fn get_tile(&self, pos: TilePos) -> Tile {
        if pos.row < 0 || pos.col < 0 || pos.row >= 7 || pos.col >= 7 {
            return Tile::NotOnBoard;
        }
        self.board[pos.row as usize][pos.col as usize]
    }

    pub fn adjacent_tile(&self, pos: TilePos, direction: Direction) -> AdjacentTile {
        AdjacentTile::Tile(pos + direction.tile_vec())
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
    pub fn random_board_for_testing(p_filled: f32) -> Self {
        let mut g = Self::new(2);

        let mut rng = rand::rng();
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

        g
    }

    pub fn recompute_flows(&mut self) {
        for i in 0..7 {
            for j in 0..7 {
                match self.board[i][j] {
                    Tile::Placed(mut tile) => tile.flows = [None; 6],
                    _ => (),
                }
            }
        }

        for side in 0..6 {
            match self.sides[side] {
                None => (),
                Some(player) => {
                    for (pos, dir) in self.edges_on_board_edge(Rotation(side as u8)) {
                        // TODO: Actually floodfill from here
                    }
                }
            }
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
            write!(f, "\n")?;
        }
        Ok(())
    }
}
