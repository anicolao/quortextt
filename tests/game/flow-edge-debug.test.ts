// Debug test for flow edge calculation
import { describe, it, expect } from 'vitest';
import { calculateFlows } from '../../src/game/flows';
import { PlacedTile, TileType, Direction, Player } from '../../src/game/types';
import { positionToKey } from '../../src/game/board';

describe('Flow Edge Debug', () => {
  it('should correctly calculate flow edges for tile at (-3,1) with ThreeSharps', () => {
    const players: Player[] = [
      { id: 'p1', color: 'blue', edgePosition: 0, isAI: false }, // NW edge (row=-3)
    ];
    const board = new Map<string, PlacedTile>();
    
    // Place ThreeSharps tile at (-3, 1) with rotation 0
    // At (-3, 1), player's edge directions are NOW NorthWest (2) and NorthEast (3) (outward-facing)
    // ThreeSharps connections (no rotation): SW-SE (0-5), W-NW (1-2), NE-E (3-4)
    // Flow enters from NW(2) -> exits to W(1)
    // Flow enters from NE(3) -> exits to E(4)
    const tile: PlacedTile = {
      type: TileType.ThreeSharps,
      rotation: 0,
      position: { row: -3, col: 1 },
    };
    
    board.set(positionToKey(tile.position), tile);
    
    const { flows, flowEdges } = calculateFlows(board, players);
    
    const playerFlow = flows.get('p1');
    const tileEdges = flowEdges.get('-3,1');
    
    console.log('Player flow:', playerFlow ? Array.from(playerFlow) : 'none');
    console.log('Tile edges:', tileEdges ? Object.fromEntries(tileEdges.entries()) : 'none');
    
    // Verify tile is in flow
    expect(playerFlow?.has('-3,1')).toBe(true);
    
    // Verify edge directions
    expect(tileEdges).toBeDefined();
    
    // Flow enters from NW(2) and NE(3), creates flow on edges 1, 2, 3, 4
    expect(tileEdges?.get(Direction.West)).toBe('p1');
    expect(tileEdges?.get(Direction.NorthWest)).toBe('p1');
    expect(tileEdges?.get(Direction.NorthEast)).toBe('p1');
    expect(tileEdges?.get(Direction.East)).toBe('p1');

    // SW and SE should NOT have p1's flow (those face outward, away from board)
    expect(tileEdges?.get(Direction.SouthWest)).toBeUndefined();
    expect(tileEdges?.get(Direction.SouthEast)).toBeUndefined();
  });
  
  it('should correctly calculate flow edges for tile at (-3,1) with TwoSharps', () => {
    const players: Player[] = [
      { id: 'p1', color: 'blue', edgePosition: 0, isAI: false }, // NW edge (row=-3)
    ];
    const board = new Map<string, PlacedTile>();
    
    // Place TwoSharps tile at (-3, 1) with rotation 0
    // At (-3, 1), player's edge directions are NOW NorthWest (2) and NorthEast (3) (outward-facing)
    // TwoSharps connections (no rotation): SW-SE (0-5), W-E (1-4), NW-NE (2-3)
    // Flow enters from NW(2) -> exits to NE(3)
    const tile: PlacedTile = {
      type: TileType.TwoSharps,
      rotation: 0,
      position: { row: -3, col: 1 },
    };
    
    board.set(positionToKey(tile.position), tile);
    
    const { flows, flowEdges } = calculateFlows(board, players);
    
    const playerFlow = flows.get('p1');
    const tileEdges = flowEdges.get('-3,1');
    
    console.log('Player flow:', playerFlow ? Array.from(playerFlow) : 'none');
    console.log('Tile edges:', tileEdges ? Object.fromEntries(tileEdges.entries()) : 'none');
    
    // Verify tile is in flow
    expect(playerFlow?.has('-3,1')).toBe(true);
    
    // Verify edge directions
    expect(tileEdges).toBeDefined();
    
    // Flow enters from NW(2) -> exits to NE(3), creates flow on edges 2 and 3
    expect(tileEdges?.get(Direction.NorthWest)).toBe('p1');
    expect(tileEdges?.get(Direction.NorthEast)).toBe('p1');

    // All other directions should NOT have p1's flow
    expect(tileEdges?.get(Direction.SouthWest)).toBeUndefined();
    expect(tileEdges?.get(Direction.West)).toBeUndefined();
    expect(tileEdges?.get(Direction.East)).toBeUndefined();
    expect(tileEdges?.get(Direction.SouthEast)).toBeUndefined();
  });
});
