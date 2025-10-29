// Minimal two-tile test to reproduce flow propagation bug
import { describe, it, expect } from 'vitest';
import { calculateFlows } from '../src/game/flows';
import { TileType, PlacedTile, Player, Direction } from '../src/game/types';
import { getFlowConnections } from '../src/game/tiles';
import { getOppositeDirection } from '../src/game/board';

describe('Flow Propagation Bug - Minimal Reproduction', () => {
  it('should propagate flow from edge tile to adjacent tile (original case)', () => {
    const board = new Map<string, PlacedTile>();
    
    // Tile 1: On player's edge (row -3, col 0)
    // NoSharps tile with rotation 0 has connections:
    // - SouthWest (0) ↔ NorthWest (2)
    // - West (1) ↔ East (4)
    // - NorthEast (3) ↔ SouthEast (5)
    board.set('-3,0', { 
      type: TileType.NoSharps, 
      rotation: 0, 
      position: { row: -3, col: 0 } 
    });
    
    // Tile 2: Adjacent to tile 1 in direction SouthWest (0)
    // Position (-2, -1) is neighbor of (-3, 0) via direction 0
    // OneSharp tile with rotation 4 has connections:
    // - East (4) ↔ NorthEast (3)  
    // - SouthEast (5) ↔ West (1)
    // - SouthWest (0) ↔ NorthWest (2)
    // Flow enters from NorthEast (3) [opposite of SouthWest (0)]
    // Flow exits to East (4)
    board.set('-2,-1', { 
      type: TileType.OneSharp, 
      rotation: 4, 
      position: { row: -2, col: -1 } 
    });
    
    // Player on edge 0 (NorthWest edge, row -3)
    const player1: Player = {
      id: 'p1',
      color: '#0173B2',
      edgePosition: 0,
      isAI: false
    };
    
    const players = [player1];
    
    // Calculate flows
    const { flows, flowEdges } = calculateFlows(board, players);
    
    const player1Flows = flows.get('p1');
    expect(player1Flows).toBeDefined();
    
    console.log('\n=== Two-Tile Flow Test ===');
    console.log('Player 1 flow positions:', Array.from(player1Flows || []));
    console.log('FlowEdges at (-3,0):', flowEdges.get('-3,0'));
    console.log('FlowEdges at (-2,-1):', flowEdges.get('-2,-1'));
    
    // Tile 1 should have flow (it's on the edge)
    expect(player1Flows!.has('-3,0')).toBe(true);
    
    // BUG: Tile 2 should have flow (it's connected to tile 1) but doesn't
    const hasTile2Flow = player1Flows!.has('-2,-1');
    console.log('\nExpected: Tile at (-2,-1) has flow');
    console.log('Actual:', hasTile2Flow ? 'HAS flow ✓' : 'NO flow ✗ BUG');
    
    expect(hasTile2Flow).toBe(true);
  });
  
  it('should work with different tile configuration', () => {
    const board = new Map<string, PlacedTile>();
    
    // Edge tile: NoSharps at rotation 0 at (-3,1)
    // Connections: 0↔2, 1↔4, 3↔5
    // Flow enters from NE(3) → exits to SE(5) → reaches (-2,1)
    board.set('-3,1', { 
      type: TileType.NoSharps, 
      rotation: 0, 
      position: { row: -3, col: 1 } 
    });
    
    // Adjacent tile at (-2,1) - neighbor via SouthEast (5)
    // NoSharps at rotation 0: 0↔2, 1↔4, 3↔5
    // Flow enters from NorthWest (2) [opposite of SouthEast (5)]
    // Flow exits to SouthWest (0)
    board.set('-2,1', { 
      type: TileType.NoSharps, 
      rotation: 0, 
      position: { row: -2, col: 1 } 
    });
    
    const player1: Player = {
      id: 'p1',
      color: '#0173B2',
      edgePosition: 0,
      isAI: false
    };
    
    const { flows } = calculateFlows(board, [player1]);
    const player1Flows = flows.get('p1');
    
    console.log('\n=== Alternative Two-Tile Test ===');
    console.log('Player 1 flow positions:', Array.from(player1Flows || []));
    
    // Both tiles should have flow
    expect(player1Flows!.has('-3,1')).toBe(true);
    expect(player1Flows!.has('-2,1')).toBe(true);
  });
});