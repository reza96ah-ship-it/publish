import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const { guardMock, updateTagsMock } = vi.hoisted(() => ({
  guardMock: vi.fn(),
  updateTagsMock: vi.fn(),
}))

vi.mock('@/lib/auth-guards', () => ({ requirePermissionApi: guardMock }))
vi.mock('@/modules/inbox', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/inbox')>()
  return {
    ...actual,
    inboxService: { updateThreadTags: updateTagsMock },
  }
})

import { POST } from '@/app/api/inbox/threads/[id]/tags/route'

function request(body: unknown) {
  return new NextRequest('http://localhost/api/inbox/threads/thread-1/tags', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/inbox/threads/:id/tags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    guardMock.mockResolvedValue({ workspaceId: 'workspace-1', userId: 'user-1' })
    updateTagsMock.mockResolvedValue({ id: 'thread-1', tags: ['فروش', 'ویژه'] })
  })

  it('normalizes, deduplicates, and persists thread tags', async () => {
    const response = await POST(request({ tags: [' فروش ', 'ویژه', 'فروش'] }), {
      params: Promise.resolve({ id: 'thread-1' }),
    })

    expect(response.status).toBe(200)
    expect(updateTagsMock).toHaveBeenCalledWith(
      { workspaceId: 'workspace-1', userId: 'user-1' },
      'thread-1',
      { tags: ['فروش', 'ویژه'] }
    )
  })

  it('rejects malformed tags before calling the service', async () => {
    const response = await POST(request({ tags: 'not-an-array' }), {
      params: Promise.resolve({ id: 'thread-1' }),
    })

    expect(response.status).toBe(400)
    expect(updateTagsMock).not.toHaveBeenCalled()
  })

  it('returns the permission guard response unchanged', async () => {
    guardMock.mockResolvedValueOnce({
      error: NextResponse.json({ error: 'forbidden' }, { status: 403 }),
    })

    const response = await POST(request({ tags: ['فروش'] }), {
      params: Promise.resolve({ id: 'thread-1' }),
    })

    expect(response.status).toBe(403)
    expect(updateTagsMock).not.toHaveBeenCalled()
  })
})
