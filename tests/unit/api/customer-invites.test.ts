import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/db', () => ({ db: { user: { findUnique: vi.fn() } } }))
vi.mock('@/lib/ratelimit', () => ({ authRateLimit: vi.fn(async () => ({ success: true })) }))
vi.mock('@/lib/customer-invitations', () => ({
  CustomerInvitationError: class extends Error {},
  issueCustomerInvitation: vi.fn(),
  listCustomerInvitations: vi.fn(),
  revokeCustomerInvitation: vi.fn(),
}))

import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { issueCustomerInvitation, listCustomerInvitations, revokeCustomerInvitation } from '@/lib/customer-invitations'
import { DELETE, GET, POST } from '@/app/api/auth/customer-invites/route'

const savedOwner = process.env.PLATFORM_OWNER_EMAIL
const savedUrl = process.env.NEXTAUTH_URL

function request(origin = 'https://odooshoping.ir') {
  return new NextRequest('https://odooshoping.ir/api/auth/customer-invites', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'customer@example.com', workspaceName: 'Customer shop' }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.PLATFORM_OWNER_EMAIL = 'owner@example.com'
  process.env.NEXTAUTH_URL = 'https://odooshoping.ir'
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'owner-1', email: 'owner@example.com' } } as never)
  vi.mocked(db.user.findUnique).mockResolvedValue({ email: 'owner@example.com', mfaSecret: 'encrypted-secret', sessionVersion: 1 } as never)
  vi.mocked(issueCustomerInvitation).mockResolvedValue({ email: 'customer@example.com', token: 'a'.repeat(43), expiresAt: new Date() } as never)
})

afterEach(() => {
  if (savedOwner === undefined) delete process.env.PLATFORM_OWNER_EMAIL
  else process.env.PLATFORM_OWNER_EMAIL = savedOwner
  if (savedUrl === undefined) delete process.env.NEXTAUTH_URL
  else process.env.NEXTAUTH_URL = savedUrl
})

describe('customer workspace invitation issuance', () => {
  it('fails closed when owner identity is not configured', async () => {
    delete process.env.PLATFORM_OWNER_EMAIL
    expect((await POST(request())).status).toBe(403)
    expect(issueCustomerInvitation).not.toHaveBeenCalled()
  })

  it('rejects another signed-in user', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'other', email: 'other@example.com' } } as never)
    expect((await POST(request())).status).toBe(403)
    expect(issueCustomerInvitation).not.toHaveBeenCalled()
  })

  it('requires owner MFA and same-origin JSON', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ email: 'owner@example.com', mfaSecret: null, sessionVersion: 1 } as never)
    expect((await POST(request())).status).toBe(403)
    expect(issueCustomerInvitation).not.toHaveBeenCalled()

    vi.mocked(db.user.findUnique).mockResolvedValue({ email: 'owner@example.com', mfaSecret: 'secret', sessionVersion: 1 } as never)
    expect((await POST(request('https://attacker.example'))).status).toBe(403)
    expect(issueCustomerInvitation).not.toHaveBeenCalled()
  })

  it('blocks issuing, listing, and revoking invitations until the owner rotates the app password', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ email: 'owner@example.com', mfaSecret: 'secret', sessionVersion: 0 } as never)
    expect((await POST(request())).status).toBe(403)
    expect((await GET()).status).toBe(403)
    expect((await DELETE(new NextRequest('https://odooshoping.ir/api/auth/customer-invites', {
      method: 'DELETE',
      headers: { origin: 'https://odooshoping.ir', 'content-type': 'application/json' },
      body: JSON.stringify({ invitationId: 'invitation-1' }),
    }))).status).toBe(403)
    expect(issueCustomerInvitation).not.toHaveBeenCalled()
    expect(listCustomerInvitations).not.toHaveBeenCalled()
    expect(revokeCustomerInvitation).not.toHaveBeenCalled()
  })

  it('returns a fragment-token link once, without caching', async () => {
    const response = await POST(request())
    expect(response.status).toBe(201)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    const body = await response.json()
    expect(body.inviteUrl).toMatch(/^https:\/\/odooshoping\.ir\/auth\/customer-invite#token=/)
    expect(issueCustomerInvitation).toHaveBeenCalledWith({ ownerId: 'owner-1', email: 'customer@example.com', workspaceName: 'Customer shop' })
  })

  it('lists and revokes only through the authenticated owner route', async () => {
    vi.mocked(listCustomerInvitations).mockResolvedValue([])
    const listed = await GET()
    expect(listed.status).toBe(200)
    expect(listCustomerInvitations).toHaveBeenCalledWith('owner-1')

    const revoked = await DELETE(new NextRequest('https://odooshoping.ir/api/auth/customer-invites', {
      method: 'DELETE',
      headers: { origin: 'https://odooshoping.ir', 'content-type': 'application/json' },
      body: JSON.stringify({ invitationId: 'invitation-1' }),
    }))
    expect(revoked.status).toBe(200)
    expect(revokeCustomerInvitation).toHaveBeenCalledWith('owner-1', 'invitation-1')
  })
})
