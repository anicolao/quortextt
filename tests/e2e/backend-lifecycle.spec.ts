import { expect, test } from '@playwright/test';

test('compiled E2E backend is healthy', async ({ request }) => {
  const backendUrl = process.env.QUORTEX_E2E_BACKEND_URL;
  expect(backendUrl, 'E2E tests must be started with npm run test:e2e').toBeTruthy();

  const healthResponse = await request.get(`${backendUrl}/health`);
  expect(healthResponse.ok()).toBe(true);

  const health = await healthResponse.json();
  expect(health).toMatchObject({
    status: 'ok',
    storage: 'file-based',
    version: { component: 'server' },
  });
});
