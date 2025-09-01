// This module contains all the logic for checking illegal moves.
use crate::game::{Direction, Game, Player, Rotation, Tile, TilePos, TileType};
use std::collections::{HashMap, HashSet, VecDeque};

pub fn is_move_legal(game: &Game) -> bool {
    if game.outcome().is_some() {
        return true;
    }
    has_distinct_potential_paths(game)
}

// Define the node type as the tuple (source_hex, dest_hex, source_dir):
type Node = (TilePos, TilePos, Direction);
type Connection = (Direction, Direction);

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

fn find_potential_path_for_team(
    player: Player,
    game: &Game,
    claimed_edges: &HashSet<Node>,
    internal_demands: &HashMap<TilePos, HashSet<Connection>>,
) -> Option<Vec<TilePos>> {
    // we are going to implement a DFS on a graph of nodes made up of
    // edges between hexes on the game board. A node will be represented
    // by (source_hex, dest_hex, source_dir), where source_dir points
    // from source_hex to dest_hex. The source_hex will always be the
    // hex that is at a "lesser" position than the dest_hex, to make
    // this representation canonical. A "lesser" position means that
    // the y coordinate is smaller, or if the y coordinates are equal,
    // the x coordinate is smaller.

    let mut queue: VecDeque<Vec<Node>> = VecDeque::new();
    //
    // We start by adding all nodes that start from the player's starting side.
    // Then, we repeatedly pop a path from the queue, and extend it by one hex
    // in all possible directions. If we reach the goal side, we return the path.
    // If we exhaust the queue, we return None.
    let (start_side, goal_side) = get_player_sides(player);

    None
}

fn claim_resources_for_path(
    path: &[TilePos],
    claimed_edges: &mut HashSet<Node>,
    internal_demands: &mut HashMap<TilePos, HashSet<Connection>>,
    game: &Game,
) {
}

fn get_player_sides(player: Player) -> (Rotation, Rotation) {
    match player {
        0 => (Rotation(0), Rotation(3)),
        1 => (Rotation(2), Rotation(5)),
        2 => (Rotation(4), Rotation(1)),
        _ => panic!("Invalid player"),
    }
}
