import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { appendFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test as base } from '@playwright/test';

const repositoryRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const backendEntryPoint = resolve(repositoryRoot, 'server', 'dist', 'index.js');
const backendLogPath = resolve(repositoryRoot, 'test-results', 'e2e-backend.log');

function waitForExit(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode });
  }

  return new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolveExit, rejectExit) => {
      child.once('error', rejectExit);
      child.once('exit', (code, signal) => resolveExit({ code, signal }));
    },
  );
}

async function waitForBackend(backendUrl: string, backendProcess: ChildProcess) {
  const deadline = Date.now() + 30_000;
  let lastError: unknown;

  while (Date.now() < deadline) {
    if (backendProcess.exitCode !== null) {
      throw new Error(`E2E backend exited during startup with code ${backendProcess.exitCode}`);
    }

    try {
      const response = await fetch(`${backendUrl}/health`);
      if (response.ok) return;
      lastError = new Error(`Health check returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }

  throw new Error(`E2E backend did not become healthy: ${String(lastError)}`);
}

async function stopProcess(child: ChildProcess | undefined) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  child.kill('SIGTERM');
  const gracefulExit = waitForExit(child).then(() => true);
  let timeout: NodeJS.Timeout | undefined;
  const timedOut = new Promise<boolean>((resolveTimeout) => {
    timeout = setTimeout(() => resolveTimeout(false), 5_000);
  });

  const stoppedGracefully = await Promise.race([gracefulExit, timedOut]);
  clearTimeout(timeout);

  if (!stoppedGracefully && child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await waitForExit(child);
  }
}

export const test = base.extend<{ isolatedBackend: void }>({
  isolatedBackend: [async ({}, use, testInfo) => {
    const backendUrl = process.env.QUORTEX_E2E_BACKEND_URL;
    const frontendUrl = process.env.QUORTEX_E2E_FRONTEND_URL;
    expect(backendUrl, 'E2E tests must be started with npm run test:e2e').toBeTruthy();
    expect(frontendUrl, 'E2E tests must be started with npm run test:e2e').toBeTruthy();

    const parsedBackendUrl = new URL(backendUrl!);
    const temporaryDirectory = await mkdtemp(join(tmpdir(), 'quortex-e2e-'));
    const backendLog: string[] = [
      `\n===== ${testInfo.titlePath.join(' > ')} =====\n`,
    ];
    let backendProcess: ChildProcess | undefined;

    try {
      backendProcess = spawn(process.execPath, [backendEntryPoint, '--seed', '888'], {
        cwd: temporaryDirectory,
        env: {
          ...process.env,
          BASE_URL: backendUrl,
          CLIENT_URL: frontendUrl,
          DATA_DIR: join(temporaryDirectory, 'data'),
          JWT_SECRET: randomBytes(48).toString('hex'),
          NODE_ENV: 'test',
          PORT: parsedBackendUrl.port,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      backendProcess.stdout?.on('data', (chunk) => {
        backendLog.push(`[stdout] ${chunk.toString()}`);
      });
      backendProcess.stderr?.on('data', (chunk) => {
        backendLog.push(`[stderr] ${chunk.toString()}`);
      });

      const backendExit = waitForExit(backendProcess);
      await Promise.race([
        waitForBackend(backendUrl!, backendProcess),
        backendExit.then((result) => {
          throw new Error(`E2E backend exited during startup with code ${result.code}`);
        }),
      ]);

      await use();
    } finally {
      await stopProcess(backendProcess);
      await appendFile(backendLogPath, backendLog.join(''), 'utf8');
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }, { auto: true }],
});

export { expect };
