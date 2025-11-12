// Game notation for recording and displaying Flows/Quortex games
// Based on the notation system defined in NOTATION.md

import { HexPosition, TileType, Rotation } from './types';
import { Move } from '../redux/types';

// Orientation names for notation
const ORIENTATION_NAMES = ['N', 'NE', 'SE', 'S', 'SW', 'NW'] as const;
type OrientationName = typeof ORIENTATION_NAMES[number];

// Tile type names for notation
const TILE_TYPE_NAMES = ['T0', 'T1', 'T2', 'T3'] as const;
type TileTypeName = typeof TILE_TYPE_NAMES[number];

/**
 * Convert internal coordinates to player-relative notation
 * 
 * This repo uses axial coordinates with rows from -radius to +radius
 * The NOTATION.md from flows branch uses a different coordinate system (0 to 2*radius)
 * 
 * For player on edge 0 with radius=3:
 * - Row -3 maps to A (closest to player)
 * - Row 0 maps to D (center)
 * - Row 3 maps to G (farthest from player)
 * 
 * Columns are numbered 1-based from left to right in player's view
 */
export function positionToNotation(
  position: HexPosition,
  playerEdge: number,
  boardRadius: number = 3
): string {
  // Transform coordinates based on player's perspective
  // Each player views the board rotated so their edge is at the "bottom"
  
  let transformedRow = position.row;
  let transformedCol = position.col;
  
  // Rotate the coordinate system based on player edge
  // Each edge represents a 60-degree rotation
  for (let i = 0; i < playerEdge; i++) {
    // Rotate 60 degrees clockwise using axial coordinate rotation
    const newRow = -transformedCol;
    const newCol = transformedRow + transformedCol;
    transformedRow = newRow;
    transformedCol = newCol;
  }
  
  // Map row to letter (A=closest to player's edge, G=farthest for radius 3)
  // Internal row -radius maps to A, +radius maps to G
  const rowLetter = String.fromCharCode('A'.charCodeAt(0) + transformedRow + boardRadius);
  
  // Map column to number (1-based from player's right to left)
  // Calculate the ending column for this row (depends on the diamond shape)
  const colEnd = Math.min(boardRadius, boardRadius - transformedRow);
  // Convert to 1-based position relative to the row's ending column
  // Right to left: rightmost column is 1
  const colNumber = colEnd - transformedCol + 1;
  
  return `${rowLetter}${colNumber}`;
}

/**
 * Convert rotation to orientation name based on player's perspective
 * Rotation 0 = North (N), 1 = NE, 2 = SE, 3 = S, 4 = SW, 5 = NW
 * 
 * The rotation needs to be adjusted based on the player's edge position
 * so that the notation is always relative to the player's view.
 * 
 * Formula derived from systematic 6-player test: (rotation - playerEdge + 3) % 6
 * This rotates the tile's orientation by subtracting the player's edge offset,
 * then adds 3 (180 degrees) to account for the coordinate system conventions.
 */
export function rotationToOrientation(rotation: Rotation, playerEdge: number): OrientationName {
  // Adjust rotation for player's perspective
  // The +3 offset (180 degrees) accounts for how the coordinate system relates
  // to player perspective. Validated with 6-player systematic test.
  let adjustedRotation = (rotation - playerEdge + 3) % 6;
  
  // Handle negative modulo results
  if (adjustedRotation < 0) {
    adjustedRotation += 6;
  }
  
  return ORIENTATION_NAMES[adjustedRotation];
}

/**
 * Convert tile type to notation name
 */
export function tileTypeToNotation(type: TileType): TileTypeName {
  return TILE_TYPE_NAMES[type];
}

/**
 * Format a move in standard notation
 * Format: P[player][position]T[type][orientation]
 * Example: P1A2T0N
 */
export function formatMoveNotation(
  move: Move,
  playerNumber: number,
  playerEdge: number,
  boardRadius: number = 3
): string {
  const position = positionToNotation(move.tile.position, playerEdge, boardRadius);
  const tileType = tileTypeToNotation(move.tile.type);
  const orientation = rotationToOrientation(move.tile.rotation, playerEdge);
  
  return `P${playerNumber}${position}${tileType}${orientation}`;
}

/**
 * Get the player number (1-based) from player ID
 */
export function getPlayerNumber(playerId: string, playerIds: string[]): number {
  const index = playerIds.indexOf(playerId);
  return index + 1;
}

/**
 * Format move history as a list of notation strings
 */
export function formatMoveHistory(
  moves: Move[],
  players: Array<{ id: string; edgePosition: number }>,
  boardRadius: number = 3
): string[] {
  const playerIds = players.map(p => p.id);
  
  return moves.map(move => {
    const playerIndex = playerIds.indexOf(move.playerId);
    if (playerIndex === -1) {
      return ''; // Invalid player ID
    }
    
    const playerNumber = playerIndex + 1;
    const playerEdge = players[playerIndex].edgePosition;
    
    return formatMoveNotation(move, playerNumber, playerEdge, boardRadius);
  });
}

/**
 * Format the entire game record with move numbers
 */
export function formatGameRecord(
  moves: Move[],
  players: Array<{ id: string; edgePosition: number; color: string }>,
  boardRadius: number = 3
): string {
  const notations = formatMoveHistory(moves, players, boardRadius);
  
  let record = `Game: ${players.length}-player\n\n`;
  
  notations.forEach((notation, index) => {
    const moveNumber = index + 1;
    record += `${moveNumber}. ${notation}\n`;
  });
  
  return record;
}
