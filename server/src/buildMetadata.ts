import { readFileSync } from 'node:fs';

export interface BuildMetadata {
  readonly component: 'frontend' | 'server';
  readonly gitSha: string;
  readonly buildTime: string;
  readonly buildId: string | null;
  readonly dirty: boolean;
}

const FULL_GIT_SHA = /^[0-9a-f]{40}$/i;

export function parseBuildMetadata(value: unknown): BuildMetadata & { component: 'server' } {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Server build metadata must be an object');
  }

  const metadata = value as Record<string, unknown>;
  if (metadata.component !== 'server') {
    throw new Error('Server build metadata has the wrong component');
  }
  if (typeof metadata.gitSha !== 'string' || !FULL_GIT_SHA.test(metadata.gitSha)) {
    throw new Error('Server build metadata has an invalid Git SHA');
  }
  if (typeof metadata.buildTime !== 'string' || Number.isNaN(Date.parse(metadata.buildTime))) {
    throw new Error('Server build metadata has an invalid build time');
  }
  if (metadata.buildId !== null && typeof metadata.buildId !== 'string') {
    throw new Error('Server build metadata has an invalid build ID');
  }
  if (typeof metadata.dirty !== 'boolean') {
    throw new Error('Server build metadata has an invalid dirty flag');
  }

  return metadata as unknown as BuildMetadata & { component: 'server' };
}

function loadServerBuildMetadata(): BuildMetadata & { component: 'server' } {
  try {
    const contents = readFileSync(new URL('./version.json', import.meta.url), 'utf8');
    return parseBuildMetadata(JSON.parse(contents));
  } catch (error) {
    const code = error instanceof Error && 'code' in error
      ? (error as NodeJS.ErrnoException).code
      : undefined;
    if (code !== 'ENOENT') throw error;

    // `tsx` development runs from src/, where the generated dist file does not
    // exist. Production starts must use the generated file from server/dist/.
    return parseBuildMetadata({
      component: 'server',
      gitSha: process.env.QUORTEX_GIT_SHA ?? '0000000000000000000000000000000000000000',
      buildTime: process.env.QUORTEX_BUILD_TIME ?? new Date().toISOString(),
      buildId: process.env.QUORTEX_BUILD_ID ?? null,
      dirty: true,
    });
  }
}

export const serverBuildMetadata = loadServerBuildMetadata();
