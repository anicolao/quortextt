import type { Plugin } from 'vite';
import { createBuildMetadata } from './scripts/build-metadata.mjs';

export function createBuildMetadataConfig() {
  const metadata = {
    component: 'frontend' as const,
    ...createBuildMetadata(),
  };

  const versionAssetPlugin: Plugin = {
    name: 'quortex-build-metadata',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: `${JSON.stringify(metadata, null, 2)}\n`,
      });
    },
  };

  return {
    define: {
      __QUORTEX_BUILD__: JSON.stringify(metadata),
    },
    metadata,
    versionAssetPlugin,
  };
}
