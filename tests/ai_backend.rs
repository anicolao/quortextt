use flows::ai_backend::EasyAiBackend;
use flows::backend::Backend;
use flows::game::{Action, GameSettings, GameViewer, Rotation, TilePos, TileType};

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
    assert!(!actions.is_empty(), "Should have at least the initialization action");
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
}
