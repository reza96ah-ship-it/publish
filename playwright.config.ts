import { defineConfig, devices } from '@playwright/test'
import path from 'path'

const AUTH_FILE = path.join(import.meta.dirname, 'tests/e2e/.auth/user.json')

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
    // ── Auth setup (runs once before visual project) ──────────────────────
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    // ── Visual regression (Issue #235) ────────────────────────────────────
    // Chromium only: baselines are platform-specific (linux runner in CI).
    // Update with: bun run test:visual:update
    {
      name: 'visual',
      testMatch: /visual\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_FILE,
      },
      dependencies: ['setup'],
    },

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
    // CI: run the pre-built standalone server directly (not via bun run start, which
    // hardcodes NODE_ENV=production and triggers bootstrapServiceConfig to reject test
    // secrets). NODE_ENV=test skips the production validation so the server starts.
    // Local dev: use the hot-reload dev server as normal.
    command: process.env.CI
      ? 'NODE_ENV=test node .next/standalone/server.js'
      : 'bun run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
