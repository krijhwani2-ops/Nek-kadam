import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@vladmandic/face-api': '@vladmandic/face-api/dist/face-api.esm.js'
    }
  },
  build: {
    chunkSizeWarningLimit: 1500
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/rpc': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
});
