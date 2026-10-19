import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
  server: {
    host: '127.0.0.1',
    port: 5176,
    proxy: {
      '/api': 'http://127.0.0.1:4000',
    },
  },
});
