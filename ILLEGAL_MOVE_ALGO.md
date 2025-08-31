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

## 3. Potential Pathfinding Algorithm

This is the most critical part of the logic. We need to verify that every team has a path from their starting border to their target border. A "potential path" can cross both empty hexes and hexes with tiles.

The "distinctness" rule implies that two different teams cannot rely on the same physical pathway on an already-placed tile for their potential paths.

### `hasDistinctPotentialPaths(board)`

```
function hasDistinctPotentialPaths(board):
  used_pathways = new Set() // Stores claimed pathways on occupied hexes

  for each team in board.teams:
    path_found = findPotentialPathForTeam(team, board, used_pathways)

    if not path_found:
      // This team is blocked, so the move is illegal.
      return false

  // All teams have a potential path.
  return true
```

### `findPotentialPathForTeam(team, board, used_pathways)`

This function uses a Breadth-First Search (BFS) to find if a path exists for a given `team`. The search space is the graph of `(hex, port)` nodes.

```
function findPotentialPathForTeam(team, board, used_pathways):
  queue = new Queue()
  visited = new Set() // Stores visited (hex, port) nodes to avoid loops

  // 1. Initialize Queue
  // Add all starting points for the team to the queue.
  for each hex h on team.start_border:
    port = port_of_h_facing_border
    queue.add( (h, port) )
    visited.add( (h, port) )

  // 2. Perform BFS
  while queue.isNotEmpty:
    current_hex, current_port = queue.pop()

    // 3. Check for Goal
    if current_hex is on team.target_border:
      // We found a path. Now we need to claim the pathways used.
      // Backtrack from the goal to the start, and for every segment that
      // crosses an occupied hex, add the pathway to used_pathways.
      claimPathways(path_from_bfs, used_pathways)
      return true

    // 4. Explore Neighbors
    // Get all reachable next (hex, port) tuples from the current one.
    // This is where we handle empty vs. occupied hexes.
    neighbors = getReachableNeighbors(current_hex, current_port, board, used_pathways)

    for each neighbor_hex, neighbor_port in neighbors:
      if (neighbor_hex, neighbor_port) not in visited:
        visited.add( (neighbor_hex, neighbor_port) )
        // Store predecessor for backtracking the path later
        predecessor[ (neighbor_hex, neighbor_port) ] = (current_hex, current_port)
        queue.add( (neighbor_hex, neighbor_port) )

  // 5. No Path Found
  return false
```

### `getReachableNeighbors(...)`

This helper function determines where we can go from a given `(hex, port)`.

```
function getReachableNeighbors(hex, port, board, used_pathways):
  // First, move to the adjacent hex
  next_hex, entry_port = board.getNeighbor(hex, port)

  if next_hex is null: // Hit edge of board
    return []

  // Now, from (next_hex, entry_port), find all possible exit ports
  if board.isHexEmpty(next_hex):
    // If the hex is empty, a potential path can be formed through it.
    // It can connect the entry_port to ANY of the other 5 ports.
    return all 5 other ports on next_hex
  else:
    // If the hex is occupied, flow is restricted by the tile.
    tile = board.getTile(next_hex)
    exit_port = tile.getConnection(entry_port)

    // Crucially, check if this pathway has been claimed by another team.
    pathway = (next_hex, entry_port, exit_port)
    if pathway in used_pathways:
      return [] // This path is already used.
    else:
      return [ (next_hex, exit_port) ]
```

## 4. Summary and Edge Cases

-   **Winning Move**: The check for a winning move must be based on actual, contiguous flows, not potential paths. This is a simpler graph traversal only considering occupied hexes.
-   **Unplayable Tile**: If a player draws a tile that cannot be legally placed anywhere (i.e., `isMoveLegal` returns `false` for all possible placements), that player wins. The game logic must handle this by iterating through all 37 hexes and 6 orientations for the drawn tile.
-   **Performance**: The pathfinding algorithm for each team runs on a graph with `37 * 6 = 222` nodes. For up to 3 teams (in a 6-player game), this means up to 3 BFS runs per move legality check. This should be performant enough for typical game scenarios.

This design provides a robust way to enforce the game's complex legality rules, ensuring that play proceeds strategically and no player is unfairly eliminated by being cut off from victory.
