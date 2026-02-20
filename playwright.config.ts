import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html']],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 15000,
    ignoreHTTPSErrors: true, // Allow self-signed certificates for local dev
  },
  expect: {
    timeout: 15000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Web server config - disabled, user should start server manually with 'npm run dev'
  // This avoids port conflicts and gives more control
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'https://localhost:5173',
  //   reuseExistingServer: true,
  //   timeout: 180000,
  // },
});