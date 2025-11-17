import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Run tests sequentially for accurate timing
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1, // Single worker for sequential execution and consistent timing
  reporter: [
    ['list'],
    ['./scripts/e2e-timing-reporter.ts'],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
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
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
