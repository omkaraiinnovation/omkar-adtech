import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E test configuration for Omkar AdTech Dashboard
 * Tests run against Next.js dev server on port 3000
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 4,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    // Use 127.0.0.1 instead of localhost to avoid DNS resolution issues on Windows
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Dark theme — ensure viewport matches dashboard breakpoints
    viewport: { width: 1280, height: 800 },
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Disable Chrome sandbox for Windows dev environments where loopback
        // access from the sandboxed process may be blocked by the OS firewall.
        launchOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
      },
    },
  ],

  // webServer config: skipped if SKIP_WEB_SERVER=1 (when dev server already runs).
  // In CI: always start a fresh server. Locally: set SKIP_WEB_SERVER=1 to skip.
  ...(process.env.SKIP_WEB_SERVER !== '1' && {
    webServer: {
      command: 'pnpm dev',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  }),
});
