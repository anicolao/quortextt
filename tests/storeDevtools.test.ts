// Test for store.ts devtools coverage

import { describe, it, expect, beforeAll } from 'vitest';

describe('Store DevTools Coverage', () => {
  beforeAll(() => {
    // Set up mock window with devtools before importing store
    if (typeof globalThis !== 'undefined') {
      (globalThis as any).window = {
        __REDUX_DEVTOOLS_EXTENSION__: () => (next: any) => (action: any) => next(action),
      };
    }
  });

  it('should import store with devtools extension available', async () => {
    // Dynamic import to ensure window mock is set up first
    const storeModule = await import('../src/redux/store');
    
    expect(storeModule.store).toBeDefined();
    expect(storeModule.store.getState).toBeDefined();
    
    // Verify window has the extension
    if (typeof window !== 'undefined') {
      expect((window as any).__REDUX_DEVTOOLS_EXTENSION__).toBeDefined();
    }
  });
});
