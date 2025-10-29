// Shared helper functions for e2e tests

/**
 * Get Redux state from the browser with proper serialization of Maps and Sets
 */
export async function getReduxState(page: any) {
  return await page.evaluate(() => {
    const state = (window as any).__REDUX_STORE__.getState();
    // Custom serialization for Maps and Sets
    return JSON.parse(JSON.stringify(state, (key, value) => {
      if (value instanceof Map) {
        return Object.fromEntries(value);
      }
      if (value instanceof Set) {
        return Array.from(value);
      }
      return value;
    }));
  });
}

/**
 * Rotate a direction by a number of steps
 * This matches the logic in src/game/board.ts rotateDirection()
 * The Direction enum is clockwise, so we subtract to rotate
 */
export function rotateDirection(direction: number, steps: number): number {
  return ((direction - steps + 6) % 6);
}
