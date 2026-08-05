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

// Vite configuration for multiplayer mode with Svelte support
// This serves both the multiplayer (/) and tabletop (/tabletop) experiences
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
