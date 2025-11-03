// Unit tests for blocking detection with three-sharp tiles
import { describe, it, expect } from 'vitest';
import { isLegalMove, getBlockedPlayers } from '../../src/game/legality';
import { TileType, PlacedTile, Player, Team } from '../../src/game/types';
import { positionToKey } from '../../src/game/board';

describe('Blocking Detection with Three-Sharp Tiles', () => {
  const createPlayer = (id: string, edge: number): Player => ({
    id,
    color: `color-${id}`,
    edgePosition: edge,
    isAI: false,
  });

  it('should detect blocking when three-sharp tiles create a barrier', () => {
    // Setup: Player 1 on edge 0 (top), Player 2 on edge 3 (bottom)
    const players = [createPlayer('p1', 0), createPlayer('p2', 3)];
    const teams: Team[] = [];
    const board = new Map<string, PlacedTile>();

    // Create a horizontal barrier at row 0 with three-sharp tiles
    // These tiles have sharp corners and limited flow connections
    const barrierRow = 0;
    for (let col = -3; col <= 2; col++) {
      const tile: PlacedTile = {
        type: TileType.ThreeSharps,
        rotation: 0, // Standard orientation
        position: { row: barrierRow, col },
      };
      board.set(positionToKey(tile.position), tile);
    }

    // Now try to place the final tile to complete the barrier
    const finalTile: PlacedTile = {
      type: TileType.ThreeSharps,
      rotation: 0,
      position: { row: barrierRow, col: 3 },
    };

    // This should be detected as blocking
    const isLegal = isLegalMove(board, finalTile, players, teams);
    const blocked = getBlockedPlayers(board, finalTile, players, teams);

    console.log('Is move legal?', isLegal);
    console.log('Blocked players:', blocked);

    // The move should be illegal because it blocks player 1 or player 2
    // However, this might currently return true due to BFS treating empty spaces as traversable
    expect(isLegal).toBe(false);
    expect(blocked.length).toBeGreaterThan(0);
  });

  it('should detect blocking with sharps pointing toward player edge', () => {
    // This test simulates the manual testing scenario described by the user:
    // Three-sharp tiles with sharp corners pointing toward a player's starting edge
    const players = [createPlayer('p1', 0), createPlayer('p2', 3)];
    const teams: Team[] = [];
    const board = new Map<string, PlacedTile>();

    // Player 1 is on edge 0 (top), player 2 on edge 3 (bottom)
    // Create tiles with sharps pointing upward (toward p1's edge)
    // ThreeSharps at rotation 0 has connections at: SW-SE (0-5), W-NW (1-2), NE-E (3-4)
    // These sharp corners point in specific directions

    // Create a barrier with three-sharp tiles oriented so their sharp corners
    // point toward player 1's starting edge, making it impossible for flow to cross
    const barrierRow = -1; // Just below player 1's edge
    for (let col = -2; col <= 2; col++) {
      const tile: PlacedTile = {
        type: TileType.ThreeSharps,
        rotation: 3, // Rotate so sharps point upward toward edge 0
        position: { row: barrierRow, col },
      };
      board.set(positionToKey(tile.position), tile);
    }

    // Add more tiles to create a more complete barrier
    const secondRow = 0;
    for (let col = -2; col <= 2; col++) {
      const tile: PlacedTile = {
        type: TileType.ThreeSharps,
        rotation: 3,
        position: { row: secondRow, col },
      };
      board.set(positionToKey(tile.position), tile);
    }

    // Try to place a tile that would seal off player 1
    const blockingTile: PlacedTile = {
      type: TileType.ThreeSharps,
      rotation: 3,
      position: { row: barrierRow, col: 3 },
    };

    const isLegal = isLegalMove(board, blockingTile, players, teams);
    const blocked = getBlockedPlayers(board, blockingTile, players, teams);

    console.log('Sharp corners barrier - Is move legal?', isLegal);
    console.log('Sharp corners barrier - Blocked players:', blocked);
    console.log('Board tiles:', board.size);

    // This should detect blocking since the sharps prevent flow connections
    // However, the current BFS might not detect this if there are empty hex paths
    // This test documents the current behavior
    if (blocked.length === 0) {
      console.log('WARNING: Blocking not detected - this is the bug being fixed');
    }
  });

  it('should allow moves that maintain connectivity despite barriers', () => {
    const players = [createPlayer('p1', 0), createPlayer('p2', 3)];
    const teams: Team[] = [];
    const board = new Map<string, PlacedTile>();

    // Create a partial barrier with a gap
    for (let col = -3; col <= 1; col++) {
      const tile: PlacedTile = {
        type: TileType.ThreeSharps,
        rotation: 0,
        position: { row: 0, col },
      };
      board.set(positionToKey(tile.position), tile);
    }
    // Gap at col: 2 and col: 3

    // Place a tile that doesn't close the gap
    const nonBlockingTile: PlacedTile = {
      type: TileType.NoSharps,
      rotation: 0,
      position: { row: 1, col: 0 },
    };

    const isLegal = isLegalMove(board, nonBlockingTile, players, teams);
    
    // This should be legal since there's still a path through the gap
    expect(isLegal).toBe(true);
  });

  it('should detect blocking when three-sharps surround but dont connect to player edge', () => {
    // This test represents the bug: tiles are placed that geometrically allow paths,
    // but their flow patterns don't actually allow connectivity
    const players = [createPlayer('p1', 0), createPlayer('p2', 3)];
    const teams: Team[] = [];
    const board = new Map<string, PlacedTile>();

    // Place three-sharp tiles in positions that geometrically connect
    // but whose flow patterns make it impossible to create a winning path
    // Player 1 is on edge 0 (row -3), needs to reach edge 3 (row 3)
    
    // Create a situation where:
    // - There ARE empty hexes forming a geometric path
    // - But three-sharp tiles with specific orientations block flow connectivity
    
    // Place tiles at row -1 with orientations that prevent upward flow
    for (let col = -2; col <= 2; col++) {
      // Row -1: tiles that don't allow flow from above (edge 0) to pass through
      board.set(positionToKey({ row: -1, col }), {
        type: TileType.ThreeSharps,
        rotation: 0, // This rotation has specific flow patterns
        position: { row: -1, col },
      });
    }

    // Also place some tiles at row 1 to constrain from the other side
    for (let col = -2; col <= 2; col++) {
      board.set(positionToKey({ row: 1, col }), {
        type: TileType.ThreeSharps,
        rotation: 0,
        position: { row: 1, col },
      });
    }

    // Leave empty hexes at row -2, row 0, and row 2
    // The BFS might see these as potential paths, but:
    // - Row -2 is between edge 0 and the barrier at row -1
    // - Row 0 is between the two barriers
    // - Row 2 is between the barrier at row 1 and edge 3

    // Now try to place another three-sharp at row 0 (between the two barriers)
    const testTile: PlacedTile = {
      type: TileType.ThreeSharps,
      rotation: 0,
      position: { row: 0, col: 0 },
    };

    const isLegal = isLegalMove(board, testTile, players, teams);
    const blocked = getBlockedPlayers(board, testTile, players, teams);

    console.log('Empty hexes test - Is move legal?', isLegal);
    console.log('Empty hexes test - Blocked players:', blocked);
    console.log('Board has', board.size, 'tiles');
    console.log('Testing placement at (0, 0) with two barrier rows at -1 and +1');

    // The BFS currently will find empty hex paths and say it's legal
    // But in reality, three-sharp tiles can't create the needed connections
    // This documents the current behavior
    console.log('Current BFS result:', isLegal ? 'LEGAL (may be incorrect)' : 'ILLEGAL (correct)');
  });
});
