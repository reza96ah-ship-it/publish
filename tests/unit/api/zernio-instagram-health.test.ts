import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth-guards', () => ({ requirePermissionApi: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: {
  workspace: { findUnique: vi.fn() },
  platform: { findMany: vi.fn() },
} }))
vi.mock('@/lib/zernio', () => ({
  listInstagramAccounts: vi.fn(),
  getZernioAccountHealth: vi.fn(),
  ZernioApiError: class extends Error {},
}))

import { requirePermissionApi } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { getZernioAccountHealth, listInstagramAccounts } from '@/lib/zernio'
import { GET } from '@/app/api/platforms/zernio/instagram/accounts/[accountId]/health/route'

const accountId = '66b2e19d8c3f5a7e9d0b1c2d'
const profileId = '66a1f0c2a4b9d3e8f1a2b3c4'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requirePermissionApi).mockResolvedValue({ workspaceId: 'workspace1', userId: 'user1' } as never)
  vi.mocked(db.workspace.findUnique).mockResolvedValue({ zernioProfileId: profileId } as never)
  vi.mocked(db.platform.findMany).mockResolvedValue([{ providerAccountId: accountId }] as never)
  vi.mocked(listInstagramAccounts).mockResolvedValue([{
    id: accountId, username: 'myshop', isActive: true,
  } as never])
  vi.mocked(getZernioAccountHealth).mockResolvedValue({
    status: 'healthy', tokenValid: true, canPost: true, canFetchAnalytics: true,
  } as never)
})

describe('Zernio Instagram health route', () => {
  const context = { params: Promise.resolve({ accountId }) }

  it('requires an authenticated workspace before looking up an account', async () => {
    vi.mocked(requirePermissionApi).mockResolvedValue({ error: new Response('Unauthorized', { status: 401 }) } as never)
    const response = await GET(new Request('http://localhost'), context)
    expect(response.status).toBe(401)
    expect(db.workspace.findUnique).not.toHaveBeenCalled()
    expect(getZernioAccountHealth).not.toHaveBeenCalled()
  })

  it('returns the health of an account in the current workspace', async () => {
    const response = await GET(new Request('http://localhost'), context)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ health: { tokenValid: true, canPost: true } })
    expect(getZernioAccountHealth).toHaveBeenCalledWith(accountId)
  })

  it('does not query health for an account outside the workspace profile', async () => {
    vi.mocked(listInstagramAccounts).mockResolvedValue([])
    const response = await GET(new Request('http://localhost'), context)
    expect(response.status).toBe(404)
    expect(getZernioAccountHealth).not.toHaveBeenCalled()
  })

  it('does not query health for an account in the profile but owned by another workspace', async () => {
    vi.mocked(db.platform.findMany).mockResolvedValue([])
    const response = await GET(new Request('http://localhost'), context)
    expect(response.status).toBe(404)
    expect(getZernioAccountHealth).not.toHaveBeenCalled()
  })

  it('does not expose a provider outage as a disconnected account', async () => {
    vi.mocked(getZernioAccountHealth).mockRejectedValue(new Error('timeout'))
    const response = await GET(new Request('http://localhost'), context)
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'health_unavailable' })
  })
})
