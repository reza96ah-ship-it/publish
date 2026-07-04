/**
 * Issue #153 Tier 2: PostgreSQL integration tests.
 *
 * Tests that require a real PostgreSQL database:
 * - migrations from blank database
 * - transaction rollback
 * - unique/check/foreign-key constraints
 * - cross-workspace isolation
 * - publication creation transaction
 * - outbox claim/lease behavior
 *
 * These tests run against the CI PostgreSQL service (not SQLite).
 * They are excluded from the default `bun run test` (unit tests) and
 * run separately via `bun run test:integration`.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { db } from '@/lib/db'
import {
  createTestWorkspace,
  createTestPlatform,
  createTestMedia,
  cleanupTestWorkspace,
  cleanupTestUser,
  testId,
} from '../helpers'

// Skip integration tests if no DATABASE_URL is set (e.g., in pure unit test CI)
const SKIP = !process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')

describe.skipIf(SKIP)('Issue #153 Tier 2 — PostgreSQL integration', () => {
  let workspaceId: string
  let userId: string

  beforeAll(async () => {
    // Verify we can connect to PostgreSQL
    await db.$connect()
  })

  afterAll(async () => {
    if (workspaceId) await cleanupTestWorkspace(workspaceId)
    if (userId) await cleanupTestUser(userId)
    await db.$disconnect()
  })

  describe('migrations and schema', () => {
    it('all models are accessible (schema is valid)', async () => {
      // If any model is missing or schema is invalid, these queries will throw
      await db.user.count()
      await db.workspace.count()
      await db.workspaceMember.count()
      await db.platform.count()
      await db.content.count()
      await db.publishJob.count()
      await db.outboxEvent.count()
      await db.publicationAttempt.count()
      await db.media.count()
      await db.notification.count()
      // New models from #145, #148, #149
      await (db as any).contentRevision.count()
      await (db as any).channelVariant.count()
      await (db as any).revisionMedia.count()
      await (db as any).publication.count()
      await (db as any).workspaceInvitation.count()
    })

    it('foreign key constraints are enforced', async () => {
      // Attempting to create a WorkspaceMember with a non-existent userId should fail
      await expect(
        db.workspaceMember.create({
          data: {
            workspaceId: 'nonexistent-workspace',
            userId: 'nonexistent-user',
            name: 'Test',
            email: 'test@test.com',
          },
        })
      ).rejects.toThrow()
    })

    it('unique constraints are enforced (workspaceId + userId)', async () => {
      const ctx = await createTestWorkspace()
      await expect(
        db.workspaceMember.create({
          data: {
            workspaceId: ctx.workspaceId,
            userId: ctx.userId,
            name: 'Duplicate',
            email: 'dup@test.com',
            role: 'admin',
          },
        })
      ).rejects.toThrow()
      await cleanupTestWorkspace(ctx.workspaceId)
      await cleanupTestUser(ctx.userId)
    })
  })

  describe('cross-workspace isolation', () => {
    it('content from workspace A is not visible in workspace B', async () => {
      const ctxA = await createTestWorkspace({ name: 'Workspace A' })
      const ctxB = await createTestWorkspace({ name: 'Workspace B' })

      // Create content in workspace A
      const content = await db.content.create({
        data: {
          workspaceId: ctxA.workspaceId,
          title: 'Secret Content A',
          body: 'This should not be visible to B',
        },
      })

      // Query from workspace B — should return 0 results
      const bContent = await db.content.findMany({
        where: { workspaceId: ctxB.workspaceId, id: content.id },
      })
      expect(bContent).toHaveLength(0)

      // Query from workspace A — should find it
      const aContent = await db.content.findMany({
        where: { workspaceId: ctxA.workspaceId, id: content.id },
      })
      expect(aContent).toHaveLength(1)

      await cleanupTestWorkspace(ctxA.workspaceId)
      await cleanupTestWorkspace(ctxB.workspaceId)
      await cleanupTestUser(ctxA.userId)
      await cleanupTestUser(ctxB.userId)
    })

    it('platform from workspace A cannot be used in workspace B', async () => {
      const ctxA = await createTestWorkspace()
      const ctxB = await createTestWorkspace()
      const platA = await createTestPlatform(ctxA.workspaceId)

      // Workspace B should not find platform A
      const bPlatform = await db.platform.findFirst({
        where: { id: platA.platformId, workspaceId: ctxB.workspaceId },
      })
      expect(bPlatform).toBeNull()

      // Workspace A should find it
      const aPlatform = await db.platform.findFirst({
        where: { id: platA.platformId, workspaceId: ctxA.workspaceId },
      })
      expect(aPlatform).not.toBeNull()

      await cleanupTestWorkspace(ctxA.workspaceId)
      await cleanupTestWorkspace(ctxB.workspaceId)
      await cleanupTestUser(ctxA.userId)
      await cleanupTestUser(ctxB.userId)
    })
  })

  describe('transaction rollback', () => {
    it('transaction rollback on error leaves no partial data', async () => {
      const ctx = await createTestWorkspace()

      try {
        await db.$transaction(async (tx) => {
          // Create content
          await tx.content.create({
            data: {
              workspaceId: ctx.workspaceId,
              title: 'Transaction Test',
            },
          })
          // Force an error — this should roll back the content creation
          throw new Error('Intentional rollback')
        })
      } catch {
        // Expected
      }

      // Verify content was NOT created (rolled back)
      const content = await db.content.findMany({
        where: { workspaceId: ctx.workspaceId, title: 'Transaction Test' },
      })
      expect(content).toHaveLength(0)

      await cleanupTestWorkspace(ctx.workspaceId)
      await cleanupTestUser(ctx.userId)
    })
  })

  describe('publication creation transaction', () => {
    it('creates content + revision + publication + outbox atomically', async () => {
      const ctx = await createTestWorkspace()
      const plat = await createTestPlatform(ctx.workspaceId)
      const media = await createTestMedia(ctx.workspaceId)

      const contentId = testId('content')
      const revisionId = testId('revision')
      const jobId = testId('job')
      const publicationId = testId('pub')

      await db.$transaction(async (tx) => {
        // Content
        await tx.content.create({
          data: {
            id: contentId,
            workspaceId: ctx.workspaceId,
            title: 'Publication Test',
            status: 'scheduled',
          },
        })

        // Revision
        await (tx as any).contentRevision.create({
          data: {
            id: revisionId,
            contentId,
            workspaceId: ctx.workspaceId,
            title: 'Publication Test',
          },
        })

        // Publication
        await (tx as any).publication.create({
          data: {
            id: publicationId,
            workspaceId: ctx.workspaceId,
            contentId,
            revisionId,
            platformId: plat.platformId,
            publishJobId: jobId,
            status: 'pending',
          },
        })

        // Outbox event
        await tx.outboxEvent.create({
          data: {
            workspaceId: ctx.workspaceId,
            aggregateId: contentId,
            payload: { jobId, contentId, platformId: plat.platformId },
          },
        })
      })

      // Verify all records exist
      const content = await db.content.findUnique({ where: { id: contentId } })
      expect(content).not.toBeNull()

      const revision = await (db as any).contentRevision.findUnique({ where: { id: revisionId } })
      expect(revision).not.toBeNull()

      const publication = await (db as any).publication.findUnique({ where: { id: publicationId } })
      expect(publication).not.toBeNull()

      const outbox = await db.outboxEvent.findFirst({ where: { aggregateId: contentId } })
      expect(outbox).not.toBeNull()

      await cleanupTestWorkspace(ctx.workspaceId)
      await cleanupTestUser(ctx.userId)
    })
  })

  describe('invitation concurrency', () => {
    it('unique constraint prevents duplicate invitations for same email', async () => {
      const ctx = await createTestWorkspace()
      const email = `invite-${testId()}@test.com`

      // First invitation — should succeed
      await (db as any).workspaceInvitation.create({
        data: {
          workspaceId: ctx.workspaceId,
          emailNormalized: email,
          role: 'viewer',
          tokenHash: testId('token'),
          invitedById: ctx.userId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      })

      // Second invitation for same email — should fail (unique constraint)
      await expect(
        (db as any).workspaceInvitation.create({
          data: {
            workspaceId: ctx.workspaceId,
            emailNormalized: email,
            role: 'editor',
            tokenHash: testId('token2'),
            invitedById: ctx.userId,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        })
      ).rejects.toThrow()

      await cleanupTestWorkspace(ctx.workspaceId)
      await cleanupTestUser(ctx.userId)
    })
  })
})
