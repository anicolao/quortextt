import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
// @ts-expect-error Operational smoke helpers intentionally remain JavaScript modules.
import { checkHttpIdentity, checkSocketIdentity } from '../scripts/smoke-production.mjs';

const SHA = '0123456789abcdef0123456789abcdef01234567';

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
  });
}

describe('production deployment smoke checks', () => {
  it('requires matching public HTTP identities', async () => {
    const fetchImpl = async (input: URL) => {
      if (input.pathname === '/version.json') {
        return jsonResponse({ component: 'frontend', gitSha: SHA });
      }
      if (input.pathname === '/version') {
        return jsonResponse({ component: 'server', gitSha: SHA });
      }
      return jsonResponse({
        status: 'ok',
        version: { component: 'server', gitSha: SHA },
      });
    };

    await expect(checkHttpIdentity('https://quortex.example', `1${SHA.slice(1)}`, {
      fetchImpl,
    })).rejects.toThrow(/version.json reported/);
    await expect(checkHttpIdentity('https://quortex.example', SHA, { fetchImpl })).resolves.toEqual(
      expect.objectContaining({ health: expect.objectContaining({ status: 'ok' }) }),
    );
  });

  it('requires the initial Socket.IO identity to match', async () => {
    class FakeSocket extends EventEmitter {
      disconnect() {}

      connect() {
        queueMicrotask(() => this.emit('server_version', {
          component: 'server',
          gitSha: SHA,
        }));
      }
    }

    await expect(checkSocketIdentity('https://quortex.example', SHA, {
      socketFactory: () => new FakeSocket(),
      timeoutMs: 100,
    })).resolves.toMatchObject({ component: 'server', gitSha: SHA });
  });
});
