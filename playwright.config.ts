import { defineConfig, devices } from '@playwright/test';

const frontendUrl = process.env.QUORTEX_E2E_FRONTEND_URL || 'http://127.0.0.1:5173';
const frontendPort = new URL(frontendUrl).port;
const fullStackTests = [
  '**/backend-lifecycle.spec.ts',
  '**/multiplayer-anonymous.spec.ts',
  '**/multiplayer-two-player-flow.spec.ts',
];
const chromium = {
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
};

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0, // No retries - tests should pass consistently
  // The isolated backend fixture reuses one dynamic port across fresh processes.
  workers: 1,
  reporter: [['html', { open: 'never' }]],
  snapshotPathTemplate: '{testDir}/snapshots/{projectName}/{testFileName}/{arg}-{platform}{ext}',
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixels: 0,
      threshold: 0,
    },
  },
  use: {
    baseURL: frontendUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'local-tabletop',
      testIgnore: fullStackTests,
      use: chromium,
    },
    {
      name: 'full-stack-multiplayer',
      testMatch: fullStackTests,
      use: chromium,
    },
  ],
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port ${frontendPort} --strictPort`,
    url: `${frontendUrl}/quortextt/`,
    reuseExistingServer: false,
    timeout: 120 * 1000,
  },
});
