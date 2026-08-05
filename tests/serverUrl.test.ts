import { describe, expect, it } from 'vitest';
import { resolveServerUrl } from '../src/multiplayer/serverUrl';

describe('multiplayer server URL', () => {
  it('uses explicit test and deployment configuration when present', () => {
    expect(resolveServerUrl('http://127.0.0.1:4567/', {
      origin: 'https://quortex.morpheum.dev',
    })).toBe('http://127.0.0.1:4567');
  });

  it('uses the reverse-proxied origin in production', () => {
    expect(resolveServerUrl(undefined, {
      origin: 'https://quortex.morpheum.dev',
    })).toBe('https://quortex.morpheum.dev');
  });

  it('uses the Vite origin during local development', () => {
    expect(resolveServerUrl(undefined, {
      origin: 'http://localhost:5173',
    })).toBe('http://localhost:5173');
  });
});
