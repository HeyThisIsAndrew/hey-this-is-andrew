import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT || 3000);

export default defineConfig({
  testDir: './e2e',
  timeout: 45 * 1000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${port}/hey-this-is-andrew/`,
    trace: 'on-first-retry',
  },
  webServer: {
    // --ignore-lock keeps `astro preview` in the foreground. Without it,
    // Astro 7 can hand the server to a background process and exit, which
    // Playwright reports as "Process from config.webServer exited early".
    command: `pnpm --filter hey-this-is-andrew exec astro preview --host 0.0.0.0 --port ${port} --ignore-lock`,
    env: { ASTRO_BASE: '/hey-this-is-andrew/' },
    url: `http://localhost:${port}/hey-this-is-andrew/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'chromium-mobile', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } },
  ],
});
