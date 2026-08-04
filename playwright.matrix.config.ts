import { defineConfig, devices } from '@playwright/test';

const frontendUrl = process.env.QUORTEX_E2E_FRONTEND_URL || 'http://127.0.0.1:5173';
const frontendPort = new URL(frontendUrl).port;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/cross-browser-smoke.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: frontendUrl,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'firefox-desktop',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'chromium-mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port ${frontendPort} --strictPort`,
    url: `${frontendUrl}/quortextt/`,
    reuseExistingServer: false,
    timeout: 120 * 1000,
  },
});
