import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { io } from 'socket.io-client';

const FULL_GIT_SHA = /^[0-9a-f]{40}$/;

function assertMetadata(metadata, component, expectedSha, source) {
  if (metadata?.component !== component || metadata?.gitSha !== expectedSha) {
    throw new Error(
      `${source} reported ${metadata?.component ?? 'unknown'} ${metadata?.gitSha ?? 'unknown'}, `
      + `expected ${component} ${expectedSha}`,
    );
  }
}

async function fetchJson(fetchImpl, url) {
  const response = await fetchImpl(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
}

/** Check the public frontend, backend, and health identities once. */
export async function checkHttpIdentity(origin, expectedSha, { fetchImpl = fetch } = {}) {
  const [frontend, server, health] = await Promise.all([
    fetchJson(fetchImpl, new URL('/version.json', origin)),
    fetchJson(fetchImpl, new URL('/version', origin)),
    fetchJson(fetchImpl, new URL('/health', origin)),
  ]);
  assertMetadata(frontend, 'frontend', expectedSha, '/version.json');
  assertMetadata(server, 'server', expectedSha, '/version');
  if (health?.status !== 'ok') throw new Error('/health did not report status ok');
  assertMetadata(health.version, 'server', expectedSha, '/health');
  return { frontend, server, health };
}

/** Establish a real Socket.IO WebSocket and check its initial server identity. */
export async function checkSocketIdentity(
  origin,
  expectedSha,
  {
    timeoutMs = 10_000,
    socketFactory = (url) => io(url, {
      autoConnect: false,
      forceNew: true,
      reconnection: false,
      transports: ['websocket'],
    }),
  } = {},
) {
  const socket = socketFactory(origin);
  return new Promise((resolve, reject) => {
    const finish = (error, metadata) => {
      clearTimeout(timer);
      socket.removeAllListeners();
      socket.disconnect();
      if (error) reject(error);
      else resolve(metadata);
    };
    const timer = setTimeout(() => {
      finish(new Error(`Socket.IO did not report its version within ${timeoutMs}ms`));
    }, timeoutMs);

    socket.once('connect_error', (error) => finish(error));
    socket.once('server_version', (metadata) => {
      try {
        assertMetadata(metadata, 'server', expectedSha, 'Socket.IO server_version');
        finish(null, metadata);
      } catch (error) {
        finish(error);
      }
    });
    socket.connect();
  });
}

/** Poll the public deployment until HTTP and Socket.IO all report one release SHA. */
export async function smokeProduction(
  origin,
  expectedSha,
  {
    timeoutMs = 60_000,
    pollIntervalMs = 2_000,
    fetchImpl = fetch,
    socketFactory,
  } = {},
) {
  if (!FULL_GIT_SHA.test(expectedSha)) throw new Error(`Invalid release SHA: ${expectedSha}`);
  const normalizedOrigin = new URL(origin);
  if (normalizedOrigin.protocol !== 'https:' && normalizedOrigin.hostname !== 'localhost') {
    throw new Error('Production smoke checks require an HTTPS origin');
  }

  const deadline = Date.now() + timeoutMs;
  let lastError;
  do {
    try {
      await checkHttpIdentity(normalizedOrigin, expectedSha, { fetchImpl });
      await checkSocketIdentity(normalizedOrigin.toString(), expectedSha, {
        timeoutMs: Math.max(1, deadline - Date.now()),
        socketFactory,
      });
      return;
    } catch (error) {
      lastError = error;
      if (Date.now() >= deadline) break;
      await delay(Math.min(pollIntervalMs, Math.max(1, deadline - Date.now())));
    }
  } while (Date.now() < deadline);
  throw new Error(`Production smoke check failed: ${lastError?.message ?? String(lastError)}`, {
    cause: lastError,
  });
}

async function main() {
  const [origin, expectedSha] = process.argv.slice(2);
  if (!origin || !expectedSha) {
    throw new Error('Usage: node scripts/smoke-production.mjs <origin> <full-sha>');
  }
  await smokeProduction(origin, expectedSha, {
    timeoutMs: Number(process.env.QUORTEX_SMOKE_TIMEOUT_MS ?? '60000'),
  });
  console.log(`Public deployment reports ${expectedSha}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
