use flows::game::{Action, Game, GameSettings, Rotation, TilePos, TileType};

// Helper function to create a default 2-player game.
// Player 0 is on side 0 (top).
// Player 1 is on side 2 (bottom-left).
fn setup_game() -> Game {
    let settings = GameSettings {
        num_players: 2,
        version: 0,
    };
    Game::new(settings)
}

fn all_board_positions() -> impl Iterator<Item = TilePos> {
    (0..7).flat_map(|r| (0..7).map(move |c| TilePos::new(r, c)))
}

#[test]
fn test_simple_block_fails() {
    let mut game = setup_game();

    // Player 0's goal is the opposite side of the board (side 3, bottom).
    // We build a horizontal wall that cuts Player 0 off from their goal.
    let wall_positions = [
        TilePos::new(3, 0), TilePos::new(3, 1), TilePos::new(3, 2),
        /* hole at (3,3) */ TilePos::new(3, 4), TilePos::new(3, 5), TilePos::new(3, 6),
    ];

    for &pos in &wall_positions {
        // We use a T1 tile because it does not have any paths that cross
        // the horizontal axis of the board, making it a solid wall for Player 0.
        game = game.with_tile_placed(TileType::OneSharp, pos, Rotation(0));
    }

    // The final move places a T1 tile at (3,3), completing the wall.
    game.set_current_player_for_testing(1);
    let illegal_action = Action::PlaceTile {
        player: 1,
        tile: TileType::OneSharp,
        pos: TilePos::new(3, 3),
        rotation: Rotation(0),
    };

    let result = game.apply_action(illegal_action);
    assert!(result.is_err(), "The move should have been detected as illegal because it completely blocks Player 0.");
}

#[test]
fn test_inter_hex_edge_contention_fails() {
    let mut game = setup_game();

    // To force contention on the edge between (3,3) and (4,3), we must
    // block all other paths. We will build two solid walls, leaving only
    // the column of hexes containing (3,3) and (4,3) open.
    for pos in all_board_positions() {
        if pos.col < 3 || pos.col > 3 {
             if *game.tile(pos) == flows::game::Tile::Empty {
                game = game.with_tile_placed(TileType::OneSharp, pos, Rotation(0));
             }
        }
    }

    // With the walls up, both P0 and P1 MUST travel down the corridor in column 3.
    // Their paths must cross the edge between (3,3) and (4,3).
    // Any move is now illegal if it leaves the board in this state.
    game.set_current_player_for_testing(0);
    let illegal_action = Action::PlaceTile {
        player: 0,
        tile: TileType::NoSharps,
        pos: TilePos::new(0, 0), // An arbitrary empty spot
        rotation: Rotation(0),
    };

    // WHY THIS MOVE IS ILLEGAL:
    // Contending Players: 0 and 1
    // Contested Resource: The inter-hex edge between (3,3) and (4,3).
    // Reason: The walls force both players' only potential paths down the same
    // column. They must both cross the same edges, which is not allowed.

    let result = game.apply_action(illegal_action);
    assert!(result.is_err(), "The move should be illegal due to inter-hex edge contention.");
}

#[test]
fn test_internal_pathway_contention_fails() {
    let mut game = setup_game();

    // We create a situation where both players must route through the empty hex (3,3).
    // We need to build walls to make this the only possible route.
    // P0 needs W-E, P1 needs N-S. No tile can satisfy both.
    for pos in all_board_positions() {
        // Leave a 3x3 box around the center empty
        if pos.row > 4 || pos.row < 2 || pos.col > 4 || pos.col < 2 {
            if *game.tile(pos) == flows::game::Tile::Empty {
                game = game.with_tile_placed(TileType::OneSharp, pos, Rotation(0));
            }
        }
    }
    // Now we have a 3x3 empty area. Let's block it up to force contention on (3,3).
    // Force P0 through horizontally
    game = game.with_tile_placed(TileType::OneSharp, TilePos::new(2,3), Rotation(0));
    game = game.with_tile_placed(TileType::OneSharp, TilePos::new(4,3), Rotation(0));
    // Force P1 through vertically
    game = game.with_tile_placed(TileType::OneSharp, TilePos::new(3,2), Rotation(0));

    // The illegal move is the final blocking piece.
    game.set_current_player_for_testing(0);
    let illegal_action = Action::PlaceTile {
        player: 0,
        tile: TileType::OneSharp,
        pos: TilePos::new(3, 4),
        rotation: Rotation(0),
    };

    // WHY THIS MOVE IS ILLEGAL:
    // Contending Players: 0 and 1
    // Contested Resource: The internal pathways of the empty hex at (3,3).
    // Reason: The walls force P0's path to require a W-E connection through (3,3),
    // and P1's path to require a N-S connection. No tile can do both.

    let result = game.apply_action(illegal_action);
    assert!(result.is_err(), "The move should be illegal due to impossible internal pathway demands.");
}
