import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  runFindFirst: vi.fn(), runFindUnique: vi.fn(), runCreate: vi.fn(), runUpdate: vi.fn(), runUpdateMany: vi.fn(),
  platformFindFirst: vi.fn(), workspaceFindUnique: vi.fn(), contentFindFirst: vi.fn(), contentCreate: vi.fn(),
  listAccounts: vi.fn(), getPosts: vi.fn(),
  queryRaw: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ db: {
  $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({
    $queryRaw: mocks.queryRaw,
    instagramSyncRun: { findFirst: mocks.runFindFirst, create: mocks.runCreate },
  })),
  instagramSyncRun: {
    findFirst: mocks.runFindFirst, findUnique: mocks.runFindUnique,
    create: mocks.runCreate, update: mocks.runUpdate, updateMany: mocks.runUpdateMany,
  },
  platform: { findFirst: mocks.platformFindFirst },
  workspace: { findUnique: mocks.workspaceFindUnique },
  content: { findFirst: mocks.contentFindFirst, create: mocks.contentCreate },
} }))
vi.mock('@/lib/zernio', () => ({
  listInstagramAccounts: mocks.listAccounts, getInstagramRecentPosts: mocks.getPosts,
  ZernioApiError: class extends Error {},
}))

import { queueZernioInitialSync, runZernioInitialSync, zernioSyncCanResume } from '@/modules/instagram-sync/zernio-service'

const accountId = '66b2e19d8c3f5a7e9d0b1c2d'
const profileId = '66a1f0c2a4b9d3e8f1a2b3c4'
const run = {
  id: 'run1', workspaceId: 'workspace1', platformId: 'platform1', status: 'PENDING',
  updatedAt: new Date(), checkpoint: { provider: 'zernio' },
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.runFindUnique.mockResolvedValue(run)
  mocks.runUpdateMany.mockResolvedValue({ count: 1 })
  mocks.runUpdate.mockResolvedValue({})
  mocks.platformFindFirst.mockResolvedValue({ providerAccountId: accountId })
  mocks.workspaceFindUnique.mockResolvedValue({ zernioProfileId: profileId })
  mocks.listAccounts.mockResolvedValue([{ id: accountId, isActive: true }])
  mocks.getPosts.mockResolvedValue([{
    id: 'media1', caption: 'First post', createdTime: '2026-01-01T00:00:00Z', picture: 'https://cdn.example.com/one.jpg',
  }])
  mocks.contentFindFirst.mockResolvedValue(null)
  mocks.contentCreate.mockResolvedValue({ id: 'content1' })
})

describe('Zernio initial sync', () => {
  it('queues a durable run but does not restart a completed one', async () => {
    mocks.runFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...run, status: 'COMPLETED' })
    mocks.runCreate.mockResolvedValue({ id: 'newRun' })
    expect(await queueZernioInitialSync('platform1', 'workspace1')).toBe('newRun')
    expect(mocks.queryRaw).toHaveBeenCalledOnce()
    expect(mocks.runCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ checkpoint: { provider: 'zernio' }, status: 'PENDING' }),
    }))
    expect(await queueZernioInitialSync('platform1', 'workspace1')).toBeNull()
  })

  it('does not reclaim a live run, but allows a stale or failed run to resume', () => {
    expect(zernioSyncCanResume('RUNNING', new Date())).toBe(false)
    expect(zernioSyncCanResume('RUNNING', new Date(Date.now() - 6 * 60_000))).toBe(true)
    expect(zernioSyncCanResume('FAILED', new Date())).toBe(true)
  })

  it('verifies tenant ownership and imports recent posts with a checkpoint', async () => {
    await runZernioInitialSync('run1')
    expect(mocks.listAccounts).toHaveBeenCalledWith(profileId)
    expect(mocks.getPosts).toHaveBeenCalledWith(accountId, 25)
    expect(mocks.contentCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ origin: 'INSTAGRAM_IMPORT', importedPostId: 'media1', status: 'published' }),
    }))
    expect(mocks.runUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'COMPLETED' }),
    }))
  })

  it('skips an already imported post after a retry', async () => {
    mocks.runFindUnique.mockResolvedValue({ ...run, status: 'FAILED', checkpoint: { provider: 'zernio', identity: true } })
    mocks.contentFindFirst.mockResolvedValue({ id: 'existing' })
    await runZernioInitialSync('run1')
    expect(mocks.contentCreate).not.toHaveBeenCalled()
    expect(mocks.runUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ importedMediaCount: 1 }),
    }))
  })

  it('records a safe failure and never imports another profile’s account', async () => {
    mocks.listAccounts.mockResolvedValue([{ id: 'different', isActive: true }])
    await runZernioInitialSync('run1')
    expect(mocks.getPosts).not.toHaveBeenCalled()
    expect(mocks.runUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'FAILED', errors: { push: 'sync_account_not_verified' } }),
    }))
  })

  it('does not execute if another request already claimed the run', async () => {
    mocks.runUpdateMany.mockResolvedValue({ count: 0 })
    await runZernioInitialSync('run1')
    expect(mocks.listAccounts).not.toHaveBeenCalled()
  })
})
