import { defineConfig } from '@playwright/test';

/** E2E of the booking page (UI-mrr-006) against the local `mrr` stack: docker/docker-compose.yml. */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  outputDir: './test-results',
  // Specs share one dev database; the booking ones book real slots, so one at a time.
  workers: 1,
  fullyParallel: false,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }], ['json', { outputFile: 'results.json' }]],
  use: {
    baseURL: 'http://localhost:4173',
    locale: 'th-TH',
    // bangkokInstant() in the web app reads the form as Bangkok time.
    timezoneId: 'Asia/Bangkok',
    screenshot: 'on',
    trace: 'retain-on-failure',
  },
});
