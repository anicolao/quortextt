import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/game/**/*.ts', 'src/redux/**/*.ts'],
      exclude: ['src/game/index.ts', 'src/redux/types.ts'],
      clean: true,
    },
  },
});
