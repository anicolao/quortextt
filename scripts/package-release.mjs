import { execFileSync, spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { verifyRelease, writeReleaseManifest } from './release-manifest.mjs';

const repositoryRoot = resolve(import.meta.dirname, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function readGit(args) {
  return execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function readOutputDirectory() {
  const outputIndex = process.argv.indexOf('--output');
  if (outputIndex === -1) return resolve(repositoryRoot, 'release-artifacts');
  const value = process.argv[outputIndex + 1];
  if (!value) throw new Error('--output requires a directory');
  return resolve(value);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with ${result.status}`);
  }
}

const outputDirectory = readOutputDirectory();
const sourceSha = readGit(['rev-parse', 'HEAD']).toLowerCase();
if (readGit(['status', '--porcelain'])) {
  throw new Error('Immutable release packaging requires a clean Git checkout');
}
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'quortex-release-'));
const releaseDirectory = resolve(temporaryDirectory, 'release');

try {
  await mkdir(resolve(releaseDirectory, 'server'), { recursive: true });
  await Promise.all([
    cp(resolve(repositoryRoot, 'dist'), resolve(releaseDirectory, 'frontend'), {
      recursive: true,
    }),
    cp(
      resolve(repositoryRoot, 'server/dist'),
      resolve(releaseDirectory, 'server/dist'),
      { recursive: true },
    ),
    cp(
      resolve(repositoryRoot, 'server/package.json'),
      resolve(releaseDirectory, 'server/package.json'),
    ),
    cp(
      resolve(repositoryRoot, 'server/package-lock.json'),
      resolve(releaseDirectory, 'server/package-lock.json'),
    ),
    cp(resolve(repositoryRoot, 'LICENSE'), resolve(releaseDirectory, 'LICENSE')),
  ]);

  run(npmCommand, ['ci', '--omit=dev', '--ignore-scripts'], {
    cwd: resolve(releaseDirectory, 'server'),
    env: { ...process.env, NODE_ENV: 'production' },
  });
  await rm(resolve(releaseDirectory, 'server/node_modules/.bin'), {
    recursive: true,
    force: true,
  });

  const expectedNodeMajor = Number(process.env.QUORTEX_EXPECTED_NODE_MAJOR ?? '22');
  const manifest = await writeReleaseManifest(releaseDirectory, { expectedNodeMajor });
  if (manifest.gitSha !== sourceSha) {
    throw new Error(`Built release SHA ${manifest.gitSha} does not match source SHA ${sourceSha}`);
  }
  await verifyRelease(releaseDirectory, {
    expectedSha: manifest.gitSha,
    expectedNodeMajor,
  });

  await mkdir(outputDirectory, { recursive: true });
  const artifactPath = resolve(outputDirectory, `quortex-${manifest.gitSha}.tar.gz`);
  await rm(artifactPath, { force: true });
  run('tar', ['-czf', artifactPath, '-C', releaseDirectory, '.'], {
    env: { ...process.env, COPYFILE_DISABLE: '1' },
  });
  console.log(`Packaged ${basename(artifactPath)}`);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
