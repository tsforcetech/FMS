import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// The staff portal is a separate front end over the same company data. It
// reuses the admin app's audited data layer (task, case, notification and
// staff stores) through the @admin alias instead of duplicating it.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.VITE_STAFF_BASE_PATH || '/',
  envDir: '../..',
  resolve: {
    alias: {
      '@admin': fileURLToPath(new URL('../admin-web/src', import.meta.url)),
    },
  },
  server: { port: 5174 },
  build: { sourcemap: false },
});
