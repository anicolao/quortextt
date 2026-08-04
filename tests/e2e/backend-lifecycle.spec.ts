import { expect, test } from './isolatedBackend';

test('production frontend and compiled backend report the tested build', async ({ request }, testInfo) => {
  const backendUrl = process.env.QUORTEX_E2E_BACKEND_URL;
  const frontendUrl = process.env.QUORTEX_E2E_FRONTEND_URL;
  const expectedGitSha = process.env.QUORTEX_E2E_GIT_SHA;
  expect(backendUrl, 'E2E tests must be started with npm run test:e2e').toBeTruthy();
  expect(frontendUrl, 'E2E tests must be started with npm run test:e2e').toBeTruthy();
  expect(expectedGitSha, 'E2E launcher must publish the tested Git SHA').toMatch(/^[0-9a-f]{40}$/);

  const [frontendResponse, versionResponse, healthResponse] = await Promise.all([
    request.get(`${frontendUrl}/quortextt/version.json`),
    request.get(`${backendUrl}/version`),
    request.get(`${backendUrl}/health`),
  ]);
  expect(frontendResponse.ok()).toBe(true);
  expect(versionResponse.ok()).toBe(true);
  expect(healthResponse.ok()).toBe(true);

  const frontend = await frontendResponse.json();
  const server = await versionResponse.json();
  const health = await healthResponse.json();

  await testInfo.attach('build-identities.json', {
    body: Buffer.from(JSON.stringify({ frontend, server, health }, null, 2)),
    contentType: 'application/json',
  });

  expect(frontend).toMatchObject({
    component: 'frontend',
    gitSha: expectedGitSha,
  });
  expect(server).toMatchObject({
    component: 'server',
    gitSha: expectedGitSha,
  });
  expect({ ...server, component: 'frontend' }).toEqual(frontend);
  expect(health).toMatchObject({
    status: 'ok',
    games: 0,
    players: 0,
    storage: 'file-based',
    version: server,
  });
});
