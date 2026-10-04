import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { cleanupTestUser, cleanupTestWorkspace, createTestWorkspace } from '../helpers'

const SKIP = !process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')

describe.skipIf(SKIP)('compose draft PostgreSQL version check', () => {
  beforeAll(async () => {
    await db.$connect()
  })
  afterAll(async () => {
    await db.$disconnect()
  })

  it('allows exactly one of two simultaneous saves from the same version', async () => {
    const workspace = await createTestWorkspace()
    try {
      const key = { workspaceId: workspace.workspaceId, authorId: workspace.userId }
      await db.contentDraft.create({ data: { ...key, content: { caption: 'base' }, version: 1 } })

      const results = await Promise.allSettled(
        ['first', 'second'].map((caption) =>
          db.contentDraft.update({
            where: { workspaceId_authorId: key, version: 1 },
            data: { content: { caption }, version: { increment: 1 } },
          })
        )
      )

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
      const rejected = results.find((result) => result.status === 'rejected')
      expect(rejected).toMatchObject({ reason: { code: 'P2025' } })
      const saved = await db.contentDraft.findUniqueOrThrow({
        where: { workspaceId_authorId: key },
      })
      expect(saved.version).toBe(2)
      expect(['first', 'second']).toContain((saved.content as { caption: string }).caption)
    } finally {
      await cleanupTestWorkspace(workspace.workspaceId)
      await cleanupTestUser(workspace.userId)
    }
  })
})
