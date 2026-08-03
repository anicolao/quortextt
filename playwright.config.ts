import { defineConfig, devices } from '@playwright/test';

const frontendUrl = process.env.QUORTEX_E2E_FRONTEND_URL || 'http://127.0.0.1:5173';
const frontendPort = new URL(frontendUrl).port;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0, // No retries - tests should pass consistently
  // The isolated backend fixture reuses one dynamic port across fresh processes.
  workers: 1,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: frontendUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        deviceScaleFactor: 1,
        launchOptions: {
          args: [
            '--font-render-hinting=none',
            '--disable-font-subpixel-positioning',
            '--disable-lcd-text',
            '--disable-skia-runtime-opts',
            '--disable-system-font-check',
            '--disable-features=FontAccess',
            '--force-device-scale-factor=1',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--use-gl=swiftshader',
            '--disable-smooth-scrolling',
            '--disable-partial-raster',
          ],
        },
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${frontendPort} --strictPort`,
    url: frontendUrl,
    reuseExistingServer: false,
    timeout: 120 * 1000,
  },
});
