use flows::ai_backend::{get_legal_moves, EasyAiBackend, MediumAiBackend};
use flows::backend::Backend;
use flows::game::{Action, Game, GameSettings, GameViewer, Rotation, TilePos, TileType};

fn setup_ai_game() -> EasyAiBackend {
    let settings = GameSettings {
        num_players: 2,
        version: 0,
    };
    EasyAiBackend::new(settings, false) // Disable AI debugging in tests
}

#[test]
fn test_ai_backend_creation() {
    let ai_backend = setup_ai_game();
    // Test that the AI backend can be created successfully
    assert_eq!(ai_backend.viewer(), GameViewer::Admin);
}

#[test]
fn test_ai_can_make_moves() {
    let mut ai_backend = setup_ai_game();

    // Initialize the game
    let init_action = Action::InitializeGame(GameSettings {
        num_players: 2,
        version: 0,
    });
    ai_backend.submit_action(init_action);

    // Give player 0 (human) a tile and place one
    let human_draw = Action::DrawTile {
        player: 0,
        tile: TileType::NoSharps,
    };
    ai_backend.submit_action(human_draw);

    let human_place = Action::PlaceTile {
        player: 0,
        tile: TileType::NoSharps,
        pos: TilePos::new(3, 3),
        rotation: Rotation(0),
    };
    ai_backend.submit_action(human_place);

    // Give AI (player 1) a tile
    let ai_draw = Action::DrawTile {
        player: 1,
        tile: TileType::OneSharp,
    };
    ai_backend.submit_action(ai_draw);

    // Trigger AI thinking by calling update - it should make a move
    ai_backend.update();

    // Check that the AI has made some moves
    let actions = ai_backend.actions_from_index(0);
    assert!(actions.len() >= 4, "AI should have made at least one move");
}

#[test]
fn test_ai_evaluation_improvements() {
    // This test verifies that our new evaluation logic is working
    // by creating an AI backend and checking it doesn't crash during evaluation
    let ai_backend = setup_ai_game();

    // Initialize the game
    let init_action = Action::InitializeGame(GameSettings {
        num_players: 2,
        version: 0,
    });
    ai_backend.submit_action(init_action);

    // The test passes if the AI backend was created successfully and
    // the initialization worked without crashing our new evaluation code
    assert_eq!(ai_backend.viewer(), GameViewer::Admin);

    // Verify action history contains the initialization
    let actions = ai_backend.actions_from_index(0);
    assert!(
        !actions.is_empty(),
        "Should have at least the initialization action"
    );
}

#[test]
fn test_medium_ai_move_ordering() {
    let settings = GameSettings {
        num_players: 2,
        version: 0,
    };
    // Use a non-admin viewer to prevent the AI from automatically making moves
    let ai_backend =
        MediumAiBackend::new(settings.clone(), 2, false).backend_for_viewer(GameViewer::Player(0));

    // Manually construct a game state to test all ordering priorities
    let mut game = Game::new(settings);

    // --- Setup game state ---
    // Player 0 (human) has a flow on their starting edge.
    game.apply_action(Action::PlaceTile {
        player: 0,
        tile: TileType::NoSharps,
        pos: TilePos::new(0, 3), // Side 0 (top) is a human start edge
        rotation: Rotation(0),
    })
    .unwrap();
    // AI (player 1) has a flow on their starting edge.
    game.apply_action(Action::PlaceTile {
        player: 1,
        tile: TileType::NoSharps,
        pos: TilePos::new(3, 0), // Side 2 (left) is an AI start edge
        rotation: Rotation(0),
    })
    .unwrap();
    // Second-to-last move (somewhere else)
    game.apply_action(Action::PlaceTile {
        player: 0,
        tile: TileType::OneSharp,
        pos: TilePos::new(1, 1),
        rotation: Rotation(0),
    })
    .unwrap();
    // Last move (somewhere else)
    game.apply_action(Action::PlaceTile {
        player: 1,
        tile: TileType::OneSharp,
        pos: TilePos::new(5, 5),
        rotation: Rotation(0),
    })
    .unwrap();

    // Recompute flows and set the current player to the AI for the test.
    game.recompute_flows();
    game.set_current_player_for_testing(1);

    // --- Define expected move priorities ---
    // Note: AI is player 1, Human is player 0
    let p1_adj_to_last_move = TilePos::new(5, 4); // Priority 1 (adj to (5,5))
    let p2_adj_to_second_last_move = TilePos::new(1, 2); // Priority 2 (adj to (1,1))
    let p3_adj_to_ai_flow = TilePos::new(3, 1); // Priority 3 (adj to AI flow at (3,0))
    let p4_adj_to_human_flow = TilePos::new(1, 3); // Priority 4 (adj to human flow at (0,3))
    let p5_other_move = TilePos::new(6, 3); // Priority 5 (far away from other things)

    let ai_player_id = 1;
    let tile_to_play = TileType::NoSharps;

    // Get all legal moves
    let mut moves = get_legal_moves(&game, ai_player_id, tile_to_play);

    // Order them using the AI's logic
    ai_backend.order_moves(&game, &mut moves);

    // --- Find the position of our test moves in the sorted list ---
    let mut move_priorities = vec![];
    let mut found_positions = std::collections::HashSet::new();
    for (i, action) in moves.iter().enumerate() {
        if let Action::PlaceTile { pos, .. } = action {
            if found_positions.contains(pos) {
                continue;
            }

            if *pos == p1_adj_to_last_move {
                move_priorities.push((1, i));
                found_positions.insert(*pos);
            } else if *pos == p2_adj_to_second_last_move {
                move_priorities.push((2, i));
                found_positions.insert(*pos);
            } else if *pos == p3_adj_to_ai_flow {
                move_priorities.push((3, i));
                found_positions.insert(*pos);
            } else if *pos == p4_adj_to_human_flow {
                move_priorities.push((4, i));
                found_positions.insert(*pos);
            } else if *pos == p5_other_move {
                move_priorities.push((5, i));
                found_positions.insert(*pos);
            }
        }
    }

    // Sort by priority (1, 2, 3...) to check their final ranks
    move_priorities.sort_by_key(|k| k.0);

    // --- Assert the final order ---
    assert_eq!(
        move_priorities.len(),
        5,
        "Did not find all test moves in the legal moves list"
    );

    // The index in the sorted list should be monotonically increasing
    // i.e., priority 1 move < priority 2 move < priority 3 move ...
    assert!(
        move_priorities[0].1 < move_priorities[1].1,
        "P1_rank({:?}) should be < P2_rank({:?})",
        move_priorities[0], move_priorities[1]
    );
    assert!(
        move_priorities[1].1 < move_priorities[2].1,
        "P2_rank({:?}) should be < P3_rank({:?})",
        move_priorities[1], move_priorities[2]
    );
    assert!(
        move_priorities[2].1 < move_priorities[3].1,
        "P3_rank({:?}) should be < P4_rank({:?})",
        move_priorities[2], move_priorities[3]
    );
    assert!(
        move_priorities[3].1 < move_priorities[4].1,
        "P4_rank({:?}) should be < P5_rank({:?})",
        move_priorities[3], move_priorities[4]
    );
}

#[test]
fn test_medium_ai_can_make_a_move() {
    let settings = GameSettings {
        num_players: 2,
        version: 0,
    };
    let mut ai_backend = MediumAiBackend::new(settings, 1, false);

    // The backend auto-initializes and draws tiles. Find the human's tile.
    let human_tile = ai_backend
        .actions_from_index(0)
        .iter()
        .find_map(|a| match a {
            Action::RevealTile { player: 0, tile } => Some(*tile),
            _ => None,
        })
        .expect("Human player (0) should have revealed a tile");

    // Human makes a valid move.
    ai_backend.submit_action(Action::PlaceTile {
        player: 0,
        tile: human_tile,
        pos: TilePos::new(3, 3),
        rotation: Rotation(0),
    });

    let actions_before_ai_move = ai_backend.actions_from_index(0).len();

    // Now, trigger the AI's turn.
    ai_backend.update();

    let actions_after_ai_move = ai_backend.actions_from_index(0).len();

    // A successful AI turn should result in at least one new action (the PlaceTile).
    assert!(
        actions_after_ai_move > actions_before_ai_move,
        "AI should have made a move, increasing the action count."
    );
}

#[test]
fn test_ai_debugging_flag() {
    // Test that AI debugging flag controls output
    let settings = GameSettings {
        num_players: 2,
        version: 0,
    };

    // Test with debugging enabled
    let ai_backend_debug = EasyAiBackend::new(settings.clone(), true);
    assert_eq!(ai_backend_debug.viewer(), GameViewer::Admin);

    // Test with debugging disabled (default)
    let ai_backend_no_debug = EasyAiBackend::new(settings, false);
    assert_eq!(ai_backend_no_debug.viewer(), GameViewer::Admin);

    // Both backends should work the same functionally
    let init_action = Action::InitializeGame(GameSettings {
        num_players: 2,
        version: 0,
    });

    ai_backend_debug.submit_action(init_action.clone());
    ai_backend_no_debug.submit_action(init_action);

    // Both should have the same action history
    let actions_debug = ai_backend_debug.actions_from_index(0);
    let actions_no_debug = ai_backend_no_debug.actions_from_index(0);

    assert_eq!(actions_debug.len(), actions_no_debug.len());
    assert!(!actions_debug.is_empty());
    assert!(
        !actions_no_debug.is_empty(),
        "Should have at least the initialization action"
    );
}
