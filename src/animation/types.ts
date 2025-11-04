// Animation framework types

export interface AnimationState {
  frameCounter: number;           // Global frame counter
  paused: boolean;                // For debugging: pause all animations
  animations: ActiveAnimation[];  // List sorted by startFrame
}

export interface ActiveAnimation {
  id: string;                     // Unique animation ID
  animationName: string;          // Name of registered animation function
  startFrame: number;             // Frame when animation starts
  endFrame: number;               // Frame when animation ends
  loop?: boolean;                 // If true, restart animation when it completes
}

// Type for animation functions (takes normalized time 0-1)
export type AnimationFunction = (t: number) => void;
