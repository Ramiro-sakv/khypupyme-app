import { defineConfig, devices } from '@playwright/test';

const billingEdge = process.env.VITE_BILLING_SIMULATION === 'true' && process.env.KHYPU_BILLING_BROWSER === 'msedge'
  ? { channel: 'msedge' as const } : {};

export default defineConfig({
  timeout: 60000,
  expect: { timeout: 10000 },
  testDir: './tests/e2e', fullyParallel: false, workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'off', screenshot: 'off', video: 'off' },
  projects: [
    { name: 'desktop-chromium', use: {
      ...devices['Desktop Chrome'],
      ...billingEdge,
    } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'], ...billingEdge } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'] } },
  ],
  webServer: { command: 'pnpm build && pnpm preview', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
});
