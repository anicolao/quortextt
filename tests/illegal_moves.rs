use flows::game::{Action, Game, GameSettings, Rotation, TilePos, TileType};
use flows::legality::{is_move_legal, LegalityError};

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
fn test_internal_pathway_contention_fails() {
    let mut game = setup_game();

    // Force contention on the empty hex (3,3).
    for r in 0..7 {
        for c in 0..7 {
            let pos = TilePos::new(r,c);
             if *game.tile(pos) == flows::game::Tile::Empty {
                if pos.row > 4 || pos.row < 2 || pos.col > 4 || pos.col < 2 {
                    game = game.with_tile_placed(TileType::OneSharp, pos, Rotation(0));
                }
             }
        }
    }
    game = game.with_tile_placed(TileType::OneSharp, TilePos::new(2,3), Rotation(0));
    game = game.with_tile_placed(TileType::OneSharp, TilePos::new(4,3), Rotation(0));
    game = game.with_tile_placed(TileType::OneSharp, TilePos::new(3,2), Rotation(0));

    // The illegal move is the final blocking piece.
    game.set_current_player_for_testing(0);
    let illegal_action = Action::PlaceTile {
        player: 0,
        tile: TileType::OneSharp,
        pos: TilePos::new(3, 4),
        rotation: Rotation(0),
    };

    let result = game.apply_action(illegal_action);
    assert!(result.is_err(), "The move should be illegal due to impossible internal pathway demands.");
}

#[test]
fn test_user_provided_scenario_is_illegal() {
    let mut game = setup_game();
    game.set_current_player_for_testing(0);
    game.apply_action(Action::PlaceTile { player: 0, tile: TileType::OneSharp, pos: TilePos::new(0, 0), rotation: Rotation(0) }).unwrap();

    game.set_current_player_for_testing(1);
    game.apply_action(Action::PlaceTile { player: 1, tile: TileType::TwoSharps, pos: TilePos::new(0, 1), rotation: Rotation(0) }).unwrap();

    game.set_current_player_for_testing(0);
    game.apply_action(Action::PlaceTile { player: 0, tile: TileType::OneSharp, pos: TilePos::new(0, 2), rotation: Rotation(0) }).unwrap();

    game.set_current_player_for_testing(1);
    let final_action = Action::PlaceTile { player: 1, tile: TileType::ThreeSharps, pos: TilePos::new(0, 3), rotation: Rotation(0) };

    let result = game.apply_action(final_action);
    assert!(result.is_err(), "User scenario should be illegal due to blocking P0 at the start.");
}

#[test]
fn test_user_b3_placement_is_legal() {
    let mut game = setup_game();
    let moves = [
        (0, TileType::ThreeSharps, TilePos::new(0, 0), Rotation(0)),
        (1, TileType::TwoSharps, TilePos::new(0, 1), Rotation(0)),
        (0, TileType::ThreeSharps, TilePos::new(0, 2), Rotation(0)),
        (1, TileType::ThreeSharps, TilePos::new(0, 3), Rotation(5)),
        (0, TileType::OneSharp, TilePos::new(2, 4), Rotation(0)),
        (1, TileType::OneSharp, TilePos::new(2, 3), Rotation(0)),
        (0, TileType::NoSharps, TilePos::new(1, 3), Rotation(0)),
        (1, TileType::TwoSharps, TilePos::new(2, 2), Rotation(0)),
    ];

    for (player, tile, pos, rotation) in moves {
        game.set_current_player_for_testing(player);
        let action = Action::PlaceTile { player, tile, pos, rotation };
        game.apply_action(action).unwrap();
    }

    game.set_current_player_for_testing(0);
    let target_pos = TilePos::new(1, 2); // B3 for Player 0

    for r in 0..6 {
        let mut game_for_this_rotation = game.clone();
        let rotation = Rotation(r);
        let action = Action::PlaceTile {
            player: 0,
            tile: TileType::NoSharps,
            pos: target_pos,
            rotation,
        };
        let result = game_for_this_rotation.apply_action(action);
        assert!(
            result.is_ok(),
            "Placing T0 at B3 with rotation {} was incorrectly flagged as illegal. Error: {:?}",
            r,
            result.err()
        );
    }
}

#[test]
fn test_no_contention_scenario_is_legal() {
    let mut game = setup_game();
    let moves = [
        (0, TileType::ThreeSharps, TilePos::new(0, 0), Rotation(0)),
        (1, TileType::TwoSharps, TilePos::new(0, 1), Rotation(0)),
        (0, TileType::ThreeSharps, TilePos::new(0, 2), Rotation(0)),
        (1, TileType::ThreeSharps, TilePos::new(0, 3), Rotation(5)),
        (0, TileType::OneSharp, TilePos::new(2, 4), Rotation(0)),
        (1, TileType::OneSharp, TilePos::new(2, 3), Rotation(0)),
        (0, TileType::NoSharps, TilePos::new(1, 3), Rotation(0)),
        (1, TileType::TwoSharps, TilePos::new(2, 2), Rotation(0)),
        (0, TileType::NoSharps, TilePos::new(1, 2), Rotation(5)),
        (1, TileType::OneSharp, TilePos::new(1, 4), Rotation(0)),
        (0, TileType::OneSharp, TilePos::new(2, 5), Rotation(1)),
        (1, TileType::ThreeSharps, TilePos::new(3, 5), Rotation(0)),
        (0, TileType::ThreeSharps, TilePos::new(3, 4), Rotation(1)),
    ];

    for (player, tile, pos, rotation) in moves {
        game.set_current_player_for_testing(player);
        game.apply_action(Action::PlaceTile { player, tile, pos, rotation }).unwrap();
    }

    game.set_current_player_for_testing(1); // Next player is P1

    let final_action = Action::PlaceTile {
        player: 1,
        tile: TileType::OneSharp,
        pos: TilePos::new(1, 1),
        rotation: Rotation(3),
    };

    let result = game.apply_action(final_action);
    assert!(result.is_ok(), "The no-contention scenario move was incorrectly flagged as illegal. Error: {:?}", result.err());
}

#[test]
fn test_final_scenario_is_illegal() {
    let mut game = setup_game();
    let moves = [
        (0, TileType::NoSharps, TilePos::new(0, 3), Rotation(5)),
        (1, TileType::OneSharp, TilePos::new(0, 2), Rotation(0)),
        (0, TileType::ThreeSharps, TilePos::new(1, 2), Rotation(4)),
        (1, TileType::TwoSharps, TilePos::new(0, 1), Rotation(2)),
        (0, TileType::OneSharp, TilePos::new(0, 0), Rotation(0)),
        (1, TileType::TwoSharps, TilePos::new(1, 3), Rotation(0)),
        (0, TileType::OneSharp, TilePos::new(1, 4), Rotation(1)),
        (1, TileType::ThreeSharps, TilePos::new(3, 4), Rotation(5)),
        (0, TileType::OneSharp, TilePos::new(2, 3), Rotation(0)),
        (1, TileType::OneSharp, TilePos::new(3, 5), Rotation(1)),
        (0, TileType::NoSharps, TilePos::new(2, 4), Rotation(5)),
        (1, TileType::TwoSharps, TilePos::new(2, 5), Rotation(5)),
        (0, TileType::TwoSharps, TilePos::new(4, 6), Rotation(4)),
        (1, TileType::OneSharp, TilePos::new(4, 5), Rotation(5)),
        (0, TileType::ThreeSharps, TilePos::new(3, 3), Rotation(3)),
        (1, TileType::NoSharps, TilePos::new(2, 2), Rotation(1)),
        (0, TileType::ThreeSharps, TilePos::new(2, 1), Rotation(1)),
        (1, TileType::ThreeSharps, TilePos::new(3, 2), Rotation(1)),
    ];
    for (player, tile, pos, rotation) in moves {
        game.set_current_player_for_testing(player);
        game.apply_action(Action::PlaceTile { player, tile, pos, rotation }).unwrap();
    }

    game.set_current_player_for_testing(0);
    let final_action = Action::PlaceTile { player: 0, tile: TileType::TwoSharps, pos: TilePos::new(1, 1), rotation: Rotation(5) };
    let result = game.apply_action(final_action);
    assert!(result.is_err(), "Final scenario move was considered legal but should be illegal.");
}

#[test]
fn test_user_d6_placement_is_legal() {
    let mut game = setup_game();
    let moves = [
        (0, TileType::ThreeSharps, TilePos::new(0, 0), Rotation(0)),
        (1, TileType::NoSharps, TilePos::new(2, 4), Rotation(0)),
        (0, TileType::OneSharp, TilePos::new(0, 1), Rotation(0)),
        (1, TileType::ThreeSharps, TilePos::new(0, 2), Rotation(0)),
        (0, TileType::NoSharps, TilePos::new(0, 3), Rotation(4)),
        (1, TileType::OneSharp, TilePos::new(1, 4), Rotation(5)),
        (0, TileType::NoSharps, TilePos::new(2, 5), Rotation(0)),
        (1, TileType::TwoSharps, TilePos::new(1, 3), Rotation(5)),
    ];

    for (player, tile, pos, rotation) in moves {
        game.set_current_player_for_testing(player);
        game.apply_action(Action::PlaceTile { player, tile, pos, rotation }).unwrap();
    }

    game.set_current_player_for_testing(0); // Next player is P0

    // The move in question: P0 places a T3 tile at D6 (3,5) with default rotation.
    let final_action = Action::PlaceTile {
        player: 0,
        tile: TileType::ThreeSharps,
        pos: TilePos::new(3, 5),
        rotation: Rotation(0),
    };

    let result = game.apply_action(final_action);
    assert!(result.is_ok(), "D6 placement with R0 was incorrectly flagged as illegal. Error: {:?}", result.err());
}

#[test]
fn test_user_d6_placement_all_rotations() {
    let mut game = setup_game();
    let moves = [
        (0, TileType::ThreeSharps, TilePos::new(0, 0), Rotation(0)),
        (1, TileType::NoSharps, TilePos::new(2, 4), Rotation(0)),
        (0, TileType::OneSharp, TilePos::new(0, 1), Rotation(0)),
        (1, TileType::ThreeSharps, TilePos::new(0, 2), Rotation(0)),
        (0, TileType::NoSharps, TilePos::new(0, 3), Rotation(4)),
        (1, TileType::OneSharp, TilePos::new(1, 4), Rotation(5)),
        (0, TileType::NoSharps, TilePos::new(2, 5), Rotation(0)),
        (1, TileType::TwoSharps, TilePos::new(1, 3), Rotation(5)),
    ];

    for (player, tile, pos, rotation) in moves {
        game.set_current_player_for_testing(player);
        game.apply_action(Action::PlaceTile { player, tile, pos, rotation }).unwrap();
    }

    game.set_current_player_for_testing(0); // Next player is P0
    let target_pos = TilePos::new(3, 5);

    for r in 0..6 {
        let mut game_for_this_rotation = game.clone();
        let action = Action::PlaceTile {
            player: 0,
            tile: TileType::ThreeSharps,
            pos: target_pos,
            rotation: Rotation(r),
        };
        let result = game_for_this_rotation.apply_action(action);
        assert!(result.is_ok(), "D6 placement with R{} was incorrectly flagged as illegal. Error: {:?}", r, result.err());
    }
}

#[test]
fn test_simple_block_returns_correct_error() {
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
    let game_with_illegal_move = game.with_tile_placed(TileType::OneSharp, TilePos::new(3,3), Rotation(0));

    let result = is_move_legal(&game_with_illegal_move);
    assert_eq!(result, Err(LegalityError::BlockedPlayer(0)), "The move should have been detected as illegal because it completely blocks Player 0.");
}
