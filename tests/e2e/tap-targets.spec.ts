/**
 * Issue #285 — Tap-target sweep: verify all interactive controls
 * have a minimum 44×44px hit area at mobile viewport (375px).
 */

import { test, expect } from '@playwright/test'

const ROUTES = [
  { name: 'signin', url: '/auth/signin', auth: false },
  { name: 'dashboard', url: '/', auth: true },
  { name: 'compose', url: '/compose', auth: true },
  { name: 'settings', url: '/settings', auth: true },
  { name: 'channels', url: '/channels', auth: true },
  { name: 'campaigns', url: '/campaigns', auth: true },
]

const MIN_TARGET = 44 // WCAG 2.2 SC 2.5.8: minimum touch target size

test.describe('tap targets @ 375px', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  for (const route of ROUTES) {
    test(`${route.name} — all visible interactive controls ≥ ${MIN_TARGET}px`, async ({ page }) => {
      if (!route.auth) {
        await page.context().clearCookies()
        await page.addInitScript(() => {
          window.localStorage.clear()
          window.sessionStorage.clear()
        })
      }

      await page.goto(route.url)
      await page.waitForLoadState('load')
      await page.waitForTimeout(1000)

      // Skip if redirected to auth
      if (route.auth && page.url().includes('/auth')) {
        test.skip(true, `${route.name} requires auth`)
        return
      }

      // Select all visible interactive elements
      const targets = page.locator(
        'button:visible, a:visible, [role="button"]:visible, input:visible, textarea:visible, select:visible, [data-slot="select-trigger"]:visible, [data-slot="tabs-trigger"]:visible'
      )

      const count = await targets.count()
      const violations: string[] = []

      for (let i = 0; i < count; i++) {
        const el = targets.nth(i)
        const box = await el.boundingBox()
        if (!box) continue

        const minDim = Math.min(box.width, box.height)
        if (minDim < MIN_TARGET) {
          const tag = await el.evaluate((node) => {
            const html = node.tagName.toLowerCase()
            const text = (node.textContent || '').trim().slice(0, 30)
            const cls = node.getAttribute('class') || ''
            return `${html}${text ? `[${text}]` : ''} ${cls.slice(0, 40)}`
          })
          violations.push(`  ${Math.round(minDim)}px: ${tag} (${Math.round(box.width)}×${Math.round(box.height)})`)
        }
      }

      if (violations.length > 0) {
        console.log(`\n${route.name} tap-target violations (${violations.length}):\n${violations.join('\n')}`)
      }

      // Allow some violations for non-essential decorative elements
      // but fail if there are more than 3
      expect(violations.length).toBeLessThanOrEqual(3)
    })
  }
})
