// This module contains all the logic for checking illegal moves
// based on the algorithm designed in ILLEGAL_MOVE_ALGO.md.

use crate::game::{Direction, Game, Tile, TilePos, TileType, Player};
use std::collections::{HashMap, HashSet, VecDeque};

// A unique, order-independent key for an edge between two hexes.
// We use a sorted tuple of the two TilePos structs.
// TilePos doesn't derive Ord, so we implement it manually for the key.
#[derive(PartialEq, Eq, Hash, Clone, Copy, Debug)]
struct EdgeKey(TilePos, TilePos);

fn get_canonical_edge_key(p1: TilePos, p2: TilePos) -> EdgeKey {
    if (p1.row < p2.row) || (p1.row == p2.row && p1.col < p2.col) {
        EdgeKey(p1, p2)
    } else {
        EdgeKey(p2, p1)
    }
}

// A required connection within a single hex, represented by an entry and exit port.
type Connection = (Direction, Direction);

/// The main entry point for checking if the state of a game board is legal.
/// This assumes a tile has just been placed.
pub fn is_move_legal(game: &Game) -> bool {
    // A winning move is always legal.
    if game.outcome().is_some() {
        return true;
    }
    has_distinct_potential_paths(game)
}

/// Orchestrates the check by trying different player priority orderings.
fn has_distinct_potential_paths(game: &Game) -> bool {
    let players: Vec<Player> = (0..game.num_players()).collect();

    if let Some(failing_player) = check_paths_for_ordering(&players, game) {
        // If the default order fails, put the failing player first and try again.
        let mut reordered_players = vec![failing_player];
        reordered_players.extend(players.iter().filter(|&&p| p != failing_player));

        if check_paths_for_ordering(&reordered_players, game).is_some() {
            // If it still fails with the failing player going first, the move is illegal.
            return false;
        }
    }

    true
}

/// Executes pathfinding for a single, specific player order.
/// Returns `None` on success or the first `player` that could not find a path.
fn check_paths_for_ordering(ordered_players: &[Player], game: &Game) -> Option<Player> {
    let mut claimed_edges: HashSet<EdgeKey> = HashSet::new();
    let mut internal_demands: HashMap<TilePos, HashSet<Connection>> = HashMap::new();

    for &player in ordered_players {
        let path = find_potential_path_for_team(player, game, &claimed_edges, &internal_demands);

        if let Some(p) = path {
            claim_resources_for_path(&p, &mut claimed_edges, &mut internal_demands, game);
        } else {
            return Some(player); // This player is blocked in this ordering.
        }
    }

    None // Success, all players found a path.
}

/// Uses BFS to find a single valid path for a team, respecting already-claimed resources.
fn find_potential_path_for_team(
    player: Player,
    game: &Game,
    claimed_edges: &HashSet<EdgeKey>,
    internal_demands: &HashMap<TilePos, HashSet<Connection>>,
) -> Option<Vec<TilePos>> {
    let mut queue: VecDeque<Vec<TilePos>> = VecDeque::new();
    // Using a HashMap for visited allows us to store the path to get there.
    let mut visited: HashMap<TilePos, Vec<TilePos>> = HashMap::new();

    let (start_side, goal_side) = get_player_sides(player);
    let goal_hexes: HashSet<TilePos> = game.edges_on_board_edge(goal_side).into_iter().map(|(p, _)| p).collect();

    // 1. Initialize Queue
    for (pos, _) in game.edges_on_board_edge(start_side) {
        if !visited.contains_key(&pos) {
            let path = vec![pos];
            queue.push_back(path.clone());
            visited.insert(pos, path);
        }
    }

    // 2. Perform BFS
    while let Some(current_path) = queue.pop_front() {
        let current_hex = *current_path.last().unwrap();

        if goal_hexes.contains(&current_hex) {
            return Some(current_path); // Goal reached
        }

        for exit_dir in Direction::all_directions() {
            if let Some(neighbor_hex) = game.get_neighbor_pos(current_hex, exit_dir) {
                if visited.contains_key(&neighbor_hex) {
                    continue;
                }

                if is_valid_step(&current_path, neighbor_hex, game, claimed_edges, internal_demands) {
                    let mut new_path = current_path.clone();
                    new_path.push(neighbor_hex);
                    visited.insert(neighbor_hex, new_path.clone());
                    queue.push_back(new_path);
                }
            }
        }
    }

    None
}

/// The core validation logic for a single step in a path.
fn is_valid_step(
    path: &[TilePos],
    next_hex: TilePos,
    game: &Game,
    claimed_edges: &HashSet<EdgeKey>,
    internal_demands: &HashMap<TilePos, HashSet<Connection>>,
) -> bool {
    let current_hex = *path.last().unwrap();

    // 1. Check Inter-Hex Edge Contention
    let edge_key = get_canonical_edge_key(current_hex, next_hex);
    if claimed_edges.contains(&edge_key) {
        return false;
    }

    // 2. Check if the current hex allows the traversal
    if path.len() >= 2 {
        let prev_hex = path[path.len() - 2];
        if let Tile::Placed(tile) = game.tile(current_hex) {
            let entry_dir = game.get_direction_towards(current_hex, prev_hex).unwrap();
            let exit_dir = game.get_direction_towards(current_hex, next_hex).unwrap();
            if tile.exit_from_entrance(entry_dir) != exit_dir {
                return false; // This placed tile blocks the required path.
            }
        }
    }

    // 3. Check Internal Pathway Contention for Empty Hexes
    if let Tile::Empty = game.tile(current_hex) {
        if path.len() >= 2 {
            let prev_hex = path[path.len() - 2];
            let entry_dir = game.get_direction_towards(current_hex, prev_hex).unwrap();
            let exit_dir = game.get_direction_towards(current_hex, next_hex).unwrap();
            let new_demand = (entry_dir, exit_dir);

            if let Some(existing_demands) = internal_demands.get(&current_hex) {
                let mut all_demands = existing_demands.clone();
                all_demands.insert(new_demand);
                if !is_satisfiable(&all_demands) {
                    return false;
                }
            }
        }
    }

    true
}

/// Checks if a set of required connections can be fulfilled by any single tile.
fn is_satisfiable(demands: &HashSet<Connection>) -> bool {
    if demands.is_empty() { return true; }

    for i in 0..4 {
        let tile_type = TileType::from_num_sharps(i);
        for r in 0..6 {
            let rotation = crate::game::Rotation(r);
            let mut provides_all = true;
            for &(d1, d2) in demands {
                // Check if this tile config provides this demand
                let rotated_d1 = d1.rotate(rotation.reversed());
                let expected_exit = tile_type.exit_from_entrance(rotated_d1).rotate(rotation);
                if expected_exit != d2 {
                    provides_all = false;
                    break; // Try next orientation
                }
            }
            if provides_all {
                return true; // Found a tile config that works
            }
        }
    }
    false
}

/// After a path is found, claim the resources it uses.
fn claim_resources_for_path(
    path: &[TilePos],
    claimed_edges: &mut HashSet<EdgeKey>,
    internal_demands: &mut HashMap<TilePos, HashSet<Connection>>,
    game: &Game,
) {
    for i in 0..path.len() - 1 {
        let p1 = path[i];
        let p2 = path[i+1];
        claimed_edges.insert(get_canonical_edge_key(p1, p2));
    }

    for i in 1..path.len() - 1 {
        let prev = path[i-1];
        let curr = path[i];
        let next = path[i+1];
        if let Tile::Empty = game.tile(curr) {
            let entry_dir = game.get_direction_towards(curr, prev).unwrap();
            let exit_dir = game.get_direction_towards(curr, next).unwrap();
            internal_demands.entry(curr).or_default().insert((entry_dir, exit_dir));
        }
    }
}

fn get_player_sides(player: Player) -> (crate::game::Rotation, crate::game::Rotation) {
    match player {
        0 => (crate::game::Rotation(0), crate::game::Rotation(3)),
        1 => (crate::game::Rotation(2), crate::game::Rotation(5)),
        2 => (crate::game::Rotation(4), crate::game::Rotation(1)),
        _ => panic!("Invalid player"),
    }
}
