import { execFileSync } from 'node:child_process';

const FULL_GIT_SHA = /^[0-9a-f]{40}$/i;

function readGitSha(cwd) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
}

function readDirtyState(cwd) {
  try {
    return execFileSync('git', ['status', '--porcelain'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim().length > 0;
  } catch {
    return true;
  }
}

function parseBoolean(value, name) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be "true" or "false"`);
}

/**
 * Create the common metadata embedded in every component of a release.
 * Explicit environment variables take precedence so a release orchestrator
 * can generate the values once and pass them to each component build.
 */
export function createBuildMetadata(
  env = process.env,
  { cwd = process.cwd(), now = () => new Date() } = {},
) {
  const gitSha = env.QUORTEX_GIT_SHA ?? env.GITHUB_SHA ?? readGitSha(cwd);
  if (!gitSha) {
    throw new Error(
      'Build Git SHA is missing; set QUORTEX_GIT_SHA or build from a Git checkout',
    );
  }
  if (!FULL_GIT_SHA.test(gitSha)) {
    throw new Error('Build Git SHA must be a full 40-character hexadecimal SHA');
  }

  const buildTime = env.QUORTEX_BUILD_TIME ?? now().toISOString();
  if (Number.isNaN(Date.parse(buildTime))) {
    throw new Error('QUORTEX_BUILD_TIME must be an ISO-8601 timestamp');
  }

  const githubBuildId = env.GITHUB_RUN_ID
    ? `${env.GITHUB_RUN_ID}.${env.GITHUB_RUN_ATTEMPT ?? '1'}`
    : null;
  const buildId = env.QUORTEX_BUILD_ID ?? githubBuildId;
  const dirty = env.QUORTEX_BUILD_DIRTY === undefined
    ? readDirtyState(cwd)
    : parseBoolean(env.QUORTEX_BUILD_DIRTY, 'QUORTEX_BUILD_DIRTY');

  if (env.CI === 'true' && env.QUORTEX_RELEASE_BUILD === 'true' && dirty) {
    throw new Error('CI release builds must use a clean Git checkout');
  }

  return {
    gitSha: gitSha.toLowerCase(),
    buildTime: new Date(buildTime).toISOString(),
    buildId,
    dirty,
  };
}

export function metadataEnvironment(metadata) {
  const environment = {
    QUORTEX_GIT_SHA: metadata.gitSha,
    QUORTEX_BUILD_TIME: metadata.buildTime,
    QUORTEX_BUILD_DIRTY: String(metadata.dirty),
  };

  if (metadata.buildId !== null) {
    environment.QUORTEX_BUILD_ID = metadata.buildId;
  }

  return environment;
}
