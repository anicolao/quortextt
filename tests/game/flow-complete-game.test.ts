// Unit test replicating first 5 moves from complete game e2e test
// This test is designed to fail initially, exposing a bug in flow computation

import { describe, it, expect } from 'vitest';
import { gameReducer, initialState } from '../../src/redux/gameReducer';
import {
  addPlayer,
  startGame,
  shuffleTiles,
  drawTile,
  placeTile,
  nextPlayer,
} from '../../src/redux/actions';
import { GameState } from '../../src/redux/types';
import { positionToKey } from '../../src/game/board';

describe('Flow computation bug - first 5 moves of complete game', () => {
  it('should correctly compute flows after 5 moves', () => {
    // === STEP 1: Add two players ===
    let state: GameState = gameReducer(initialState, addPlayer());
    state = gameReducer(state, addPlayer());
    
    expect(state.configPlayers.length).toBe(2);
    
    // === STEP 2: Start the game ===
    state = gameReducer(state, startGame());
    expect(state.screen).toBe('gameplay');
    expect(state.phase).toBe('playing');
    expect(state.players.length).toBe(2);
    
    const player1 = state.players[0];
    const player2 = state.players[1];
    
    console.log('Player 1:', player1.id, 'edge:', player1.edgePosition, 'color:', player1.color);
    console.log('Player 2:', player2.id, 'edge:', player2.edgePosition, 'color:', player2.color);
    
    // Players in 2-player game should be on opposite edges (0 and 3)
    expect([player1.edgePosition, player2.edgePosition].sort()).toEqual([0, 3]);
    
    // === STEP 3: Use deterministic seed for reproducible tile shuffle ===
    const DETERMINISTIC_SEED = 999; // Same seed as e2e test
    state = gameReducer(state, shuffleTiles(DETERMINISTIC_SEED));
    
    // === STEP 4: Play first 5 moves ===
    // Generate positions in the same pattern as the e2e test
    const generatePositions = () => {
      const positions = [];
      for (let row = -3; row <= 3; row++) {
        for (let col = -3; col <= 3; col++) {
          if (Math.abs(row + col) <= 3) {
            positions.push({ row, col });
          }
        }
      }
      return positions;
    };
    
    const allPositions = generatePositions();
    let positionIndex = 0;
    
    // Play exactly 5 moves
    for (let moveNumber = 0; moveNumber < 5; moveNumber++) {
      // Draw tile
      state = gameReducer(state, drawTile());
      const currentTile = state.currentTile;
      
      expect(currentTile).not.toBeNull();
      
      // Find next valid position
      let position = null;
      let rotation = 0;
      
      while (positionIndex < allPositions.length) {
        const testPos = allPositions[positionIndex];
        const posKey = positionToKey(testPos);
        
        if (!state.board.has(posKey)) {
          position = testPos;
          rotation = ((moveNumber + 1) % 6) as any; // Same rotation pattern as e2e test
          positionIndex++;
          break;
        }
        positionIndex++;
      }
      
      expect(position).not.toBeNull();
      
      // Place the tile
      state = gameReducer(state, placeTile(position!, rotation));
      
      const tileKey = positionToKey(position!);
      const placedTile = state.board.get(tileKey);
      
      console.log(`Move ${moveNumber + 1}: Placed tile at (${position!.row}, ${position!.col}) rotation ${rotation}`);
      console.log(`  Tile type: ${placedTile?.type}, stored rotation: ${placedTile?.rotation}`);
      
      // Get flow edges for this tile
      const flowEdgesForTile = state.flowEdges.get(tileKey);
      
      // Log flow information
      if (state.flows) {
        const player1Flows = state.flows.get(player1.id);
        const player2Flows = state.flows.get(player2.id);
        console.log(`  Player 1 flows: ${player1Flows?.size || 0} positions`);
        console.log(`  Player 2 flows: ${player2Flows?.size || 0} positions`);
        
        if (flowEdgesForTile && flowEdgesForTile.size > 0) {
          console.log(`  Tile has flow edges:`, Array.from(flowEdgesForTile.entries()));
        } else {
          console.log(`  Tile has no flows`);
        }
      }
      
      // Next player
      state = gameReducer(state, nextPlayer());
    }
    
    // === STEP 5: Check the 5th tile ===
    // Get the position of the 5th tile placed (moveNumber 4, index 4)
    const fifthMove = state.moveHistory[4];
    expect(fifthMove).toBeDefined();
    
    const fifthTilePosition = fifthMove.tile.position;
    const fifthTileKey = positionToKey(fifthTilePosition);
    const fifthTile = state.board.get(fifthTileKey);
    
    console.log('\n=== ANALYZING 5TH TILE ===');
    console.log(`Position: (${fifthTilePosition.row}, ${fifthTilePosition.col})`);
    console.log(`Tile type: ${fifthTile?.type}, rotation: ${fifthTile?.rotation}`);
    
    // Check if the 5th tile has any flows
    const flowEdgesFor5thTile = state.flowEdges.get(fifthTileKey);
    const player1FlowsContain5thTile = state.flows.get(player1.id)?.has(fifthTileKey);
    const player2FlowsContain5thTile = state.flows.get(player2.id)?.has(fifthTileKey);
    
    console.log(`Flow edges for 5th tile:`, flowEdgesFor5thTile ? Array.from(flowEdgesFor5thTile.entries()) : 'none');
    console.log(`Player 1 flows contain 5th tile: ${player1FlowsContain5thTile}`);
    console.log(`Player 2 flows contain 5th tile: ${player2FlowsContain5thTile}`);
    
    // Check all tiles for their positions and flows
    console.log('\n=== ALL TILES ON BOARD ===');
    state.moveHistory.forEach((move, idx) => {
      const pos = move.tile.position;
      const key = positionToKey(pos);
      const hasP1Flow = state.flows.get(player1.id)?.has(key);
      const hasP2Flow = state.flows.get(player2.id)?.has(key);
      console.log(`Tile ${idx + 1} at (${pos.row}, ${pos.col}): type=${move.tile.type}, rot=${move.tile.rotation}, P1=${hasP1Flow}, P2=${hasP2Flow}`);
    });
    
    // Check all flow positions
    console.log('\n=== ALL FLOW POSITIONS ===');
    const player1Flows = state.flows.get(player1.id);
    console.log('Player 1 flow positions:', Array.from(player1Flows || []));
    
    // Check for flows on empty positions (this would be a bug)
    const emptyPositions = [
      { row: -1, col: -2 },
      { row: -1, col: -1 },
      { row: -3, col: -1 },
      { row: -2, col: 0 },
    ];
    
    console.log('\n=== CHECKING EMPTY POSITIONS FOR INCORRECT FLOWS ===');
    emptyPositions.forEach(pos => {
      const key = positionToKey(pos);
      const hasFlow = player1Flows?.has(key);
      const onBoard = state.board.has(key);
      console.log(`Position (${pos.row}, ${pos.col}): onBoard=${onBoard}, hasFlow=${hasFlow}`);
      // Empty positions should NOT have flows
      if (hasFlow && !onBoard) {
        console.log(`  ❌ BUG: Empty position has flow!`);
      }
    });
    
    // The 5th tile SHOULD have flows because it's connected to edge tiles
    // This is the correct behavior after fixing the bidirectional flow logic
    expect(player1FlowsContain5thTile || player2FlowsContain5thTile).toBe(true);
    
    // CRITICAL: Empty positions should NOT have flows
    // Only positions with actual tiles should be in the flow set
    emptyPositions.forEach(pos => {
      const key = positionToKey(pos);
      const onBoard = state.board.has(key);
      const hasFlow = player1Flows?.has(key) || state.flows.get(player2.id)?.has(key);
      if (!onBoard) {
        expect(hasFlow).toBe(false);
      }
    });
    
    // Verify the 5th tile has flow edges for the traversed connection
    // The connection from tile 1 at (-3,0) comes via SW direction from tile 1
    // which means tile 5 receives from NE (opposite of SW) and exits to NW
    expect(flowEdgesFor5thTile).toBeDefined();
    expect(flowEdgesFor5thTile!.size).toBe(2); // Exactly one connection (2 directions)
    expect(flowEdgesFor5thTile!.has(3)).toBe(true); // NE - entry from tile 1
    expect(flowEdgesFor5thTile!.has(2)).toBe(true); // NW - exit from this connection
  });
});
