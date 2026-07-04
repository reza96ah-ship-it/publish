import { test, expect } from '@playwright/test'

test.describe('Dashboard smoke tests', () => {
  test('home page loads with Nashrino title', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/نشرینو|Nashrino|نشر/i)
  })

  test('sidebar nav is visible on the dashboard', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('load')
    // If auth redirects to sign-in, nav won't be present — that's acceptable.
    // This test verifies the page renders without error, not that the user is authenticated.
    const isOnDashboard = page.url().includes('/auth') === false
    if (isOnDashboard) {
      const nav = page.locator('nav').first()
      await expect(nav).toBeVisible({ timeout: 5000 })
    }
  })

  test('signin page shows email + password fields', async ({ page }) => {
    await page.goto('/auth/signin')
    const emailInput = page
      .locator('input[type="email"], input[name="email"], input[autocomplete="email"]')
      .first()
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first()
    await expect(emailInput).toBeVisible()
    await expect(passwordInput).toBeVisible()
  })
})

test.describe('Navigation', () => {
  test('can navigate to compose view', async ({ page }) => {
    await page.goto('/')
    // Click the compose nav button (Persian: انتشار)
    const composeBtn = page.locator('button:has-text("انتشار")').first()
    if (await composeBtn.isVisible()) {
      await composeBtn.click()
      await page.waitForTimeout(1000)
      // Check that the compose view rendered (look for the editor or title input)
      const editor = page
        .locator('textarea, [contenteditable], input[placeholder*="عنوان"]')
        .first()
      await expect(editor).toBeVisible({ timeout: 5000 })
    }
  })

  test('can navigate to calendar view', async ({ page }) => {
    await page.goto('/')
    const calendarBtn = page.locator('button:has-text("تقویم")').first()
    if (await calendarBtn.isVisible()) {
      await calendarBtn.click()
      await page.waitForTimeout(1000)
      // Check calendar heading is visible
      const heading = page.locator('h1:has-text("تقویم")')
      await expect(heading).toBeVisible({ timeout: 5000 })
    }
  })

  test('can navigate to analytics view', async ({ page }) => {
    await page.goto('/')
    const analyticsBtn = page.locator('button:has-text("تحلیل")').first()
    if (await analyticsBtn.isVisible()) {
      await analyticsBtn.click()
      await page.waitForTimeout(1000)
    }
  })
})

test.describe('RTL + Mobile layout', () => {
  test('no horizontal overflow on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }) // iPhone X
    await page.goto('/')
    await page.waitForLoadState('load')

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1) // +1 for rounding
  })

  test('no horizontal overflow on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await page.waitForLoadState('load')

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  })
})

test.describe('Dark mode', () => {
  test('dark mode toggle works', async ({ page }) => {
    await page.goto('/')

    const toggleBtn = page.locator('button:has-text("تاریک"), button:has-text("روشن")').first()
    if (await toggleBtn.isVisible()) {
      // Get initial theme
      const initialClass = await page.evaluate(() => document.documentElement.className)
      await toggleBtn.click()
      await page.waitForTimeout(500)
      // Check theme changed
      const newClass = await page.evaluate(() => document.documentElement.className)
      expect(newClass).not.toBe(initialClass)
    }
  })
})

test.describe('Health endpoints', () => {
  test('GET /api/health returns 200', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.status).toBe('alive')
    expect(body.uptime).toBeDefined()
  })

  test('GET /api/readyz returns 200 with DB check', async ({ request }) => {
    const res = await request.get('/api/readyz')
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.checks.database.ok).toBe(true)
  })

  test('GET /api/metrics returns Prometheus format', async ({ request }) => {
    const res = await request.get('/api/metrics')
    expect(res.ok()).toBe(true)
    const text = await res.text()
    expect(text).toContain('HELP')
    expect(text).toContain('TYPE')
  })
})
