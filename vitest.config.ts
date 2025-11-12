import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000, // 60 seconds to handle slow AI tests
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/game/**/*.ts', 'src/redux/**/*.ts'],
      exclude: [
        'src/game/index.ts',
        'src/redux/types.ts',
        'src/game/ai.ts', // Temporarily exclude AI from coverage
        'src/redux/aiMiddleware.ts', // Temporarily exclude AI middleware from coverage
        'src/redux/store.ts' // Store configuration with browser-only code
      ],
      clean: true,
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 95,
        statements: 100,
      },
    },
  },
});
