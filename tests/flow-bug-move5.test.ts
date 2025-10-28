// Debug test for flow propagation issue at move 5
import { describe, it, expect } from 'vitest';
import { calculateFlows } from '../src/game/flows';
import { TileType, PlacedTile, Player } from '../src/game/types';
import { positionToKey } from '../src/game/board';

describe('Flow Bug Investigation - Move 5', () => {
  it('should propagate flow from (-3,0) to (-2,-1)', () => {
    // Recreate the board state at move 5
    const board = new Map<string, PlacedTile>();
    
    // Tiles from moves 1-4 (all on row -3, Player 1's edge)
    board.set('-3,0', { type: TileType.NoSharps, rotation: 0, position: { row: -3, col: 0 } });
    board.set('-3,1', { type: TileType.ThreeSharps, rotation: 1, position: { row: -3, col: 1 } });
    board.set('-3,2', { type: TileType.TwoSharps, rotation: 2, position: { row: -3, col: 2 } });
    board.set('-3,3', { type: TileType.OneSharp, rotation: 3, position: { row: -3, col: 3 } });
    
    // Move 5: tile at (-2, -1)
    board.set('-2,-1', { type: TileType.OneSharp, rotation: 4, position: { row: -2, col: -1 } });
    
    // Player setup
    const player1: Player = {
      id: 'p1',
      color: '#0173B2',
      edgePosition: 0, // NorthWest edge (row -3)
      isAI: false
    };
    
    const player2: Player = {
      id: 'p2',
      color: '#DE8F05',
      edgePosition: 3, // SouthEast edge (row 3)
      isAI: false
    };
    
    const players = [player1, player2];
    
    // Calculate flows
    const { flows, flowEdges } = calculateFlows(board, players);
    
    console.log('Player 1 flows:', Array.from(flows.get('p1') || []));
    console.log('FlowEdges at (-3,0):', flowEdges.get('-3,0'));
    console.log('FlowEdges at (-2,-1):', flowEdges.get('-2,-1'));
    
    const player1Flows = flows.get('p1');
    expect(player1Flows).toBeDefined();
    
    // Check if (-3,0) has flow
    expect(player1Flows!.has('-3,0')).toBe(true);
    
    // BUG: (-2,-1) should have flow but doesn't
    console.log('\nDoes (-2,-1) have flow?', player1Flows!.has('-2,-1'));
    
    // This SHOULD pass but currently fails
    expect(player1Flows!.has('-2,-1')).toBe(true);
  });
});
