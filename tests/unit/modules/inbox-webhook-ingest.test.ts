import { beforeEach, describe, expect, it, vi } from 'vitest'

const { dbMock, emitMock } = vi.hoisted(() => ({
  emitMock: vi.fn().mockResolvedValue(undefined),
  dbMock: {
    platform: { findMany: vi.fn() },
    inboxThread: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    inboxThreadMessage: { createMany: vi.fn() },
    inboxMessage: { createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('@/modules/inbox/realtime-emit', () => ({ emitInboxThreadEvent: emitMock }))

import { ingestInstagramWebhookPayload } from '@/modules/inbox/instagram-webhook-ingest'

const EVENT_TIME = new Date('2026-07-12T10:00:00.000Z')

function payload() {
  return {
    object: 'instagram',
    entry: [
      {
        id: 'ig-account-1',
        changes: [
          {
            field: 'comments',
            value: {
              id: 'comment-1',
              text: 'قیمت چنده؟',
              from: { id: 'customer-1', username: 'reza' },
              timestamp: EVENT_TIME.toISOString(),
            },
          },
        ],
      },
    ],
  }
}

describe('Instagram webhook transactional ingestion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbMock.$transaction.mockImplementation(async (callback: (tx: typeof dbMock) => unknown) =>
      callback(dbMock)
    )
    dbMock.platform.findMany.mockResolvedValue([
      { id: 'platform-1', workspaceId: 'workspace-1', targetId: 'ig-account-1' },
    ])
    dbMock.inboxThread.findUnique.mockResolvedValue(null)
    dbMock.inboxThread.upsert.mockResolvedValue({
      id: 'thread-1',
      status: 'new',
      unreadCount: 0,
      lastMessageAt: EVENT_TIME,
      lastInboundAt: EVENT_TIME,
      slaStartedAt: EVENT_TIME,
      firstResponseAt: null,
      resolvedAt: null,
    })
    dbMock.inboxThreadMessage.createMany.mockResolvedValue({ count: 1 })
    dbMock.inboxThread.update.mockResolvedValue({})
    dbMock.inboxMessage.createMany.mockResolvedValue({ count: 1 })
  })

  it('commits thread, timeline, state, and compatibility mirror together', async () => {
    const result = await ingestInstagramWebhookPayload(payload())

    expect(dbMock.$transaction).toHaveBeenCalledOnce()
    expect(dbMock.inboxThreadMessage.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true })
    )
    expect(dbMock.inboxThread.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'new',
          unreadCount: { increment: 1 },
          slaStartedAt: EVENT_TIME,
        }),
      })
    )
    expect(dbMock.inboxMessage.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true })
    )
    expect(result).toMatchObject({
      createdThreads: 1,
      createdThreadMessages: 1,
      createdInboxMessages: 1,
      duplicateMessages: 0,
    })
  })

  it('does not mutate counters or mirror rows for duplicate deliveries', async () => {
    dbMock.inboxThread.findUnique.mockResolvedValue({ id: 'thread-1' })
    dbMock.inboxThreadMessage.createMany.mockResolvedValue({ count: 0 })

    const result = await ingestInstagramWebhookPayload(payload())

    expect(dbMock.inboxThread.update).not.toHaveBeenCalled()
    expect(dbMock.inboxMessage.createMany).not.toHaveBeenCalled()
    expect(result.duplicateMessages).toBe(1)
    expect(result.createdThreadMessages).toBe(0)
  })

  it('never moves thread ordering backward for an older out-of-order event', async () => {
    const newer = new Date('2026-07-12T12:00:00.000Z')
    dbMock.inboxThread.findUnique.mockResolvedValue({ id: 'thread-1' })
    dbMock.inboxThread.upsert.mockResolvedValue({
      id: 'thread-1',
      status: 'in_progress',
      unreadCount: 0,
      lastMessageAt: newer,
      lastInboundAt: newer,
      slaStartedAt: newer,
      firstResponseAt: newer,
      resolvedAt: null,
    })

    await ingestInstagramWebhookPayload(payload())

    expect(dbMock.inboxThread.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastMessageAt: newer,
          lastInboundAt: newer,
        }),
      })
    )
  })
})
