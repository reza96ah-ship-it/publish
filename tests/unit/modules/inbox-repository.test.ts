import { beforeEach, describe, expect, it, vi } from 'vitest'

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    inboxMessage: { findMany: vi.fn() },
    inboxThreadMessage: { findMany: vi.fn() },
    inboxThread: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}))

vi.mock('@/lib/db', () => ({ db: dbMock }))

import {
  encodeThreadCursor,
  encodeThreadMessageCursor,
  InboxRepository,
} from '@/modules/inbox/repository'

const platform = { type: 'instagram', name: 'Instagram' }

function legacyRow(id: string) {
  return {
    id,
    senderName: id,
    senderAvatar: null,
    message: `message-${id}`,
    isRead: false,
    isReplied: false,
    reply: null,
    platformType: 'instagram',
    messageType: 'comment',
    assigneeId: null,
    status: 'new',
    slaStartedAt: null,
    firstResponseAt: null,
    resolvedAt: null,
    createdAt: new Date('2026-07-12T10:00:00.000Z'),
    platform,
  }
}

describe('InboxRepository pagination and context', () => {
  beforeEach(() => vi.clearAllMocks())

  it('preserves SQL page order after excluding mirrored legacy rows', async () => {
    dbMock.$queryRaw.mockResolvedValue([{ id: 'legacy-3' }, { id: 'legacy-1' }])
    dbMock.inboxMessage.findMany.mockResolvedValue([legacyRow('legacy-1'), legacyRow('legacy-3')])

    const rows = await new InboxRepository().list('workspace-1', { limit: 20 })

    expect(rows.map((row) => row.id)).toEqual(['legacy-3', 'legacy-1'])
    expect(dbMock.$queryRaw).toHaveBeenCalledOnce()
  })

  it('uses an immutable timestamp/id keyset cursor for thread pages', async () => {
    const lastMessageAt = new Date('2026-07-12T10:00:00.000Z')
    const cursor = encodeThreadCursor({ id: 'thread-20', lastMessageAt })
    dbMock.inboxThread.findMany.mockResolvedValue([])

    await new InboxRepository().listThreads('workspace-1', {
      limit: 20,
      queue: 'all',
      cursor,
    })

    const where = dbMock.inboxThread.findMany.mock.calls[0][0].where
    expect(where.AND).toEqual([
      {
        OR: [{ lastMessageAt: { lt: lastMessageAt } }, { lastMessageAt, id: { lt: 'thread-20' } }],
      },
    ])
  })

  it('reports total customer history independently from the 20-row preview', async () => {
    dbMock.inboxThread.findFirst.mockResolvedValue({
      id: 'thread-current',
      providerUserId: 'customer-1',
      title: 'Customer',
    })
    const firstSeenAt = new Date('2025-01-01T00:00:00.000Z')
    dbMock.inboxThread.aggregate.mockReturnValue('aggregate-query')
    dbMock.inboxThread.findMany.mockReturnValue('related-query')
    dbMock.$transaction.mockResolvedValue([
      { _count: { _all: 47 }, _min: { createdAt: firstSeenAt } },
      [],
    ])

    const context = await new InboxRepository().getThreadCustomerContext(
      'thread-current',
      'workspace-1'
    )

    expect(context?.customer).toMatchObject({ threadCount: 47, firstSeenAt })
  })

  it('counts only unread legacy rows that are not mirrored into threads', async () => {
    dbMock.$queryRaw.mockResolvedValue([{ count: 7 }])

    await expect(new InboxRepository().legacyUnreadCount('workspace-1')).resolves.toBe(7)
    expect(dbMock.$queryRaw).toHaveBeenCalledOnce()
  })

  it('uses timestamp and id to page older messages without gaps on tied timestamps', async () => {
    const createdAt = new Date('2026-07-12T10:00:00.000Z')
    const cursor = encodeThreadMessageCursor({ id: 'message-50', createdAt })
    dbMock.inboxThreadMessage.findMany.mockResolvedValue([])

    await new InboxRepository().listThreadMessages('thread-1', 'workspace-1', {
      limit: 50,
      cursor,
    })

    const query = dbMock.inboxThreadMessage.findMany.mock.calls[0][0]
    expect(query.where.OR).toEqual([
      { createdAt: { lt: createdAt } },
      { createdAt, id: { lt: 'message-50' } },
    ])
    expect(query.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }])
    expect(query.take).toBe(51)
  })
})
