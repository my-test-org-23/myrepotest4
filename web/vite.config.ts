import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During development the frontend runs on Vite's dev server and proxies /api
// to the Node API. In production `vite build` emits static files that the Node
// server serves directly, so they share an origin and no proxy is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    // host: true binds to 0.0.0.0 so other machines on the LAN can reach the
    // dev server. It proxies /api to the API running on this same machine.
    host: true,
    port: 5180,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    outDir: 'dist',
  },
});
