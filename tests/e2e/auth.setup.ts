/**
 * Auth setup for Playwright visual project.
 * Logs in as the seeded demo user and saves the auth storage state so
 * visual regression tests can reuse the session without re-logging in.
 *
 * Run order: 'setup' project runs before 'visual' (see playwright.config.ts).
 */

import { expect, test as setup } from '@playwright/test'
import path from 'path'

export const AUTH_FILE = path.resolve(__dirname, '.auth/user.json')

setup('authenticate as demo user', async ({ page }) => {
  const csrfResponse = await page.request.get('/api/auth/csrf')
  expect(csrfResponse.ok()).toBe(true)
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken?: string }
  expect(csrfToken).toBeTruthy()
  if (!csrfToken) throw new Error('NextAuth CSRF token was not returned')

  const signInResponse = await page.request.post('/api/auth/callback/credentials', {
    form: {
      csrfToken,
      email: 'demo@nashrino.ir',
      password: 'demo1234',
      callbackUrl: '/',
    },
    maxRedirects: 0,
  })

  expect([302, 303]).toContain(signInResponse.status())
  expect(signInResponse.headers().location ?? '').not.toContain('/auth/signin')

  await page.goto('/')
  await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 15_000 })

  await page.context().storageState({ path: AUTH_FILE })
})
