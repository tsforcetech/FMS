import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['firebase/tests/**/*.test.{ts,tsx}'],
    fileParallelism: false,
    environmentOptions: { jsdom: { url: 'http://localhost:5173/' } },
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
