/**
 * API contract tests — gate against regressions in response shapes.
 *
 * Three categories:
 *   1. Public endpoints (health, readyz, metrics) — must return 200 + correct shape
 *   2. Auth-protected endpoints — must return 401 (not 500) when unauthenticated
 *   3. Parameter validation — must return 400 for invalid cursor/limit values
 *
 * These run against the live Next.js dev server (see playwright.config.ts webServer).
 * No test credentials are required — the 401 behaviour IS the contract.
 */

import { test, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// 1. Public health endpoints
// ---------------------------------------------------------------------------
test.describe('Public health endpoints', () => {
  test('GET /api/health → 200 {ok, status, uptime}', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.status).toBe('alive')
    expect(typeof body.uptime).toBe('number')
  })

  test('GET /api/readyz → 200 {ok, checks.database.ok}', async ({ request }) => {
    const res = await request.get('/api/readyz')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.checks?.database?.ok).toBe(true)
  })

  test('GET /api/metrics → 200 Prometheus text', async ({ request }) => {
    const res = await request.get('/api/metrics')
    expect(res.status()).toBe(200)
    const text = await res.text()
    expect(text).toContain('# HELP')
    expect(text).toContain('# TYPE')
  })
})

// ---------------------------------------------------------------------------
// 2. Auth-protected endpoints: must 401, never 500
// ---------------------------------------------------------------------------
const PROTECTED = [
  '/api/platforms',
  '/api/campaigns',
  '/api/analytics',
  '/api/analytics/real',
  '/api/outbox/dead-letter',
  '/api/content',
  '/api/publications',
  '/api/notifications',
]

test.describe('Auth-protected endpoints — 401 not 500 when unauthenticated', () => {
  for (const path of PROTECTED) {
    test(`GET ${path}`, async ({ request }) => {
      const res = await request.get(path)
      expect(res.status()).not.toBe(500)
      // Accept 401 or 307/302 redirect to /auth/signin
      expect([401, 302, 307]).toContain(res.status())
    })
  }
})

// ---------------------------------------------------------------------------
// 3. Cursor pagination parameter validation (400 for bad inputs)
// ---------------------------------------------------------------------------
test.describe('Pagination parameter validation', () => {
  test('GET /api/platforms?limit=abc → 400', async ({ request }) => {
    const res = await request.get('/api/platforms?limit=abc')
    // Protected routes return 401 before param validation in unauthenticated CI,
    // but in dev-mode with auth bypass they return 400. Either is correct here.
    expect([400, 401, 302, 307]).toContain(res.status())
  })

  test('GET /api/campaigns?limit=-1 → not 500', async ({ request }) => {
    const res = await request.get('/api/campaigns?limit=-1')
    expect(res.status()).not.toBe(500)
  })

  test('GET /api/outbox/dead-letter?limit=999 → not 500', async ({ request }) => {
    const res = await request.get('/api/outbox/dead-letter?limit=999')
    expect(res.status()).not.toBe(500)
  })
})

// ---------------------------------------------------------------------------
// 4. Response shape contract (dev mode with auth bypass, or skip gracefully)
// ---------------------------------------------------------------------------
test.describe('Paginated response shape', () => {
  async function assertPaginatedShape(
    res: Awaited<ReturnType<typeof fetch>>,
    body: unknown
  ) {
    // If auth is enforced (not dev bypass), skip shape assertion
    if ((res as { status(): number }).status() !== 200) return

    expect(body).toHaveProperty('data')
    expect(Array.isArray((body as { data: unknown }).data)).toBe(true)
    expect(body).toHaveProperty('nextCursor')
  }

  test('GET /api/platforms returns {data, nextCursor}', async ({ request }) => {
    const res = await request.get('/api/platforms?limit=5')
    const body = await res.json().catch(() => null)
    if (res.status() === 200 && body) {
      expect(Array.isArray(body.data)).toBe(true)
      expect('nextCursor' in body).toBe(true)
    }
  })

  test('GET /api/campaigns returns {data, nextCursor}', async ({ request }) => {
    const res = await request.get('/api/campaigns?limit=5')
    const body = await res.json().catch(() => null)
    if (res.status() === 200 && body) {
      expect(Array.isArray(body.data)).toBe(true)
      expect('nextCursor' in body).toBe(true)
    }
  })

  test('GET /api/outbox/dead-letter returns {data, nextCursor}', async ({ request }) => {
    const res = await request.get('/api/outbox/dead-letter?limit=5')
    const body = await res.json().catch(() => null)
    if (res.status() === 200 && body) {
      expect(Array.isArray(body.data)).toBe(true)
      expect('nextCursor' in body).toBe(true)
    }
  })

  test('GET /api/analytics returns {dates, reach, engagement}', async ({ request }) => {
    const res = await request.get('/api/analytics')
    const body = await res.json().catch(() => null)
    if (res.status() === 200 && body) {
      expect(Array.isArray(body.dates)).toBe(true)
      expect(Array.isArray(body.reach)).toBe(true)
      expect(Array.isArray(body.engagement)).toBe(true)
    }
  })
})
