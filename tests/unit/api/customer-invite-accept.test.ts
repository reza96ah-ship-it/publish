import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/ratelimit', () => ({ authRateLimit: vi.fn(async () => ({ success: true })) }))
vi.mock('@/lib/customer-invitations', () => ({
  CustomerInvitationError: class extends Error {},
  acceptCustomerInvitation: vi.fn(),
}))

import { acceptCustomerInvitation } from '@/lib/customer-invitations'
import { POST } from '@/app/api/auth/customer-invite/route'

const appOrigin = new URL(process.env.NEXTAUTH_URL ?? 'https://odooshoping.ir').origin

function request(body: unknown, origin = appOrigin) {
  return new NextRequest(`${appOrigin}/api/auth/customer-invite`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const valid = {
  token: 'a'.repeat(43),
  email: 'customer@example.com',
  name: 'Customer Name',
  password: 'long-test-phrase-123',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(acceptCustomerInvitation).mockResolvedValue({ email: valid.email, workspaceId: 'workspace-1' })
})

describe('public customer invite acceptance', () => {
  it('rejects cross-origin submissions', async () => {
    expect((await POST(request(valid, 'https://attacker.example'))).status).toBe(403)
    expect(acceptCustomerInvitation).not.toHaveBeenCalled()
  })

  it('rejects malformed tokens and weak passwords before touching the database', async () => {
    expect((await POST(request({ ...valid, token: 'bad' }))).status).toBe(400)
    expect((await POST(request({ ...valid, password: 'admin' }))).status).toBe(400)
    expect((await POST(request({ ...valid, password: 'aaaaaaaaaaaaaa' }))).status).toBe(400)
    expect((await POST(request({ ...valid, password: 'password-123456' }))).status).toBe(400)
    expect(acceptCustomerInvitation).not.toHaveBeenCalled()
  })

  it('accepts a valid request and disables response caching', async () => {
    const response = await POST(request(valid))
    expect(response.status).toBe(201)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(acceptCustomerInvitation).toHaveBeenCalledWith(valid)
  })
})
