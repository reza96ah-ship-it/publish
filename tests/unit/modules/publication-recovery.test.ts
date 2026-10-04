import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findPublication: vi.fn(), updatePublication: vi.fn(), updateJob: vi.fn(),
  createAudit: vi.fn(), createOutbox: vi.fn(), checkContent: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ db: {
  publication: { findFirst: mocks.findPublication },
  $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({
    publication: { updateMany: mocks.updatePublication },
    publishJob: { updateMany: mocks.updateJob },
    auditLog: { create: mocks.createAudit },
    outboxEvent: { create: mocks.createOutbox },
  })),
} }))
vi.mock('@/lib/content-aggregate', () => ({ checkContentPublished: mocks.checkContent }))

import { PublicationsService } from '@/modules/publications/service'

const auth = { workspaceId: 'workspace1', userId: 'owner1', authorName: 'Owner', role: 'admin' }
const publication = {
  id: 'pub1', workspaceId: 'workspace1', publishJobId: 'job1', contentId: 'content1',
  platformId: 'platform1', revisionId: 'revision1', status: 'action_required',
  reconciliationStatus: 'still_unknown',
}
const service = new PublicationsService({} as never)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.findPublication.mockResolvedValue(publication)
  mocks.updatePublication.mockResolvedValue({ count: 1 })
  mocks.updateJob.mockResolvedValue({ count: 1 })
  mocks.createAudit.mockResolvedValue({})
  mocks.createOutbox.mockResolvedValue({})
  mocks.checkContent.mockResolvedValue(undefined)
})

describe('manual publication recovery', () => {
  it('refuses to resolve a post that is not still unknown', async () => {
    mocks.findPublication.mockResolvedValue({ ...publication, reconciliationStatus: null })
    await expect(service.resolve(auth, 'pub1', { action: 'confirm_failure', reason: 'Checked external post list' })).rejects.toThrow()
    expect(mocks.updatePublication).not.toHaveBeenCalled()
  })

  it('requires an external post ID before confirming published', async () => {
    await expect(service.resolve(auth, 'pub1', { action: 'mark_published', reason: 'Verified in Instagram account' })).rejects.toThrow()
    expect(mocks.updatePublication).not.toHaveBeenCalled()
  })

  it('atomically confirms success and synchronizes the legacy job and content', async () => {
    await service.resolve(auth, 'pub1', { action: 'mark_published', providerPostId: 'ig123', reason: 'Verified the exact post externally' })
    expect(mocks.updatePublication).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'pub1', workspaceId: 'workspace1', reconciliationStatus: 'still_unknown' },
      data: expect.objectContaining({ status: 'success', providerPostId: 'ig123', reconciliationStatus: 'confirmed_success' }),
    }))
    expect(mocks.updateJob).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'success', externalId: 'ig123' }),
    }))
    expect(mocks.checkContent).toHaveBeenCalledWith('content1')
  })

  it('marks confirmed failure as retryable without re-posting automatically', async () => {
    await service.resolve(auth, 'pub1', { action: 'confirm_failure', reason: 'No post exists on the connected account' })
    expect(mocks.updateJob).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'failed' }),
    }))
    expect(mocks.createOutbox).not.toHaveBeenCalled()
    expect(mocks.checkContent).toHaveBeenCalledWith('content1')
  })

  it('loses a race safely if the scanner or another admin resolved first', async () => {
    mocks.updatePublication.mockResolvedValue({ count: 0 })
    await expect(service.resolve(auth, 'pub1', { action: 'mark_published', providerPostId: 'ig123', reason: 'Verified the exact post externally' })).rejects.toThrow()
    expect(mocks.updateJob).not.toHaveBeenCalled()
    expect(mocks.createAudit).not.toHaveBeenCalled()
  })

  it('rejects a missing linked job instead of committing a misleading resolution', async () => {
    mocks.updateJob.mockResolvedValue({ count: 0 })
    await expect(service.resolve(auth, 'pub1', { action: 'mark_published', providerPostId: 'ig123', reason: 'Verified the exact post externally' })).rejects.toThrow()
    expect(mocks.createAudit).not.toHaveBeenCalled()
    expect(mocks.checkContent).not.toHaveBeenCalled()
  })

  it('keeps an abandoned publication unavailable for retry', async () => {
    await service.resolve(auth, 'pub1', { action: 'abandon', reason: 'Could not establish a safe provider result' })
    expect(mocks.updateJob).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'cancelled' }),
    }))
  })

  it('does not allow the legacy duplicate-safe shortcut without confirmed failure', async () => {
    await expect(service.resolve(auth, 'pub1', { action: 'duplicate_safe_retry', reason: 'No reliable external confirmation exists' })).rejects.toThrow()
    expect(mocks.updatePublication).not.toHaveBeenCalled()
    expect(mocks.createOutbox).not.toHaveBeenCalled()
  })
})
