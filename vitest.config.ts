import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: {
    alias: {
      '@admin': fileURLToPath(new URL('./apps/admin-web/src', import.meta.url)),
    },
  },
  test: { include: ['packages/**/*.test.ts', 'apps/mobile/src/**/*.test.ts'] },
});
