import { spawnSync } from 'node:child_process';
import { createBuildMetadata, metadataEnvironment } from './build-metadata.mjs';

const metadata = createBuildMetadata();
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const env = {
  ...process.env,
  ...metadataEnvironment(metadata),
  QUORTEX_RELEASE_BUILD: 'true',
  // Release frontends always reach the backend through their current origin.
  // This also overrides any developer-only value loaded from a local .env.
  VITE_SERVER_URL: '',
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
