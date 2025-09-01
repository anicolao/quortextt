use flows::ai_backend::EasyAiBackend;
use flows::game::{GameSettings, TileType, TilePos, Rotation, Action, GameViewer};
use flows::backend::Backend;

fn setup_ai_game() -> EasyAiBackend {
    let settings = GameSettings {
        num_players: 2,
        version: 0,
    };
    EasyAiBackend::new(settings)
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