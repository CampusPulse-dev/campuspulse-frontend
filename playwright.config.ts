import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3104';
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: process.env.LIVE_E2E !== 'true',
  workers: process.env.LIVE_E2E === 'true' ? 1 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.LIVE_E2E === 'true' ? 0 : process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.LIVE_E2E === 'true'
          ? {
              launchOptions: {
                args: [
                  '--use-fake-device-for-media-stream',
                  '--use-fake-ui-for-media-stream',
                  `--use-file-for-fake-video-capture=${resolve('test-results/live-camera.y4m')}`,
                ],
              },
            }
          : {}),
      },
    },
    // The PRD's core flows must work in a plain mobile browser tab.
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: `npm run start -- --port ${new URL(baseURL).port || '3104'}`,
    url: baseURL,
    reuseExistingServer: process.env.E2E_REUSE_SERVER === 'true',
    timeout: 120_000,
  },
});
