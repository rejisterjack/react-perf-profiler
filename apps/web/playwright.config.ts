import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for apps/web.
 *
 * Assumes the dev server (or `next start` against a build) is reachable at
 * the configured baseURL. CI runs `next build && next start` on a random
 * port and sets PLAYWRIGHT_BASE_URL accordingly.
 *
 * Locally: `bun run test:e2e` boots the dev server, runs the suite, and
 * tears it down.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:7394',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'bun run dev',
        url: 'http://localhost:7394',
        timeout: 60_000,
        reuseExistingServer: !process.env.CI,
      },
});
