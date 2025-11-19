// Unit tests for improved dirty detection (validating the fix)
import { describe, it, expect, beforeEach } from 'vitest';
import { DirtyDetector } from '../../src/rendering/dirtyDetector';
import { RootState } from '../../src/redux/types';

// Helper to create a minimal valid state
function createMockState(overrides: any = {}): RootState {
  const baseState = {
    game: {
      screen: 'gameplay',
      board: new Map(),
      flows: new Map(),
      players: [],
      teams: [],
      currentPlayerIndex: 0,
      configPlayers: [],
      boardRadius: 3,
      seatingPhase: {
        active: false,
        seatingOrder: [],
        seatingIndex: 0,
        availableEdges: [],
        edgeAssignments: new Map(),
      },
      availableTiles: [],
      currentTile: null,
      supermove: false,
      singleSupermove: false,
      supermoveAnyPlayer: false,
      supermoveInProgress: false,
      flowEdges: new Map(),
      phase: 'playing' as const,
      winners: [],
      winType: null,
      moveHistory: [],
      lastPlacedTilePosition: null,
    },
    ui: {
      gameMode: 'tabletop' as const,
      localPlayerId: null,
      selectedPosition: null,
      hoveredPosition: null,
      hoveredElement: null,
      currentRotation: 0,
      showLegalMoves: false,
      showFlowMarkers: false,
      animationSpeed: 1,
      zoom: 1,
      panOffset: { x: 0, y: 0 },
      showSettings: false,
      showHelp: false,
      helpCorner: null,
      showMoveList: false,
      moveListCorner: null,
      moveListIndex: -1,
      savedGameState: null,
      disconnectedPlayers: new Set(),
      userIdToPlayerId: new Map(),
      isSpectator: false,
      spectatorCount: 0,
      settings: {
        boardRadius: 3,
        supermove: false,
        singleSupermove: false,
        supermoveAnyPlayer: false,
        debugShowEdgeLabels: false,
        debugShowVictoryEdges: false,
        debugLegalityTest: false,
        debugAnimationSlowdown: 1,
        debugAIScoring: false,
        debugHitTest: false,
        tileDistribution: [1, 1, 1, 1] as [number, number, number, number],
        enableDirtyRendering: true,
        debugShowDirtyRegions: false,
        debugShowRenderMetrics: false,
      },
    },
    animation: {
      frameCounter: 0,
      animations: [],
      paused: false,
    },
  };

  return { ...baseState, ...overrides } as RootState;
}

describe('DirtyDetector - Idle Frame Optimization', () => {
  let detector: DirtyDetector;
  const canvasWidth = 1920;
  const canvasHeight = 1080;

  beforeEach(() => {
    detector = new DirtyDetector();
  });

  it('should return empty dirty regions on idle frames (no animations)', () => {
    // Create base state with stable references
    const baseState = createMockState({
      animation: { frameCounter: 1, animations: [], paused: false }
    });
    
    // First render establishes baseline
    const dirty1 = detector.detectDirtyRegions(baseState, canvasWidth, canvasHeight);
    expect(dirty1.length).toBeGreaterThan(0); // First render is dirty
    
    // Create state2 that REUSES the same nested objects (only frameCounter changes)
    const state2: RootState = {
      ...baseState,
      animation: {
        ...baseState.animation,
        frameCounter: 2, // Only this changes
      }
    };
    
    const dirty2 = detector.detectDirtyRegions(state2, canvasWidth, canvasHeight);
    expect(dirty2.length).toBe(0); // Idle frame - nothing dirty!
  });

  it('should return dirty regions when animations are active', () => {
    // Create base state with stable references
    const baseState = createMockState({
      animation: { frameCounter: 1, animations: [], paused: false }
    });
    
    detector.detectDirtyRegions(baseState, canvasWidth, canvasHeight);
    
    // Frame counter increments WITH active animation
    const state2: RootState = {
      ...baseState,
      animation: { 
        frameCounter: 2, 
        animations: [{ id: 'test-animation' } as any], 
        paused: false 
      }
    };
    
    const dirty2 = detector.detectDirtyRegions(state2, canvasWidth, canvasHeight);
    expect(dirty2.length).toBeGreaterThan(0); // Should be dirty when animations active
  });

  it('should handle multiple consecutive idle frames correctly', () => {
    // Create base state with stable references
    let prevState = createMockState({
      animation: { frameCounter: 1, animations: [], paused: false }
    });
    
    detector.detectDirtyRegions(prevState, canvasWidth, canvasHeight);
    
    // Multiple idle frames in a row
    for (let i = 2; i <= 10; i++) {
      const state: RootState = {
        ...prevState,
        animation: {
          ...prevState.animation,
          frameCounter: i,
        }
      };
      
      const dirty = detector.detectDirtyRegions(state, canvasWidth, canvasHeight);
      expect(dirty.length).toBe(0); // All should be clean
      
      prevState = state;
    }
  });

  it('should mark dirty when actual state changes occur', () => {
    // Create base state with stable references
    const baseState = createMockState({
      animation: { frameCounter: 1, animations: [], paused: false }
    });
    
    detector.detectDirtyRegions(baseState, canvasWidth, canvasHeight);
    
    // Board change (tile placement) - should be dirty
    const state2: RootState = {
      ...baseState,
      game: {
        ...baseState.game,
        board: new Map([['0,0', { type: 0, rotation: 0, position: { row: 0, col: 0 } }]])
      },
      animation: {
        ...baseState.animation,
        frameCounter: 2,
      }
    };
    
    const dirty2 = detector.detectDirtyRegions(state2, canvasWidth, canvasHeight);
    expect(dirty2.length).toBeGreaterThan(0); // Should be dirty on board change
  });
});
