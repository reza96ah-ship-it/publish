/**
 * Issue #289 — Visual state tests: loading, empty, error, offline.
 *
 * These tests force hard-to-see states that happy-path screenshots miss.
 * Uses API mocking to trigger each state deterministically.
 *
 * States covered:
 *   - loading (skeleton shimmer)
 *   - empty (first-use, no data)
 *   - error (API failure)
 *   - offline (network blocked)
 *
 * Each state is captured at desktop (1280px) in light mode.
 * The tests use route interceptors to mock API responses.
 */

import { test, expect, type Page } from '@playwright/test'

const VIEWPORT = { width: 1280, height: 800 }

// ── Helpers ────────────────────────────────────────────────────────────────

async function mockEmptyResponse(page: Page, pattern: string) {
  await page.route(pattern, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], nextCursor: null }) })
  )
}

async function mockErrorResponse(page: Page, pattern: string) {
  await page.route(pattern, (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'خطای سرور' }) })
  )
}

async function mockLoadingHang(page: Page, pattern: string) {
  await page.route(pattern, (route) => new Promise(() => {})) // Never resolves → loading state persists
}

async function waitForStable(page: Page) {
  await page.waitForLoadState('load')
  await page.waitForTimeout(1500)
}

// ── Loading state tests ────────────────────────────────────────────────────

test.describe('loading states', () => {
  test.use({ viewport: VIEWPORT })

  test('dashboard — loading skeleton', async ({ page }) => {
    await mockLoadingHang(page, '**/api/dashboard/summary')
    await mockLoadingHang(page, '**/api/dashboard/metrics')
    await page.goto('/')
    await page.waitForTimeout(2000)
    if (page.url().includes('/auth')) { test.skip(true, 'requires auth'); return }
    await expect(page).toHaveScreenshot('state-loading-dashboard.png', {
      maxDiffPixels: 5000,
      animations: 'disabled',
      mask: [page.locator('[data-slot="skeleton"]')],
    })
  })

  test('analytics — loading skeleton', async ({ page }) => {
    await mockLoadingHang(page, '**/api/analytics')
    await page.goto('/analytics')
    await page.waitForTimeout(2000)
    if (page.url().includes('/auth')) { test.skip(true, 'requires auth'); return }
    await expect(page).toHaveScreenshot('state-loading-analytics.png', {
      maxDiffPixels: 5000,
      animations: 'disabled',
      mask: [page.locator('[data-slot="skeleton"]')],
    })
  })

  test('inbox — loading skeleton', async ({ page }) => {
    await mockLoadingHang(page, '**/api/inbox')
    await page.goto('/inbox')
    await page.waitForTimeout(2000)
    if (page.url().includes('/auth')) { test.skip(true, 'requires auth'); return }
    await expect(page).toHaveScreenshot('state-loading-inbox.png', {
      maxDiffPixels: 5000,
      animations: 'disabled',
      mask: [page.locator('[data-slot="skeleton"]')],
    })
  })
})

// ── Empty state tests ──────────────────────────────────────────────────────

test.describe('empty states', () => {
  test.use({ viewport: VIEWPORT })

  test('campaigns — empty first-use', async ({ page }) => {
    await mockEmptyResponse(page, '**/api/campaigns')
    await page.goto('/campaigns')
    await waitForStable(page)
    if (page.url().includes('/auth')) { test.skip(true, 'requires auth'); return }
    await expect(page).toHaveScreenshot('state-empty-campaigns.png', {
      maxDiffPixels: 5000,
      animations: 'disabled',
    })
  })

  test('inbox — empty no messages', async ({ page }) => {
    await mockEmptyResponse(page, '**/api/inbox')
    await page.goto('/inbox')
    await waitForStable(page)
    if (page.url().includes('/auth')) { test.skip(true, 'requires auth'); return }
    await expect(page).toHaveScreenshot('state-empty-inbox.png', {
      maxDiffPixels: 5000,
      animations: 'disabled',
    })
  })

  test('content — empty library', async ({ page }) => {
    await mockEmptyResponse(page, '**/api/content')
    await page.goto('/content')
    await waitForStable(page)
    if (page.url().includes('/auth')) { test.skip(true, 'requires auth'); return }
    await expect(page).toHaveScreenshot('state-empty-content.png', {
      maxDiffPixels: 5000,
      animations: 'disabled',
    })
  })

  test('media — empty library', async ({ page }) => {
    await mockEmptyResponse(page, '**/api/media')
    await page.goto('/media')
    await waitForStable(page)
    if (page.url().includes('/auth')) { test.skip(true, 'requires auth'); return }
    await expect(page).toHaveScreenshot('state-empty-media.png', {
      maxDiffPixels: 5000,
      animations: 'disabled',
    })
  })
})

// ── Error state tests ──────────────────────────────────────────────────────

test.describe('error states', () => {
  test.use({ viewport: VIEWPORT })

  test('analytics — API error', async ({ page }) => {
    await mockErrorResponse(page, '**/api/analytics')
    await page.goto('/analytics')
    await waitForStable(page)
    if (page.url().includes('/auth')) { test.skip(true, 'requires auth'); return }
    await expect(page).toHaveScreenshot('state-error-analytics.png', {
      maxDiffPixels: 5000,
      animations: 'disabled',
    })
  })

  test('dashboard — API error', async ({ page }) => {
    await mockErrorResponse(page, '**/api/dashboard/summary')
    await mockErrorResponse(page, '**/api/dashboard/metrics')
    await page.goto('/')
    await waitForStable(page)
    if (page.url().includes('/auth')) { test.skip(true, 'requires auth'); return }
    await expect(page).toHaveScreenshot('state-error-dashboard.png', {
      maxDiffPixels: 5000,
      animations: 'disabled',
    })
  })

  test('inbox — API error', async ({ page }) => {
    await mockErrorResponse(page, '**/api/inbox')
    await page.goto('/inbox')
    await waitForStable(page)
    if (page.url().includes('/auth')) { test.skip(true, 'requires auth'); return }
    await expect(page).toHaveScreenshot('state-error-inbox.png', {
      maxDiffPixels: 5000,
      animations: 'disabled',
    })
  })
})

// ── Offline state tests ────────────────────────────────────────────────────

test.describe('offline states', () => {
  test.use({ viewport: VIEWPORT })

  test('dashboard — offline (network blocked)', async ({ page }) => {
    // First load normally, then block all API calls
    await page.goto('/')
    await waitForStable(page)
    if (page.url().includes('/auth')) { test.skip(true, 'requires auth'); return }

    // Block all API requests to simulate offline
    await page.route('**/api/**', (route) => route.abort())

    // Trigger a refetch by reloading
    await page.reload()
    await page.waitForTimeout(2000)

    await expect(page).toHaveScreenshot('state-offline-dashboard.png', {
      maxDiffPixels: 5000,
      animations: 'disabled',
    })
  })
})
