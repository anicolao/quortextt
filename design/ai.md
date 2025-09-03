# AI Design Document

## 1. Introduction

This document outlines the design for a new "Medium" AI player in the game. It details the existing "Easy" AI, the proposed "Medium" AI using an alpha-beta search algorithm, and the necessary architectural changes to support both, including a pluggable evaluation function.

## 2. Existing AI (EasyAI)

The current AI, `EasyAiBackend`, is a simple, non-searching AI that makes decisions based on a one-move-deep evaluation.

### 2.1. Architecture

- The `EasyAiBackend` struct wraps an `InMemoryBackend`.
- It acts as a `Backend` implementation, allowing it to be used by the game UI.
- The AI's turn is triggered by the `update` method, which calls `maybe_make_ai_move`.
- The AI player is hardcoded as player 1.

### 2.2. Decision Logic

The `find_best_ai_move` function implements the core logic:
1. It iterates through all empty hexes on the board and all possible tile rotations to generate a list of all legal moves for the tile in its hand.
2. It checks if any of these moves result in an immediate win and plays it if found.
3. It filters out any move that results in an immediate loss for the AI, unless all possible moves are losing moves.
4. It uses an evaluation function to score the remaining (non-losing) moves and selects the one with the highest score.

This is effectively a 1-ply search (or Minimax with a depth of 1).

### 2.3. Evaluation Function

The `evaluate_move` function provides a heuristic score for a given board state after a move is made.
- It calculates the length of the shortest potential path to victory for both the AI and the opponent (human player).
- The path length is the number of empty hexes that need to be filled to complete a connection between the player's sides of the board.
- The score is calculated based on these path lengths, prioritizing moves that shorten the AI's path and lengthen the opponent's path.
- The formula is: `score = -30.0 / (human_tiles_needed as f64) - 1.2 * ai_tiles_needed as f64`
- It gives a large bonus for winning moves and a large penalty for moves that allow the opponent to win on the next turn.

## 3. New AI (MediumAI)

The "Medium" AI will be a more advanced opponent that uses an alpha-beta search algorithm to look several moves ahead.

### 3.1. Architecture

- A new struct, `MediumAiBackend`, will be created, similar in structure to `EasyAiBackend`.
- Both `EasyAiBackend` and `MediumAiBackend` will be refactored to use a new `EvaluationStrategy` trait. This will allow the evaluation function to be pluggable and reusable.
- The `MediumAiBackend` will contain the logic for the alpha-beta search.

### 3.2. Alpha-Beta Search Logic

The core of the Medium AI will be a recursive function implementing alpha-beta pruning. The search function signature will look something like this:

```rust
fn alpha_beta_search(
    game: &Game,
    depth: usize,
    mut alpha: f64,
    mut beta: f64,
    maximizing_player: bool,
    evaluator: &dyn EvaluationStrategy,
) -> (f64, Option<Action>);
```

- **`game`**: The current state of the game.
- **`depth`**: The remaining depth to search. The search will terminate when depth is 0.
- **`alpha`**: The best score found so far for the maximizing player.
- **`beta`**: The best score found so far for the minimizing player.
- **`maximizing_player`**: A boolean indicating if the current turn is for the player trying to maximize the score (the AI) or minimize it (the opponent).
- **`evaluator`**: The pluggable evaluation function.

The search will proceed as follows:
1.  **Base Case**: If `depth` is 0 or the game is over, evaluate the board state using the `evaluator` and return the score.
2.  **Recursive Step**:
    - If it's the `maximizing_player`'s (AI's) turn:
        - Iterate through all legal moves.
        - For each move, create a new game state.
        - This new state represents the opponent's turn. However, the opponent doesn't have a tile yet. This is where we need to handle the tile draw randomness (see section 3.3).
        - Recursively call `alpha_beta_search` for the new state with `maximizing_player = false`.
        - Update `alpha` and the best move.
        - Prune the search if `alpha >= beta`.
    - If it's the `minimizing_player`'s (opponent's) turn, do the reverse, updating `beta`.

### 3.3. Handling Randomness (Tile Draws)

A key challenge is the random tile draw that occurs at the beginning of a player's turn. The problem description states: "all possible random draws have to be considered, but it is acceptable to take the best outcome if it is the opponent's move, and the worst outcome if it is the AI's move, among the four random tile choices."

This means we will model the tile draw as a chance node in the game tree. The search must handle two scenarios:

1.  **The current player has a tile in hand:** This is the case for the root of the search tree (the AI's current move) and for any node that immediately follows a chance node. The search proceeds as a standard alpha-beta node, iterating through all legal placements of the known tile.

2.  **The current player needs to draw a tile:** This occurs after a tile has been placed. The search must consider all possible tile draws and assume the worst-case scenario for the current player.
    -   **If it is the AI's turn (maximizing player):** We will iterate through all 4 possible `TileType`s the AI could draw. For each tile, we will run the search for that complete sub-tree. Since we must assume the worst outcome for the AI, we will take the `min` of the scores returned from these sub-trees.
    -   **If it is the opponent's turn (minimizing player):** We will do the same, iterating through all 4 possible `TileType`s. To model the "best outcome for the opponent," we will also take the `min` of the scores from the sub-trees (a lower score is better for the opponent).

This approach is a simplification of Expectiminimax, where instead of calculating an expected value over all random outcomes, we assume a pessimistic, worst-case draw for both players.

## 4. Pluggable Evaluation Function

To allow code reuse and experimentation with different heuristics, the evaluation logic will be extracted into a trait.

```rust
trait EvaluationStrategy {
    fn evaluate(&self, game: &Game, player: Player) -> f64;
}
```

- **`evaluate`**: Takes a game state and a player's perspective, and returns a score. A higher score is always better for the given player.

A default implementation, `PathLengthEvaluator`, will be created based on the current `evaluate_move` logic in `EasyAiBackend`.

Both `EasyAiBackend` and `MediumAiBackend` will be generic over this trait or hold a `Box<dyn EvaluationStrategy>`.

```rust
pub struct EasyAiBackend {
    inner: InMemoryBackend,
    ai_player: Player,
    evaluator: Box<dyn EvaluationStrategy>,
    // ...
}

pub struct MediumAiBackend {
    inner: InMemoryBackend,
    ai_player: Player,
    search_depth: usize,
    evaluator: Box<dyn EvaluationSrategy>,
    // ...
}
```

## 5. UI Changes

- In `src/app.rs` (or wherever the game setup UI is defined), a new button labeled "Medium AI" will be added.
- Clicking this button will instantiate a `MediumAiBackend` with a `PathLengthEvaluator` and a reasonable default search depth (e.g., 3 or 4).
