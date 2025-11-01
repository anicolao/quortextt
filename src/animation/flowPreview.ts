// Flow preview animation for tile placement

import { HexPosition, PlacedTile, Player, Rotation, FlowConnection } from '../game/types';
import { calculateFlows } from '../game/flows';
import { positionToKey } from '../game/board';
import { getFlowConnections } from '../game/tiles';
import { defineAnimation, undefineAnimation } from './registry';
import { registerAnimation } from './actions';
import { store } from '../redux/store';

// Track active flow preview animations
interface FlowSegment {
  position: string; // position key
  direction1: number; // Direction enum
  direction2: number; // Direction enum
  playerId: string;
}

// Store current preview segments to track changes
let currentPreviewSegments: FlowSegment[] = [];

/**
 * Calculate which flow segments are new in the preview compared to actual game
 */
export function calculateNewFlowSegments(
  previewBoard: Map<string, PlacedTile>,
  actualBoard: Map<string, PlacedTile>,
  players: Player[]
): FlowSegment[] {
  // Calculate flows for both boards
  const previewFlows = calculateFlows(previewBoard, players);
  const actualFlows = calculateFlows(actualBoard, players);

  const newSegments: FlowSegment[] = [];

  // For each player, find flow edges that exist in preview but not in actual
  for (const player of players) {
    const previewPlayerFlow = previewFlows.flows.get(player.id);
    const actualPlayerFlow = actualFlows.flows.get(player.id);

    if (!previewPlayerFlow) continue;

    // Check each position in the preview flow
    for (const posKey of previewPlayerFlow) {
      const previewEdges = previewFlows.flowEdges.get(posKey);
      const actualEdges = actualFlows.flowEdges.get(posKey);

      if (!previewEdges) continue;

      // Get all directions for this position that have this player's flow
      const previewDirs: number[] = [];
      previewEdges.forEach((playerId, dir) => {
        if (playerId === player.id) {
          previewDirs.push(dir);
        }
      });

      // Get actual directions (empty if position not in actual flow)
      const actualDirs: number[] = [];
      if (actualEdges) {
        actualEdges.forEach((playerId, dir) => {
          if (playerId === player.id) {
            actualDirs.push(dir);
          }
        });
      }

      // Find new directions
      const newDirs = previewDirs.filter(dir => !actualDirs.includes(dir));

      // If there are new directions, this is a new or extended flow segment
      if (newDirs.length > 0 || !actualPlayerFlow?.has(posKey)) {
        // Get the tile to find flow connections
        const tile = previewBoard.get(posKey);
        if (tile) {
          // For simplicity, track that this position has new flow
          // We'll animate all connections at this position
          const connections = getFlowConnectionsForTile(tile);
          for (const [dir1, dir2] of connections) {
            // Check if this connection involves the player
            const hasDir1 = previewEdges.get(dir1) === player.id;
            const hasDir2 = previewEdges.get(dir2) === player.id;
            
            if (hasDir1 && hasDir2) {
              newSegments.push({
                position: posKey,
                direction1: dir1,
                direction2: dir2,
                playerId: player.id,
              });
            }
          }
        }
      }
    }
  }

  return newSegments;
}

// Helper to get flow connections for a tile
function getFlowConnectionsForTile(tile: PlacedTile): FlowConnection[] {
  return getFlowConnections(tile.type, tile.rotation);
}

/**
 * Update flow preview when tile position or rotation changes
 */
export function updateFlowPreview(
  previewPosition: HexPosition | null,
  previewRotation: Rotation,
  currentTile: number | null
): void {
  // Clear old animations by undefining them
  currentPreviewSegments.forEach((segment) => {
    const animName = `flow-preview-${segment.position}-${segment.direction1}-${segment.direction2}`;
    undefineAnimation(animName);
  });
  currentPreviewSegments = [];

  // If no preview position, nothing to animate
  if (!previewPosition || currentTile === null) {
    return;
  }

  const state = store.getState();
  const { board, players } = state.game;

  // Create temporary board with preview tile
  const previewBoard = new Map(board);
  const previewTile: PlacedTile = {
    type: currentTile,
    rotation: previewRotation,
    position: previewPosition,
  };
  previewBoard.set(positionToKey(previewPosition), previewTile);

  // Calculate new flow segments
  const newSegments = calculateNewFlowSegments(previewBoard, board, players);
  currentPreviewSegments = newSegments;

  // Register animations for each new segment
  newSegments.forEach((segment) => {
    const animName = `flow-preview-${segment.position}-${segment.direction1}-${segment.direction2}`;
    
    // Store segment data for rendering
    const segmentData = {
      ...segment,
      animationProgress: 0,
    };

    // Define animation that updates progress
    defineAnimation(animName, (t: number) => {
      segmentData.animationProgress = t;
      // Store in global state for renderer to access
      const previewData = (window as any).__FLOW_PREVIEW_DATA__ || {};
      previewData[animName] = segmentData;
      (window as any).__FLOW_PREVIEW_DATA__ = previewData;
    });

    // Register animation: 18 frames (~300ms) with ease-out
    store.dispatch(registerAnimation(animName, 18));
  });
}

/**
 * Get current flow preview animation data for rendering
 */
export function getFlowPreviewData(): Record<string, any> {
  return (window as any).__FLOW_PREVIEW_DATA__ || {};
}

/**
 * Clear all flow preview data
 */
export function clearFlowPreviewData(): void {
  (window as any).__FLOW_PREVIEW_DATA__ = {};
}
