import { defineConfig } from '@playwright/test';

const fixturePort = Number(process.env.E2E_FIXTURE_PORT ?? 3210);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  outputDir: 'test-results',
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  workers: process.env.CI ? 1 : undefined,
  use: {
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node ./scripts/e2e-fixture-server.mjs',
    port: fixturePort,
    timeout: 30_000,
    reuseExistingServer: !process.env.CI,
    env: {
      E2E_FIXTURE_PORT: String(fixturePort),
    },
  },
});
