import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: vi.fn(),
}))
vi.mock('@/lib/auth-guards', () => ({ requirePermissionApi: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: {
  instagramSyncRun: { findFirst: vi.fn() },
  platform: { findFirst: vi.fn() },
} }))
vi.mock('@/modules/instagram-sync/zernio-service', () => ({
  queueZernioInitialSync: vi.fn(), runZernioInitialSync: vi.fn(),
  zernioSyncCanResume: vi.fn().mockReturnValue(true),
}))

import { after } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { queueZernioInitialSync } from '@/modules/instagram-sync/zernio-service'
import { GET, POST } from '@/app/api/platforms/sync-status/route'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requirePermissionApi).mockResolvedValue({ workspaceId: 'workspace1', userId: 'user1' } as never)
  vi.mocked(db.platform.findFirst).mockResolvedValue({ id: 'platform1' } as never)
  vi.mocked(queueZernioInitialSync).mockResolvedValue('run1')
})

describe('Zernio initial sync API', () => {
  it('scopes the status query to the signed-in workspace and hides checkpoint internals', async () => {
    vi.mocked(db.instagramSyncRun.findFirst).mockResolvedValue({
      id: 'run1', status: 'FAILED', checkpoint: { provider: 'zernio', identity: true }, updatedAt: new Date(),
    } as never)
    const response = await GET(new NextRequest('http://localhost/api/platforms/sync-status?platformId=platform1&source=zernio'))
    expect(db.instagramSyncRun.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { platformId: 'platform1', workspaceId: 'workspace1', checkpoint: { path: ['provider'], equals: 'zernio' } },
    }))
    const body = await response.json()
    expect(body.run.canResume).toBe(true)
    expect(body.run.checkpoint).toBeUndefined()
  })

  it('will not schedule a sync for a platform outside this workspace', async () => {
    vi.mocked(db.platform.findFirst).mockResolvedValue(null)
    const response = await POST(new NextRequest('http://localhost/api/platforms/sync-status', {
      method: 'POST', body: JSON.stringify({ platformId: 'foreign' }),
    }))
    expect(response.status).toBe(404)
    expect(queueZernioInitialSync).not.toHaveBeenCalled()
  })

  it('schedules a retry only for an active Zernio Instagram platform', async () => {
    const response = await POST(new NextRequest('http://localhost/api/platforms/sync-status', {
      method: 'POST', body: JSON.stringify({ platformId: 'platform1' }),
    }))
    expect(response.status).toBe(200)
    expect(db.platform.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspaceId: 'workspace1', provider: 'zernio', status: 'active' }),
    }))
    expect(queueZernioInitialSync).toHaveBeenCalledWith('platform1', 'workspace1')
    expect(after).toHaveBeenCalledOnce()
  })
})
