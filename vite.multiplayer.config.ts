import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

// Vite configuration for multiplayer mode with Svelte support
// This serves both the multiplayer (/) and tabletop (/tabletop) experiences
export default defineConfig({
  plugins: [
    svelte({
      include: /\.svelte$/,
    })
  ],
  base: '/quortextt/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        tabletop: resolve(__dirname, 'tabletop.html'),
      },
      output: {
        manualChunks: undefined,
      },
    },
  },
});
