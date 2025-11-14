import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

// Default Vite configuration - serves both multiplayer (/) and tabletop (/tabletop)
export default defineConfig({
  plugins: [
    svelte({
      include: /\.svelte$/,
    })
  ],
  base: '/quortextt/',
  experimental: {
    renderBuiltUrl(filename, { hostType, type, ssr }) {
      // For discord HTML, use relative paths to assets
      if (hostType === 'html' && type === 'asset') {
        return '../assets/' + filename.split('/').pop();
      }
      if (hostType === 'html' && type === 'public') {
        return '../' + filename;
      }
      // Default behavior for other files
      return { relative: true };
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild', // Use esbuild minification (faster and built-in)
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        tabletop: resolve(__dirname, 'tabletop.html'),
        discord: resolve(__dirname, 'discord/index.html'),
      },
      output: {
        manualChunks: undefined, // Single bundle for simplicity
      },
    },
  },
});
