import { describe, it, expect, beforeEach, vi } from 'vitest'

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    platform: { findUnique: vi.fn() },
    inboxThread: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    inboxThreadMessage: { createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('@/lib/crypto', () => ({ decrypt: vi.fn((v: string) => `dec:${v}`) }))

import { backfillInstagramConversations } from '@/modules/inbox/instagram-backfill'

const IG_USER_ID = 'ig_biz_1'

const basePlatform = {
  id: 'plat_1',
  workspaceId: 'ws_1',
  type: 'instagram',
  tokenSecret: 'enc_token',
  targetId: IG_USER_ID,
}

function makeConversation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conv_1',
    participants: {
      data: [
        { id: IG_USER_ID, username: 'brand' },
        { id: 'igsid_customer', username: 'reza' },
      ],
    },
    messages: {
      data: [
        {
          id: 'mid.1',
          message: 'سلام، قیمت چنده؟',
          from: { id: 'igsid_customer', username: 'reza' },
          created_time: '2026-07-11T10:00:00+0000',
        },
        {
          id: 'mid.2',
          message: 'سلام! لیست قیمت خدمت شما',
          from: { id: IG_USER_ID, username: 'brand' },
          created_time: '2026-07-11T10:05:00+0000',
        },
      ],
    },
    ...overrides,
  }
}

describe('instagram DM history backfill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbMock.$transaction.mockImplementation(async (callback: (tx: typeof dbMock) => unknown) =>
      callback(dbMock)
    )
    dbMock.platform.findUnique.mockResolvedValue(basePlatform)
    dbMock.inboxThread.findUnique.mockResolvedValue(null)
    dbMock.inboxThread.upsert.mockResolvedValue({ id: 'thr_1' })
    dbMock.inboxThread.update.mockResolvedValue({})
    dbMock.inboxThreadMessage.createMany.mockResolvedValue({ count: 2 })
  })

  it('creates a thread per conversation using the webhook dm:{igsid} convention', async () => {
    const stats = await backfillInstagramConversations('plat_1', {
      fetchConversations: vi.fn().mockResolvedValue([makeConversation()]),
    })

    expect(stats.conversations).toBe(1)
    expect(stats.messagesCreated).toBe(2)
    const upsertArg = dbMock.inboxThread.upsert.mock.calls[0][0] as {
      where: { platformId_providerThreadId: { providerThreadId: string } }
      create: Record<string, unknown>
    }
    expect(upsertArg.where.platformId_providerThreadId.providerThreadId).toBe('dm:igsid_customer')
    expect(upsertArg.create).toMatchObject({
      providerUserId: 'igsid_customer',
      messageType: 'dm',
      title: 'reza',
    })
    // History stays read: no unreadCount seeded.
    expect(upsertArg.create.unreadCount).toBeUndefined()
    // lastInboundAt reflects the customer's newest message, not the brand's.
    expect((upsertArg.create.lastInboundAt as Date).toISOString()).toBe(
      '2026-07-11T10:00:00.000Z'
    )
  })

  it('marks direction by sender: customer=inbound, brand=outbound', async () => {
    await backfillInstagramConversations('plat_1', {
      fetchConversations: vi.fn().mockResolvedValue([makeConversation()]),
    })

    const directions = (
      dbMock.inboxThreadMessage.createMany.mock.calls[0][0] as {
        data: Array<{ providerMessageId: string; direction: string }>
      }
    ).data
    expect(directions).toContainEqual(
      expect.objectContaining({ providerMessageId: 'mid.1', direction: 'inbound' })
    )
    expect(directions).toContainEqual(
      expect.objectContaining({ providerMessageId: 'mid.2', direction: 'outbound' })
    )
  })

  it('skips duplicate messages already ingested by webhooks (P2002)', async () => {
    dbMock.inboxThreadMessage.createMany.mockResolvedValueOnce({ count: 1 })

    const stats = await backfillInstagramConversations('plat_1', {
      fetchConversations: vi.fn().mockResolvedValue([makeConversation()]),
    })

    expect(stats.messagesCreated).toBe(1)
    expect(stats.errors).toBe(0)
  })

  it('is a no-op for platforms without token or wrong type', async () => {
    dbMock.platform.findUnique.mockResolvedValue({ ...basePlatform, tokenSecret: null })

    const fetchConversations = vi.fn()
    const stats = await backfillInstagramConversations('plat_1', { fetchConversations })

    expect(fetchConversations).not.toHaveBeenCalled()
    expect(stats.conversations).toBe(0)
  })

  it('survives a Graph fetch failure without throwing', async () => {
    const stats = await backfillInstagramConversations('plat_1', {
      fetchConversations: vi.fn().mockRejectedValue(new Error('IG 403')),
    })

    expect(stats.errors).toBe(1)
    expect(dbMock.inboxThread.upsert).not.toHaveBeenCalled()
  })

  it('keeps existing thread timestamps monotonic while importing older history', async () => {
    dbMock.inboxThread.findUnique.mockResolvedValue({
      id: 'thr_1',
      lastMessageAt: new Date('2026-07-12T12:00:00.000Z'),
      lastInboundAt: new Date('2026-07-12T11:00:00.000Z'),
      slaStartedAt: new Date('2026-07-12T11:00:00.000Z'),
      firstResponseAt: null,
    })

    await backfillInstagramConversations('plat_1', {
      fetchConversations: vi.fn().mockResolvedValue([makeConversation()]),
    })

    expect(dbMock.inboxThread.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastMessageAt: new Date('2026-07-12T12:00:00.000Z'),
          lastInboundAt: new Date('2026-07-12T11:00:00.000Z'),
        }),
      })
    )
  })
})
