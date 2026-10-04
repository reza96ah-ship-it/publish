import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { cleanupTestUser, cleanupTestWorkspace, createTestPlatform, createTestWorkspace, testId } from '../helpers'

const SKIP = !process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')

describe.skipIf(SKIP)('comment-to-DM PostgreSQL send claims', () => {
  beforeAll(async () => { await db.$connect() })
  afterAll(async () => { await db.$disconnect() })

  it('permits legacy/skipped rows but blocks another rule for one comment or commenter/post', async () => {
    const workspace = await createTestWorkspace()
    try {
      const { platformId } = await createTestPlatform(workspace.workspaceId, 'instagram')
      const commentId = testId('comment')
      const postId = testId('post')
      const senderUserId = testId('sender')

      await db.commentDmLog.create({ data: {
        workspaceId: workspace.workspaceId, ruleId: 'old-rule', commentId,
        postId, senderUserId, status: 'skipped',
      } })
      await db.commentDmLog.create({ data: {
        workspaceId: workspace.workspaceId, ruleId: 'winning-rule', commentId,
        postId, senderUserId, claimPlatformId: platformId, status: 'pending',
      } })

      await expect(db.commentDmLog.create({ data: {
        workspaceId: workspace.workspaceId, ruleId: 'other-rule', commentId,
        postId, senderUserId: testId('sender'), claimPlatformId: platformId, status: 'pending',
      } })).rejects.toMatchObject({ code: 'P2002' })

      await expect(db.commentDmLog.create({ data: {
        workspaceId: workspace.workspaceId, ruleId: 'other-rule', commentId: testId('comment'),
        postId, senderUserId, claimPlatformId: platformId, status: 'pending',
      } })).rejects.toMatchObject({ code: 'P2002' })

      await db.commentDmLog.create({ data: {
        workspaceId: workspace.workspaceId, ruleId: 'other-rule', commentId: testId('comment'),
        postId, senderUserId: testId('sender'), claimPlatformId: platformId, status: 'pending',
      } })
    } finally {
      await cleanupTestWorkspace(workspace.workspaceId)
      await cleanupTestUser(workspace.userId)
    }
  })

  it('lets exactly one of two concurrent rules claim the same comment', async () => {
    const workspace = await createTestWorkspace()
    try {
      const { platformId } = await createTestPlatform(workspace.workspaceId, 'instagram')
      const commentId = testId('comment')
      const postId = testId('post')
      const senderUserId = testId('sender')
      const results = await Promise.allSettled(['rule-a', 'rule-b'].map((ruleId) =>
        db.commentDmLog.create({ data: {
          workspaceId: workspace.workspaceId, ruleId, commentId, postId,
          senderUserId, claimPlatformId: platformId, status: 'pending',
        } })))
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
      expect(await db.commentDmLog.count({ where: {
        claimPlatformId: platformId, commentId, status: 'pending',
      } })).toBe(1)
    } finally {
      await cleanupTestWorkspace(workspace.workspaceId)
      await cleanupTestUser(workspace.userId)
    }
  })
})
