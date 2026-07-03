/**
 * Auth setup for Playwright visual project.
 * Logs in as the seeded demo user and saves the auth storage state so
 * visual regression tests can reuse the session without re-logging in.
 *
 * Run order: 'setup' project runs before 'visual' (see playwright.config.ts).
 */

import { test as setup } from '@playwright/test'
import path from 'path'

export const AUTH_FILE = path.resolve(__dirname, '.auth/user.json')

setup('authenticate as demo user', async ({ page }) => {
  await page.goto('/auth/signin')
  await page.waitForLoadState('load')

  await page.fill('input[type="email"], input[name="email"]', 'demo@nashrino.ir')
  await page.fill('input[type="password"]', 'demo1234')
  await page.click('button[type="submit"]')

  // Wait until redirected away from the sign-in page (dashboard or any protected route)
  await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 15_000 })

  await page.context().storageState({ path: AUTH_FILE })
})
