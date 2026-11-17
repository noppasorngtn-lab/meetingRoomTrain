import { defineConfig, devices } from '@playwright/test';

/** E2E against the local `mrr` stack: docker/docker-compose.yml. */
const NFR = 'e2e/nfr-005-browsers.spec.ts';

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
  projects: [
    // Every spec runs here (the booking cases, UI-mrr-006, are Chromium only — they write to the dev database).
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // NFR-mrr-005: the browser/mobile smoke spec only, one project per engine or device.
    { name: 'firefox', testMatch: NFR, use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit-safari', testMatch: NFR, use: { ...devices['Desktop Safari'] } },
    { name: 'edge', testMatch: NFR, use: { ...devices['Desktop Edge'], channel: 'msedge' } },
    { name: 'mobile-chrome', testMatch: NFR, use: { ...devices['Pixel 7'] } },
    { name: 'mobile-safari', testMatch: NFR, use: { ...devices['iPhone 14'] } },
  ],
});
