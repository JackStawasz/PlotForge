// playwright.config.js
// Place this in the project root or tests/ directory.
// Run: npx playwright test

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.js',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: process.env.PLOTFORGE_URL || 'http://localhost:8080',
    headless: true,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 10_000,
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});