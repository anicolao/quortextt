import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const playwrightCli = resolve(
  repositoryRoot,
  'node_modules',
  '@playwright',
  'test',
  'cli.js',
);
const backendLogPath = resolve(repositoryRoot, 'test-results', 'e2e-backend.log');

function waitForExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
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

async function stopProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  child.kill('SIGTERM');
  const gracefulExit = waitForExit(child).then(() => true);
  let timeout;
  const timedOut = new Promise((resolveTimeout) => {
    timeout = setTimeout(() => resolveTimeout(false), 5_000);
  });

  const stoppedGracefully = await Promise.race([gracefulExit, timedOut]);
  clearTimeout(timeout);

  if (!stoppedGracefully && child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await waitForExit(child);
  }
}

const [frontendPort, backendPort] = await allocatePorts(2);
const frontendUrl = `http://127.0.0.1:${frontendPort}`;
const backendUrl = `http://127.0.0.1:${backendPort}`;
const buildEnvironment = {
  ...process.env,
  VITE_SERVER_URL: backendUrl,
};
let playwrightProcess;

function forwardSignal(signal) {
  playwrightProcess?.kill(signal);
}

process.once('SIGINT', () => forwardSignal('SIGINT'));
process.once('SIGTERM', () => forwardSignal('SIGTERM'));

try {
  await mkdir(resolve(repositoryRoot, 'test-results'), { recursive: true });
  await writeFile(backendLogPath, '', 'utf8');

  await runCommand(npmCommand, ['run', 'build:all'], {
    env: buildEnvironment,
  });
  await runCommand(npmCommand, ['run', 'verify:build-metadata'], {
    env: buildEnvironment,
  });

  const frontendMetadata = JSON.parse(await readFile(
    resolve(repositoryRoot, 'dist', 'version.json'),
    'utf8',
  ));

  playwrightProcess = spawn(
    process.execPath,
    [playwrightCli, 'test', ...process.argv.slice(2)],
    {
      cwd: repositoryRoot,
      env: {
        ...buildEnvironment,
        QUORTEX_E2E_BACKEND_URL: backendUrl,
        QUORTEX_E2E_FRONTEND_URL: frontendUrl,
        QUORTEX_E2E_GIT_SHA: frontendMetadata.gitSha,
      },
      stdio: 'inherit',
    },
  );

  const result = await waitForExit(playwrightProcess);
  if (result.code !== 0) {
    process.exitCode = result.code ?? 1;
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await stopProcess(playwrightProcess);
  console.log(`E2E backend log written to ${backendLogPath}`);
}
