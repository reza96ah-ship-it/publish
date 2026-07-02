import { defineConfig, devices } from '@playwright/test'

/**
 * Issue #153 Tier 6: Browser/accessibility matrix.
 *
 * Tests run on Chromium, Firefox, and WebKit desktop + mobile viewports.
 * RTL/Persian locale is set globally.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
  },
  // Issue #153: browser matrix — Chromium, Firefox, WebKit desktop + mobile
  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: ['**/accessibility.spec.ts'], // axe works best on chromium
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testIgnore: ['**/accessibility.spec.ts'],
    },
    // Mobile viewports (Issue #153: at least one mobile per engine)
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
      testIgnore: ['**/accessibility.spec.ts'],
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
      testIgnore: ['**/accessibility.spec.ts'],
    },
  ],
  webServer: {
    // CI uses the pre-built standalone server (seconds to start).
    // Local dev uses the hot-reload dev server.
    command: process.env.CI ? 'bun run start' : 'bun run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: process.env.CI ? 60_000 : 60_000,
  },
})
