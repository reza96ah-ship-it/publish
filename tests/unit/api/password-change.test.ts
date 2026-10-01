import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/db', () => ({ db: {
  user: { findUnique: vi.fn(), updateMany: vi.fn() },
  auditLog: { create: vi.fn() },
} }))
vi.mock('@/lib/ratelimit', () => ({ authRateLimit: vi.fn(async () => ({ success: true })) }))
vi.mock('@/lib/password', () => ({
  verifyPassword: vi.fn(async () => ({ valid: true })),
  hashPassword: vi.fn(async () => 'new-hash'),
}))
vi.mock('@/lib/mfa', () => ({
  decryptMfaSecret: vi.fn(() => 'totp-secret'),
  verifyTotpCode: vi.fn(() => true),
}))

import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { verifyPassword, hashPassword } from '@/lib/password'
import { verifyTotpCode } from '@/lib/mfa'
import { POST } from '@/app/api/auth/password/change/route'

const priorUrl = process.env.NEXTAUTH_URL
const valid = { currentPassword: 'old-secret', newPassword: 'fresh-mountain-river-2026', totpCode: '123456' }

function request(body: unknown = valid, origin = 'https://odooshoping.ir') {
  return new NextRequest('https://odooshoping.ir/api/auth/password/change', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXTAUTH_URL = 'https://odooshoping.ir'
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'owner-1', email: 'owner@example.com' } } as never)
  vi.mocked(db.user.findUnique).mockResolvedValue({
    id: 'owner-1', email: 'owner@example.com', passwordHash: 'old-hash',
    mfaSecret: 'encrypted-secret', lockedUntil: null,
  } as never)
  vi.mocked(db.user.updateMany).mockResolvedValue({ count: 1 } as never)
  vi.mocked(db.auditLog.create).mockResolvedValue({} as never)
  vi.mocked(verifyPassword).mockResolvedValue({ valid: true } as never)
  vi.mocked(verifyTotpCode).mockReturnValue(true)
})

afterEach(() => {
  if (priorUrl === undefined) delete process.env.NEXTAUTH_URL
  else process.env.NEXTAUTH_URL = priorUrl
})

describe('self-service app password change', () => {
  it('requires an authenticated same-origin request', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    expect((await POST(request())).status).toBe(401)
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'owner-1', email: 'owner@example.com' } } as never)
    expect((await POST(request(valid, 'https://attacker.example'))).status).toBe(403)
    expect(db.user.updateMany).not.toHaveBeenCalled()
  })

  it('rejects weak and reused passwords before hashing', async () => {
    expect((await POST(request({ ...valid, newPassword: 'adminadminadmin' }))).status).toBe(400)
    expect((await POST(request({ ...valid, currentPassword: valid.newPassword }))).status).toBe(400)
    expect(hashPassword).not.toHaveBeenCalled()
  })

  it('rejects an incorrect current password', async () => {
    vi.mocked(verifyPassword).mockResolvedValue({ valid: false } as never)
    expect((await POST(request())).status).toBe(400)
    expect(db.user.updateMany).not.toHaveBeenCalled()
  })

  it('requires a fresh TOTP code when MFA is enabled', async () => {
    expect((await POST(request({ ...valid, totpCode: '' }))).status).toBe(400)
    vi.mocked(verifyTotpCode).mockReturnValue(false)
    expect((await POST(request())).status).toBe(400)
    expect(db.user.updateMany).not.toHaveBeenCalled()
  })

  it('changes only the signed-in user with the current stored hash', async () => {
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(db.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'owner-1', passwordHash: 'old-hash' },
      data: { passwordHash: 'new-hash', failedAttempts: 0, lockedUntil: null },
    })
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: { userId: 'owner-1', action: 'account.password_changed', resource: 'User' },
    })
  })

  it('rejects a concurrent password change', async () => {
    vi.mocked(db.user.updateMany).mockResolvedValue({ count: 0 } as never)
    expect((await POST(request())).status).toBe(409)
  })
})
