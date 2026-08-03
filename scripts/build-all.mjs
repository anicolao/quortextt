import { spawnSync } from 'node:child_process';
import { createBuildMetadata, metadataEnvironment } from './build-metadata.mjs';

const metadata = createBuildMetadata();
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const env = {
  ...process.env,
  ...metadataEnvironment(metadata),
  QUORTEX_RELEASE_BUILD: 'true',
};

for (const script of ['build', 'build:server']) {
  const result = spawnSync(npmCommand, ['run', script], {
    env,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
