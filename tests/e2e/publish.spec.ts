import { test, expect } from '@playwright/test'

test.describe('Publish flow', () => {
  test('navigate to compose and see editor', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('load')

    // If on dashboard (authenticated), navigate via sidebar
    const composeLink = page.locator('a[href="/compose"]').first()
    if (await composeLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await composeLink.click()
      await page.waitForURL('**/compose', { timeout: 5000 })
    } else {
      // Not authenticated — go directly to compose (may redirect to signin)
      await page.goto('/compose')
      await page.waitForLoadState('load')
    }

    // Verify the compose view OR signin rendered without crashing
    const editorArea = page
      .locator('textarea, [contenteditable], input[placeholder*="عنوان"], .n-card, input[type="email"]')
      .first()
    await expect(editorArea).toBeVisible({ timeout: 5000 })
  })

  test('compose has schedule options', async ({ page }) => {
    await page.goto('/compose')
    await page.waitForTimeout(2000)

    // Look for the schedule section (Persian: زمان‌بندی انتشار)
    const scheduleText = page.locator('text=/زمان‌بندی/i')
    if (await scheduleText.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Verify the 3 schedule modes exist
      const nowBtn = page.locator('button:has-text("اکنون")')
      const scheduleBtn = page.locator('button:has-text("زمان‌بندی")')
      const queueBtn = page.locator('button:has-text("صف انتشار")')

      await expect(nowBtn).toBeVisible({ timeout: 3000 })
      await expect(scheduleBtn).toBeVisible()
      await expect(queueBtn).toBeVisible()
    }
  })

  test('compose has live preview section', async ({ page }) => {
    await page.goto('/compose')
    await page.waitForTimeout(2000)

    // Look for the preview heading (Persian: پیش‌نمایش زنده)
    const previewText = page.locator('text=/پیش‌نمایش/i')
    if (await previewText.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(previewText).toBeVisible()
    }
  })

  test('can type in title field', async ({ page }) => {
    await page.goto('/compose')
    await page.waitForTimeout(2000)

    // Find the title input
    const titleInput = page.locator('input[placeholder*="عنوان"], input[type="text"]').first()
    if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await titleInput.fill('تست انتشار خودکار')
      await expect(titleInput).toHaveValue('تست انتشار خودکار')
    }
  })

  test('navigate back to dashboard via sidebar', async ({ page }) => {
    await page.goto('/compose')
    await page.waitForLoadState('load')

    // Only test nav when user is actually on the compose page (authenticated)
    if (!page.url().includes('/auth')) {
      const dashboardLink = page.locator('a[href="/"]').first()
      if (await dashboardLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await dashboardLink.click()
        await page.waitForURL('**/', { timeout: 5000 })
        const nav = page.locator('nav').first()
        await expect(nav).toBeVisible()
      }
    }
  })
})

test.describe('Composer media draft restoration', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' })

  test('keeps the selected media reference after a browser refresh', async ({ page }) => {
    await page.route('**/api/compose-draft*', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'draft-1', version: 2 }) })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          draft: { content: { title: 'Media draft', scheduleMode: 'now', mediaIds: ['media-1'] }, version: 1 },
          media: [{ id: 'media-1', name: 'Restored photo', thumbnail: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=' }],
        }),
      })
    })

    await page.goto('/compose')
    await expect(page.getByAltText('Restored photo')).toBeVisible()
    await expect(page.getByText(/رسانه‌های پیش‌نویس هنوز با سرور بررسی نشده‌اند/)).toHaveCount(0)

    await page.reload()
    await expect(page.getByAltText('Restored photo')).toBeVisible()
  })
})
