import { test, expect } from '@playwright/test'

test.describe('Dashboard smoke tests', () => {
  test('home page loads with Nashrino title', async ({ page }) => {
    await page.goto('/')
    // Title contains "نشرینو" or "Nashrino" (whichever the metadata ends up serving)
    await expect(page).toHaveTitle(/نشرینو|Nashrino|نشر/i)
  })

  test('sidebar nav is visible on the dashboard', async ({ page }) => {
    await page.goto('/')
    const nav = page.locator('nav').first()
    await expect(nav).toBeVisible()
  })

  test('signin page shows email + password fields', async ({ page }) => {
    await page.goto('/auth/signin')
    // Look for email and password inputs by type (robust to label/text variations)
    const emailInput = page.locator('input[type="email"], input[name="email"], input[autocomplete="email"]').first()
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first()
    await expect(emailInput).toBeVisible()
    await expect(passwordInput).toBeVisible()
  })
})
