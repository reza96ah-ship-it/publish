/**
 * Issue #284 — Visual regression suite (expanded).
 *
 * P0 routes × 5 viewports × 2 color schemes + reduced-motion.
 */

import { test, expect, type Page } from '@playwright/test'

const VIEWPORTS = [
  { name: 'sm-mobile', width: 360, height: 740 },
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1024, height: 768 },
  { name: 'desktop', width: 1280, height: 800 },
] as const

const VIEWS = [
  { name: 'signin', url: '/auth/signin', auth: false },
  { name: 'dashboard', url: '/', auth: true },
  { name: 'compose', url: '/compose', auth: true },
  { name: 'calendar', url: '/calendar', auth: true },
  { name: 'inbox', url: '/inbox', auth: true },
  { name: 'analytics', url: '/analytics', auth: true },
  { name: 'settings', url: '/settings', auth: true },
  { name: 'channels', url: '/channels', auth: true },
  { name: 'campaigns', url: '/campaigns', auth: true },
  { name: 'media', url: '/media', auth: true },
  { name: 'content', url: '/content', auth: true },
  { name: 'smart-pages', url: '/smart-pages', auth: true },
] as const

const ANIMATED_ROUTES = new Set(['dashboard', 'compose', 'analytics'])

const DYNAMIC_MASKS = [
  'img[src*="avatar"]',
  'img[alt*="avatar"]',
  '[data-slot="skeleton"]',
  '.animate-ping',
  '[data-visual-mask]',
  '.recharts-bar-rectangle',
  '.recharts-line-dot',
  '.recharts-area-area',
  '.recharts-curve',
] as const

async function waitForStable(page: Page) {
  await page.waitForLoadState('load')
  await page.waitForTimeout(1200)
}

async function getMasks(page: Page) {
  return page.locator(DYNAMIC_MASKS.join(', ')).all()
}

async function screenshot(page: Page, name: string, scheme: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: scheme })
  await page.waitForTimeout(300)
  const masks = await getMasks(page)
  await expect(page).toHaveScreenshot(`${name}-${scheme}.png`, {
    maxDiffPixels: 10000,
    mask: masks,
    animations: 'disabled',
  })
}

for (const vp of VIEWPORTS) {
  test.describe(`viewport:${vp.name} (${vp.width}×${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })
    for (const view of VIEWS) {
      for (const scheme of ['light', 'dark'] as const) {
        test(`${view.name} — ${vp.name} — ${scheme}`, async ({ page }) => {
          if (!view.auth) {
            await page.context().clearCookies()
            await page.addInitScript(() => { window.localStorage.clear(); window.sessionStorage.clear() })
          }
          await page.goto(view.url)
          await waitForStable(page)
          if (view.auth && page.url().includes('/auth')) {
            test.skip(true, `${view.name} requires auth`)
            return
          }
          await screenshot(page, `${view.name}-${vp.name}`, scheme)
        })
      }
    }
  })
}

test.describe('reduced-motion', () => {
  test.use({ viewport: { width: 1280, height: 800 } })
  for (const view of VIEWS) {
    if (!ANIMATED_ROUTES.has(view.name)) continue
    test(`${view.name} — reduced-motion — light`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
      if (!view.auth) { await page.context().clearCookies(); await page.addInitScript(() => { window.localStorage.clear(); window.sessionStorage.clear() }) }
      await page.goto(view.url)
      await waitForStable(page)
      if (view.auth && page.url().includes('/auth')) { test.skip(true, `${view.name} requires auth`); return }
      const masks = await getMasks(page)
      await expect(page).toHaveScreenshot(`${view.name}-reduced-motion-light.png`, { maxDiffPixels: 10000, mask: masks, animations: 'disabled' })
    })
  }
})
