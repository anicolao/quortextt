import { describe, expect, it } from 'vitest';
import { parseBuildMetadata } from '../buildMetadata.js';

const validMetadata = {
  component: 'server',
  gitSha: '0123456789abcdef0123456789abcdef01234567',
  buildTime: '2026-08-03T15:04:05.000Z',
  buildId: '123.1',
  dirty: false,
};

describe('server build metadata', () => {
  it('accepts complete server metadata', () => {
    expect(parseBuildMetadata(validMetadata)).toEqual(validMetadata);
  });

  it.each([
    ['non-object metadata', null],
    ['wrong component', { ...validMetadata, component: 'frontend' }],
    ['short Git SHA', { ...validMetadata, gitSha: 'abc123' }],
    ['invalid build time', { ...validMetadata, buildTime: 'today' }],
    ['invalid build ID', { ...validMetadata, buildId: 123 }],
    ['invalid dirty flag', { ...validMetadata, dirty: 'false' }],
  ])('rejects %s', (_description, metadata) => {
    expect(() => parseBuildMetadata(metadata)).toThrow(/build metadata/i);
  });
});
