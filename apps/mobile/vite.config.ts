import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// The mobile app bundles into the Capacitor native shell (android/, ios/).
// It reuses the audited admin data layer (@admin) and the staff portal
// screens (@staff); only native and offline features live here.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  envDir: '../..',
  resolve: {
    alias: {
      '@admin': fileURLToPath(new URL('../admin-web/src', import.meta.url)),
      '@staff': fileURLToPath(new URL('../staff-web/src', import.meta.url)),
    },
  },
  server: { port: 5175 },
  build: { sourcemap: false, outDir: 'dist' },
});
