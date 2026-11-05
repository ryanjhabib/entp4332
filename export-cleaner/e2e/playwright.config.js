import { defineConfig } from '@playwright/test';
import { PORT } from './support/env.js';

export default defineConfig({
  testDir: './tests',
  // A test scans a small folder with the real AI on the processor, so it
  // takes tens of seconds, not milliseconds.
  timeout: 4 * 60_000,
  expect: { timeout: 20_000 },
  // Every test gets its own fresh browser profile, so tests can run side by
  // side: half as many at once as the computer has processor cores. More only
  // makes each scan slower.
  fullyParallel: true,
  workers: '50%',
  // No retries: a test that only passes on a second try is hiding a problem.
  retries: 0,
  reporter: [['list'], ['./support/reporter.js']],
  outputDir: './test-results',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // The full Chromium browser (not the stripped-down headless one), with no window.
    channel: 'chromium',
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node serve.mjs',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
