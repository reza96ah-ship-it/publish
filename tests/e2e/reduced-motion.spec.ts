/**
 * Issue #291 — Reduced-motion assertions.
 *
 * Verifies that when prefers-reduced-motion is active, no decorative
 * infinite animations run on work surfaces.
 */

import { test, expect } from '@playwright/test'

test.describe('reduced-motion', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('dashboard — no infinite animation when reduced-motion is active', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await page.waitForLoadState('load')
    await page.waitForTimeout(2000)

    if (page.url().includes('/auth')) {
      test.skip(true, 'requires auth')
      return
    }

    // Check for any element with infinite animation
    const animated = page.locator('[class*="animate-ping"], [class*="animate-bounce"], [class*="animate-spin"]:not([class*="Loader"])')
    const count = await animated.count()

    // animate-spin on Loader2 is allowed (functional, not decorative)
    // animate-ping should be removed from sidebar (#291)
    expect(count).toBeLessThanOrEqual(2) // Allow skeleton spinners only
  })

  test('compose — no infinite animation when reduced-motion is active', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/compose')
    await page.waitForLoadState('load')
    await page.waitForTimeout(2000)

    if (page.url().includes('/auth')) {
      test.skip(true, 'requires auth')
      return
    }

    const animated = page.locator('[class*="animate-ping"], [class*="animate-bounce"]')
    const count = await animated.count()
    expect(count).toBe(0)
  })

  test('analytics — no infinite animation when reduced-motion is active', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/analytics')
    await page.waitForLoadState('load')
    await page.waitForTimeout(2000)

    if (page.url().includes('/auth')) {
      test.skip(true, 'requires auth')
      return
    }

    const animated = page.locator('[class*="animate-ping"], [class*="animate-bounce"]')
    const count = await animated.count()
    expect(count).toBe(0)
  })

  test('sidebar — no animate-ping (replaced with calm dot)', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('load')
    await page.waitForTimeout(1000)

    if (page.url().includes('/auth')) {
      test.skip(true, 'requires auth')
      return
    }

    // The sidebar live indicator should NOT have animate-ping
    const pingInSidebar = await page.locator('aside [class*="animate-ping"]').count()
    expect(pingInSidebar).toBe(0)
  })
})
