import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['**/node_modules/**', 'dist', 'website/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client/src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
});
