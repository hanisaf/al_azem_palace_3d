import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  publicDir: 'public',
  server: {
    port: 3000,
    open: false
  },
  build: {
    assetsDir: 'assets',
    sourcemap: false
  }
});
