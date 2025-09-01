// This module contains all the logic for checking illegal moves.
use crate::game::{Direction, Game, Player, PlacedTile, Rotation, Tile, TilePos, TileType};
use std::collections::{HashMap, HashSet, VecDeque};

// A connection is a pair of directions (ports) on a hex that must be connected.
type Connection = (Direction, Direction);

// An inter-hex edge, which is the node in our pathfinding graph.
// It's represented by the two hexes it connects and the direction from the
// canonical "source" hex (the one with the smaller coordinate).
type Node = (TilePos, TilePos, Direction);

/// Checks if a set of required connections within a single hex can be
/// fulfilled by any single tile.
fn is_satisfiable(demands: &HashSet<Connection>) -> bool {
    if demands.is_empty() {
        return true;
    }
    // Iterate through all 4 tile types and 6 rotations
    for &tile_type in &[
        TileType::NoSharps,
        TileType::OneSharp,
        TileType::TwoSharps,
        TileType::ThreeSharps,
    ] {
        for i in 0..6 {
            let rotation = Rotation(i);
            let placed_tile = PlacedTile::new(tile_type, rotation);
            let provided_connections = placed_tile
                .all_flows()
                .into_iter()
                .map(|(mut d1, mut d2)| {
                    if d1 > d2 {
                        std::mem::swap(&mut d1, &mut d2);
                    }
                    (d1, d2)
                })
                .collect::<HashSet<_>>();

            if demands.is_subset(&provided_connections) {
                return true; // Found a tile configuration that satisfies all demands
            }
        }
    }
    false // No single tile can fulfill all demands
}

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
    let mut claimed_edges: HashSet<Node> = HashSet::new();
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

// Helper to create a canonical representation of a node (inter-hex edge).
// The source hex must always be "smaller" than the destination hex.
fn canonical_node(pos1: TilePos, pos2: TilePos, game: &Game) -> Node {
    let dir = game.get_direction_towards(pos1, pos2).unwrap();
    if pos1 < pos2 {
        (pos1, pos2, dir)
    } else {
        (pos2, pos1, dir.reversed())
    }
}

fn find_potential_path_for_team(
    player: Player,
    game: &Game,
    claimed_edges: &HashSet<Node>,
    internal_demands: &HashMap<TilePos, HashSet<Connection>>,
) -> Option<Vec<Node>> {
    // The queue stores tuples of (path_of_nodes, current_tip_of_path)
    let mut queue: VecDeque<(Vec<Node>, TilePos)> = VecDeque::new();
    let mut visited_nodes: HashSet<Node> = HashSet::new();

    let (start_side, goal_side) = get_player_sides(player);
    let goal_edges: HashSet<(TilePos, Direction)> =
        game.edges_on_board_edge(goal_side).into_iter().collect();
    let goal_hexes: HashSet<TilePos> = goal_edges.iter().map(|(pos, _)| *pos).collect();

    // 1. Initialize Queue with starting paths.
    for (start_pos, border_dir) in game.edges_on_board_edge(start_side) {
        let entry_dir = border_dir.reversed();

        match *game.tile(start_pos) {
            Tile::Placed(placed_tile) => {
                // Path must follow the tile's connection from the entry point.
                let exit_dir = placed_tile.exit_from_entrance(entry_dir);
                if let Some(neighbor_pos) = game.get_neighbor_pos(start_pos, exit_dir) {
                    let start_node = canonical_node(start_pos, neighbor_pos, game);
                    if !claimed_edges.contains(&start_node) && !visited_nodes.contains(&start_node)
                    {
                        queue.push_back((vec![start_node], neighbor_pos));
                        visited_nodes.insert(start_node);
                    }
                }
            }
            Tile::Empty => {
                // From an empty start hex, a path can go to any neighbor.
                for exit_dir in Direction::all_directions() {
                    if let Some(neighbor_pos) = game.get_neighbor_pos(start_pos, exit_dir) {
                        let start_node = canonical_node(start_pos, neighbor_pos, game);
                        if !claimed_edges.contains(&start_node) && !visited_nodes.contains(&start_node)
                        {
                            queue.push_back((vec![start_node], neighbor_pos));
                            visited_nodes.insert(start_node);
                        }
                    }
                }
            }
            Tile::NotOnBoard => {} // Should not happen
        }
    }

    // 2. Perform BFS
    while let Some((path, current_pos)) = queue.pop_front() {
        let last_node = path.last().unwrap();
        let prev_pos = if last_node.0 == current_pos { last_node.1 } else { last_node.0 };

        // 3. Check for Goal
        if goal_hexes.contains(&current_pos) {
            let entry_dir = game.get_direction_towards(current_pos, prev_pos).unwrap();
            match *game.tile(current_pos) {
                Tile::Placed(placed_tile) => {
                    let exit_dir = placed_tile.exit_from_entrance(entry_dir);
                    if goal_edges.contains(&(current_pos, exit_dir)) {
                        return Some(path); // Success!
                    }
                }
                Tile::Empty => {
                    // Find the goal directions for this specific hex
                    for (_, goal_exit_dir) in goal_edges.iter().filter(|(pos, _)| *pos == current_pos)
                    {
                        let mut new_demand = (entry_dir, *goal_exit_dir);
                        if new_demand.0 > new_demand.1 {
                            std::mem::swap(&mut new_demand.0, &mut new_demand.1);
                        }
                        let mut all_demands =
                            internal_demands.get(&current_pos).cloned().unwrap_or_default();
                        all_demands.insert(new_demand);

                        if is_satisfiable(&all_demands) {
                            return Some(path); // Success!
                        }
                    }
                }
                Tile::NotOnBoard => {}
            }
        }

        // 4. Explore Neighbors
        let prev_pos = if last_node.0 == current_pos { last_node.1 } else { last_node.0 };

        match *game.tile(current_pos) {
            Tile::Placed(placed_tile) => {
                // Path is forced by the tile's connections.
                let entry_dir = game.get_direction_towards(current_pos, prev_pos).unwrap();
                let exit_dir = placed_tile.exit_from_entrance(entry_dir);

                if let Some(next_pos) = game.get_neighbor_pos(current_pos, exit_dir) {
                    let next_node = canonical_node(current_pos, next_pos, game);
                    if !visited_nodes.contains(&next_node) && !claimed_edges.contains(&next_node)
                    {
                        let mut new_path = path.clone();
                        new_path.push(next_node);
                        visited_nodes.insert(next_node);
                        queue.push_back((new_path, next_pos));
                    }
                }
            }
            Tile::Empty => {
                // Case 2: Path goes through an EMPTY hex. Any direction is possible.
                for exit_dir in Direction::all_directions() {
                    if let Some(next_pos) = game.get_neighbor_pos(current_pos, exit_dir) {
                        if next_pos == prev_pos { continue; } // Don't go back

                        let next_node = canonical_node(current_pos, next_pos, game);
                        if visited_nodes.contains(&next_node) || claimed_edges.contains(&next_node) {
                            continue;
                        }

                        // Check for internal pathway contention
                        let entry_dir = game.get_direction_towards(current_pos, prev_pos).unwrap();
                        let mut new_demand = (entry_dir, exit_dir);
                        if new_demand.0 > new_demand.1 {
                            std::mem::swap(&mut new_demand.0, &mut new_demand.1);
                        }
                        let mut all_demands = internal_demands.get(&current_pos).cloned().unwrap_or_default();
                        all_demands.insert(new_demand);

                        if !is_satisfiable(&all_demands) {
                            continue;
                        }

                        // Enqueue new path
                        let mut new_path = path.clone();
                        new_path.push(next_node);
                        visited_nodes.insert(next_node);
                        queue.push_back((new_path, next_pos));
                    }
                }
            }
            Tile::NotOnBoard => {} // Should not happen in BFS
        }
    }

    None // No path found
}

fn claim_resources_for_path(
    path: &[Node],
    claimed_edges: &mut HashSet<Node>,
    internal_demands: &mut HashMap<TilePos, HashSet<Connection>>,
    game: &Game,
) {
    // 1. Claim all inter-hex edges used by the path.
    claimed_edges.extend(path.iter().copied());

    // 2. For any empty hexes the path turns through, claim the internal connection.
    if path.len() < 2 {
        return; // No turns in a path with less than 2 edges.
    }

    for window in path.windows(2) {
        let node_a = window[0];
        let node_b = window[1];

        // Find the hex where the path turns.
        let turn_hex = if node_a.0 == node_b.0 || node_a.0 == node_b.1 {
            node_a.0
        } else {
            node_a.1
        };

        // If the turn happens in an empty hex, record the demand.
        if *game.tile(turn_hex) == Tile::Empty {
            let prev_hex = if node_a.0 == turn_hex { node_a.1 } else { node_a.0 };
            let next_hex = if node_b.0 == turn_hex { node_b.1 } else { node_b.0 };

            let entry_dir = game.get_direction_towards(turn_hex, prev_hex).unwrap();
            let exit_dir = game.get_direction_towards(turn_hex, next_hex).unwrap();

            let mut connection = (entry_dir, exit_dir);
            if connection.0 > connection.1 {
                std::mem::swap(&mut connection.0, &mut connection.1);
            }

            internal_demands
                .entry(turn_hex)
                .or_default()
                .insert(connection);
        }
    }
}

fn get_player_sides(player: Player) -> (Rotation, Rotation) {
    match player {
        0 => (Rotation(0), Rotation(3)),
        1 => (Rotation(2), Rotation(5)),
        2 => (Rotation(4), Rotation(1)),
        _ => panic!("Invalid player"),
    }
}
