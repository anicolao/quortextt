import { execFile } from 'node:child_process';
import { lstat, readlink, rename, symlink, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { verifyRelease } from './release-manifest.mjs';

const execFileAsync = promisify(execFile);
const FULL_GIT_SHA = /^[0-9a-f]{40}$/;

function validateReleaseRoot(releaseRoot) {
  const root = resolve(releaseRoot);
  if (root === '/') throw new Error('Release root must not be the filesystem root');
  return root;
}

async function readManagedLink(releaseRoot, name) {
  const linkPath = resolve(releaseRoot, name);
  try {
    const stats = await lstat(linkPath);
    if (!stats.isSymbolicLink()) {
      throw new Error(`${linkPath} must be a symbolic link`);
    }
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }

  const target = await readlink(linkPath);
  const match = /^releases\/([0-9a-f]{40})$/.exec(target);
  if (!match) throw new Error(`${linkPath} has an unmanaged target: ${target}`);
  return match[1];
}

async function replaceManagedLink(releaseRoot, name, sha) {
  const linkPath = resolve(releaseRoot, name);
  const temporaryLink = resolve(
    releaseRoot,
    `.${name}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}`,
  );
  await symlink(`releases/${sha}`, temporaryLink);
  try {
    await rename(temporaryLink, linkPath);
  } catch (error) {
    await unlink(temporaryLink).catch(() => {});
    throw error;
  }
}

async function removeManagedLink(releaseRoot, name) {
  const linkPath = resolve(releaseRoot, name);
  try {
    const stats = await lstat(linkPath);
    if (!stats.isSymbolicLink()) {
      throw new Error(`${linkPath} must be a symbolic link`);
    }
    await unlink(linkPath);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

async function restoreLinks(releaseRoot, links) {
  for (const name of ['previous', 'current']) {
    if (links[name]) {
      await replaceManagedLink(releaseRoot, name, links[name]);
    } else {
      await removeManagedLink(releaseRoot, name);
    }
  }
}

async function verifyManagedRelease(releaseRoot, sha, options) {
  if (!FULL_GIT_SHA.test(sha)) throw new Error(`Invalid release SHA: ${sha}`);
  return verifyRelease(resolve(releaseRoot, 'releases', sha), {
    expectedSha: sha,
    expectedNodeMajor: options.expectedNodeMajor,
    expectedUid: options.expectedUid,
  });
}

async function applyLinkTransaction(releaseRoot, nextLinks, previousLinks, restartService) {
  try {
    await restoreLinks(releaseRoot, nextLinks);
    await restartService();
  } catch (activationError) {
    await restoreLinks(releaseRoot, previousLinks);
    try {
      if (previousLinks.current) await restartService();
    } catch (recoveryError) {
      throw new AggregateError(
        [activationError, recoveryError],
        'Release activation and recovery restart both failed',
      );
    }
    throw activationError;
  }
}

/** Atomically activate one verified, pre-staged immutable release. */
export async function activateRelease(
  releaseRoot,
  sha,
  { restartService, expectedNodeMajor = 22, expectedUid } = {},
) {
  if (typeof restartService !== 'function') {
    throw new Error('activateRelease requires a restartService function');
  }
  const root = validateReleaseRoot(releaseRoot);
  await verifyManagedRelease(root, sha, { expectedNodeMajor, expectedUid });

  const links = {
    current: await readManagedLink(root, 'current'),
    previous: await readManagedLink(root, 'previous'),
  };
  if (links.current === sha) return { changed: false, current: sha, previous: links.previous };
  if (links.current) {
    await verifyManagedRelease(root, links.current, { expectedNodeMajor, expectedUid });
  }

  const nextLinks = { current: sha, previous: links.current };
  await applyLinkTransaction(root, nextLinks, links, restartService);
  return { changed: true, ...nextLinks };
}

/** Atomically swap current and previous after verifying both releases. */
export async function rollbackRelease(
  releaseRoot,
  { restartService, expectedNodeMajor = 22, expectedUid } = {},
) {
  if (typeof restartService !== 'function') {
    throw new Error('rollbackRelease requires a restartService function');
  }
  const root = validateReleaseRoot(releaseRoot);
  const links = {
    current: await readManagedLink(root, 'current'),
    previous: await readManagedLink(root, 'previous'),
  };
  if (!links.current || !links.previous) {
    throw new Error('Rollback requires both current and previous releases');
  }
  await Promise.all([
    verifyManagedRelease(root, links.current, { expectedNodeMajor, expectedUid }),
    verifyManagedRelease(root, links.previous, { expectedNodeMajor, expectedUid }),
  ]);

  const nextLinks = { current: links.previous, previous: links.current };
  await applyLinkTransaction(root, nextLinks, links, restartService);
  return { changed: true, ...nextLinks };
}

function parseArguments(argv) {
  const options = {};
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument.startsWith('--')) {
      const value = argv[index + 1];
      if (!value) throw new Error(`${argument} requires a value`);
      options[argument.slice(2)] = value;
      index += 1;
    } else {
      positional.push(argument);
    }
  }
  return { options, positional };
}

async function main() {
  const { options, positional } = parseArguments(process.argv.slice(2));
  const [action, sha] = positional;
  if (!options['release-root'] || !options.service || !options.systemctl) {
    throw new Error('--release-root, --service, and --systemctl are required');
  }
  const expectedUid = options['expected-uid'] === undefined
    ? undefined
    : Number(options['expected-uid']);
  const expectedNodeMajor = Number(options['node-major'] ?? '22');
  const restartService = async () => {
    await execFileAsync(options.systemctl, ['restart', options.service]);
  };
  const commonOptions = { restartService, expectedNodeMajor, expectedUid };

  let result;
  if (action === 'activate' && sha) {
    result = await activateRelease(options['release-root'], sha, commonOptions);
  } else if (action === 'rollback' && !sha) {
    result = await rollbackRelease(options['release-root'], commonOptions);
  } else {
    throw new Error('Usage: quortex-release activate <full-sha> | rollback');
  }
  console.log(JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
