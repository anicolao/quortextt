// Flow preview animation for tile placement

import { HexPosition, PlacedTile, Player, Rotation, Direction } from '../game/types';
import { calculateFlows } from '../game/flows';
import { positionToKey, getNeighborInDirection, getOppositeDirection, getEdgePositionsWithDirections } from '../game/board';
import { getFlowExit } from '../game/tiles';
import { defineAnimation, undefineAnimation } from './registry';
import { registerAnimation } from './actions';
import { store } from '../redux/store';

// Track active flow preview animations
interface FlowSegment {
  position: string; // position key
  direction1: number; // Direction enum
  direction2: number; // Direction enum
  playerId: string;
  orderInPath: number; // Order of this segment in its flow path
}

// Represents an ordered flow path
interface OrderedFlowPath {
  playerId: string;
  segments: FlowSegment[];
}

// Store current preview segments to track changes
let currentPreviewSegments: FlowSegment[] = [];

/**
 * Trace a flow path from a starting position and return ordered segments
 */
function traceOrderedFlowPath(
  board: Map<string, PlacedTile>,
  startPos: HexPosition,
  startDirection: Direction,
  playerId: string
): FlowSegment[] {
  const segments: FlowSegment[] = [];
  let currentPos = startPos;
  let entryDir = startDirection;
  let orderIndex = 0;

  while (true) {
    const posKey = positionToKey(currentPos);
    const tile = board.get(posKey);
    
    if (!tile) break;

    const exitDir = getFlowExit(tile, entryDir);
    if (exitDir === null) break;

    // Add this segment to the ordered list
    segments.push({
      position: posKey,
      direction1: entryDir,
      direction2: exitDir,
      playerId,
      orderInPath: orderIndex++,
    });

    // Move to next position
    const nextPos = getNeighborInDirection(currentPos, exitDir);
    currentPos = nextPos;
    entryDir = getOppositeDirection(exitDir);
  }

  return segments;
}

/**
 * Calculate which flow segments are new in the preview compared to actual game
 * Returns ordered paths where each path contains segments in sequence
 */
export function calculateNewFlowPaths(
  previewBoard: Map<string, PlacedTile>,
  actualBoard: Map<string, PlacedTile>,
  players: Player[],
  previewPosition: HexPosition,
  boardRadius: number
): OrderedFlowPath[] {
  const newPaths: OrderedFlowPath[] = [];
  const actualFlows = calculateFlows(actualBoard, players, boardRadius);

  // For each player, trace their flows from edge positions
  for (const player of players) {
    const edgeData = getEdgePositionsWithDirections(player.edgePosition, boardRadius);

    for (const { pos, dir } of edgeData) {
      const posKey = positionToKey(pos);
      const previewTile = previewBoard.get(posKey);
      
      if (!previewTile) continue;

      // Trace the flow path in the preview
      const previewSegments = traceOrderedFlowPath(previewBoard, pos, dir, player.id);
      
      if (previewSegments.length === 0) continue;

      // Find where the actual flow ends (if it exists)
      const actualPlayerFlow = actualFlows.flows.get(player.id);
      const previewPosKey = positionToKey(previewPosition);
      let firstNewSegmentIndex = 0;

      if (actualPlayerFlow) {
        // Find the first segment (connection) that doesn't exist in the actual flow
        // With one-way flows, only the entry direction is recorded, so check if EITHER direction has flow
        for (let i = 0; i < previewSegments.length; i++) {
          const segment = previewSegments[i];
          const actualEdges = actualFlows.flowEdges.get(segment.position);
          
          // If this segment is at the preview position, it's new (tile was just placed)
          if (segment.position === previewPosKey) {
            firstNewSegmentIndex = i;
            break;
          }
          
          // Check if THIS SPECIFIC CONNECTION (dir1<->dir2) exists in actual flow
          // With one-way flows, only ONE direction will have the player's flow (the entry direction)
          const hasDir1 = actualEdges?.get(segment.direction1) === player.id;
          const hasDir2 = actualEdges?.get(segment.direction2) === player.id;
          
          // If NEITHER direction has the player's flow, this segment is new
          if (!hasDir1 && !hasDir2) {
            firstNewSegmentIndex = i;
            break;
          }
          firstNewSegmentIndex = i + 1;
        }
      }

      // Only include the new segments (the suffix of the path)
      const newSegments = previewSegments.slice(firstNewSegmentIndex);
      
      if (newSegments.length > 0) {
        // Renumber the segments to start from 0
        newSegments.forEach((seg, idx) => {
          seg.orderInPath = idx;
        });
        
        newPaths.push({
          playerId: player.id,
          segments: newSegments,
        });
      }
    }
  }

  return newPaths;
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
  
  // Clear old flow preview data to prevent old animations from persisting
  clearFlowPreviewData();

  // If no preview position, nothing to animate
  if (!previewPosition || currentTile === null) {
    return;
  }

  const state = store.getState();
  const { board, players, boardRadius } = state.game;

  // Create temporary board with preview tile
  const previewBoard = new Map(board);
  const previewTile: PlacedTile = {
    type: currentTile,
    rotation: previewRotation,
    position: previewPosition,
  };
  previewBoard.set(positionToKey(previewPosition), previewTile);

  // Calculate new flow paths with ordered segments
  const newPaths = calculateNewFlowPaths(previewBoard, board, players, previewPosition, boardRadius);
  
  // Flatten all segments for tracking
  const allSegments: FlowSegment[] = [];
  newPaths.forEach(path => {
    allSegments.push(...path.segments);
  });
  currentPreviewSegments = allSegments;

  // Animation duration per segment (in frames)
  const segmentDuration = 12; // ~200ms per segment at 60fps

  // Register animations for each path
  // Each path's segments animate sequentially, but different paths can animate concurrently
  newPaths.forEach((path) => {
    path.segments.forEach((segment) => {
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

      // Calculate delay: each segment starts after the previous one in its path completes
      const delay = segment.orderInPath * segmentDuration;
      
      // Register animation with delay
      store.dispatch(registerAnimation(animName, segmentDuration, delay));
    });
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
