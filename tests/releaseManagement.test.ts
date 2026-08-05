import { execFile } from 'node:child_process';
import { access, mkdtemp, mkdir, readFile, readlink, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error Build-time release helpers intentionally remain JavaScript modules.
import { activateRelease, importRelease, rollbackRelease } from '../scripts/manage-release.mjs';
// @ts-expect-error Build-time release helpers intentionally remain JavaScript modules.
import { verifyRelease, writeReleaseManifest } from '../scripts/release-manifest.mjs';

const SHA_A = '0123456789abcdef0123456789abcdef01234567';
const SHA_B = '89abcdef0123456789abcdef0123456789abcdef';
const temporaryDirectories: string[] = [];
const execFileAsync = promisify(execFile);

async function populateRelease(releaseDirectory: string, sha: string, marker: string) {
  await Promise.all([
    mkdir(resolve(releaseDirectory, 'frontend'), { recursive: true }),
    mkdir(resolve(releaseDirectory, 'server/dist'), { recursive: true }),
  ]);
  const commonMetadata = {
    gitSha: sha,
    buildTime: '2026-08-04T12:00:00.000Z',
    buildId: '123.1',
    dirty: false,
  };
  await Promise.all([
    writeFile(resolve(releaseDirectory, 'frontend/index.html'), marker),
    writeFile(
      resolve(releaseDirectory, 'frontend/version.json'),
      JSON.stringify({ component: 'frontend', ...commonMetadata }),
    ),
    writeFile(resolve(releaseDirectory, 'server/dist/index.js'), `// ${marker}\n`),
    writeFile(
      resolve(releaseDirectory, 'server/dist/version.json'),
      JSON.stringify({ component: 'server', ...commonMetadata }),
    ),
  ]);
  await writeReleaseManifest(releaseDirectory, { expectedNodeMajor: 22 });
  return releaseDirectory;
}

async function createRelease(releaseRoot: string, sha: string, marker: string) {
  return populateRelease(resolve(releaseRoot, 'releases', sha), sha, marker);
}

async function createReleaseRoot() {
  const releaseRoot = await mkdtemp(resolve(tmpdir(), 'quortex-release-test-'));
  temporaryDirectories.push(releaseRoot);
  await mkdir(resolve(releaseRoot, 'releases'));
  return releaseRoot;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )));
});

describe('immutable release manifests', () => {
  it('verifies a complete release and rejects any byte difference', async () => {
    const releaseRoot = await createReleaseRoot();
    const releaseDirectory = await createRelease(releaseRoot, SHA_A, 'release A');

    await expect(verifyRelease(releaseDirectory, {
      expectedSha: SHA_A,
      expectedNodeMajor: 22,
      expectedUid: process.getuid?.(),
    })).resolves.toMatchObject({ gitSha: SHA_A, node: { major: 22 } });

    const indexPath = resolve(releaseDirectory, 'frontend/index.html');
    await writeFile(indexPath, `${await readFile(indexPath, 'utf8')}changed`);
    await expect(verifyRelease(releaseDirectory, { expectedSha: SHA_A })).rejects.toThrow(
      /inventory or checksums/,
    );
  });
});

describe('release import', () => {
  it('imports the fixed incoming archive before activation', async () => {
    const releaseRoot = await createReleaseRoot();
    const incomingRoot = resolve(releaseRoot, 'incoming');
    await mkdir(incomingRoot);
    const archivePath = resolve(incomingRoot, `quortex-${SHA_A}.tar.gz`);
    const sourceDirectory = resolve(releaseRoot, 'archive-source');
    await populateRelease(sourceDirectory, SHA_A, 'imported release');
    await execFileAsync('tar', ['-czf', archivePath, '-C', sourceDirectory, '.']);

    await expect(importRelease(releaseRoot, incomingRoot, SHA_A, {
      expectedUid: process.getuid?.(),
      expectedArchiveUid: process.getuid?.(),
      tarPath: 'tar',
    })).resolves.toMatchObject({ gitSha: SHA_A });

    expect(await readFile(
      resolve(releaseRoot, 'releases', SHA_A, 'frontend/index.html'),
      'utf8',
    )).toBe('imported release');
    await expect(access(archivePath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('does not install an incoming release with any changed byte', async () => {
    const releaseRoot = await createReleaseRoot();
    const incomingRoot = resolve(releaseRoot, 'incoming');
    await mkdir(incomingRoot);
    const archivePath = resolve(incomingRoot, `quortex-${SHA_A}.tar.gz`);
    await writeFile(archivePath, 'test archive');

    await expect(importRelease(releaseRoot, incomingRoot, SHA_A, {
      expectedUid: process.getuid?.(),
      expectedArchiveUid: process.getuid?.(),
      extractArchive: async (_archivePath: string, destination: string) => {
        await populateRelease(destination, SHA_A, 'original release');
        await writeFile(resolve(destination, 'frontend/index.html'), 'changed release');
      },
    })).rejects.toThrow(/inventory or checksums/);

    await expect(access(resolve(releaseRoot, 'releases', SHA_A))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(access(archivePath)).resolves.toBeUndefined();
  });
});

describe('release activation', () => {
  it('activates and rolls back by atomically swapping managed links', async () => {
    const releaseRoot = await createReleaseRoot();
    await Promise.all([
      createRelease(releaseRoot, SHA_A, 'release A'),
      createRelease(releaseRoot, SHA_B, 'release B'),
    ]);
    const restarts: string[] = [];
    const options = {
      expectedUid: process.getuid?.(),
      restartService: async () => { restarts.push('restart'); },
    };

    await expect(activateRelease(releaseRoot, SHA_A, options)).resolves.toMatchObject({
      current: SHA_A,
      previous: null,
    });
    await expect(activateRelease(releaseRoot, SHA_B, options)).resolves.toMatchObject({
      current: SHA_B,
      previous: SHA_A,
    });
    expect(await readlink(resolve(releaseRoot, 'current'))).toBe(`releases/${SHA_B}`);
    expect(await readlink(resolve(releaseRoot, 'previous'))).toBe(`releases/${SHA_A}`);

    await expect(rollbackRelease(releaseRoot, options)).resolves.toMatchObject({
      current: SHA_A,
      previous: SHA_B,
    });
    expect(await readlink(resolve(releaseRoot, 'current'))).toBe(`releases/${SHA_A}`);
    expect(await readlink(resolve(releaseRoot, 'previous'))).toBe(`releases/${SHA_B}`);
    expect(restarts).toHaveLength(3);
  });

  it('restores the active link if the new service cannot start', async () => {
    const releaseRoot = await createReleaseRoot();
    await Promise.all([
      createRelease(releaseRoot, SHA_A, 'release A'),
      createRelease(releaseRoot, SHA_B, 'release B'),
    ]);
    await activateRelease(releaseRoot, SHA_A, {
      expectedUid: process.getuid?.(),
      restartService: async () => {},
    });

    let restartAttempts = 0;
    await expect(activateRelease(releaseRoot, SHA_B, {
      expectedUid: process.getuid?.(),
      restartService: async () => {
        restartAttempts += 1;
        if (restartAttempts === 1) throw new Error('service failed');
      },
    })).rejects.toThrow('service failed');

    expect(await readlink(resolve(releaseRoot, 'current'))).toBe(`releases/${SHA_A}`);
    expect(restartAttempts).toBe(2);
  });
});
