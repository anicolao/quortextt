import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Discord Activity build configuration - uses relative paths for asset loading
export default defineConfig({
  root: 'discord', // Set root to discord directory
  plugins: [
    svelte({
      include: /\.svelte$/,
    })
  ],
  base: './', // Use relative paths instead of absolute /quortextt/ paths
  build: {
    outDir: '../dist/discord', // Output relative to root (discord/)
    assetsDir: 'assets', // Assets go in dist/discord/assets
    emptyOutDir: true, // Clear the discord directory before build
    sourcemap: false,
    minify: 'esbuild',
  },
});
