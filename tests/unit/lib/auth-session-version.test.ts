import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({ db: {
  user: { findUnique: vi.fn() },
  workspaceMember: { findFirst: vi.fn() },
} }))
vi.mock('@/lib/metrics', () => ({ authFailuresTotal: { inc: vi.fn() } }))
vi.mock('next-auth/jwt', () => ({ getToken: vi.fn() }))

import { db } from '@/lib/db'
import { getToken } from 'next-auth/jwt'
import { authOptions } from '@/lib/auth'
import { proxy } from '@/proxy'

const priorDisableAuth = process.env.DISABLE_AUTH

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.DISABLE_AUTH
  vi.mocked(db.user.findUnique).mockResolvedValue({ sessionVersion: 0 } as never)
})

afterEach(() => {
  if (priorDisableAuth === undefined) delete process.env.DISABLE_AUTH
  else process.env.DISABLE_AUTH = priorDisableAuth
})

describe('password-change session revocation', () => {
  it('preserves a pre-migration JWT while account version is zero', async () => {
    const token = await authOptions.callbacks!.jwt!({ token: { id: 'u1' }, user: undefined } as never)
    expect(token).toMatchObject({ id: 'u1' })
    expect(token.sessionRevoked).toBeUndefined()
  })

  it('marks an old JWT revoked after a password change', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ sessionVersion: 1 } as never)
    const token = await authOptions.callbacks!.jwt!({ token: { id: 'u1', sessionVersion: 0 }, user: undefined } as never)
    expect(token.sessionRevoked).toBe(true)
    const session = await authOptions.callbacks!.session!({
      session: { user: { id: 'u1', email: 'owner@example.com' }, expires: '2099-01-01' },
      token,
    } as never)
    expect(session.user).toBeUndefined()
  })

  it('denies a revoked JWT at the proxy before it reaches a page or API', async () => {
    vi.mocked(getToken).mockResolvedValue({ id: 'u1', sessionVersion: 0 } as never)
    vi.mocked(db.user.findUnique).mockResolvedValue({ sessionVersion: 1 } as never)
    const page = await proxy(new NextRequest('https://odooshoping.ir/calendar'))
    expect(page.status).toBe(307)
    expect(page.headers.get('location')).toContain('/auth/signin')
    const api = await proxy(new NextRequest('https://odooshoping.ir/api/calendar'))
    expect(api.status).toBe(401)
  })

  it('allows a matching version through the proxy', async () => {
    vi.mocked(getToken).mockResolvedValue({ id: 'u1', sessionVersion: 1 } as never)
    vi.mocked(db.user.findUnique).mockResolvedValue({ sessionVersion: 1 } as never)
    const response = await proxy(new NextRequest('https://odooshoping.ir/calendar'))
    expect(response.status).toBe(200)
  })
})
