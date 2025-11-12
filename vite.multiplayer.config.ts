import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Vite configuration for multiplayer mode with Svelte support
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
      output: {
        manualChunks: undefined,
      },
    },
  },
});
