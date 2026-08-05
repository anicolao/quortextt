import { mkdtemp, mkdir, readFile, readlink, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error Build-time release helpers intentionally remain JavaScript modules.
import { activateRelease, rollbackRelease } from '../scripts/manage-release.mjs';
// @ts-expect-error Build-time release helpers intentionally remain JavaScript modules.
import { verifyRelease, writeReleaseManifest } from '../scripts/release-manifest.mjs';

const SHA_A = '0123456789abcdef0123456789abcdef01234567';
const SHA_B = '89abcdef0123456789abcdef0123456789abcdef';
const temporaryDirectories: string[] = [];

async function createRelease(releaseRoot: string, sha: string, marker: string) {
  const releaseDirectory = resolve(releaseRoot, 'releases', sha);
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
