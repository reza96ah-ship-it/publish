import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { db } from '@/lib/db'
import {
  getPrivateCommentReplyState, sendPrivateCommentReply,
} from '@/modules/inbox/private-comment-reply'
import {
  cleanupTestUser, cleanupTestWorkspace, createTestPlatform, createTestWorkspace, testId,
} from '../helpers'

const SKIP = !process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')
const DAY = 24 * 60 * 60 * 1000

describe.skipIf(SKIP)('private Instagram comment reply — PostgreSQL', () => {
  beforeAll(async () => { await db.$connect() })
  afterAll(async () => { await db.$disconnect() })

  async function fixture(commentAgeMs = 60_000) {
    const owner = await createTestWorkspace()
    const { platformId } = await createTestPlatform(owner.workspaceId, 'instagram')
    const accountId = randomBytes(12).toString('hex')
    await db.platform.update({ where: { id: platformId }, data: {
      provider: 'zernio', providerAccountId: accountId,
    } })
    const commentId = testId('comment')
    const postId = testId('post')
    const now = new Date()
    const thread = await db.inboxThread.create({ data: {
      workspaceId: owner.workspaceId, platformId,
      providerThreadId: `comment:${commentId}`, messageType: 'comment',
      tags: ['unanswered'],
    } })
    await db.inboxThreadMessage.create({ data: {
      workspaceId: owner.workspaceId, platformId, threadId: thread.id,
      providerMessageId: `comment:${commentId}`, direction: 'inbound',
      messageType: 'comment', senderExternalId: testId('sender'),
      senderName: 'Customer', body: 'Hello', payload: { postId },
      createdAt: new Date(now.getTime() - commentAgeMs), ingestedAt: now,
    } })
    return { owner, platformId, accountId, commentId, postId, threadId: thread.id, now }
  }

  it('sends a distinct private DM once and records the claim, timeline and response', async () => {
    const f = await fixture()
    try {
      const auth = { workspaceId: f.owner.workspaceId, userId: f.owner.userId }
      expect((await getPrivateCommentReplyState(f.owner.workspaceId, f.threadId)).available).toBe(true)
      const send = vi.fn(async () => 'provider-dm-1')
      await expect(sendPrivateCommentReply(auth, f.threadId, ' Hi privately ', send))
        .resolves.toEqual({ status: 'sent', providerMessageId: 'provider-dm-1' })
      expect(send).toHaveBeenCalledTimes(1)
      expect(send).toHaveBeenCalledWith(f.accountId, f.postId, f.commentId, 'Hi privately')
      const claim = await db.commentDmLog.findFirstOrThrow({ where: {
        claimPlatformId: f.platformId, commentId: f.commentId,
      } })
      expect(claim.status).toBe('sent')
      expect(claim.providerMessageId).toBe('provider-dm-1')
      const outbound = await db.inboxThreadMessage.findUniqueOrThrow({ where: {
        platformId_providerMessageId: { platformId: f.platformId, providerMessageId: 'private:provider-dm-1' },
      } })
      expect(outbound.messageType).toBe('dm')
      expect(outbound.direction).toBe('outbound')
      expect(outbound.payload).toMatchObject({ replyKind: 'private_comment_reply' })
      const thread = await db.inboxThread.findUniqueOrThrow({ where: { id: f.threadId } })
      expect(thread.firstResponseAt).not.toBeNull()
      expect(thread.tags).not.toContain('unanswered')
      expect(await getPrivateCommentReplyState(f.owner.workspaceId, f.threadId))
        .toMatchObject({ available: false, reason: 'already_attempted', status: 'sent' })
      await expect(sendPrivateCommentReply(auth, f.threadId, 'Again', send))
        .rejects.toMatchObject({ code: 'already_attempted' })
      expect(send).toHaveBeenCalledTimes(1)
    } finally {
      await cleanupTestWorkspace(f.owner.workspaceId)
      await cleanupTestUser(f.owner.userId)
    }
  })

  it('only allows one of two simultaneous sends to reach the provider', async () => {
    const f = await fixture()
    try {
      const auth = { workspaceId: f.owner.workspaceId, userId: f.owner.userId }
      const send = vi.fn(async () => 'provider-dm-2')
      const results = await Promise.allSettled([
        sendPrivateCommentReply(auth, f.threadId, 'First', send),
        sendPrivateCommentReply(auth, f.threadId, 'Second', send),
      ])
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1)
      expect(send).toHaveBeenCalledTimes(1)
    } finally {
      await cleanupTestWorkspace(f.owner.workspaceId)
      await cleanupTestUser(f.owner.userId)
    }
  })

  it('does not call the provider outside the seven-day window', async () => {
    const f = await fixture(7 * DAY + 60_000)
    try {
      const send = vi.fn(async () => 'never')
      await expect(sendPrivateCommentReply(
        { workspaceId: f.owner.workspaceId, userId: f.owner.userId }, f.threadId, 'Too late', send,
      )).rejects.toMatchObject({ code: 'window_closed' })
      expect(send).not.toHaveBeenCalled()
    } finally {
      await cleanupTestWorkspace(f.owner.workspaceId)
      await cleanupTestUser(f.owner.userId)
    }
  })

  it('holds an uncertain outcome instead of retrying a potentially accepted DM', async () => {
    const f = await fixture()
    try {
      const auth = { workspaceId: f.owner.workspaceId, userId: f.owner.userId }
      const send = vi.fn(async (): Promise<string | null> => { throw new Error('network timeout') })
      await expect(sendPrivateCommentReply(auth, f.threadId, 'Maybe sent', send))
        .rejects.toMatchObject({ code: 'outcome_unknown' })
      expect(await getPrivateCommentReplyState(f.owner.workspaceId, f.threadId))
        .toMatchObject({ available: false, reason: 'already_attempted', status: 'unknown' })
      await expect(sendPrivateCommentReply(auth, f.threadId, 'Retry', send))
        .rejects.toMatchObject({ code: 'already_attempted' })
      expect(send).toHaveBeenCalledTimes(1)
    } finally {
      await cleanupTestWorkspace(f.owner.workspaceId)
      await cleanupTestUser(f.owner.userId)
    }
  })

  it('does not expose another workspace’s comment thread', async () => {
    const f = await fixture()
    const other = await createTestWorkspace()
    try {
      const send = vi.fn(async () => 'never')
      await expect(sendPrivateCommentReply(
        { workspaceId: other.workspaceId, userId: other.userId }, f.threadId, 'Cross-tenant', send,
      )).rejects.toMatchObject({ code: 'not_found' })
      expect(send).not.toHaveBeenCalled()
    } finally {
      await cleanupTestWorkspace(f.owner.workspaceId)
      await cleanupTestUser(f.owner.userId)
      await cleanupTestWorkspace(other.workspaceId)
      await cleanupTestUser(other.userId)
    }
  })
})
