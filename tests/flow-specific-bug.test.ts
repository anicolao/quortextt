// Test for specific flow bug: 0 sharps at -3,0 and three sharps at -2,-1 with rotation 5
import { describe, it, expect } from 'vitest';
import { calculateFlows } from '../src/game/flows';
import { TileType, PlacedTile, Player, Direction } from '../src/game/types';
import { getFlowConnections } from '../src/game/tiles';

describe('Specific Flow Bug - 0 sharps at -3,0 and three sharps at -2,-1', () => {
  it('should show tile connections for debugging', () => {
    console.log('\n=== Tile Connection Debug ===');
    
    // Check NoSharps at rotation 0
    const noSharpsConnections = getFlowConnections(TileType.NoSharps, 0);
    console.log('NoSharps (0 sharps) at rotation 0:', noSharpsConnections);
    
    // Check ThreeSharps at rotation 5
    const threeSharpsConnections = getFlowConnections(TileType.ThreeSharps, 5);
    console.log('ThreeSharps at rotation 5:', threeSharpsConnections);
    
    console.log('\nDirection Reference: 0=SW, 1=W, 2=NW, 3=NE, 4=E, 5=SE');
    console.log('Position (-3,0) to (-2,-1) is in direction SouthWest (0)');
    console.log('Flow entering (-2,-1) comes from direction NorthEast (3)');
    
    // Check if tiles have the right connections
    const hasDir0 = noSharpsConnections.some(([d1, d2]) => d1 === 0 || d2 === 0);
    console.log('\nNoSharps has connection with direction 0 (SouthWest)?', hasDir0);
    
    const hasDir3 = threeSharpsConnections.some(([d1, d2]) => d1 === 3 || d2 === 3);
    console.log('ThreeSharps has connection with direction 3 (NorthEast)?', hasDir3);
  });

  it('should have flow in three sharps tile at rotation 5 in position -2,-1', () => {
    const board = new Map<string, PlacedTile>();
    
    // Put a 0 sharps tile (NoSharps) at position (-3, 0)
    board.set('-3,0', {
      type: TileType.NoSharps,
      rotation: 0,
      position: { row: -3, col: 0 }
    });
    
    // Put a three sharps tile at rotation 5 in position (-2, -1)
    board.set('-2,-1', {
      type: TileType.ThreeSharps,
      rotation: 5,
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
    
    console.log('\n=== Specific Flow Bug Test ===');
    console.log('Player 1 flow positions:', Array.from(flows.get('p1') || []));
    console.log('FlowEdges at (-3,0):', flowEdges.get('-3,0'));
    console.log('FlowEdges at (-2,-1):', flowEdges.get('-2,-1'));
    
    const player1Flows = flows.get('p1');
    expect(player1Flows).toBeDefined();
    
    // The tile at (-3,0) should have flow (it's on the edge)
    expect(player1Flows!.has('-3,0')).toBe(true);
    
    // The three sharps tile at (-2,-1) should have flow
    const hasThreeSharpsFlow = player1Flows!.has('-2,-1');
    console.log('\nExpected: Tile at (-2,-1) has flow');
    console.log('Actual:', hasThreeSharpsFlow ? 'HAS flow ✓' : 'NO flow ✗ BUG');
    
    // This assertion should pass but may fail due to the bug
    expect(hasThreeSharpsFlow).toBe(true);
  });

  it('should have flow with second NoSharps tile at -2,0 and ThreeSharps at -2,-1', () => {
    const board = new Map<string, PlacedTile>();
    
    // Put a 0 sharps tile (NoSharps) at position (-3, 0)
    board.set('-3,0', {
      type: TileType.NoSharps,
      rotation: 0,
      position: { row: -3, col: 0 }
    });
    
    // Put a second NoSharps tile at position (-2, 0)
    board.set('-2,0', {
      type: TileType.NoSharps,
      rotation: 0,
      position: { row: -2, col: 0 }
    });
    
    // Put a three sharps tile at rotation 5 in position (-2, -1)
    board.set('-2,-1', {
      type: TileType.ThreeSharps,
      rotation: 5,
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
    
    console.log('\n=== Three Tile Flow Test ===');
    console.log('Player 1 flow positions:', Array.from(flows.get('p1') || []));
    console.log('FlowEdges at (-3,0):', flowEdges.get('-3,0'));
    console.log('FlowEdges at (-2,0):', flowEdges.get('-2,0'));
    console.log('FlowEdges at (-2,-1):', flowEdges.get('-2,-1'));
    
    const player1Flows = flows.get('p1');
    expect(player1Flows).toBeDefined();
    
    // The tile at (-3,0) should have flow (it's on the edge)
    expect(player1Flows!.has('-3,0')).toBe(true);
    
    // The second NoSharps tile at (-2,0) should have flow
    const hasSecondNoSharpsFlow = player1Flows!.has('-2,0');
    console.log('\nExpected: Tile at (-2,0) has flow');
    console.log('Actual:', hasSecondNoSharpsFlow ? 'HAS flow ✓' : 'NO flow ✗');
    expect(hasSecondNoSharpsFlow).toBe(true);
    
    // The three sharps tile at (-2,-1) should have flow
    const hasThreeSharpsFlow = player1Flows!.has('-2,-1');
    console.log('\nExpected: Tile at (-2,-1) has flow');
    console.log('Actual:', hasThreeSharpsFlow ? 'HAS flow ✓' : 'NO flow ✗ BUG');
    
    // This assertion may fail due to the bug
    expect(hasThreeSharpsFlow).toBe(true);
  });
});
