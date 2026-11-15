import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: {
    alias: {
      '@admin': fileURLToPath(new URL('./apps/admin-web/src', import.meta.url)),
    },
  },
  test: {
    include: ['firebase/tests/**/*.test.{ts,tsx}'],
    fileParallelism: false,
    environmentOptions: { jsdom: { url: 'http://localhost:5173/' } },
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
