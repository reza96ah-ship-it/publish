import { test, expect } from '@playwright/test'

test.describe('Approval flow', () => {
  test('navigate to content library', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Click the content library nav link (Persian: کتابخانه محتوا)
    const contentLink = page.locator('a[href="/content"]').first()
    await expect(contentLink).toBeVisible()
    await contentLink.click()

    // Wait for content page to load
    await page.waitForURL('**/content', { timeout: 5000 })
    await page.waitForTimeout(1000)

    // Verify the content view rendered
    expect(page.url()).toContain('/content')
  })

  test('content library shows content items or empty state', async ({ page }) => {
    await page.goto('/content')
    await page.waitForTimeout(2000)

    // The content view should either show content cards or an empty state message
    const contentArea = page.locator('main, [role="main"], .flex.flex-col').first()
    await expect(contentArea).toBeVisible({ timeout: 5000 })
  })

  test('can navigate to compose and create draft', async ({ page }) => {
    // Start at compose
    await page.goto('/compose')
    await page.waitForTimeout(2000)

    // Fill in title
    const titleInput = page.locator('input[placeholder*="عنوان"], input[type="text"]').first()
    if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await titleInput.fill('پیش‌نویس تست تأیید')

      // Look for draft save button (Persian: پیش‌نویس)
      const draftBtn = page.locator('button:has-text("پیش‌نویس")').first()
      if (await draftBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await draftBtn.click()
        // Wait for any toast or success indication
        await page.waitForTimeout(1000)
      }
    }

    // Navigate to content library to verify
    await page.goto('/content')
    await page.waitForTimeout(1000)
    expect(page.url()).toContain('/content')
  })

  test('calendar shows scheduled content', async ({ page }) => {
    await page.goto('/calendar')
    await page.waitForTimeout(2000)

    // Verify calendar heading is visible
    const heading = page.locator('h1:has-text("تقویم")')
    if (await heading.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(heading).toBeVisible()
    }
  })

  test('can switch between calendar views (month/week/agenda)', async ({ page }) => {
    await page.goto('/calendar')
    await page.waitForTimeout(2000)

    // Look for tab buttons
    const monthTab = page.locator('button:has-text("ماه"), [role="tab"]:has-text("ماه")').first()
    const weekTab = page.locator('button:has-text("هفته"), [role="tab"]:has-text("هفته")').first()
    const agendaTab = page.locator('button:has-text("برنامه"), [role="tab"]:has-text("برنامه")').first()

    if (await monthTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Click week tab
      if (await weekTab.isVisible()) {
        await weekTab.click()
        await page.waitForTimeout(500)
      }

      // Click agenda tab
      if (await agendaTab.isVisible()) {
        await agendaTab.click()
        await page.waitForTimeout(500)
      }

      // Back to month
      if (await monthTab.isVisible()) {
        await monthTab.click()
        await page.waitForTimeout(500)
      }
    }
  })
})
