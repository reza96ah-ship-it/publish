import { expect, test } from '@playwright/test'

const inviteToken = 'a'.repeat(43) // Test-only token, never a live invitation.

test.describe('customer invitation page', () => {
  test('does not show a signup form without an invitation token', async ({ page }) => {
    await page.goto('/auth/customer-invite')
    await expect(page.locator('main [role="alert"]')).toContainText('لینک دعوت معتبر نیست')
    await expect(page.getByRole('button', { name: 'ساخت حساب و ورود' })).toHaveCount(0)
  })

  test('removes the token from the URL and submits it only to the app API', async ({ page }) => {
    await page.route('**/api/auth/customer-invite', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'دعوت‌نامه نامعتبر یا منقضی شده است' }),
      })
    })

    await page.goto(`/auth/customer-invite#token=${inviteToken}`)
    await expect(page.getByRole('button', { name: 'ساخت حساب و ورود' })).toBeVisible()
    await expect(page).toHaveURL(/\/auth\/customer-invite$/)

    await page.locator('input[type="email"]').fill('customer@example.com')
    await page.locator('input[autocomplete="name"]').fill('Customer')
    await page.locator('input[autocomplete="new-password"]').first().fill('strong-test-password-123')
    await page.locator('input[autocomplete="new-password"]').last().fill('strong-test-password-123')

    const submitted = page.waitForRequest((request) =>
      request.url().endsWith('/api/auth/customer-invite') && request.method() === 'POST')
    await page.getByRole('button', { name: 'ساخت حساب و ورود' }).click()
    expect((await submitted).postDataJSON()).toEqual({
      token: inviteToken,
      email: 'customer@example.com',
      name: 'Customer',
      password: 'strong-test-password-123',
    })
    await expect(page.locator('main [role="alert"]')).toContainText('دعوت‌نامه نامعتبر یا منقضی شده است')
    await expect(page).toHaveURL(/\/auth\/customer-invite$/)
  })
})
