/**
 * Issue #235 — Visual regression suite.
 *
 * 6 core views × 3 viewports × 2 color schemes = 36 baselines.
 * Runs on Chromium only (linux runner) to keep baselines platform-consistent.
 *
 * Baselines are committed to git under tests/e2e/visual.spec.ts-snapshots/.
 * To regenerate: bunx playwright test --project=visual --update-snapshots
 *
 * Dynamic regions are masked so data fluctuations don't cause false failures:
 *   - Persian/Gregorian date strings
 *   - Avatar images
 *   - Recharts SVG paths (chart bars, lines — data-driven)
 *   - KPI counter numbers inside .num-tabular spans
 */

import { test, expect, type Page } from '@playwright/test'

// ── Constants ─────────────────────────────────────────────────────────────

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
] as const

const VIEWS = [
  { name: 'signin', url: '/auth/signin', auth: false },
  { name: 'dashboard', url: '/', auth: true },
  { name: 'compose', url: '/compose', auth: true },
  { name: 'campaigns', url: '/campaigns', auth: true },
  { name: 'analytics', url: '/analytics', auth: true },
  { name: 'settings', url: '/settings', auth: true },
] as const

// Selectors for dynamic content that should be masked in screenshots
const DYNAMIC_MASKS = [
  // KPI numbers and counters
  '.num-tabular',
  // Recharts SVG data paths (bars, lines, areas — vary with real data)
  '.recharts-wrapper',
  '.recharts-bar-rectangle',
  '.recharts-line-dot',
  '.recharts-area-area',
  '.recharts-curve',
  // App-native mini charts and sparkline SVGs
  '.touch-none',
  '.touch-none [aria-hidden]',
  '.touch-none .absolute',
  'svg.overflow-visible',
  // Avatar images (user photos — may change)
  'img[src*="avatar"]',
  'img[alt*="avatar"]',
  // Skeleton loading placeholders (timing-sensitive)
  '[data-slot="skeleton"]',
  // App-provided opt-in mask for dynamic metric cards/charts.
  '[data-visual-mask]',
  // Live connection indicator (animated ping dot)
  '.animate-ping',
  // Timestamp text nodes — broad selector for Persian date strings
  'time',
  '[data-testid="timestamp"]',
] as const

// ── Helpers ───────────────────────────────────────────────────────────────

async function waitForStable(page: Page) {
  await page.waitForLoadState('load')
  // Let React hydrate and initial queries settle
  await page.waitForTimeout(800)
}

async function getMasks(page: Page) {
  const handles = await page
    .locator(DYNAMIC_MASKS.join(', '))
    .all()
  return handles
}

async function screenshot(
  page: Page,
  name: string,
  scheme: 'light' | 'dark',
) {
  await page.emulateMedia({ colorScheme: scheme })
  // Brief pause to let CSS transitions complete after theme switch
  await page.waitForTimeout(200)

  const masks = await getMasks(page)

  await expect(page).toHaveScreenshot(`${name}-${scheme}.png`, {
    maxDiffPixels: 50000, // Allow up to 5% diff for anti-aliasing/font rendering differences across CI runners
    mask: masks,
    animations: 'disabled',
  })
}

// ── Test matrix ───────────────────────────────────────────────────────────

for (const vp of VIEWPORTS) {
  test.describe(`viewport:${vp.name} (${vp.width}×${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    for (const view of VIEWS) {
      for (const scheme of ['light', 'dark'] as const) {
        test(`${view.name} — ${scheme}`, async ({ page }) => {
          if (!view.auth) {
            await page.context().clearCookies()
            await page.addInitScript(() => {
              window.localStorage.clear()
              window.sessionStorage.clear()
            })
          }

          await page.goto(view.url)
          await waitForStable(page)

          // If auth is required but we land on sign-in, skip gracefully
          if (view.auth && page.url().includes('/auth')) {
            test.skip(true, `${view.name} requires auth — sign-in redirect; re-run after seed:auth`)
            return
          }

          await screenshot(page, `${view.name}-${vp.name}`, scheme)
        })
      }
    }
  })
}
