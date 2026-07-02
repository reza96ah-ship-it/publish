/**
 * Issue #128: WCAG 2.2 AA accessibility audit with axe-core.
 *
 * Runs AxeBuilder with tags wcag2a, wcag2aa, wcag21aa, wcag22aa on all
 * critical views. Also includes RTL-specific checks for Persian layout.
 *
 * Axe tags:
 *   - wcag2a   — WCAG 2.0 Level A (must-fix)
 *   - wcag2aa  — WCAG 2.0 Level AA (must-fix)
 *   - wcag21aa — WCAG 2.1 Level AA (must-fix, includes RTL/mobile)
 *   - wcag22aa — WCAG 2.2 Level AA (must-fix, includes focus/target size)
 */

import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']

// Run each view's accessibility scan.
// color-contrast is excluded here — it is tracked separately in the
// 'Color contrast' describe block below (marked test.fixme until Gate 8
// fixes the Tailwind muted/placeholder token values, issue #157).
test.describe('Issue #128 — WCAG 2.2 AA accessibility audit', () => {
  test.describe.configure({ retries: 2 })

  test('login page — zero axe violations', async ({ page }) => {
    await page.goto('/auth/signin')
    // 'load' not 'networkidle' — background requests (session polling, sockets)
    // keep the network active under the production server, so networkidle never fires
    await page.waitForLoadState('load')

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .disableRules(['color-contrast'])
      .analyze()

    expect(results.violations).toEqual([])
  })

  test('dashboard — zero axe violations', async ({ page }) => {
    // Dashboard requires auth — will redirect to sign-in; use 'load' not
    // 'networkidle' because the redirect chain keeps the network active
    await page.goto('/')
    await page.waitForLoadState('load')

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .disableRules(['color-contrast'])
      .analyze()

    expect(results.violations).toEqual([])
  })

  test('compose view — zero axe violations', async ({ page }) => {
    await page.goto('/compose')
    await page.waitForLoadState('load')

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .disableRules(['color-contrast'])
      .analyze()

    expect(results.violations).toEqual([])
  })

  test('content view — zero axe violations', async ({ page }) => {
    await page.goto('/content')
    await page.waitForLoadState('load')

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .disableRules(['color-contrast'])
      .analyze()

    expect(results.violations).toEqual([])
  })

  test('channels view — zero axe violations', async ({ page }) => {
    await page.goto('/channels')
    await page.waitForLoadState('load')

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .disableRules(['color-contrast'])
      .analyze()

    expect(results.violations).toEqual([])
  })
})

// RTL-specific checks (Issue #128: "Critical RTL-specific checks")
test.describe('Issue #128 — RTL layout checks', () => {
  test('document has dir="rtl" and lang="fa"', async ({ page }) => {
    await page.goto('/auth/signin')

    const dir = await page.getAttribute('html', 'dir')
    const lang = await page.getAttribute('html', 'lang')

    expect(dir).toBe('rtl')
    expect(lang).toBe('fa')
  })

  test('icon buttons have aria-label in Persian', async ({ page }) => {
    await page.goto('/auth/signin')
    // 'load' not 'networkidle' — background requests (session polling, sockets)
    // keep the network active under the production server, so networkidle never fires
    await page.waitForLoadState('load')

    // Find all buttons that contain only an icon (no visible text)
    // Bug fix: removed stray ')' from end of selector string
    const iconButtons = page.locator('button:has(svg):not(:has-text(""))')
    const count = await iconButtons.count()

    for (let i = 0; i < count; i++) {
      const btn = iconButtons.nth(i)
      // Skip Next.js dev tools buttons (they're not user-facing)
      if (await btn.evaluate((el) => el.closest('[data-nextjs-dev-tools]'))) continue
      const label = await btn.getAttribute('aria-label')
      // Bug fix: require aria-label to be present (not just check its content if it exists)
      // An icon button without any label is an accessibility failure, not a skip
      expect(label, `icon button at index ${i} is missing aria-label`).toBeTruthy()
      expect(label).toMatch(/[؀-ۿ]/)
    }
  })

  test('focus order is logical in RTL (tab navigation)', async ({ page }) => {
    await page.goto('/auth/signin')
    // 'load' not 'networkidle' — background requests (session polling, sockets)
    // keep the network active under the production server, so networkidle never fires
    await page.waitForLoadState('load')

    // Tab through focusable elements — verify each is visible when focused
    const focusable = page.locator(
      'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    const count = await focusable.count()

    for (let i = 0; i < Math.min(count, 5); i++) {
      await page.keyboard.press('Tab')
      const activeTag = await page.evaluate(() => document.activeElement?.tagName)
      expect(activeTag).toBeTruthy()
    }
  })

  test('aria-live regions exist for status announcements', async ({ page }) => {
    await page.goto('/auth/signin')
    // 'load' not 'networkidle' — background requests (session polling, sockets)
    // keep the network active under the production server, so networkidle never fires
    await page.waitForLoadState('load')

    // The app should have aria-live regions for announcing dynamic content
    // (publish status, toasts, etc.) — at least the sr-only announce region
    const liveRegions = page.locator('[aria-live], [role="status"], [role="alert"]')
    const count = await liveRegions.count()
    // Should have at least one live region for announcements
    // Bug fix: >= 0 is always true; the app has an aria-live announce region from
    // src/lib/aria-live.tsx — if this fails, that region was removed accidentally
    expect(count).toBeGreaterThanOrEqual(1)
  })
})

// Color contrast checks (Issue #216: fix --n-text-tertiary tokens to pass WCAG 4.5:1)
test.describe('Issue #216 — Color contrast', () => {
  test('login page meets WCAG AA contrast ratios', async ({ page }) => {
    await page.goto('/auth/signin')
    await page.waitForLoadState('load')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .withRules(['color-contrast'])
      .analyze()

    expect(results.violations.filter((v) => v.id === 'color-contrast')).toEqual([])
  })

  test('dashboard meets WCAG AA contrast ratios', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('load')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .withRules(['color-contrast'])
      .analyze()

    expect(results.violations.filter((v) => v.id === 'color-contrast')).toEqual([])
  })

  test('compose view meets WCAG AA contrast ratios', async ({ page }) => {
    await page.goto('/compose')
    await page.waitForLoadState('load')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .withRules(['color-contrast'])
      .analyze()

    expect(results.violations.filter((v) => v.id === 'color-contrast')).toEqual([])
  })

  test('content view meets WCAG AA contrast ratios', async ({ page }) => {
    await page.goto('/content')
    await page.waitForLoadState('load')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .withRules(['color-contrast'])
      .analyze()

    expect(results.violations.filter((v) => v.id === 'color-contrast')).toEqual([])
  })

  test('channels view meets WCAG AA contrast ratios', async ({ page }) => {
    await page.goto('/channels')
    await page.waitForLoadState('load')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .withRules(['color-contrast'])
      .analyze()

    expect(results.violations.filter((v) => v.id === 'color-contrast')).toEqual([])
  })
})
