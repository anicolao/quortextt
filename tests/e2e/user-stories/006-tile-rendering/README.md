# User Story: Tile Rendering Verification

**As a developer, I want to verify that all tile types render correctly in all rotations**

## Flow Description

This story provides comprehensive visual verification of tile rendering for all tile types (NoSharps, OneSharp, TwoSharps, ThreeSharps) in all 6 possible rotations. Each screenshot includes edge labels and connection information to help diagnose rendering issues and verify that rendered curves match the logical model.

## Purpose

This is a **developer-focused** story that serves multiple purposes:
1. Visual verification that tile rendering is correct
2. Documentation of tile patterns and connections
3. Debugging aid when rendering issues occur
4. Reference for understanding tile rotation mechanics
5. Validation that logical model matches visual rendering

## Test Scenario

- **Tile Types**: 4 (NoSharps, OneSharp, TwoSharps, ThreeSharps)
- **Rotations per Type**: 6 (0-5)
- **Total Screenshots**: 24
- **Seed**: 42 (for reproducibility)
- **Tile Position**: Center (0, 0) for clear visibility

## Screenshot Format

Each screenshot includes:
- **Title**: Tile type and rotation number
- **Edge Labels**: Numbers (0-5) with direction names (SW, W, NW, NE, E, SE)
- **Connection Info**: List of which edges connect through flow paths
- **Visual Tile**: Rendered tile with flow paths visible

## Hexagonal Edge Directions

```
      NW (2)    NE (3)
         \      /
          \    /
   W (1) —— •• —— E (4)
          /    \
         /      \
      SW (0)    SE (5)
```

## Tile Types and Connections

### NoSharps (Type 0)
- **Base Connections**: 0↔2 (curved), 1↔4 (straight), 3↔5 (curved)
- **Description**: Three gentle curves, no sharp turns
- **Use Case**: Smooth flow transitions

#### NoSharps Screenshots

1. **nosharps-rotation-0.png** - Connections: 0↔2, 1↔4, 3↔5
2. **nosharps-rotation-1.png** - Connections: 1↔3, 2↔5, 4↔0
3. **nosharps-rotation-2.png** - Connections: 2↔4, 3↔0, 5↔1
4. **nosharps-rotation-3.png** - Connections: 3↔5, 4↔1, 0↔2
5. **nosharps-rotation-4.png** - Connections: 4↔0, 5↔2, 1↔3
6. **nosharps-rotation-5.png** - Connections: 5↔1, 0↔3, 2↔4

### OneSharp (Type 1)
- **Base Connections**: 0↔5 (sharp), 1↔3 (curved), 2↔4 (curved)
- **Description**: One sharp 60° turn plus two curves
- **Use Case**: Directional flow with one sharp turn

#### OneSharp Screenshots

1. **onesharp-rotation-0.png** - Connections: 0↔5, 1↔3, 2↔4
2. **onesharp-rotation-1.png** - Connections: 1↔0, 2↔4, 3↔5
3. **onesharp-rotation-2.png** - Connections: 2↔1, 3↔5, 4↔0
4. **onesharp-rotation-3.png** - Connections: 3↔2, 4↔0, 5↔1
5. **onesharp-rotation-4.png** - Connections: 4↔3, 5↔1, 0↔2
6. **onesharp-rotation-5.png** - Connections: 5↔4, 0↔2, 1↔3

### TwoSharps (Type 2)
- **Base Connections**: 0↔5 (sharp), 1↔4 (straight), 2↔3 (sharp)
- **Description**: Two sharp 60° turns plus one straight path
- **Use Case**: Multiple sharp redirections

#### TwoSharps Screenshots

1. **twosharps-rotation-0.png** - Connections: 0↔5, 1↔4, 2↔3
2. **twosharps-rotation-1.png** - Connections: 1↔0, 2↔5, 3↔4
3. **twosharps-rotation-2.png** - Connections: 2↔1, 3↔0, 4↔5
4. **twosharps-rotation-3.png** - Connections: 3↔2, 4↔1, 5↔0
5. **twosharps-rotation-4.png** - Connections: 4↔3, 5↔2, 0↔1
6. **twosharps-rotation-5.png** - Connections: 5↔4, 0↔3, 1↔2

### ThreeSharps (Type 3)
- **Base Connections**: 0↔5 (sharp), 1↔2 (sharp), 3↔4 (sharp)
- **Description**: Three sharp 60° turns
- **Use Case**: Maximum sharp redirection, complex flow patterns

#### ThreeSharps Screenshots

1. **threesharps-rotation-0.png** - Connections: 0↔5, 1↔2, 3↔4
2. **threesharps-rotation-1.png** - Connections: 1↔0, 2↔3, 4↔5
3. **threesharps-rotation-2.png** - Connections: 2↔1, 3↔4, 5↔0
4. **threesharps-rotation-3.png** - Connections: 3↔2, 4↔5, 0↔1
5. **threesharps-rotation-4.png** - Connections: 4↔3, 5↔0, 1↔2
6. **threesharps-rotation-5.png** - Connections: 5↔4, 0↔1, 2↔3

## How to Use These Screenshots

### For Debugging Rendering Issues:

1. **Identify the problem**: Note which tile type and rotation looks incorrect
2. **Check this README**: Find the expected connections for that tile/rotation
3. **Compare visual to expected**: Verify that rendered paths match connection list
4. **Check edge alignment**: Use edge labels to verify paths connect correct edges

### For Understanding Tile Mechanics:

1. **View all rotations**: See how rotation affects connection patterns
2. **Pattern recognition**: Notice how connections shift by 60° with each rotation
3. **Flow planning**: Understand which tiles create which flow patterns
4. **Strategic placement**: Learn which rotations fit which board situations

### For Verifying Code Changes:

1. **Before changes**: Review current screenshots
2. **After changes**: Regenerate tests and compare
3. **Visual diff**: Look for unexpected changes in rendering
4. **Connection validation**: Verify connections still match expectations

## Test Coverage

This story validates:
- All 4 tile types render correctly
- All 6 rotations render correctly
- Edge positions align with logical model (0-5)
- Flow path curves match connection patterns
- Rotation mechanics work correctly
- Visual rendering matches tile definitions in code
- Edge direction names (SW, W, NW, NE, E, SE) align properly
- Connection information is accurate

## Related Files
- Test: `tests/e2e/tile-rendering.spec.ts`
- Tile Definitions: `src/game/tiles.ts`
- Tile Renderer: `src/rendering/tileRenderer.ts`
- Rendering Canvas: `src/rendering/gameplayScreen.ts`

## Rotation Math

Connection rotation formula: `(edge + rotation) % 6`

Example for OneSharp rotation 2:
- Base: 0↔5, 1↔3, 2↔4
- After rotation 2: (0+2)↔(5+2), (1+2)↔(3+2), (2+2)↔(4+2)
- Result: 2↔1, 3↔5, 4↔0

## Benefits

1. **Visual Documentation**: Clearly shows what each tile looks like
2. **Debugging Aid**: Edge labels help diagnose misalignment issues
3. **Reference Material**: New developers can understand tile mechanics
4. **Regression Testing**: Visual comparison detects rendering changes
5. **Connection Verification**: Confirms logical model matches visual
6. **Learning Tool**: Helps understand hexagonal geometry and rotations
