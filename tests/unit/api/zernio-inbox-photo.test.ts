import { beforeEach, describe, expect, it, vi } from 'vitest'

const { guard, findThread, getConversation, fetchPhoto } = vi.hoisted(() => ({
  guard: vi.fn(),
  findThread: vi.fn(),
  getConversation: vi.fn(),
  fetchPhoto: vi.fn(),
}))

vi.mock('@/lib/auth-guards', () => ({ requirePermissionApi: guard }))
vi.mock('@/lib/db', () => ({ db: { inboxThread: { findFirst: findThread } } }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/lib/zernio', () => ({
  getZernioInboxConversation: getConversation,
  ZernioApiError: class ZernioApiError extends Error {},
}))
vi.mock('@/lib/zernio-photo', () => ({ fetchInstagramPhotoThroughProxy: fetchPhoto }))

import { GET } from '@/app/api/inbox/threads/[id]/photo/route'

const threadId = 'cmuofkvee000101nzzmpp187e'
const params = { params: Promise.resolve({ id: threadId }) }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('INSTAGRAM_IMAGE_PROXY_URL', 'http://127.0.0.1:10809')
  guard.mockResolvedValue({ workspaceId: 'workspace-1' })
  findThread.mockResolvedValue({
    providerThreadId: '3297393773983978',
    messageType: 'dm',
    platform: { type: 'instagram', provider: 'zernio', providerAccountId: '6ab90338e45fe3934a12ade1' },
  })
  getConversation.mockResolvedValue({ participantPicture: 'https://scontent-lhr6-1.cdninstagram.com/photo.jpg' })
  fetchPhoto.mockResolvedValue({ bytes: Uint8Array.from([0xff, 0xd8, 0xff]), contentType: 'image/jpeg' })
})

describe('Zernio Inbox participant photo', () => {
  it('proxies a workspace-owned participant photo as private image bytes', async () => {
    const response = await GET(new Request('http://localhost'), params)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/jpeg')
    expect(response.headers.get('cache-control')).toContain('private')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(Uint8Array.from([0xff, 0xd8, 0xff]))
    expect(findThread).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: threadId, workspaceId: 'workspace-1' },
    }))
    expect(getConversation).toHaveBeenCalledWith('6ab90338e45fe3934a12ade1', '3297393773983978')
    expect(fetchPhoto).toHaveBeenCalledWith('https://scontent-lhr6-1.cdninstagram.com/photo.jpg', 'http://127.0.0.1:10809')
  })

  it('does not expose another workspace or a non-Zernio thread', async () => {
    findThread.mockResolvedValueOnce(null)
    expect((await GET(new Request('http://localhost'), params)).status).toBe(404)
    findThread.mockResolvedValueOnce({
      providerThreadId: 'other', messageType: 'dm',
      platform: { type: 'instagram', provider: 'direct', providerAccountId: null },
    })
    expect((await GET(new Request('http://localhost'), params)).status).toBe(404)
    expect(getConversation).not.toHaveBeenCalled()
  })

  it('keeps the initials fallback when Zernio has no picture', async () => {
    getConversation.mockResolvedValueOnce({ participantPicture: null })
    expect((await GET(new Request('http://localhost'), params)).status).toBe(404)
    expect(fetchPhoto).not.toHaveBeenCalled()
  })
})
