import { describe, expect, it } from 'vitest';
// This is a build-time Node module, intentionally shared by Vite and scripts.
// @ts-expect-error JavaScript build helper has no separate declaration file.
import { createBuildMetadata, metadataEnvironment } from '../scripts/build-metadata.mjs';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const BUILD_TIME = '2026-08-03T15:04:05.000Z';

describe('build metadata', () => {
  it('creates normalized metadata from explicit release values', () => {
    const metadata = createBuildMetadata({
      QUORTEX_GIT_SHA: SHA.toUpperCase(),
      QUORTEX_BUILD_TIME: BUILD_TIME,
      QUORTEX_BUILD_ID: '123.1',
      QUORTEX_BUILD_DIRTY: 'false',
    });

    expect(metadata).toEqual({
      gitSha: SHA,
      buildTime: BUILD_TIME,
      buildId: '123.1',
      dirty: false,
    });
    expect(metadataEnvironment(metadata)).toEqual({
      QUORTEX_GIT_SHA: SHA,
      QUORTEX_BUILD_TIME: BUILD_TIME,
      QUORTEX_BUILD_ID: '123.1',
      QUORTEX_BUILD_DIRTY: 'false',
    });
  });

  it('rejects a missing Git SHA outside a Git checkout', () => {
    expect(() => createBuildMetadata({}, { cwd: '/' })).toThrow(/Git SHA is missing/);
  });

  it('rejects malformed release values', () => {
    expect(() => createBuildMetadata({ QUORTEX_GIT_SHA: 'short' })).toThrow(
      /full 40-character/,
    );
    expect(() => createBuildMetadata({
      QUORTEX_GIT_SHA: SHA,
      QUORTEX_BUILD_TIME: 'not-a-date',
    })).toThrow(/ISO-8601/);
    expect(() => createBuildMetadata({
      QUORTEX_GIT_SHA: SHA,
      QUORTEX_BUILD_DIRTY: 'sometimes',
    })).toThrow(/must be "true" or "false"/);
  });

  it('rejects dirty CI builds', () => {
    expect(() => createBuildMetadata({
      CI: 'true',
      QUORTEX_RELEASE_BUILD: 'true',
      QUORTEX_GIT_SHA: SHA,
      QUORTEX_BUILD_DIRTY: 'true',
    })).toThrow(/clean Git checkout/);
  });
});
