import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: vi.fn(),
}))
vi.mock('@/lib/auth-guards', () => ({ requirePermissionApi: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: { workspace: { findUnique: vi.fn() }, platform: { findFirst: vi.fn() }, auditLog: { create: vi.fn() } },
}))
vi.mock('@/lib/zernio', () => ({ listInstagramAccounts: vi.fn(), ZernioApiError: class extends Error {} }))
vi.mock('@/modules/channels/zernio-sync', () => ({ syncWorkspaceZernioInstagram: vi.fn().mockResolvedValue([]) }))
vi.mock('@/modules/instagram-sync/zernio-service', () => ({
  queueZernioInitialSyncForAccount: vi.fn().mockResolvedValue('run1'),
  runZernioInitialSync: vi.fn(),
}))

import { after } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { listInstagramAccounts } from '@/lib/zernio'
import { syncWorkspaceZernioInstagram } from '@/modules/channels/zernio-sync'
import { queueZernioInitialSyncForAccount } from '@/modules/instagram-sync/zernio-service'
import { GET } from '@/app/api/platforms/zernio/instagram/callback/route'

const profileId = '66a1f0c2a4b9d3e8f1a2b3c4'
const accountId = '66b2e19d8c3f5a7e9d0b1c2d'
const flow = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

function callbackRequest(cookieWorkspaceId = 'workspace1') {
  const url = new URL('http://localhost:3000/api/platforms/zernio/instagram/callback')
  url.searchParams.set('flow', flow)
  url.searchParams.set('connected', 'instagram')
  url.searchParams.set('profileId', profileId)
  url.searchParams.set('accountId', accountId)
  const cookie = encodeURIComponent(JSON.stringify({ workspaceId: cookieWorkspaceId, userId: 'user1', profileId }))
  return new NextRequest(url, { headers: { cookie: `zernio_ig_${flow}=${cookie}` } })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requirePermissionApi).mockResolvedValue({ workspaceId: 'workspace1', userId: 'user1' } as never)
  vi.mocked(db.workspace.findUnique).mockResolvedValue({ zernioProfileId: profileId } as never)
  vi.mocked(db.platform.findFirst).mockResolvedValue({ id: 'platform1' } as never)
  vi.mocked(db.auditLog.create).mockResolvedValue({} as never)
  vi.mocked(listInstagramAccounts).mockResolvedValue([{
    id: accountId,
    username: 'myshop',
    displayName: 'My Shop',
    profileUrl: null,
    avatarUrl: null,
    isActive: true,
  }])
  vi.mocked(syncWorkspaceZernioInstagram).mockResolvedValue([{
    id: accountId, username: 'myshop', displayName: 'My Shop',
    profileUrl: null, avatarUrl: null, isActive: true,
  } as never])
})

describe('Zernio Instagram callback', () => {
  it('accepts an account only after server-side verification', async () => {
    const response = await GET(callbackRequest())
    expect(response.headers.get('location')).toContain('zernio_success=1')
    expect(listInstagramAccounts).toHaveBeenCalledWith(profileId)
    expect(queueZernioInitialSyncForAccount).toHaveBeenCalledWith(accountId, 'workspace1')
    expect(after).toHaveBeenCalledOnce()
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
  })

  it('rejects a callback from another workspace before calling Zernio', async () => {
    const response = await GET(callbackRequest('workspace2'))
    expect(response.headers.get('location')).toContain('zernio_error=invalid_flow')
    expect(listInstagramAccounts).not.toHaveBeenCalled()
    expect(queueZernioInitialSyncForAccount).not.toHaveBeenCalled()
  })

  it('rejects an account that Zernio does not list as active', async () => {
    vi.mocked(listInstagramAccounts).mockResolvedValue([])
    const response = await GET(callbackRequest())
    expect(response.headers.get('location')).toContain('zernio_error=account_not_verified')
  })

  it('rejects an account already owned by another workspace without queuing an import', async () => {
    vi.mocked(syncWorkspaceZernioInstagram).mockResolvedValue([])
    const response = await GET(callbackRequest())
    expect(response.headers.get('location')).toContain('zernio_error=account_already_connected')
    expect(queueZernioInitialSyncForAccount).not.toHaveBeenCalled()
    expect(db.auditLog.create).not.toHaveBeenCalled()
  })
})
