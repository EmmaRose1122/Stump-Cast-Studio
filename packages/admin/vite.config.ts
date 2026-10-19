import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Served by the StumpCast server at /admin/, so assets must be relative.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
  server: {
    host: '127.0.0.1',
    port: 5175,
    proxy: {
      '/api': 'http://127.0.0.1:4000',
      '/assets': 'http://127.0.0.1:4000',
      '/ws': { target: 'ws://127.0.0.1:4000', ws: true },
      '/ext': { target: 'ws://127.0.0.1:4000', ws: true },
    },
  },
});
