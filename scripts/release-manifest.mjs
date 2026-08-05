import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';

const FULL_GIT_SHA = /^[0-9a-f]{40}$/;
const RELEASE_SCHEMA_VERSION = 1;

function normalizeRelativePath(rootDirectory, filePath) {
  return relative(rootDirectory, filePath).split(sep).join('/');
}

async function walkRelease(directory, rootDirectory, entries, options) {
  const children = await readdir(directory, { withFileTypes: true });
  children.sort((left, right) => left.name.localeCompare(right.name));

  for (const child of children) {
    const childPath = resolve(directory, child.name);
    const releasePath = normalizeRelativePath(rootDirectory, childPath);
    const stats = await lstat(childPath);

    if (options.expectedUid !== undefined && stats.uid !== options.expectedUid) {
      throw new Error(`${releasePath} must be owned by uid ${options.expectedUid}`);
    }
    if ((stats.mode & 0o022) !== 0) {
      throw new Error(`${releasePath} must not be writable by group or other users`);
    }
    if (stats.isSymbolicLink()) {
      throw new Error(`Release entries must not be symbolic links: ${releasePath}`);
    }
    if (stats.isDirectory()) {
      await walkRelease(childPath, rootDirectory, entries, options);
      continue;
    }
    if (!stats.isFile()) {
      throw new Error(`Release entries must be regular files: ${releasePath}`);
    }
    if (releasePath === 'release.json') continue;

    const contents = await readFile(childPath);
    entries.push({
      path: releasePath,
      sha256: createHash('sha256').update(contents).digest('hex'),
      bytes: contents.byteLength,
    });
  }
}

async function listReleaseFiles(releaseDirectory, options = {}) {
  const rootDirectory = resolve(releaseDirectory);
  const rootStats = await lstat(rootDirectory);
  if (!rootStats.isDirectory()) {
    throw new Error(`Release is not a directory: ${rootDirectory}`);
  }
  if (options.expectedUid !== undefined && rootStats.uid !== options.expectedUid) {
    throw new Error(`Release root must be owned by uid ${options.expectedUid}`);
  }
  if ((rootStats.mode & 0o022) !== 0) {
    throw new Error('Release root must not be writable by group or other users');
  }

  const entries = [];
  await walkRelease(rootDirectory, rootDirectory, entries, options);
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

async function readJson(path, description) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read ${description} at ${path}`, { cause: error });
  }
}

function assertCommonMetadata(frontend, server) {
  if (frontend.component !== 'frontend' || server.component !== 'server') {
    throw new Error('Release component metadata has an invalid component name');
  }
  if (!FULL_GIT_SHA.test(frontend.gitSha) || frontend.gitSha !== server.gitSha) {
    throw new Error('Frontend and server release SHAs must be identical full Git SHAs');
  }
  if (Number.isNaN(Date.parse(frontend.buildTime))) {
    throw new Error('Release build time must be an ISO-8601 timestamp');
  }
  if (frontend.buildId !== null && typeof frontend.buildId !== 'string') {
    throw new Error('Release build ID must be a string or null');
  }
  for (const field of ['buildTime', 'buildId', 'dirty']) {
    if (frontend[field] !== server[field]) {
      throw new Error(`Frontend and server release metadata disagree on ${field}`);
    }
  }
  if (frontend.dirty !== false) {
    throw new Error('Immutable releases must be built from a clean checkout');
  }
}

/**
 * Create the complete checksum manifest for an assembled release directory.
 */
export async function createReleaseManifest(
  releaseDirectory,
  { expectedNodeMajor = 22 } = {},
) {
  const rootDirectory = resolve(releaseDirectory);
  const frontend = await readJson(
    resolve(rootDirectory, 'frontend/version.json'),
    'frontend build metadata',
  );
  const server = await readJson(
    resolve(rootDirectory, 'server/dist/version.json'),
    'server build metadata',
  );
  assertCommonMetadata(frontend, server);

  if (!Number.isInteger(expectedNodeMajor) || expectedNodeMajor < 1) {
    throw new Error('Expected Node major version must be a positive integer');
  }

  return {
    schemaVersion: RELEASE_SCHEMA_VERSION,
    gitSha: frontend.gitSha,
    buildTime: frontend.buildTime,
    buildId: frontend.buildId,
    dirty: frontend.dirty,
    node: { major: expectedNodeMajor },
    components: {
      frontend: { directory: 'frontend', version: 'frontend/version.json' },
      server: { directory: 'server', version: 'server/dist/version.json' },
    },
    files: await listReleaseFiles(rootDirectory),
  };
}

/** Write a release manifest with stable formatting. */
export async function writeReleaseManifest(releaseDirectory, options = {}) {
  const manifest = await createReleaseManifest(releaseDirectory, options);
  await writeFile(
    resolve(releaseDirectory, 'release.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  return manifest;
}

function assertManifestShape(manifest, expectedSha, expectedNodeMajor) {
  if (manifest?.schemaVersion !== RELEASE_SCHEMA_VERSION) {
    throw new Error(`Unsupported release manifest schema: ${manifest?.schemaVersion}`);
  }
  if (!FULL_GIT_SHA.test(manifest.gitSha)) {
    throw new Error('Release manifest Git SHA is invalid');
  }
  if (expectedSha && manifest.gitSha !== expectedSha) {
    throw new Error(`Release SHA ${manifest.gitSha} does not match ${expectedSha}`);
  }
  if (manifest.dirty !== false) {
    throw new Error('Release manifest must describe a clean build');
  }
  if (expectedNodeMajor !== undefined && manifest.node?.major !== expectedNodeMajor) {
    throw new Error(
      `Release requires Node ${manifest.node?.major}, expected Node ${expectedNodeMajor}`,
    );
  }
  if (!Array.isArray(manifest.files)) {
    throw new Error('Release manifest files must be an array');
  }
  if (
    manifest.components?.frontend?.directory !== 'frontend'
    || manifest.components?.frontend?.version !== 'frontend/version.json'
    || manifest.components?.server?.directory !== 'server'
    || manifest.components?.server?.version !== 'server/dist/version.json'
  ) {
    throw new Error('Release manifest component paths are invalid');
  }
}

/**
 * Verify component identity, file inventory, checksums, ownership, and modes.
 */
export async function verifyRelease(
  releaseDirectory,
  { expectedSha, expectedNodeMajor, expectedUid } = {},
) {
  const rootDirectory = resolve(releaseDirectory);
  const manifest = await readJson(resolve(rootDirectory, 'release.json'), 'release manifest');
  assertManifestShape(manifest, expectedSha, expectedNodeMajor);

  const frontend = await readJson(
    resolve(rootDirectory, manifest.components?.frontend?.version ?? ''),
    'frontend build metadata',
  );
  const server = await readJson(
    resolve(rootDirectory, manifest.components?.server?.version ?? ''),
    'server build metadata',
  );
  assertCommonMetadata(frontend, server);

  for (const field of ['gitSha', 'buildTime', 'buildId', 'dirty']) {
    if (manifest[field] !== frontend[field]) {
      throw new Error(`Release manifest and component metadata disagree on ${field}`);
    }
  }

  const actualFiles = await listReleaseFiles(rootDirectory, { expectedUid });
  const expectedFiles = [...manifest.files].sort((left, right) => (
    left.path.localeCompare(right.path)
  ));

  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    throw new Error('Release file inventory or checksums do not match release.json');
  }

  return manifest;
}

export const releaseManifestSchemaVersion = RELEASE_SCHEMA_VERSION;
