import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const playwrightCli = resolve(
  repositoryRoot,
  'node_modules',
  '@playwright',
  'test',
  'cli.js',
);
const backendEntryPoint = resolve(repositoryRoot, 'server', 'dist', 'index.js');
const backendLogPath = resolve(repositoryRoot, 'test-results', 'e2e-backend.log');

function waitForExit(child) {
  if (child.exitCode !== null) {
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode });
  }

  return new Promise((resolveExit, rejectExit) => {
    child.once('error', rejectExit);
    child.once('exit', (code, signal) => resolveExit({ code, signal }));
  });
}

async function runCommand(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: repositoryRoot,
    stdio: 'inherit',
    ...options,
  });
  const result = await waitForExit(child);
  if (result.code !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with code ${result.code}`);
  }
}

async function allocatePorts(count) {
  const reservations = [];

  try {
    for (let index = 0; index < count; index += 1) {
      const reservation = createServer();
      await new Promise((resolveListen, rejectListen) => {
        reservation.once('error', rejectListen);
        reservation.listen(0, '127.0.0.1', resolveListen);
      });
      reservations.push(reservation);
    }

    return reservations.map((reservation) => {
      const address = reservation.address();
      if (typeof address === 'string' || address === null) {
        throw new Error('Unable to determine an E2E port');
      }
      return address.port;
    });
  } finally {
    await Promise.all(reservations.map((reservation) => new Promise((resolveClose) => {
      reservation.close(resolveClose);
    })));
  }
}

async function waitForBackend(backendUrl, backendProcess) {
  const deadline = Date.now() + 30_000;
  let lastError;

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

async function stopProcess(child) {
  if (!child || child.exitCode !== null) return;

  child.kill('SIGTERM');
  const gracefulExit = waitForExit(child).then(() => true);
  let timeout;
  const timedOut = new Promise((resolveTimeout) => {
    timeout = setTimeout(() => resolveTimeout(false), 5_000);
  });

  const stoppedGracefully = await Promise.race([gracefulExit, timedOut]);
  clearTimeout(timeout);

  if (!stoppedGracefully && child.exitCode === null) {
    child.kill('SIGKILL');
    await waitForExit(child);
  }
}

await runCommand(npmCommand, ['run', 'build:server']);

const [frontendPort, backendPort] = await allocatePorts(2);
const frontendUrl = `http://127.0.0.1:${frontendPort}`;
const backendUrl = `http://127.0.0.1:${backendPort}`;
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'quortex-e2e-'));
const backendLog = [];
let backendProcess;
let playwrightProcess;

function captureBackendOutput(label, chunk) {
  backendLog.push(`[${label}] ${chunk.toString()}`);
}

function forwardSignal(signal) {
  playwrightProcess?.kill(signal);
  backendProcess?.kill(signal);
}

process.once('SIGINT', () => forwardSignal('SIGINT'));
process.once('SIGTERM', () => forwardSignal('SIGTERM'));

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
      PORT: String(backendPort),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  backendProcess.stdout.on('data', (chunk) => captureBackendOutput('stdout', chunk));
  backendProcess.stderr.on('data', (chunk) => captureBackendOutput('stderr', chunk));
  const backendExit = waitForExit(backendProcess);

  await Promise.race([
    waitForBackend(backendUrl, backendProcess),
    backendExit.then((result) => {
      throw new Error(`E2E backend exited during startup with code ${result.code}`);
    }),
  ]);
  console.log(`E2E backend ready at ${backendUrl}`);

  playwrightProcess = spawn(
    process.execPath,
    [playwrightCli, 'test', ...process.argv.slice(2)],
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        QUORTEX_E2E_BACKEND_URL: backendUrl,
        QUORTEX_E2E_FRONTEND_URL: frontendUrl,
        VITE_SERVER_URL: backendUrl,
      },
      stdio: 'inherit',
    },
  );

  const firstExit = await Promise.race([
    waitForExit(playwrightProcess).then((result) => ({ source: 'playwright', result })),
    backendExit.then((result) => ({ source: 'backend', result })),
  ]);

  if (firstExit.source === 'backend') {
    await stopProcess(playwrightProcess);
    throw new Error(
      `E2E backend exited before Playwright with code ${firstExit.result.code}`,
    );
  }
  if (firstExit.result.code !== 0) {
    process.exitCode = firstExit.result.code ?? 1;
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await stopProcess(playwrightProcess);
  await stopProcess(backendProcess);
  await mkdir(resolve(repositoryRoot, 'test-results'), { recursive: true });
  await writeFile(backendLogPath, backendLog.join(''), 'utf8');
  await rm(temporaryDirectory, { recursive: true, force: true });
  console.log(`E2E backend log written to ${backendLogPath}`);
}
