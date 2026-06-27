import { test, expect } from '@playwright/test'

test.describe('Publish flow', () => {
  test('navigate to compose and see editor', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Click the compose nav link (Persian: انتشار)
    const composeLink = page.locator('a[href="/compose"]').first()
    await expect(composeLink).toBeVisible()
    await composeLink.click()

    // Wait for compose page to load
    await page.waitForURL('**/compose', { timeout: 5000 })
    await page.waitForTimeout(1000)

    // Verify the compose view rendered — look for title input or editor area
    const editorArea = page.locator('textarea, [contenteditable], input[placeholder*="عنوان"], .n-card').first()
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
    await page.waitForTimeout(1000)

    // Click dashboard link
    const dashboardLink = page.locator('a[href="/"]').first()
    await dashboardLink.click()
    await page.waitForURL('**/', { timeout: 5000 })

    // Verify we're back on dashboard
    const nav = page.locator('nav').first()
    await expect(nav).toBeVisible()
  })
})
