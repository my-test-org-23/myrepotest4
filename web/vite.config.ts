import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During development the frontend runs on Vite's dev server and proxies /api
// to the Node API. In production `vite build` emits static files that the Node
// server serves directly, so they share an origin and no proxy is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
