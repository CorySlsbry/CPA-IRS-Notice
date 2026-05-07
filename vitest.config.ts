import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['lib/**/*.spec.ts', 'lib/**/*.test.ts', 'app/**/*.spec.ts'],
    coverage: { provider: 'v8', reporter: ['text', 'html'] },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
