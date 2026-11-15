import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// The customer portal is a separate, deliberately small front end. It reuses
// the admin app's audited customer store (customerStore.ts) and the staff
// portal's mobile-first styles; it never imports internal admin screens.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.VITE_CUSTOMER_BASE_PATH || '/',
  envDir: '../..',
  resolve: {
    alias: {
      '@admin': fileURLToPath(new URL('../admin-web/src', import.meta.url)),
      '@staff': fileURLToPath(new URL('../staff-web/src', import.meta.url)),
    },
  },
  server: { port: 5176 },
  build: { sourcemap: false },
});
