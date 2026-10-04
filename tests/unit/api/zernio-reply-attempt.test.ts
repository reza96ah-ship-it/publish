import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({ guard: vi.fn(), getOpen: vi.fn(), resolve: vi.fn() }))
vi.mock('@/lib/auth-guards', () => ({ requirePermissionApi: mocks.guard }))
vi.mock('@/modules/inbox/zernio-reply-attempt', () => ({
  getOpenZernioReplyAttempt: mocks.getOpen,
  resolveZernioReplyAttempt: mocks.resolve,
  ReplyAttemptError: class ReplyAttemptError extends Error {},
}))

import { GET, POST } from '@/app/api/inbox/threads/[id]/reply-attempt/route'

const threadId = 'cmuofkvee000101nzzmpp187e'
const key = '7b8e1250-4205-4c6e-9270-cba566e716cb'
const params = { params: Promise.resolve({ id: threadId }) }

describe('Zernio ambiguous reply resolution API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.guard.mockResolvedValue({ error: null, role: 'admin', workspaceId: 'ws-1', userId: 'admin-1' })
    mocks.getOpen.mockResolvedValue({ idempotencyKey: key, status: 'unknown', createdAt: new Date() })
    mocks.resolve.mockResolvedValue(undefined)
  })

  it('shows editors an unresolved state without disclosing the operation key', async () => {
    mocks.guard.mockResolvedValue({ error: null, role: 'editor', workspaceId: 'ws-1', userId: 'editor-1' })
    const response = await GET(new NextRequest('http://localhost'), params)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ attempt: { status: 'unknown', idempotencyKey: null }, canResolve: false })
  })

  it('requires admin permission for a manual resolution', async () => {
    mocks.guard.mockImplementation(async (permission: string) => permission === 'security.admin'
      ? { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }
      : { error: null, role: 'editor', workspaceId: 'ws-1', userId: 'editor-1' })
    const response = await POST(new NextRequest('http://localhost', {
      method: 'POST', body: JSON.stringify({ idempotencyKey: key, resolution: 'not_sent', confirmation: 'checked_instagram_conversation' }),
    }), params)
    expect(response.status).toBe(403)
    expect(mocks.resolve).not.toHaveBeenCalled()
  })

  it('requires explicit confirmation and audits through the service', async () => {
    const missingConfirmation = await POST(new NextRequest('http://localhost', {
      method: 'POST', body: JSON.stringify({ idempotencyKey: key, resolution: 'not_sent' }),
    }), params)
    expect(missingConfirmation.status).toBe(400)
    const accepted = await POST(new NextRequest('http://localhost', {
      method: 'POST', body: JSON.stringify({ idempotencyKey: key, resolution: 'not_sent', confirmation: 'checked_instagram_conversation' }),
    }), params)
    expect(accepted.status).toBe(200)
    expect(mocks.resolve).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: 'ws-1', threadId, userId: 'admin-1', idempotencyKey: key, resolution: 'not_sent',
    }))
  })
})
