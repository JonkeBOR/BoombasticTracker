import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const serverOnlyStub = fileURLToPath(
  new URL('./node_modules/server-only/empty.js', import.meta.url),
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      'server-only': serverOnlyStub,
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'src/lib/**/*.test.ts',
            'src/app/api/**/*.test.ts',
            'src/features/**/*.test.ts',
          ],
          exclude: ['**/*.storage.test.ts', '**/node_modules/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'storage',
          environment: 'node',
          include: ['src/**/*.storage.test.ts'],
          globalSetup: ['./vitest.storage-setup.ts'],
          testTimeout: 30000,
          hookTimeout: 60000,
          fileParallelism: false,
          isolate: false,
          maxWorkers: 1,
          sequence: { groupOrder: 1 },
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['./vitest.setup.ts'],
        },
      },
    ],
  },
});
