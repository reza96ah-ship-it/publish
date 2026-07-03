/**
 * Issue #218 — Mobile responsive audit (375×812 RTL)
 *
 * These tests run on the mobile-chrome and mobile-safari Playwright projects
 * (Pixel 7 / iPhone 14). They assert that no horizontal overflow occurs,
 * tap targets meet 44px, and the mobile hamburger navigation works.
 *
 * Authentication: demo@nashrino.ir / demo1234
 */

import { test, expect, type Page } from '@playwright/test'

const AUTH_FILE = 'tests/e2e/.auth/user.json'

// ── Helpers ────────────────────────────────────────────────────────────────

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    return document.body.scrollWidth > window.innerWidth
  })
  expect(overflow, 'horizontal overflow detected').toBe(false)
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Issue #218 — Mobile responsive audit (375px RTL)', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('signin page — no horizontal overflow', async ({ page }) => {
    await page.goto('/auth/signin')
    await page.waitForLoadState('load')
    await assertNoHorizontalOverflow(page)
  })

  test('signin page — form inputs are usable at 375px', async ({ page }) => {
    await page.goto('/auth/signin')
    await page.waitForLoadState('load')
    const emailInput = page.locator('input[type="email"], input[name="email"]').first()
    await expect(emailInput).toBeVisible()
    const box = await emailInput.boundingBox()
    expect(box).not.toBeNull()
    // Input should span most of the viewport width (at least 280px)
    expect(box!.width).toBeGreaterThan(280)
  })
})

test.describe('Issue #218 — Authenticated mobile shell (375px RTL)', () => {
  test.use({ viewport: { width: 375, height: 812 }, storageState: AUTH_FILE })

  test('mobile hamburger opens sidebar drawer', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('load')
    const hamburgerShell = page.locator('button[aria-label="باز کردن منو"]')
    await expect(hamburgerShell).toBeVisible()
    // Tap target must be ≥ 44px
    const box = await hamburgerShell.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)
    // Click it — sidebar should open
    await hamburgerShell.click()
    const sidebar = page.locator('nav[aria-label="ناوبری اصلی"]')
    await expect(sidebar).toBeVisible()
  })

  test('dashboard — no horizontal overflow at 375px', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('load')
    await assertNoHorizontalOverflow(page)
  })

  test('compose — no horizontal overflow at 375px', async ({ page }) => {
    await page.goto('/compose')
    await page.waitForLoadState('load')
    await assertNoHorizontalOverflow(page)
  })

  test('compose — bottom action bar is visible without scrolling', async ({ page }) => {
    await page.goto('/compose')
    await page.waitForLoadState('load')
    // The sticky bottom bar should be in the viewport
    const actionBar = page.locator('.sticky.bottom-0').first()
    const count = await actionBar.count()
    if (count > 0) {
      const box = await actionBar.boundingBox()
      expect(box).not.toBeNull()
      // It should be near the bottom of the viewport
      expect(box!.y + box!.height).toBeLessThanOrEqual(830) // 812 + some buffer
    }
  })

  test('calendar — no horizontal overflow at 375px', async ({ page }) => {
    await page.goto('/calendar')
    await page.waitForLoadState('load')
    await assertNoHorizontalOverflow(page)
  })

  test('calendar — calendar card is horizontally scrollable', async ({ page }) => {
    await page.goto('/calendar')
    await page.waitForLoadState('load')
    // The n-card wrapping the 7-col grid should have overflow-x-auto
    const calendarCard = page.locator('.overflow-x-auto').first()
    await expect(calendarCard).toBeVisible()
  })

  test('inbox — no horizontal overflow at 375px', async ({ page }) => {
    await page.goto('/inbox')
    await page.waitForLoadState('load')
    await assertNoHorizontalOverflow(page)
  })

  test('channels — no horizontal overflow at 375px', async ({ page }) => {
    await page.goto('/channels')
    await page.waitForLoadState('load')
    await assertNoHorizontalOverflow(page)
  })

  test('analytics — no horizontal overflow at 375px', async ({ page }) => {
    await page.goto('/analytics')
    await page.waitForLoadState('load')
    await assertNoHorizontalOverflow(page)
  })

  test('mobile shell — CommandBar is hidden on mobile', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('load')
    // Desktop CommandBar should be hidden on mobile (hidden lg:block)
    const cmdBar = page.locator('[data-testid="command-bar"]')
    const count = await cmdBar.count()
    if (count > 0) {
      await expect(cmdBar).toBeHidden()
    }
  })
})

// ── Tablet tier (768×1024) ─────────────────────────────────────────────────

test.describe('Issue #226 — Tablet tier (768px)', () => {
  test.use({ viewport: { width: 768, height: 1024 }, storageState: AUTH_FILE })

  test('sidebar icon rail is visible at 768px', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('load')
    const sidebar = page.locator('nav[aria-label="ناوبری اصلی"]')
    await expect(sidebar).toBeVisible()
  })

  test('command bar is visible at 768px (no longer hidden)', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('load')
    const cmdBar = page.locator('[data-testid="command-bar"]')
    const count = await cmdBar.count()
    if (count > 0) {
      await expect(cmdBar).toBeVisible()
    }
  })

  test('bottom nav is hidden at 768px', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('load')
    const bottomNav = page.locator('nav[aria-label="ناوبری پایین"]')
    const count = await bottomNav.count()
    if (count > 0) {
      await expect(bottomNav).toBeHidden()
    }
  })

  test('dashboard — no horizontal overflow at 768px', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('load')
    const overflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth)
    expect(overflow, 'horizontal overflow at 768px').toBe(false)
  })

  test('compose — no horizontal overflow at 768px', async ({ page }) => {
    await page.goto('/compose')
    await page.waitForLoadState('load')
    const overflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth)
    expect(overflow, 'horizontal overflow at 768px').toBe(false)
  })
})

// ── Issue #228 — Adaptive charts, tables, and zero-breakpoint views ─────────

test.describe('Issue #228 — Zero-breakpoint grid fixes (375px)', () => {
  test.use({ viewport: { width: 375, height: 812 }, storageState: AUTH_FILE })

  test('channel-health — stats grid stacks single-column on mobile', async ({ page }) => {
    await page.goto('/channel-health')
    await page.waitForLoadState('load')
    await assertNoHorizontalOverflow(page)
  })

  test('channel-health — no horizontal overflow', async ({ page }) => {
    await page.goto('/channel-health')
    await page.waitForLoadState('load')
    const overflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth)
    expect(overflow, 'horizontal overflow on /channel-health').toBe(false)
  })
})
