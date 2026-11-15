import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// Sharaco platform console: a separate front end for platform staff. It
// reuses the admin app's Firebase setup and design kit; its authority comes
// only from the platformRole custom claim checked by the security rules.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.VITE_PLATFORM_BASE_PATH || '/',
  envDir: '../..',
  resolve: {
    alias: {
      '@admin': fileURLToPath(new URL('../admin-web/src', import.meta.url)),
    },
  },
  server: { port: 5177 },
  build: { sourcemap: false },
});
