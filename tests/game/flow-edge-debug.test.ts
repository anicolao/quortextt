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
    // At (-3, 1), player's edge directions are West (1) and NorthWest (2)
    // ThreeSharps connections: SW-SE (0-5), NE-E (3-4), W-NW (1-2)
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
    
    // From West (1) <-> NorthWest (2) should both be p1
    expect(tileEdges?.get(Direction.West)).toBe('p1');
    expect(tileEdges?.get(Direction.NorthWest)).toBe('p1');
    
    // NE (3), E (4), SW (0), SE (5) should NOT have p1's flow
    expect(tileEdges?.get(Direction.NorthEast)).toBeUndefined();
    expect(tileEdges?.get(Direction.East)).toBeUndefined();
    expect(tileEdges?.get(Direction.SouthWest)).toBeUndefined();
    expect(tileEdges?.get(Direction.SouthEast)).toBeUndefined();
  });
  
  it('should correctly calculate flow edges for tile at (-3,1) with TwoSharps', () => {
    const players: Player[] = [
      { id: 'p1', color: 'blue', edgePosition: 0, isAI: false }, // NW edge (row=-3)
    ];
    const board = new Map<string, PlacedTile>();
    
    // Place TwoSharps tile at (-3, 1) with rotation 0
    // At (-3, 1), player's edge directions are West (1) and NorthWest (2)
    // TwoSharps connections: SW-SE (0-5), NW-NE (2-3), W-E (1-4)
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
    
    // From West (1) -> East (4) should both be p1
    expect(tileEdges?.get(Direction.West)).toBe('p1');
    expect(tileEdges?.get(Direction.East)).toBe('p1');
    
    // From NorthWest (2) -> NorthEast (3) should both be p1
    expect(tileEdges?.get(Direction.NorthWest)).toBe('p1');
    expect(tileEdges?.get(Direction.NorthEast)).toBe('p1');
    
    // SW (0) and SE (5) should NOT have p1's flow
    expect(tileEdges?.get(Direction.SouthWest)).toBeUndefined();
    expect(tileEdges?.get(Direction.SouthEast)).toBeUndefined();
  });
});
