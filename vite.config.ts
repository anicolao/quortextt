import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';
import { createBuildMetadataConfig } from './vite.build-metadata';

const buildMetadata = createBuildMetadataConfig();
const backendTarget = process.env.QUORTEX_E2E_BACKEND_URL || 'http://127.0.0.1:3001';
const backendProxy = {
  '/api': { target: backendTarget, changeOrigin: true },
  '/auth': { target: backendTarget, changeOrigin: true },
  '^/health$': { target: backendTarget, changeOrigin: true },
  '^/version$': { target: backendTarget, changeOrigin: true },
  '/socket.io': { target: backendTarget, changeOrigin: true, ws: true },
};

// Default Vite configuration - serves both multiplayer (/) and tabletop (/tabletop)
export default defineConfig({
  plugins: [
    svelte({
      include: /\.svelte$/,
    }),
    buildMetadata.versionAssetPlugin,
  ],
  define: buildMetadata.define,
  base: '/quortextt/',
  server: { proxy: backendProxy },
  preview: { proxy: backendProxy },
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
        // Ensure asset paths are absolute from base, not relative
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
  experimental: {
    // Render built URLs as absolute from base path
    renderBuiltUrl(filename: string) {
      return '/quortextt/' + filename;
    },
  },
});
