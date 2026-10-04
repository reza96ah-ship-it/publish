import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth-guards', () => ({ requirePermissionApi: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/db', () => ({
  db: {
    contentDraft: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    media: { findMany: vi.fn() },
  },
}))

import { requirePermissionApi } from '@/lib/auth-guards'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { GET, POST } from '@/app/api/compose-draft/route'

function request(version: number | null = null) {
  return new Request('https://odooshoping.ir/api/compose-draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: { title: 'New caption' }, channelIds: ['channel-1'], version }),
  })
}

function mediaRequest(mediaIds: unknown) {
  return new Request('https://odooshoping.ir/api/compose-draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: { title: 'With photo', mediaIds }, version: null }),
  })
}

const savedDraft = { id: 'draft-1', version: 1, updatedAt: new Date('2026-01-01T00:00:00Z') }

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(requirePermissionApi).mockResolvedValue({ workspaceId: 'workspace-1' } as never)
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'author-1' } } as never)
})

describe('compose draft optimistic concurrency', () => {
  it('accepts the editor’s null version for the first save', async () => {
    vi.mocked(db.contentDraft.create).mockResolvedValue(savedDraft as never)

    const response = await POST(request())

    expect(response.status).toBe(200)
    expect((await response.json()).version).toBe(1)
    expect(db.contentDraft.create).toHaveBeenCalledWith({
      data: {
        workspaceId: 'workspace-1',
        authorId: 'author-1',
        content: { title: 'New caption' },
        channelIds: ['channel-1'],
        scheduledAt: null,
        version: 1,
      },
    })
    expect(db.contentDraft.update).not.toHaveBeenCalled()
  })

  it('returns a conflict when another tab creates the draft first', async () => {
    vi.mocked(db.contentDraft.create).mockRejectedValue({ code: 'P2002' })
    vi.mocked(db.contentDraft.findUnique).mockResolvedValue({ version: 1 } as never)

    const response = await POST(request())

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error: 'conflict', version: 1 })
    expect(db.contentDraft.update).not.toHaveBeenCalled()
  })

  it('updates only the exact version the editor loaded', async () => {
    vi.mocked(db.contentDraft.update).mockResolvedValue({ ...savedDraft, version: 3 } as never)

    const response = await POST(request(2))

    expect(response.status).toBe(200)
    expect((await response.json()).version).toBe(3)
    expect(db.contentDraft.update).toHaveBeenCalledWith({
      where: {
        workspaceId_authorId: { workspaceId: 'workspace-1', authorId: 'author-1' },
        version: 2,
      },
      data: {
        content: { title: 'New caption' },
        channelIds: ['channel-1'],
        scheduledAt: null,
        version: { increment: 1 },
      },
    })
    expect(db.contentDraft.create).not.toHaveBeenCalled()
  })

  it('does not overwrite a newer version from another tab', async () => {
    vi.mocked(db.contentDraft.update).mockRejectedValue({ code: 'P2025' })
    vi.mocked(db.contentDraft.findUnique).mockResolvedValue({ version: 4 } as never)

    const response = await POST(request(2))

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error: 'conflict', version: 4 })
  })

  it('does not hide unrelated database errors as edit conflicts', async () => {
    vi.mocked(db.contentDraft.update).mockRejectedValue({ code: 'P1001' })
    await expect(POST(request(2))).rejects.toMatchObject({ code: 'P1001' })
  })
})

describe('compose draft media references', () => {
  it('resolves saved and local-only IDs through validated media in this workspace', async () => {
    vi.mocked(db.contentDraft.findUnique).mockResolvedValue({ content: { mediaIds: ['media-1', 'media-2'] } } as never)
    vi.mocked(db.media.findMany).mockResolvedValue([
      { id: 'media-2', name: 'second', thumbnailUrl: null, url: '/uploads/second.jpg', fileType: 'image/jpeg', fileSize: 20 },
      { id: 'media-1', name: 'first', thumbnailUrl: '/thumb/first.jpg', url: '/uploads/first.jpg', fileType: 'image/jpeg', fileSize: 10 },
      { id: 'media-3', name: 'local', thumbnailUrl: '/thumb/local.jpg', url: '/uploads/local.jpg', fileType: 'image/jpeg', fileSize: 30 },
    ] as never)

    const response = await GET(new Request('https://odooshoping.ir/api/compose-draft?mediaId=media-3'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(db.media.findMany).toHaveBeenCalledWith({
      where: { workspaceId: 'workspace-1', status: 'validated', id: { in: ['media-1', 'media-2', 'media-3'] } },
      select: { id: true, name: true, thumbnailUrl: true, url: true, fileType: true, fileSize: true },
    })
    expect(body.media.map((item: { id: string }) => item.id)).toEqual(['media-1', 'media-2', 'media-3'])
    expect(body.media[1].thumbnail).toBe('/uploads/second.jpg')
  })

  it('rejects too many local IDs without querying media', async () => {
    const query = Array.from({ length: 21 }, (_, i) => `mediaId=${i}`).join('&')
    const response = await GET(new Request(`https://odooshoping.ir/api/compose-draft?${query}`))
    expect(response.status).toBe(400)
    expect(db.media.findMany).not.toHaveBeenCalled()
  })

  it('saves media IDs only after workspace and validation checks', async () => {
    vi.mocked(db.media.findMany).mockResolvedValue([{ id: 'media-1' }] as never)
    vi.mocked(db.contentDraft.create).mockResolvedValue(savedDraft as never)

    const response = await POST(mediaRequest(['media-1']))

    expect(response.status).toBe(200)
    expect(db.media.findMany).toHaveBeenCalledWith({
      where: { workspaceId: 'workspace-1', status: 'validated', id: { in: ['media-1'] } },
      select: { id: true },
    })
    expect(db.contentDraft.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      content: { title: 'With photo', mediaIds: ['media-1'] },
    }) })
  })

  it('refuses a foreign, deleted, or unvalidated media reference', async () => {
    vi.mocked(db.media.findMany).mockResolvedValue([])
    const response = await POST(mediaRequest(['media-1']))
    expect(response.status).toBe(400)
    expect(db.contentDraft.create).not.toHaveBeenCalled()
  })

  it('refuses malformed media reference lists', async () => {
    expect((await POST(mediaRequest(['media-1', 'media-1']))).status).toBe(400)
    expect((await POST(mediaRequest(Array.from({ length: 21 }, (_, i) => `media-${i}`)))).status).toBe(400)
    expect(db.media.findMany).not.toHaveBeenCalled()
  })
})
