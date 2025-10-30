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
    
    // Tile 2: Adjacent to tile 1 in direction NorthWest (2)
    // Position (-2, -1) is neighbor of (-3, 0) via direction 2
    // OneSharp tile with rotation 4 has connections:
    // - East (4) ↔ NorthEast (3)  
    // - SouthEast (5) ↔ West (1)
    // - SouthWest (0) ↔ NorthWest (2)
    // Flow enters from SouthEast (5) [opposite of NorthWest (2)]
    // Flow exits to West (1)
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
  
  it('should work with different tile types (original passing case)', () => {
    const board = new Map<string, PlacedTile>();
    
    // Edge tile: TwoSharps at rotation 0
    // Connections: 0↔5, 1↔4, 2↔3
    board.set('-3,1', { 
      type: TileType.TwoSharps, 
      rotation: 0, 
      position: { row: -3, col: 1 } 
    });
    
    // Adjacent tile at (-2,1) - neighbor via NorthEast (3)
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
    
    expect(player1Flows!.has('-3,1')).toBe(true);
    expect(player1Flows!.has('-2,1')).toBe(true);
  });
  
  describe('Comprehensive two-tile flow tests', () => {
    const tileTypes = [
      TileType.NoSharps,
      TileType.OneSharp,
      TileType.TwoSharps,
      TileType.ThreeSharps
    ];
    
    const tileTypeNames: Record<TileType, string> = {
      [TileType.NoSharps]: 'NoSharps',
      [TileType.OneSharp]: 'OneSharp',
      [TileType.TwoSharps]: 'TwoSharps',
      [TileType.ThreeSharps]: 'ThreeSharps'
    };
    
    // Helper to check if a tile has a connection in a specific direction
    function hasConnectionInDirection(tileType: TileType, rotation: number, direction: Direction): boolean {
      const connections = getFlowConnections(tileType, rotation);
      return connections.some(([dir1, dir2]) => dir1 === direction || dir2 === direction);
    }
    
    // Test all combinations: 4 tile types × 4 tile types × 6 rotations = 96 tests
    tileTypes.forEach(edgeTileType => {
      tileTypes.forEach(adjacentTileType => {
        for (let rotation = 0; rotation < 6; rotation++) {
          it(`should handle flow correctly: ${tileTypeNames[edgeTileType]} rot=0 → ${tileTypeNames[adjacentTileType]} rot=${rotation}`, () => {
            const board = new Map<string, PlacedTile>();
            
            // Edge tile at player's edge (row -3, col 0)
            board.set('-3,0', { 
              type: edgeTileType, 
              rotation: 0, 
              position: { row: -3, col: 0 } 
            });
            
            // Adjacent tile at (-2, -1) - neighbor via direction 2 (NorthWest)
            board.set('-2,-1', { 
              type: adjacentTileType, 
              rotation: rotation, 
              position: { row: -2, col: -1 } 
            });
            
            const player1: Player = {
              id: 'p1',
              color: '#0173B2',
              edgePosition: 0,
              isAI: false
            };
            
            const { flows, flowEdges } = calculateFlows(board, [player1]);
            const player1Flows = flows.get('p1');
            
            expect(player1Flows).toBeDefined();
            
            // Edge tile should always have flow (it's on the player's edge)
            expect(player1Flows!.has('-3,0')).toBe(true);
            
            // Determine if flow SHOULD propagate to adjacent tile
            // Flow propagates from edge tile in direction 2 (NorthWest)
            const edgeTileHasFlowInDir2 = hasConnectionInDirection(edgeTileType, 0, Direction.NorthWest);
            
            if (edgeTileHasFlowInDir2) {
              // Flow enters adjacent tile from opposite direction (SouthEast = 5)
              const entryDirection = getOppositeDirection(Direction.NorthWest);
              const adjacentTileAcceptsFlow = hasConnectionInDirection(adjacentTileType, rotation, entryDirection);
              
              if (adjacentTileAcceptsFlow) {
                // Flow SHOULD propagate
                const adjacentHasFlow = player1Flows!.has('-2,-1');
                const adjacentFlowEdges = flowEdges.get('-2,-1');
                
                // THIS IS THE KEY ASSERTION: if both tiles have proper connections, flow must propagate
                expect(adjacentHasFlow).toBe(true);
                expect(adjacentFlowEdges).toBeDefined();
                expect(adjacentFlowEdges!.size).toBeGreaterThan(0);
              } else {
                // Flow should NOT propagate (adjacent tile doesn't accept it)
                expect(player1Flows!.has('-2,-1')).toBe(false);
              }
            } else {
              // Edge tile doesn't have flow in direction 0, so flow cannot propagate
              expect(player1Flows!.has('-2,-1')).toBe(false);
            }
          });
        }
      });
    });
  });
});