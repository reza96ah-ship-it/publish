import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/platforms/[id]/connect/route'
import { db } from '@/lib/db'
import { requireWorkspaceApi, type WorkspaceGuardResult } from '@/lib/auth-guards'
import { decrypt, isEncrypted } from '@/lib/crypto'

vi.mock('@/lib/db', () => ({
  db: {
    platform: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth-guards', () => ({
  requireWorkspaceApi: vi.fn(),
}))

const mockedDb = vi.mocked(db)
const mockedRequireWorkspaceApi = vi.mocked(requireWorkspaceApi)

describe('platform token storage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedRequireWorkspaceApi.mockResolvedValue({
      error: null,
      workspace: { id: 'ws_1' },
      session: null,
      role: 'admin',
    } as unknown as WorkspaceGuardResult)
    mockedDb.platform.findFirst.mockResolvedValue({
      id: 'platform_1',
      workspaceId: 'ws_1',
      type: 'telegram',
      name: 'Telegram',
      username: null,
    } as never)
    mockedDb.platform.update.mockResolvedValue({ id: 'platform_1' } as never)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        json: async () => ({
          ok: true,
          result: { username: 'nashrino_bot', first_name: 'Nashrino' },
        }),
      }))
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
