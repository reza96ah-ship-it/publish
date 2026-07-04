import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/platforms/[id]/connect/route'
import { db } from '@/lib/db'
import { requirePermissionApi, type PermissionGuardResult } from '@/lib/auth-guards'
import { decrypt, isEncrypted } from '@/lib/crypto'

vi.mock('@/lib/db', () => ({
  db: {
    platform: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    workspaceMember: {
      findFirst: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth-guards', () => ({
  requirePermissionApi: vi.fn(),
}))

const mockedDb = vi.mocked(db)
const mockedRequirePermissionApi = vi.mocked(requirePermissionApi)

describe('platform token storage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Issue #142: mock requirePermissionApi (replaces requireWorkspaceApi)
    mockedRequirePermissionApi.mockResolvedValue({
      error: null,
      workspace: { id: 'ws_1' },
      session: null,
      role: 'admin',
      userId: 'user_1',
      membershipId: 'member_1',
      workspaceId: 'ws_1',
    } as unknown as PermissionGuardResult)
    mockedDb.platform.findFirst.mockResolvedValue({
      id: 'platform_1',
      workspaceId: 'ws_1',
      type: 'telegram',
      name: 'Telegram',
      username: null,
    } as never)
    mockedDb.platform.update.mockResolvedValue({ id: 'platform_1' } as never)
    mockedDb.workspaceMember.findFirst.mockResolvedValue({ id: 'member_1' } as never)
    // Issue #144: the connect route now calls fetch 3 times for Telegram with a targetId:
    // 1. getMe → validate token
    // 2. getChat → validate target exists
    // 3. getChatMember → verify bot is admin
    vi.stubGlobal(
      'fetch',
      vi.fn()
        // getMe
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ok: true,
            result: { id: 123456789, username: 'nashrino_bot', first_name: 'Nashrino' },
          }),
        })
        // getChat
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ok: true, result: { id: -100123, title: 'Nashrino' } }),
        })
        // getChatMember
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ok: true, result: { status: 'administrator' } }),
        })
    )
  })

  it('encrypts tokenSecret before saving a connected platform', async () => {
    const plaintext = '123456789:telegram-secret-token'
    const req = new NextRequest('http://localhost/api/platforms/platform_1/connect', {
      method: 'POST',
      body: JSON.stringify({ token: plaintext, targetId: '@nashrino' }),
    })

    const res = await POST(req, { params: Promise.resolve({ id: 'platform_1' }) })

    expect(res.status).toBe(200)
    expect(mockedDb.platform.update).toHaveBeenCalledOnce()
    const updateArg = mockedDb.platform.update.mock.calls[0][0] as { data: { tokenSecret: string } }
    const stored = updateArg.data.tokenSecret

    expect(stored).not.toBe(plaintext)
    expect(isEncrypted(stored)).toBe(true)
    expect(decrypt(stored)).toBe(plaintext)
  })
})
