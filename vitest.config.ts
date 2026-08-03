import { resolve } from 'node:path';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vitest/config';

/**
 * Vitest runs outside WXT, so the `@/…` alias and the Preact JSX transform have
 * to be restated here. Everything runs in jsdom: the pure-logic tests don't care,
 * and the component tests need a DOM. `tests/setup.ts` installs the fake `chrome`
 * API and an in-memory IndexedDB before each file.
 */
export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      '~': resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['lib/**/*.ts', 'components/**/*.tsx', 'entrypoints/**/*.tsx'],
      exclude: [
        'lib/types.ts',
        'lib/extract/types.ts',
        // Runs inside the page's isolated world, not in Node — its coverage comes
        // from the real-browser smoke in `scripts/e2e-capture.mjs`.
        'lib/extract/scanner.ts',
        // Three-line render() bootstraps, covered end-to-end by `scripts/e2e-flow.mjs`.
        'entrypoints/**/main.tsx',
      ],
      thresholds: {
        lines: 95,
        statements: 93,
        functions: 90,
        branches: 88,
      },
    },
  },
});
