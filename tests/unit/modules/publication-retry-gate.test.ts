import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findPublication: vi.fn(), enqueue: vi.fn(), remove: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ db: { publication: { findFirst: mocks.findPublication } } }))
vi.mock('@/lib/queue', () => ({ enqueuePublishJob: mocks.enqueue, publishQueue: { remove: mocks.remove } }))
vi.mock('@/lib/audit', () => ({ writeAuditLog: vi.fn() }))
vi.mock('@/lib/content-aggregate', () => ({ checkContentPublished: vi.fn() }))

import { PublishJobService } from '@/modules/publications/job-service'

const job = {
  id: 'job1', workspaceId: 'workspace1', contentId: 'content1', platformId: 'platform1',
  status: 'failed', externalId: null, idempotencyKey: 'old-key',
}
const repo = {
  findByIdInWorkspace: vi.fn(), retry: vi.fn(),
}
const service = new PublishJobService(repo as never)

beforeEach(() => {
  vi.clearAllMocks()
  repo.findByIdInWorkspace.mockResolvedValue(job)
  repo.retry.mockResolvedValue({ ...job, status: 'pending' })
  mocks.findPublication.mockResolvedValue({
    id: 'pub1', status: 'failed', reconciliationStatus: null, providerAcknowledgedAt: null,
  })
  mocks.enqueue.mockResolvedValue(undefined)
  mocks.remove.mockResolvedValue(undefined)
})

describe('publication retry gate', () => {
  const auth = { workspaceId: 'workspace1', userId: 'owner1' }

  it('blocks an unknown outcome before rearming the queue', async () => {
    mocks.findPublication.mockResolvedValue({ id: 'pub1', reconciliationStatus: 'still_unknown' })
    await expect(service.patchJob(auth, 'job1', { action: 'retry' })).rejects.toThrow()
    expect(repo.retry).not.toHaveBeenCalled()
    expect(mocks.enqueue).not.toHaveBeenCalled()
  })

  it('blocks a provider-confirmed success even if the legacy job says failed', async () => {
    mocks.findPublication.mockResolvedValue({
      id: 'pub1', status: 'success', reconciliationStatus: 'confirmed_success', providerAcknowledgedAt: new Date(),
    })
    await expect(service.patchJob(auth, 'job1', { action: 'retry' })).rejects.toThrow()
    expect(repo.retry).not.toHaveBeenCalled()
  })

  it('blocks retry of a pending or abandoned job', async () => {
    repo.findByIdInWorkspace.mockResolvedValueOnce({ ...job, status: 'pending' })
      .mockResolvedValueOnce({ ...job, status: 'cancelled' })
    await expect(service.patchJob(auth, 'job1', { action: 'retry' })).rejects.toThrow()
    await expect(service.patchJob(auth, 'job1', { action: 'retry' })).rejects.toThrow()
    expect(repo.retry).not.toHaveBeenCalled()
  })

  it('allows a definite failure and re-enqueues once', async () => {
    await expect(service.patchJob(auth, 'job1', { action: 'retry' })).resolves.toMatchObject({ status: 'pending' })
    expect(repo.retry).toHaveBeenCalledOnce()
    expect(mocks.enqueue).toHaveBeenCalledOnce()
  })

  it('allows an automatically confirmed failure still shown as action by the old job', async () => {
    repo.findByIdInWorkspace.mockResolvedValue({ ...job, status: 'action' })
    mocks.findPublication.mockResolvedValue({
      id: 'pub1', status: 'failed', reconciliationStatus: 'confirmed_failure', providerAcknowledgedAt: null,
    })
    await service.patchJob(auth, 'job1', { action: 'retry' })
    expect(repo.retry).toHaveBeenCalledOnce()
  })
})
