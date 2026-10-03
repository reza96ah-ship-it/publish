import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ jobs: vi.fn(), publications: vi.fn(), guard: vi.fn() }))
vi.mock('@/lib/auth-guards', () => ({ requirePermissionApi: mocks.guard }))
vi.mock('@/lib/db', () => ({ db: {
  publishJob: { findMany: mocks.jobs }, publication: { findMany: mocks.publications },
} }))

import { GET } from '@/app/api/publish-jobs/route'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.guard.mockResolvedValue({ workspaceId: 'workspace1', role: 'admin' })
  mocks.jobs.mockResolvedValue([{
    id: 'job1', status: 'action', error: 'Outcome unknown', content: { title: 'Post', thumbnailUrl: null },
    platform: { type: 'instagram', name: 'Shop' }, campaign: null,
  }])
  mocks.publications.mockResolvedValue([{
    id: 'pub1', publishJobId: 'job1', reconciliationStatus: 'still_unknown', errorMessage: 'Provider response missing',
  }])
})

describe('publishing queue recovery data', () => {
  it('returns the workspace-scoped publication state beside the legacy job', async () => {
    const response = await GET(new NextRequest('http://localhost/api/publish-jobs'))
    expect(mocks.publications).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId: 'workspace1', publishJobId: { in: ['job1'] } },
    }))
    const body = await response.json()
    expect(body.data[0]).toMatchObject({
      id: 'job1', publicationId: 'pub1', reconciliationStatus: 'still_unknown',
      publicationError: 'Provider response missing', canResolve: true,
    })
  })

  it('does not offer admin resolution to an editor', async () => {
    mocks.guard.mockResolvedValue({ workspaceId: 'workspace1', role: 'editor' })
    const response = await GET(new NextRequest('http://localhost/api/publish-jobs'))
    expect((await response.json()).data[0].canResolve).toBe(false)
  })

  it('can retrieve older attention jobs without changing the ordinary queue', async () => {
    await GET(new NextRequest('http://localhost/api/publish-jobs?state=attention&limit=100'))
    expect(mocks.jobs).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId: 'workspace1', status: { in: ['action', 'failed'] } },
    }))
  })
})
