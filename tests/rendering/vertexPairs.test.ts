// Test to verify vertexPairs correctly map to Direction enum
// This ensures that rendering matches the logical direction names

import { describe, it, expect } from 'vitest';
import { Direction } from '../../src/game/types';
import { getEdgeMidpoint, getHexVertex } from '../../src/rendering/hexLayout';

describe('vertexPairs mapping to Direction', () => {
  it('should map directions to correct screen positions', () => {
    const center = { x: 0, y: 0 };
    const size = 100;

    // Get edge midpoints for each direction
    const edges = {
      [Direction.SouthWest]: getEdgeMidpoint(center, size, Direction.SouthWest),
      [Direction.West]: getEdgeMidpoint(center, size, Direction.West),
      [Direction.NorthWest]: getEdgeMidpoint(center, size, Direction.NorthWest),
      [Direction.NorthEast]: getEdgeMidpoint(center, size, Direction.NorthEast),
      [Direction.East]: getEdgeMidpoint(center, size, Direction.East),
      [Direction.SouthEast]: getEdgeMidpoint(center, size, Direction.SouthEast),
    };

    // NOTE: Rendering appears to be vertically flipped from typical screen coordinates
    // In the render: "North" appears at bottom (positive Y), "South" at top (negative Y)
    // This matches how the game board is rendered

    // East should be to the right (positive X, Y near 0)
    expect(edges[Direction.East].x).toBeGreaterThan(80);
    expect(Math.abs(edges[Direction.East].y)).toBeLessThan(20);

    // West should be to the left (negative X, Y near 0)
    expect(edges[Direction.West].x).toBeLessThan(-80);
    expect(Math.abs(edges[Direction.West].y)).toBeLessThan(20);

    // NorthEast should be down-right in render (positive X, positive Y)
    expect(edges[Direction.NorthEast].x).toBeGreaterThan(40);
    expect(edges[Direction.NorthEast].y).toBeGreaterThan(40);

    // NorthWest should be down-left in render (negative X, positive Y)
    expect(edges[Direction.NorthWest].x).toBeLessThan(-40);
    expect(edges[Direction.NorthWest].y).toBeGreaterThan(40);

    // SouthEast should be up-right in render (positive X, negative Y)
    expect(edges[Direction.SouthEast].x).toBeGreaterThan(40);
    expect(edges[Direction.SouthEast].y).toBeLessThan(-40);

    // SouthWest should be up-left in render (negative X, negative Y)
    expect(edges[Direction.SouthWest].x).toBeLessThan(-40);
    expect(edges[Direction.SouthWest].y).toBeLessThan(-40);
  });

  it('should have vertices at expected angles for pointy-top hexagon', () => {
    const center = { x: 0, y: 0 };
    const size = 100;

    // For a pointy-top hexagon with vertex 0 at top
    // Vertex 0 should be at -30° (330°) = up and slightly right
    const v0 = getHexVertex(center, size, 0);
    expect(v0.y).toBeLessThan(0); // Up (negative Y)
    expect(v0.x).toBeGreaterThan(0); // Right (positive X)

    // Vertex 1 should be at 30° = down-right
    const v1 = getHexVertex(center, size, 1);
    expect(v1.y).toBeGreaterThan(0); // Down (positive Y)
    expect(v1.x).toBeGreaterThan(0); // Right (positive X)

    // Vertex 2 should be at 90° = down
    const v2 = getHexVertex(center, size, 2);
    expect(v2.y).toBeGreaterThan(80); // Down (large positive Y)
    expect(Math.abs(v2.x)).toBeLessThan(20); // Centered (X near 0)

    // Vertex 3 should be at 150° = down-left
    const v3 = getHexVertex(center, size, 3);
    expect(v3.y).toBeGreaterThan(0); // Down (positive Y)
    expect(v3.x).toBeLessThan(0); // Left (negative X)

    // Vertex 4 should be at 210° = up-left
    const v4 = getHexVertex(center, size, 4);
    expect(v4.y).toBeLessThan(0); // Up (negative Y)
    expect(v4.x).toBeLessThan(0); // Left (negative X)

    // Vertex 5 should be at 270° = up
    const v5 = getHexVertex(center, size, 5);
    expect(v5.y).toBeLessThan(-80); // Up (large negative Y)
    expect(Math.abs(v5.x)).toBeLessThan(20); // Centered (X near 0)
  });

  it('should log actual edge positions for debugging', () => {
    const center = { x: 0, y: 0 };
    const size = 100;

    console.log('\n=== Direction to Edge Position Mapping ===');
    const directionNames = ['SouthWest', 'West', 'NorthWest', 'NorthEast', 'East', 'SouthEast'];
    
    for (let dir = 0; dir < 6; dir++) {
      const edge = getEdgeMidpoint(center, size, dir as Direction);
      const angle = Math.atan2(edge.y, edge.x) * (180 / Math.PI);
      console.log(`${directionNames[dir]} (${dir}): (${edge.x.toFixed(1)}, ${edge.y.toFixed(1)}) at ${angle.toFixed(1)}°`);
    }

    console.log('\n=== Vertex Positions ===');
    for (let v = 0; v < 6; v++) {
      const vertex = getHexVertex(center, size, v);
      const angle = Math.atan2(vertex.y, vertex.x) * (180 / Math.PI);
      console.log(`Vertex ${v}: (${vertex.x.toFixed(1)}, ${vertex.y.toFixed(1)}) at ${angle.toFixed(1)}°`);
    }
  });
});
