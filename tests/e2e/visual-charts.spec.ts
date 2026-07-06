/**
 * Issue #286 — Deterministic no-mask chart and KPI visual baselines.
 *
 * Unlike route screenshots (which mask dynamic chart data), these
 * component-level tests use DETERMINISTIC seeded data so charts and
 * KPI numbers can be captured without masking — catching layout bugs
 * that masked route screenshots would miss.
 *
 * This test file injects deterministic data via a route interceptor
 * that mocks API responses with fixed numbers.
 */

import { test, expect, type Page } from '@playwright/test'

// ── Deterministic data fixtures ────────────────────────────────────────────

const DETERMINISTIC_ANALYTICS = {
  dates: ['1405-07-01', '1405-07-02', '1405-07-03', '1405-07-04', '1405-07-05', '1405-07-06', '1405-07-07'],
  reach: [1200, 1800, 1500, 2400, 3100, 2800, 3500],
  engagement: [45, 72, 60, 96, 124, 112, 140],
  followers: [8400, 8500, 8550, 8600, 8700, 8750, 8800],
  clicks: [89, 134, 112, 178, 230, 208, 259],
}

const DETERMINISTIC_KPI = {
  totalReach: 16300,
  totalEngagement: 649,
  totalFollowers: 8800,
  totalClicks: 1210,
  engagementRate: 3.98,
  followerGrowth: 4.8,
  reachTrend: 15.2,
  clickTrend: 8.5,
}

// ── Helper: inject deterministic API responses ─────────────────────────────

async function mockAnalyticsAPI(page: Page) {
  await page.route('**/api/analytics**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(DETERMINISTIC_ANALYTICS),
    })
  })
  await page.route('**/api/dashboard/summary**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        kpis: DETERMINISTIC_KPI,
        recentJobs: [],
        upcomingJobs: [],
      }),
    })
  })
  await page.route('**/api/dashboard/metrics**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(DETERMINISTIC_ANALYTICS),
    })
  })
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('deterministic chart/KPI baselines', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('analytics page — no-mask chart baseline (light)', async ({ page }) => {
    await mockAnalyticsAPI(page)
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/analytics')
    await page.waitForLoadState('load')
    await page.waitForTimeout(2000)

    // Skip if auth redirect
    if (page.url().includes('/auth')) {
      test.skip(true, 'requires auth')
      return
    }

    // No masks — chart data is deterministic
    await expect(page).toHaveScreenshot('analytics-charts-deterministic-light.png', {
      maxDiffPixels: 500, // Very strict — only anti-aliasing differences
      animations: 'disabled',
    })
  })

  test('analytics page — no-mask chart baseline (dark)', async ({ page }) => {
    await mockAnalyticsAPI(page)
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/analytics')
    await page.waitForLoadState('load')
    await page.waitForTimeout(2000)

    if (page.url().includes('/auth')) {
      test.skip(true, 'requires auth')
      return
    }

    await expect(page).toHaveScreenshot('analytics-charts-deterministic-dark.png', {
      maxDiffPixels: 500,
      animations: 'disabled',
    })
  })

  test('dashboard — KPI cards with deterministic data (light)', async ({ page }) => {
    await mockAnalyticsAPI(page)
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    await page.waitForLoadState('load')
    await page.waitForTimeout(2000)

    if (page.url().includes('/auth')) {
      test.skip(true, 'requires auth')
      return
    }

    // Only screenshot the KPI cards section (first viewport height)
    await expect(page).toHaveScreenshot('dashboard-kpi-deterministic-light.png', {
      maxDiffPixels: 1000,
      animations: 'disabled',
      clip: { x: 0, y: 0, width: 1280, height: 800 },
    })
  })

  test('dashboard — KPI cards with deterministic data (dark)', async ({ page }) => {
    await mockAnalyticsAPI(page)
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    await page.waitForLoadState('load')
    await page.waitForTimeout(2000)

    if (page.url().includes('/auth')) {
      test.skip(true, 'requires auth')
      return
    }

    await expect(page).toHaveScreenshot('dashboard-kpi-deterministic-dark.png', {
      maxDiffPixels: 1000,
      animations: 'disabled',
      clip: { x: 0, y: 0, width: 1280, height: 800 },
    })
  })

  // Mobile chart baseline
  test('analytics — mobile chart baseline (light)', async ({ page }) => {
    await mockAnalyticsAPI(page)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/analytics')
    await page.waitForLoadState('load')
    await page.waitForTimeout(2000)

    if (page.url().includes('/auth')) {
      test.skip(true, 'requires auth')
      return
    }

    await expect(page).toHaveScreenshot('analytics-mobile-charts-deterministic-light.png', {
      maxDiffPixels: 500,
      animations: 'disabled',
    })
  })
})
