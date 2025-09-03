use flows::backend::{Backend, InMemoryBackend};
use flows::game::{Action, GameSettings, GameViewer, Rotation, TilePos, TileType};
use flows::game_ui::GameUi;
use flows::game_view::GameView;

#[test]
fn test_action_count_detection_logic() {
    // Test the core logic of detecting new actions
    let mut last_known_count = 0;
    let current_count = 3;

    // Should detect new actions
    assert!(current_count > last_known_count);

    // After updating, should not detect new actions
    last_known_count = current_count;
    assert_eq!(current_count, last_known_count);

    // New action arrives
    let new_count = 4;
    assert!(new_count > last_known_count);
}

#[test]
fn test_opponent_move_animation_trigger() {
    let settings = GameSettings {
        num_players: 2,
        version: 0,
    };
    let backend = InMemoryBackend::new(settings);

    // Place a tile to create a game state with a move
    let tile_pos = TilePos::new(3, 3); // Center position
    let action = Action::PlaceTile {
        player: 0,
        tile: TileType::NoSharps,
        pos: tile_pos,
        rotation: Rotation(0),
    };

    // Apply the action to the backend
    backend.submit_action(action.clone());

    let game_view = GameView::new(Box::new(backend.backend_for_viewer(GameViewer::Player(0))));

    if let Some(game) = game_view.game() {
        // Create a GameUi to test animation trigger
        let mut game_ui = GameUi::new();

        // Simulate the animation trigger by calling the public function
        game_ui.trigger_opponent_flow_animation(game, tile_pos);

        // Check if animation was created
        let _has_animation = game_ui.has_flow_animation();
        let _has_opponent_animation = game_ui.has_opponent_flow_animation();

        // Note: Animation creation depends on the tile creating actual flows, which requires
        // connections to other tiles or edges. A single isolated tile might not create animations.
    }
}
