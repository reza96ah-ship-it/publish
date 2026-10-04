import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  updateMany: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    inboxReplyAttempt: {
      findUnique: mocks.findUnique,
      findFirst: mocks.findFirst,
      create: mocks.create,
      updateMany: mocks.updateMany,
    },
    $transaction: mocks.transaction,
  },
}))

import {
  beginZernioReplyAttempt,
  completeZernioReplyAttempt,
  markZernioReplyAttempt,
  resolveZernioReplyAttempt,
} from '@/modules/inbox/zernio-reply-attempt'

const KEY = '7b8e1250-4205-4c6e-9270-cba566e716cb'
const pending = {
  id: 'attempt-1', workspaceId: 'ws-1', threadId: 'thread-1', activeThreadId: 'thread-1', idempotencyKey: KEY,
  replyHash: '5782b18687e6cf8a482fc32d2db5b196d8821c458a0c069c6acf3953446e7bb5', // sha256("reply")
  status: 'pending', providerMessageId: null, threadMessageId: null,
  createdAt: new Date(Date.now() - 60_000), updatedAt: new Date(Date.now() - 60_000),
}

describe('Zernio reply attempt ledger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findUnique.mockResolvedValue(null)
    mocks.findFirst.mockResolvedValue(null)
    mocks.create.mockResolvedValue({ id: 'attempt-1' })
    mocks.updateMany.mockResolvedValue({ count: 1 })
  })

  it('reserves a new send with a stable key', async () => {
    await expect(beginZernioReplyAttempt('ws-1', 'thread-1', KEY, 'reply'))
      .resolves.toEqual({ kind: 'send', id: 'attempt-1' })
    expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      workspaceId: 'ws-1', threadId: 'thread-1', idempotencyKey: KEY,
    }) })
  })

  it('returns the previous success without another provider send', async () => {
    mocks.findUnique.mockResolvedValue({ ...pending, status: 'sent', threadMessageId: 'out-1' })
    await expect(beginZernioReplyAttempt('ws-1', 'thread-1', KEY, 'reply'))
      .resolves.toEqual({ kind: 'sent', threadMessageId: 'out-1' })
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('does not blindly retry an uncertain provider outcome', async () => {
    mocks.findUnique.mockResolvedValue({ ...pending, status: 'unknown' })
    await expect(beginZernioReplyAttempt('ws-1', 'thread-1', KEY, 'reply'))
      .rejects.toMatchObject({ code: 'reply_outcome_unknown' })
    expect(mocks.updateMany).not.toHaveBeenCalled()
  })

  it('blocks a different key while a prior send is unresolved', async () => {
    mocks.findFirst.mockResolvedValue(pending)
    await expect(beginZernioReplyAttempt('ws-1', 'thread-1', crypto.randomUUID(), 'reply'))
      .rejects.toMatchObject({ code: 'reply_previous_unresolved' })
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('rejects a reused key with a different body or tenant', async () => {
    mocks.findUnique.mockResolvedValue(pending)
    await expect(beginZernioReplyAttempt('ws-2', 'thread-1', KEY, 'reply'))
      .rejects.toMatchObject({ code: 'reply_key_conflict' })
  })

  it('converts a stale in-flight attempt to unknown rather than resending', async () => {
    mocks.findUnique.mockResolvedValue(pending)
    await expect(beginZernioReplyAttempt('ws-1', 'thread-1', KEY, 'reply'))
      .rejects.toMatchObject({ code: 'reply_outcome_unknown' })
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'unknown' } }))
  })

  it('records a provider receipt and local thread message in one transaction', async () => {
    const tx = {
      inboxThreadMessage: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ id: 'out-1', threadId: 'thread-1' }),
      },
      inboxThread: {
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      inboxReplyAttempt: { update: vi.fn().mockResolvedValue({}) },
    }
    mocks.transaction.mockImplementation((fn: (value: typeof tx) => Promise<string>) => fn(tx))
    await expect(completeZernioReplyAttempt({
      attemptId: 'attempt-1', threadId: 'thread-1', workspaceId: 'ws-1',
      platformId: 'platform-1', messageType: 'dm', reply: 'reply', providerMessageId: 'mid-1',
    })).resolves.toBe('out-1')
    expect(tx.inboxThreadMessage.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }))
    expect(tx.inboxReplyAttempt.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'sent', threadMessageId: 'out-1' }),
    }))
  })

  it('marks an unknown send without claiming it was delivered', async () => {
    await markZernioReplyAttempt('attempt-1', 'unknown')
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: 'attempt-1', status: 'pending' }, data: { status: 'unknown' },
    })
  })

  it('requires a deliberate admin resolution and audits it atomically', async () => {
    const tx = {
      inboxReplyAttempt: {
        findUnique: vi.fn().mockResolvedValue({ ...pending, status: 'unknown' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    mocks.transaction.mockImplementation((fn: (value: typeof tx) => Promise<void>) => fn(tx))
    await resolveZernioReplyAttempt({
      workspaceId: 'ws-1', threadId: 'thread-1', idempotencyKey: KEY,
      resolution: 'not_sent', userId: 'admin-1',
    })
    expect(tx.inboxReplyAttempt.updateMany).toHaveBeenCalledWith({
      where: { id: 'attempt-1', status: 'unknown' },
      data: { status: 'resolved_not_sent', activeThreadId: null },
    })
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: 'admin-1', action: 'inbox.zernio_reply_manually_resolved',
    }) })
  })

  it('cannot resolve another workspace\'s attempt', async () => {
    const tx = {
      inboxReplyAttempt: {
        findUnique: vi.fn().mockResolvedValue({ ...pending, status: 'unknown' }),
        updateMany: vi.fn(),
      },
      auditLog: { create: vi.fn() },
    }
    mocks.transaction.mockImplementation((fn: (value: typeof tx) => Promise<void>) => fn(tx))
    await expect(resolveZernioReplyAttempt({
      workspaceId: 'ws-2', threadId: 'thread-1', idempotencyKey: KEY,
      resolution: 'not_sent', userId: 'admin-2',
    })).rejects.toMatchObject({ code: 'reply_attempt_not_found' })
    expect(tx.inboxReplyAttempt.updateMany).not.toHaveBeenCalled()
    expect(tx.auditLog.create).not.toHaveBeenCalled()
  })
})
