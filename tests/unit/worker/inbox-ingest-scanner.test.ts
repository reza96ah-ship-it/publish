// @vitest-environment node

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  scanInbox,
  type IngestDeps,
} from '../../../mini-services/publish-worker/lib/inbox-ingest-scanner'
import type { IgComment } from '../../../mini-services/publish-worker/lib/instagram-messaging'

const dbMock = {
  platform: { findMany: vi.fn() },
  publication: { findMany: vi.fn() },
  inboxMessage: { createMany: vi.fn() },
  inboxThread: { upsert: vi.fn(), update: vi.fn() },
  inboxThreadMessage: { createMany: vi.fn() },
  $transaction: vi.fn(),
}
const decryptMock = vi.fn((value: string) => value)
const emitThreadMock = vi.fn().mockResolvedValue(undefined)

const injectedDeps = (): Pick<IngestDeps, 'database' | 'decryptToken' | 'emitThread'> => ({
  database: dbMock as unknown as NonNullable<IngestDeps['database']>,
  decryptToken: decryptMock,
  emitThread: emitThreadMock,
})

const IG_USER_ID = 'ig_user_456'

const basePlatform = {
  id: 'plat_1',
  workspaceId: 'ws_1',
  tokenSecret: 'enc:key:iv:ct:tag',
  targetId: IG_USER_ID,
  name: 'اینستاگرام',
}

function makeComment(overrides: Partial<IgComment> = {}): IgComment {
  return {
    id: 'cmt_' + Math.random().toString(36).slice(2, 8),
    text: 'قیمت چنده؟',
    username: 'reza',
    from: { id: 'ig_user_reza', username: 'reza' },
    timestamp: '2026-07-05T10:00:00Z',
    ...overrides,
  }
}

describe('inbox-ingest-scanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    decryptMock.mockImplementation((value: string) => value)
    emitThreadMock.mockResolvedValue(undefined)
    dbMock.$transaction.mockImplementation(async (callback: (tx: typeof dbMock) => unknown) =>
      callback(dbMock)
    )
    dbMock.platform.findMany.mockResolvedValue([basePlatform])
    dbMock.publication.findMany.mockResolvedValue([{ providerPostId: 'ig_media_1' }])
    dbMock.inboxMessage.createMany.mockResolvedValue({ count: 1 })
    dbMock.inboxThread.upsert.mockResolvedValue({
      id: 'thread_1',
      status: 'new',
      lastMessageAt: new Date('2026-07-05T10:00:00.000Z'),
      lastInboundAt: new Date('2026-07-05T10:00:00.000Z'),
      slaStartedAt: new Date('2026-07-05T10:00:00.000Z'),
      firstResponseAt: null,
      resolvedAt: null,
    })
    dbMock.inboxThread.update.mockResolvedValue({})
    dbMock.inboxThreadMessage.createMany.mockResolvedValue({ count: 1 })
  })

  it('creates an InboxMessage for each inbound comment', async () => {
    const comment = makeComment({ id: 'cmt_1', text: 'سلام، موجوده؟' })
    const stats = await scanInbox({
      ...injectedDeps(),
      listComments: vi.fn().mockResolvedValue([comment]),
    })

    expect(stats.platformsScanned).toBe(1)
    expect(stats.mediaScanned).toBe(1)
    expect(stats.commentsSeen).toBe(1)
    expect(stats.messagesCreated).toBe(1)
    expect(dbMock.inboxThreadMessage.createMany).toHaveBeenCalledOnce()
    expect(dbMock.inboxMessage.createMany).toHaveBeenCalledOnce()

    const arg = dbMock.inboxMessage.createMany.mock.calls[0][0] as {
      data: Array<Record<string, unknown>>
      skipDuplicates: boolean
    }
    expect(arg.skipDuplicates).toBe(true)
    expect(arg.data[0]).toMatchObject({
      workspaceId: 'ws_1',
      platformId: 'plat_1',
      senderName: 'reza',
      message: 'سلام، موجوده؟',
      platformType: 'instagram',
      externalId: 'cmt_1',
      messageType: 'comment',
    })
    expect((arg.data[0].createdAt as Date).toISOString()).toBe('2026-07-05T10:00:00.000Z')
  })

  it('skips the account own comments (self-replies)', async () => {
    const own = makeComment({ from: { id: IG_USER_ID, username: 'brand' } })
    const stats = await scanInbox({
      ...injectedDeps(),
      listComments: vi.fn().mockResolvedValue([own]),
    })

    expect(stats.commentsSeen).toBe(0)
    expect(dbMock.inboxMessage.createMany).not.toHaveBeenCalled()
  })

  it('continues past a media whose comment fetch fails', async () => {
    dbMock.publication.findMany.mockResolvedValue([
      { providerPostId: 'ig_media_bad' },
      { providerPostId: 'ig_media_ok' },
    ])
    const listComments = vi
      .fn()
      .mockRejectedValueOnce(new Error('IG 403'))
      .mockResolvedValueOnce([makeComment()])

    const stats = await scanInbox({ ...injectedDeps(), listComments })

    expect(stats.mediaScanned).toBe(2)
    expect(stats.commentsSeen).toBe(1)
    expect(dbMock.inboxMessage.createMany).toHaveBeenCalledOnce()
  })

  it('skips platforms whose token fails to decrypt', async () => {
    decryptMock.mockImplementationOnce(() => {
      throw new Error('bad key')
    })

    const stats = await scanInbox({ ...injectedDeps(), listComments: vi.fn() })

    expect(stats.platformsScanned).toBe(1)
    expect(stats.mediaScanned).toBe(0)
    expect(dbMock.inboxMessage.createMany).not.toHaveBeenCalled()
  })

  it('falls back to now for malformed timestamps', async () => {
    const comment = makeComment({ timestamp: 'not-a-date' })
    await scanInbox({
      ...injectedDeps(),
      listComments: vi.fn().mockResolvedValue([comment]),
    })

    const arg = dbMock.inboxMessage.createMany.mock.calls[0][0] as {
      data: Array<{ createdAt: Date }>
    }
    expect(Number.isNaN(arg.data[0].createdAt.getTime())).toBe(false)
  })
})
