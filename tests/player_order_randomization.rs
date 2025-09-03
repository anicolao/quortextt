use flows::game::{Game, GameSettings, Action};
use flows::backend::{InMemoryBackend, Backend};
use flows::game::GameViewer;
use rand::prelude::SliceRandom;
use rand::rngs::StdRng;
use rand::SeedableRng;

#[test]
fn test_randomization_across_multiple_games() {
    let settings = GameSettings {
        num_players: 3,
        version: 0,
    };
    
    let mut player_orders = Vec::new();
    
    // Create multiple games and collect their player orders
    for _ in 0..5 {
        let backend = InMemoryBackend::new(settings.clone());
        let mut backend_for_viewer = backend.backend_for_viewer(GameViewer::Admin);
        backend_for_viewer.update();
        
        let actions = backend_for_viewer.action_history();
        
        // Find the RandomizePlayerOrder action
        for action in actions {
            if let Action::RandomizePlayerOrder { player_order } = action {
                player_orders.push(player_order.clone());
                break;
            }
        }
    }
    
    // Print the orders for debugging
    for (i, order) in player_orders.iter().enumerate() {
        println!("Game {}: Player order: {:?}", i + 1, order);
    }
    
    // Verify that we got randomization actions for all games
    assert_eq!(player_orders.len(), 5);
    
    // Verify that each order contains all players exactly once
    for order in &player_orders {
        let mut sorted_order = order.clone();
        sorted_order.sort();
        assert_eq!(sorted_order, vec![0, 1, 2]);
    }
}

#[test]
fn test_player_order_randomization() {
    // Test 1: Check that player order can be randomized
    let settings = GameSettings {
        num_players: 3,
        version: 0,
    };
    let mut game = Game::new(settings);
    
    // Create a randomized player order
    let mut rng = StdRng::seed_from_u64(12345);
    let mut player_order: Vec<usize> = (0..3).collect();
    player_order.shuffle(&mut rng);
    
    // Apply the randomization action
    let result = game.apply_action(Action::RandomizePlayerOrder { player_order: player_order.clone() });
    assert!(result.is_ok(), "Failed to randomize player order: {}", result.unwrap_err());
    
    // Check that the current player is now the first in the randomized order
    assert_eq!(game.current_player(), player_order[0]);
    
    // Test 2: Check that the order cannot be randomized twice
    let result = game.apply_action(Action::RandomizePlayerOrder { player_order: vec![0, 1, 2] });
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("already randomized"));
}

#[test]
fn test_player_order_validation() {
    let settings = GameSettings {
        num_players: 2,
        version: 0,
    };
    let mut game = Game::new(settings);
    
    // Test invalid length
    let result = game.apply_action(Action::RandomizePlayerOrder { player_order: vec![0, 1, 2] });
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("length doesn't match"));
    
    // Test missing player
    let result = game.apply_action(Action::RandomizePlayerOrder { player_order: vec![0, 0] });
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("each player exactly once"));
    
    // Test valid order
    let result = game.apply_action(Action::RandomizePlayerOrder { player_order: vec![1, 0] });
    assert!(result.is_ok());
    assert_eq!(game.current_player(), 1);
}