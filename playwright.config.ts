import { defineConfig, devices } from '@playwright/test'
import path from 'path'

const AUTH_FILE = path.resolve(__dirname, 'tests/e2e/.auth/user.json')
const VISUAL_TEST = /visual\.spec\.ts/
const scriptName = process.env.npm_lifecycle_event ?? ''
const isVisualRun =
  scriptName.startsWith('test:visual') ||
  process.argv.some((arg) => arg === '--project=visual' || arg === 'visual')

const visualProjects = isVisualRun
  ? [
      {
        name: 'setup',
        testMatch: /auth\.setup\.ts/,
      },
      {
        name: 'visual',
        testMatch: VISUAL_TEST,
        use: {
          ...devices['Desktop Chrome'],
          storageState: AUTH_FILE,
        },
        dependencies: ['setup'],
      },
    ]
  : []

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
  // Issue #153: browser matrix - Chromium, Firefox, WebKit desktop + mobile.
  // Visual regression has its own GitHub Actions job and is included only
  // when the visual project is explicitly requested.
  projects: [
    ...visualProjects,
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: VISUAL_TEST,
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: [VISUAL_TEST, '**/accessibility.spec.ts'], // axe works best on chromium
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testIgnore: [VISUAL_TEST, '**/accessibility.spec.ts'],
    },
    // Mobile viewports (Issue #153: at least one mobile per engine)
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
      testIgnore: [VISUAL_TEST, '**/accessibility.spec.ts'],
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
      testIgnore: [VISUAL_TEST, '**/accessibility.spec.ts'],
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
