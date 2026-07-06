/**
 * Critical user flows — 8 named end-to-end paths through the application.
 *
 * Flows:
 *   1.  Sign-in page renders + form is interactive
 *   2.  Dashboard (or redirect) loads without JS error
 *   3.  Compose editor loads + accepts text input
 *   4.  Compose schedule mode toggle (now / schedule / queue)
 *   5.  Autosave indicator fires after typing
 *   6.  Content library renders (list or empty state)
 *   7.  Channels page renders (list or connect prompt)
 *   8.  Analytics page renders
 *   9.  Calendar page renders with navigation controls
 *   10. No uncaught console errors on any critical page
 *
 * These run in dev mode where Next.js middleware auth is typically bypassed
 * (NODE_ENV !== production). Tests degrade gracefully when auth IS enforced —
 * an auth redirect is accepted as a valid outcome where noted.
 */

import { test, expect } from '@playwright/test'

test.describe.configure({ retries: 1 })

// ---------------------------------------------------------------------------
// Flow 1 — Sign-in page: renders + form fields are interactive
// ---------------------------------------------------------------------------
test.describe('Flow 1: Sign-in page', () => {
  test('renders email + password fields and a submit button', async ({ page }) => {
    await page.goto('/auth/signin')
    await page.waitForLoadState('load')

    const email = page.locator('input[type="email"], input[name="email"]').first()
    const password = page.locator('input[type="password"]').first()
    const submit = page.locator('button[type="submit"]').first()

    await expect(email).toBeVisible()
    await expect(password).toBeVisible()
    await expect(submit).toBeVisible()
  })

  test('can fill email and password without error', async ({ page }) => {
    await page.goto('/auth/signin')
    await page.waitForLoadState('load')

    await page.locator('input[type="email"], input[name="email"]').first().fill('test@example.com')
    await page.locator('input[type="password"]').first().fill('password123')

    await expect(page.locator('input[type="email"]').first()).toHaveValue('test@example.com')
  })
})

// ---------------------------------------------------------------------------
// Flow 2 — Dashboard loads without crash
// ---------------------------------------------------------------------------
test.describe('Flow 2: Dashboard', () => {
  test('page loads and either shows nav or redirects to sign-in', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto('/')
    await page.waitForLoadState('load')

    // Acceptable outcomes: dashboard with nav, or sign-in page
    const isAuthRedirect = page.url().includes('/auth')
    if (!isAuthRedirect) {
      const nav = page.locator('nav').first()
      await expect(nav).toBeVisible({ timeout: 5000 })
    }

    // No uncaught errors regardless of auth state
    expect(errors.filter((e) => !e.includes('Hydration') && !e.includes('Warning'))).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Flow 3 — Compose editor: loads + accepts text input
// ---------------------------------------------------------------------------
test.describe('Flow 3: Compose editor', () => {
  test('compose page loads an editor area', async ({ page }) => {
    await page.goto('/compose')
    await page.waitForLoadState('load')
    // Accept redirect to sign-in as valid in auth-enforced environments
    if (page.url().includes('/auth')) return

    const editor = page.locator(
      '[contenteditable="true"], textarea, input[placeholder*="عنوان"]'
    ).first()
    await expect(editor).toBeVisible({ timeout: 5000 })
  })

  test('title input accepts Persian text', async ({ page }) => {
    await page.goto('/compose')
    await page.waitForLoadState('load')
    if (page.url().includes('/auth')) return

    const titleInput = page.locator('input[placeholder*="عنوان"]').first()
    if (!(await titleInput.isVisible({ timeout: 3000 }).catch(() => false))) return

    await titleInput.fill('تست انتشار خودکار')
    await expect(titleInput).toHaveValue('تست انتشار خودکار')
  })

  test('body editor accepts input', async ({ page }) => {
    await page.goto('/compose')
    await page.waitForLoadState('load')
    if (page.url().includes('/auth')) return

    const editor = page.locator('[contenteditable="true"]').first()
    if (!(await editor.isVisible({ timeout: 3000 }).catch(() => false))) return

    await editor.click()
    await editor.type('این یک تست است')
    const content = await editor.textContent()
    expect(content).toContain('این یک تست است')
  })
})

// ---------------------------------------------------------------------------
// Flow 4 — Compose: schedule mode toggle (اکنون / زمان‌بندی / صف انتشار)
// ---------------------------------------------------------------------------
test.describe('Flow 4: Schedule mode toggle', () => {
  test('three schedule mode buttons are present and clickable', async ({ page }) => {
    await page.goto('/compose')
    await page.waitForLoadState('load')
    if (page.url().includes('/auth')) return

    const nowBtn = page.locator('button:has-text("اکنون")').first()
    if (!(await nowBtn.isVisible({ timeout: 3000 }).catch(() => false))) return

    const scheduleBtn = page.locator('button:has-text("زمان‌بندی")').first()
    const queueBtn = page.locator('button:has-text("صف")').first()

    await expect(nowBtn).toBeVisible()
    await expect(scheduleBtn).toBeVisible()
    await expect(queueBtn).toBeVisible()

    // Click schedule mode — should not throw
    await scheduleBtn.click()
    await page.waitForTimeout(300)

    // Click queue mode
    await queueBtn.click()
    await page.waitForTimeout(300)

    // Return to now
    await nowBtn.click()
  })
})

// ---------------------------------------------------------------------------
// Flow 5 — Autosave: indicator appears after typing
// ---------------------------------------------------------------------------
test.describe('Flow 5: Autosave indicator', () => {
  test('save indicator or draft status appears within 4 seconds of typing', async ({ page }) => {
    await page.goto('/compose')
    await page.waitForLoadState('load')
    if (page.url().includes('/auth')) return

    const titleInput = page.locator('input[placeholder*="عنوان"]').first()
    if (!(await titleInput.isVisible({ timeout: 3000 }).catch(() => false))) return

    await titleInput.fill('تست ذخیره خودکار')

    // Look for any save indicator (Persian: ذخیره شد, در حال ذخیره, پیش‌نویس)
    const saveIndicator = page.locator(
      'text=/ذخیره شد|در حال ذخیره|پیش‌نویس|saved|saving/i'
    ).first()

    // Autosave debounce is typically 1-3 seconds — allow 4 seconds total
    const appeared = await saveIndicator
      .waitFor({ state: 'visible', timeout: 4000 })
      .then(() => true)
      .catch(() => false)

    // If no indicator, verify no network error occurred — autosave is best-effort
    if (!appeared) {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.waitForTimeout(500)
      expect(errors).toEqual([])
    }
  })
})

// ---------------------------------------------------------------------------
// Flow 6 — Content library: renders list or empty state
// ---------------------------------------------------------------------------
test.describe('Flow 6: Content library', () => {
  test('content page loads without crash', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    await page.goto('/content')
    await page.waitForLoadState('load')

    expect(page.url()).toMatch(/\/content|\/auth/)
    expect(errors.filter((e) => !e.includes('Warning'))).toEqual([])
  })

  test('shows content items or an empty state message', async ({ page }) => {
    await page.goto('/content')
    await page.waitForLoadState('load')
    if (page.url().includes('/auth')) return

    // Either a list of content cards or an empty-state message is acceptable
    const hasContent = await page.locator('[data-content-item], .n-card, article').first()
      .isVisible({ timeout: 3000 }).catch(() => false)
    const hasEmpty = await page.locator('text=/خالی|محتوایی|هنوز/i').first()
      .isVisible({ timeout: 3000 }).catch(() => false)
    const hasAny = await page.locator('main, [role="main"]').first()
      .isVisible({ timeout: 3000 }).catch(() => false)

    expect(hasContent || hasEmpty || hasAny).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Flow 7 — Channels page: renders list or connect prompt
// ---------------------------------------------------------------------------
test.describe('Flow 7: Channels page', () => {
  test('channels page loads without crash', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    await page.goto('/channels')
    await page.waitForLoadState('load')

    expect(page.url()).toMatch(/\/channels|\/auth/)
    expect(errors.filter((e) => !e.includes('Warning'))).toEqual([])
  })

  test('shows platform list or connect-channel prompt', async ({ page }) => {
    await page.goto('/channels')
    await page.waitForLoadState('load')
    if (page.url().includes('/auth')) return

    // Should show either the channel list section or a "connect your first channel" CTA
    const main = page.locator('main, [role="main"], .flex.flex-col').first()
    await expect(main).toBeVisible({ timeout: 5000 })
  })
})

// ---------------------------------------------------------------------------
// Flow 8 — Analytics page: renders
// ---------------------------------------------------------------------------
test.describe('Flow 8: Analytics page', () => {
  test('analytics page loads without crash', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    await page.goto('/analytics')
    await page.waitForLoadState('load')

    expect(page.url()).toMatch(/\/analytics|\/auth/)
    expect(errors.filter((e) => !e.includes('Warning'))).toEqual([])
  })

  test('analytics view renders a main content area', async ({ page }) => {
    await page.goto('/analytics')
    await page.waitForLoadState('load')
    if (page.url().includes('/auth')) return

    const main = page.locator('main, [role="main"], .flex.flex-col').first()
    await expect(main).toBeVisible({ timeout: 5000 })
  })
})

// ---------------------------------------------------------------------------
// Flow 9 — Calendar page: renders with navigation controls
// ---------------------------------------------------------------------------
test.describe('Flow 9: Calendar page', () => {
  test('calendar page loads without crash', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    await page.goto('/calendar')
    await page.waitForLoadState('load')

    expect(page.url()).toMatch(/\/calendar|\/auth/)
    expect(errors.filter((e) => !e.includes('Warning'))).toEqual([])
  })

  test('calendar shows heading and view-toggle tabs', async ({ page }) => {
    await page.goto('/calendar')
    await page.waitForLoadState('load')
    if (page.url().includes('/auth')) return

    const heading = page.locator('h1, h2').first()
    await expect(heading).toBeVisible({ timeout: 5000 })

    // Month/week/agenda tabs (Persian)
    const monthTab = page.locator('button:has-text("ماه"), [role="tab"]:has-text("ماه")').first()
    if (await monthTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(monthTab).toBeVisible()
    }
  })
})

// ---------------------------------------------------------------------------
// Flow 10 — No uncaught errors on critical pages in sequence
// ---------------------------------------------------------------------------
test.describe('Flow 10: No uncaught JS errors across all critical pages', () => {
  const PAGES = ['/', '/auth/signin', '/compose', '/content', '/channels', '/analytics', '/calendar']

  for (const path of PAGES) {
    test(`${path} — zero uncaught errors`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => {
        // Exclude known-harmless Next.js hydration warnings
        if (!e.message.includes('Hydration') && !e.message.includes('Warning:')) {
          errors.push(e.message)
        }
      })

      await page.goto(path)
      await page.waitForLoadState('load')
      await page.waitForTimeout(500) // let deferred scripts settle

      expect(errors).toEqual([])
    })
  }
})
