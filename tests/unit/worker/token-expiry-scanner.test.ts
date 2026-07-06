import { describe, it, expect, vi, beforeEach } from 'vitest'
import { scanExpiringTokens } from '../../../mini-services/publish-worker/lib/token-expiry-scanner'

// Mock the worker's db client — the scanner only reads Platform + writes Notification.
vi.mock('../../../mini-services/publish-worker/lib/db', () => ({
  db: {
    platform: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    notification: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import { db } from '../../../mini-services/publish-worker/lib/db'

describe('Issue #116 — Instagram/LinkedIn token expiry scanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(db.platform.update as any).mockResolvedValue({})
    ;(db.notification.findFirst as any).mockResolvedValue(null) // no existing notification
    ;(db.notification.create as any).mockResolvedValue({})
  })

  const NOW = new Date('2026-08-28T12:00:00Z')
  const DAY = 24 * 60 * 60 * 1000

  function platformWithExpiry(daysUntilExpiry: number, opts: { id?: string; type?: string; name?: string; workspaceId?: string } = {}) {
    return {
      id: opts.id ?? 'plat-1',
      workspaceId: opts.workspaceId ?? 'ws-1',
      name: opts.name ?? 'حساب اینستاگرام',
      type: opts.type ?? 'instagram',
      tokenExpiresAt: new Date(NOW.getTime() + daysUntilExpiry * DAY),
      status: 'active',
    }
  }

  it('creates a 7-day warning when token expires in 5 days (< 7d window)', async () => {
    ;(db.platform.findMany as any).mockResolvedValue([platformWithExpiry(5)])

    const result = await scanExpiringTokens(NOW)

    expect(result.warned7d).toBe(1)
    expect(result.warned1d).toBe(0)
    expect(result.expired).toBe(0)
    expect(db.notification.create).toHaveBeenCalledTimes(1)
    const created = (db.notification.create as any).mock.calls[0][0].data
    expect(created.type).toBe('token_expiring')
    expect(created.workspaceId).toBe('ws-1')
    expect(created.title).toContain('۷ روز')
  })

  it('creates a 1-day urgent warning when token expires in 12 hours (< 1d)', async () => {
    ;(db.platform.findMany as any).mockResolvedValue([platformWithExpiry(0.5)])

    const result = await scanExpiringTokens(NOW)

    expect(result.warned1d).toBe(1)
    expect(result.warned7d).toBe(0)
    expect(db.notification.create).toHaveBeenCalledTimes(1)
    const created = (db.notification.create as any).mock.calls[0][0].data
    expect(created.type).toBe('token_expiring_urgent')
    expect(created.title).toContain('فردا')
  })

  it('marks platform as expired + creates token_expired notification when token is past expiry', async () => {
    ;(db.platform.findMany as any).mockResolvedValue([platformWithExpiry(-1)]) // expired 1 day ago

    const result = await scanExpiringTokens(NOW)

    expect(result.expired).toBe(1)
    expect(db.platform.update).toHaveBeenCalledTimes(1)
    const updateArgs = (db.platform.update as any).mock.calls[0][0]
    expect(updateArgs.where.id).toBe('plat-1')
    expect(updateArgs.data.status).toBe('expired')
    expect(updateArgs.data.primaryIssue).toContain('منقضی')

    expect(db.notification.create).toHaveBeenCalledTimes(1)
    const notif = (db.notification.create as any).mock.calls[0][0].data
    expect(notif.type).toBe('token_expired')
  })

  it('does NOT warn when token expires in 10 days (> 7d window)', async () => {
    ;(db.platform.findMany as any).mockResolvedValue([platformWithExpiry(10)])

    const result = await scanExpiringTokens(NOW)

    expect(result.warned7d).toBe(0)
    expect(result.warned1d).toBe(0)
    expect(result.expired).toBe(0)
    expect(db.notification.create).not.toHaveBeenCalled()
  })

  it('is idempotent — does not create duplicate notifications on re-scan', async () => {
    ;(db.platform.findMany as any).mockResolvedValue([platformWithExpiry(5)])
    // Simulate an existing 7-day notification from a previous scan
    ;(db.notification.findFirst as any).mockResolvedValue({ id: 'existing-notif' })

    const result = await scanExpiringTokens(NOW)

    expect(result.warned7d).toBe(1) // counted but...
    expect(db.notification.create).not.toHaveBeenCalled() // ...not created again
  })

  it('only scans Instagram + LinkedIn (bot tokens never expire)', async () => {
    ;(db.platform.findMany as any).mockResolvedValue([])
    await scanExpiringTokens(NOW)

    const findArgs = (db.platform.findMany as any).mock.calls[0][0]
    expect(findArgs.where.type.in).toEqual(['instagram', 'linkedin'])
    expect(findArgs.where.tokenExpiresAt.not).toBeNull()
  })

  it('handles LinkedIn tokens with the same lifecycle', async () => {
    ;(db.platform.findMany as any).mockResolvedValue([
      platformWithExpiry(3, { id: 'li-1', type: 'linkedin', name: 'Company Page' }),
    ])

    const result = await scanExpiringTokens(NOW)

    expect(result.warned7d).toBe(1)
    const notif = (db.notification.create as any).mock.calls[0][0].data
    expect(notif.title).toContain('Company Page')
    expect(notif.body).toContain('لینکدین')
  })

  it('processes multiple platforms in a single scan', async () => {
    ;(db.platform.findMany as any).mockResolvedValue([
      platformWithExpiry(5, { id: 'ig-1' }),
      platformWithExpiry(0.5, { id: 'li-1', type: 'linkedin' }),
      platformWithExpiry(-2, { id: 'ig-2' }),
      platformWithExpiry(20, { id: 'ig-3' }), // too far out — no warning
    ])

    const result = await scanExpiringTokens(NOW)

    expect(result.warned7d).toBe(1)
    expect(result.warned1d).toBe(1)
    expect(result.expired).toBe(1)
    expect(db.notification.create).toHaveBeenCalledTimes(3)
    expect(db.platform.update).toHaveBeenCalledTimes(1) // only the expired one
  })

  it('stores a fingerprint in the notification body to enable idempotency check', async () => {
    ;(db.platform.findMany as any).mockResolvedValue([platformWithExpiry(5, { id: 'fp-test' })])

    await scanExpiringTokens(NOW)

    const created = (db.notification.create as any).mock.calls[0][0].data
    expect(created.body).toContain('<!--fp:fp-test:7d-->')
  })
})
