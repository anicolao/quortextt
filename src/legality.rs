// This module contains all the logic for checking illegal moves
// based on the algorithm designed in ILLEGAL_MOVE_ALGO.md.

use crate::game::{Direction, Game, Tile, TilePos, TileType, Player};
use std::collections::{HashMap, HashSet, VecDeque};

// A directed edge between two hexes.
type EdgeKey = (TilePos, TilePos);

type Connection = (Direction, Direction);

pub fn is_move_legal(game: &Game) -> bool {
    if game.outcome().is_some() {
        return true;
    }
    has_distinct_potential_paths(game)
}

fn has_distinct_potential_paths(game: &Game) -> bool {
    let players: Vec<Player> = (0..game.num_players()).collect();

    if let Some(failing_player) = check_paths_for_ordering(&players, game) {
        let mut reordered_players = vec![failing_player];
        reordered_players.extend(players.iter().filter(|&&p| p != failing_player));

        if check_paths_for_ordering(&reordered_players, game).is_some() {
            return false;
        }
    }

    true
}

fn check_paths_for_ordering(ordered_players: &[Player], game: &Game) -> Option<Player> {
    let mut claimed_edges: HashSet<EdgeKey> = HashSet::new();
    let mut internal_demands: HashMap<TilePos, HashSet<Connection>> = HashMap::new();

    for &player in ordered_players {
        let path = find_potential_path_for_team(player, game, &claimed_edges, &internal_demands);

        if let Some(p) = path {
            claim_resources_for_path(&p, &mut claimed_edges, &mut internal_demands, game);
        } else {
            return Some(player);
        }
    }

    None
}

fn find_potential_path_for_team(
    player: Player,
    game: &Game,
    claimed_edges: &HashSet<EdgeKey>,
    internal_demands: &HashMap<TilePos, HashSet<Connection>>,
) -> Option<Vec<TilePos>> {
    let mut queue: VecDeque<Vec<TilePos>> = VecDeque::new();
    let mut visited_edges: HashSet<EdgeKey> = HashSet::new();

    let (start_side, goal_side) = get_player_sides(player);
    let goal_hexes: HashSet<TilePos> = game.edges_on_board_edge(goal_side).into_iter().map(|(p, _)| p).collect();

    // 1. Initialize Queue with valid paths of length 2.
    for (pos, border_dir) in game.edges_on_board_edge(start_side) {
        if let Tile::Placed(tile) = game.tile(pos) {
            let exit_dir = tile.exit_from_entrance(border_dir);
            if let Some(neighbor_hex) = game.get_neighbor_pos(pos, exit_dir) {
                if !game.is_border_edge(neighbor_hex, exit_dir.reversed()) {
                    let edge = (pos, neighbor_hex);
                    if visited_edges.insert(edge) {
                        queue.push_back(vec![pos, neighbor_hex]);
                    }
                }
            }
        }
        if let Tile::Empty = game.tile(pos) {
            for dir in Direction::all_directions() {
                 if let Some(neighbor_hex) = game.get_neighbor_pos(pos, dir) {
                    if !game.is_border_edge(neighbor_hex, dir.reversed()) {
                        let edge = (pos, neighbor_hex);
                         if visited_edges.insert(edge) {
                            queue.push_back(vec![pos, neighbor_hex]);
                        }
                    }
                 }
            }
        }
    }

    // 2. Perform BFS
    while let Some(current_path) = queue.pop_front() {
        let current_hex = *current_path.last().unwrap();

        if goal_hexes.contains(&current_hex) {
            return Some(current_path);
        }

        for exit_dir in Direction::all_directions() {
            if let Some(neighbor_hex) = game.get_neighbor_pos(current_hex, exit_dir) {
                let edge = (current_hex, neighbor_hex);
                if visited_edges.contains(&edge) { continue; }

                if is_valid_step(&current_path, neighbor_hex, game, claimed_edges, internal_demands) {
                    let mut new_path = current_path.clone();
                    new_path.push(neighbor_hex);
                    visited_edges.insert(edge);
                    queue.push_back(new_path);
                }
            }
        }
    }

    None
}

fn is_valid_step(
    path: &[TilePos],
    next_hex: TilePos,
    game: &Game,
    claimed_edges: &HashSet<EdgeKey>,
    internal_demands: &HashMap<TilePos, HashSet<Connection>>,
) -> bool {
    let current_hex = *path.last().unwrap();

    let edge_key = (current_hex, next_hex);
    if claimed_edges.contains(&edge_key) {
        return false;
    }

    if path.len() >= 2 {
        let prev_hex = path[path.len() - 2];
        if let Tile::Placed(tile) = game.tile(current_hex) {
            let entry_dir = game.get_direction_towards(current_hex, prev_hex).unwrap();
            let exit_dir = game.get_direction_towards(current_hex, next_hex).unwrap();
            if tile.exit_from_entrance(entry_dir) != exit_dir {
                return false;
            }
        }
    }

    if let Tile::Empty = game.tile(current_hex) {
        if path.len() >= 2 {
            let prev_hex = path[path.len() - 2];
            let entry_dir = game.get_direction_towards(current_hex, prev_hex).unwrap();
            let exit_dir = game.get_direction_towards(current_hex, next_hex).unwrap();
            let new_demand = (entry_dir, exit_dir);

            let mut all_demands = internal_demands.get(&current_hex).cloned().unwrap_or_default();
            all_demands.insert(new_demand);
            if !is_satisfiable(&all_demands) {
                return false;
            }
        }
    }

    true
}

fn is_satisfiable(demands: &HashSet<Connection>) -> bool {
    if demands.is_empty() { return true; }

    for i in 0..4 {
        let tile_type = TileType::from_num_sharps(i);
        for r in 0..6 {
            let rotation = crate::game::Rotation(r);
            let mut provides_all = true;
            for &(d1, d2) in demands {
                let rotated_d1 = d1.rotate(rotation.reversed());
                let expected_exit = tile_type.exit_from_entrance(rotated_d1).rotate(rotation);
                if expected_exit != d2 {
                    provides_all = false;
                    break;
                }
            }
            if provides_all {
                return true;
            }
        }
    }
    false
}

fn claim_resources_for_path(
    path: &[TilePos],
    claimed_edges: &mut HashSet<EdgeKey>,
    internal_demands: &mut HashMap<TilePos, HashSet<Connection>>,
    game: &Game,
) {
    for i in 0..path.len() - 1 {
        let p1 = path[i];
        let p2 = path[i+1];
        claimed_edges.insert((p1, p2));
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
