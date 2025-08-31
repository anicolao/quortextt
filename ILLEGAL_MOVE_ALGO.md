# Illegal Move Detection Algorithm for Flows

This document outlines the design for an algorithm to detect illegal moves in the game of Flows, based on the rules specified in `RULES.md`.

## Core Principle

The fundamental rule for move legality is:
> Unless the tile **completes a winning path**, every placed tile must **leave a distinct route for each player or team to potentially win**.

A move is therefore illegal if and only if:
1.  It is not a winning move.
2.  It completely blocks at least one player or team from having a potential path to their goal.

## 1. Graph Representation

To implement the pathfinding checks, we need a graph representation of the board state.

### Graph Components

-   **Nodes**: The fundamental units of flow are the connection points on the edges of each hex. Each of the 37 hexes has 6 such points (Ports). We can label them 0-5 (e.g., SW, W, NW, NE, E, SE as per `NOTATION.md`).
    -   A node in our graph can be uniquely identified by a `(hex_coord, port_index)` tuple.
-   **Edges**: Edges represent connections that flow can travel through.
    -   **Intra-Hex Edges**: These connect ports *within* a single hex. They are determined by the tile placed in that hex and its orientation. For an empty hex, there are no intra-hex edges.
    -   **Inter-Hex Edges**: These connect ports of *adjacent* hexes. For example, the East (E) port of a hex is always connected to the West (W) port of its neighbor to the east. These connections are static for the whole game.

## 2. Main Algorithm: `isMoveLegal(move)`

This function takes a proposed `move` (player, tile type, coordinates, orientation) and returns `true` if it's legal, `false` otherwise.

```
function isMoveLegal(move):
  // Create a temporary board state with the move applied
  temp_board = current_board.apply(move)

  // 1. Check for Immediate Win
  // A move that creates a winning connection is always legal.
  winning_players = findWinningPlayers(temp_board)
  if winning_players.isNotEmpty:
    return true

  // 2. Check for Blocking
  // If it's not a winning move, check if it blocks any team.
  // This requires ensuring each team has a "distinct potential path".
  return hasDistinctPotentialPaths(temp_board)
```

## 3. Potential Pathfinding Algorithm (Advanced)

To accurately check for blocking, the algorithm must account for two levels of resource contention between players' potential paths:
1.  **Inter-Hex Edges**: Two teams cannot claim the same boundary between two hexes.
2.  **Internal Hex Pathways**: The set of pathways required by all teams within a single *empty* hex must be satisfiable by at least one of the four real tile types.

Furthermore, the process of finding paths is order-dependent. A greedy search for Player A might claim resources that block Player B, even though a valid solution for both exists. To mitigate this, the algorithm tries multiple player orderings.

The guiding principle is to **overestimate illegality**. It is better to conservatively reject a rare legal move than to ever allow an illegal one.

### `hasDistinctPotentialPaths(board)` - Meta-Controller

This function orchestrates the check by trying different player priority orderings.

```
function hasDistinctPotentialPaths(board):
  teams = board.getTeams()

  // First, try the default player order
  failing_team = checkPathsForOrdering(teams, board)
  if failing_team is null:
    return true // A valid set of paths was found

  // If it failed, give the failing team top priority and try again.
  // This handles many common ordering dependency issues.
  reordered_teams = [failing_team] + teams.without(failing_team)
  failing_team_again = checkPathsForOrdering(reordered_teams, board)
  if failing_team_again is null:
    return true

  // If it still fails, the move is declared illegal. For a more exhaustive
  // search, one could try all N! permutations, but this is computationally
  // expensive. Giving the first-failing player top priority is a strong heuristic.
  return false
```

### `checkPathsForOrdering(ordered_teams, board)`

This function executes the pathfinding for a single, specific player order. It returns `null` on success or the first `team` that could not find a path.

```
function checkPathsForOrdering(ordered_teams, board):
  // Resources claimed during this specific ordering attempt
  claimed_edges = new Set()
  internal_demands = new Map<Hex, Set<Connection>>() // Connection is a pair of ports

  for each team in ordered_teams:
    path = findPotentialPathForTeam(team, board, claimed_edges, internal_demands)

    if path is null:
      return team // This team is blocked in this ordering

    // If a path was found, "claim" the resources it used for the next players.
    claimResourcesForPath(path, claimed_edges, internal_demands)

  return null // Success, all teams found a path
```

## 4. Core Pathfinding and Helpers

### `findPotentialPathForTeam(...)`

This function uses BFS to find a single valid path for a team, respecting already-claimed resources. The path is returned as a list of hexes.

```
function findPotentialPathForTeam(team, board, claimed_edges, internal_demands):
  queue = new Queue() // Stores paths (as lists of hexes)
  visited_states = new Set() // Prevents cycles

  // 1. Initialize Queue with starting paths
  for each hex h on team.start_border:
    queue.add([h]) // A path is a list of hexes

  // 2. Perform BFS
  while queue.isNotEmpty:
    current_path = queue.pop()
    current_hex = current_path.last()

    // 3. Check for Goal
    if current_hex is on team.target_border:
      return current_path // Success

    // 4. Explore Neighbors
    for each neighbor_hex in board.getNeighbors(current_hex):

      // Check if this move is valid before adding to queue
      if isValidStep(current_path, neighbor_hex, claimed_edges, internal_demands):
        new_path = current_path.add(neighbor_hex)
        state_sig = new_path.getSignature() // Avoid re-visiting identical paths
        if state_sig not in visited_states:
          visited_states.add(state_sig)
          queue.add(new_path)

  return null // No path found
```

### `isValidStep(path, next_hex, claimed_edges, internal_demands)`

This is the core validation logic for a single step in a path.

```
function isValidStep(path, next_hex, ...):
  current_hex = path.last()

  // 1. Check Inter-Hex Edge Contention
  edge_key = get_canonical_edge_key(current_hex, next_hex)
  if edge_key in claimed_edges:
    return false

  // 2. Check Internal Pathway Contention for Empty Hexes
  // This check applies if the path is turning inside an empty hex.
  if path.length >= 2 and board.isHexEmpty(current_hex):
    prev_hex = path.before_last()
    entry_port = get_port_towards(current_hex, prev_hex)
    exit_port = get_port_towards(current_hex, next_hex)
    new_demand = (entry_port, exit_port)

    existing_demands = internal_demands.get(current_hex) or []
    if not isSatisfiable(existing_demands + [new_demand]):
      return false // No single tile can fulfill all demands for this hex

  return true
```

### `isSatisfiable(demands)`

Checks if a set of required connections within a single hex can be fulfilled by any single tile.

```
function isSatisfiable(demands):
  // Iterate through all 4 tile types and 6 orientations
  for each tile_config in all_possible_tile_configs:
    if tile_config.providesAll(demands):
      return true
  return false
```

## 5. Summary and Edge Cases

-   **Winning Move**: The check for a winning move must be based on actual, contiguous flows, not potential paths. This is a simpler graph traversal only considering occupied hexes.
-   **Unplayable Tile**: If a player draws a tile that cannot be legally placed anywhere (i.e., `isMoveLegal` returns `false` for all possible placements), that player wins. The game logic must handle this by iterating through all 37 hexes and 6 orientations for the drawn tile.
-   **Performance**: The pathfinding algorithm for each team runs on a graph with `37 * 6 = 222` nodes. For up to 3 teams (in a 6-player game), this means up to 3 BFS runs per move legality check. This should be performant enough for typical game scenarios.

This design provides a robust way to enforce the game's complex legality rules, ensuring that play proceeds strategically and no player is unfairly eliminated by being cut off from victory.
