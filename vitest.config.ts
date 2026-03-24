import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      $lib: path.resolve(__dirname, 'src/lib')
    }
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/lib/server/**/*.ts', 'src/hooks.server.ts'],
      exclude: ['src/lib/server/types.ts'],
      thresholds: {
        lines: 90,
        functions: 100,
        branches: 85,
        statements: 90
      }
    }
  }
});
