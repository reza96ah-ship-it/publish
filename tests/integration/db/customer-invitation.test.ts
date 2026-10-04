import { describe, expect, it } from 'vitest'

const SKIP = !process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')

describe.skipIf(SKIP)('customer invitation — PostgreSQL integration', () => {
  it('creates an isolated workspace, rolls back a failed claim, and accepts the token once', async () => {
    const { db } = await import('@/lib/db')
    const { acceptCustomerInvitation, issueCustomerInvitation } =
      await import('@/lib/customer-invitations')
    const { cleanupTestUser, cleanupTestWorkspace, createTestWorkspace, testId } =
      await import('../helpers')
    const owner = await createTestWorkspace()
    const customerEmail = `${testId('customer')}@nashrino.test`
    let customerWorkspaceId: string | undefined
    let conflictingUserId: string | undefined
    let customerUserId: string | undefined

    try {
      const issued = await issueCustomerInvitation({
        ownerId: owner.userId,
        email: customerEmail.toUpperCase(),
        workspaceName: 'Customer test workspace',
      })
      customerWorkspaceId = issued.workspaceId
      expect(issued.email).toBe(customerEmail)

      const invitation = await db.workspaceInvitation.findFirstOrThrow({
        where: { workspaceId: issued.workspaceId },
      })
      expect(invitation.tokenHash).not.toBe(issued.token)
      expect(invitation.role).toBe('admin')
      expect(await db.workspaceMember.count({ where: { workspaceId: issued.workspaceId } })).toBe(0)

      // A user can register after the invite is issued. The unique-email failure
      // must roll back the token claim, leaving the invitation usable.
      const conflictingUser = await db.user.create({
        data: { email: customerEmail, name: 'Conflicting user', passwordHash: 'test-only' },
      })
      conflictingUserId = conflictingUser.id
      await expect(
        acceptCustomerInvitation({
          token: issued.token,
          email: customerEmail,
          name: 'Customer',
          password: 'Valid-test-password-123!',
        })
      ).rejects.toMatchObject({ status: 409 })

      expect(
        await db.workspaceInvitation.findUnique({ where: { id: invitation.id } })
      ).toMatchObject({ acceptedAt: null, acceptedById: null })
      expect(await db.workspaceMember.count({ where: { workspaceId: issued.workspaceId } })).toBe(0)

      await cleanupTestUser(conflictingUserId)
      conflictingUserId = undefined

      const accepted = await acceptCustomerInvitation({
        token: issued.token,
        email: customerEmail.toUpperCase(),
        name: 'Customer',
        password: 'Valid-test-password-123!',
      })
      expect(accepted).toEqual({ email: customerEmail, workspaceId: issued.workspaceId })

      const customerUser = await db.user.findUniqueOrThrow({ where: { email: customerEmail } })
      customerUserId = customerUser.id
      const memberships = await db.workspaceMember.findMany({ where: { userId: customerUser.id } })
      expect(memberships).toMatchObject([
        {
          workspaceId: issued.workspaceId,
          role: 'admin',
        },
      ])
      expect(
        await db.workspaceMember.count({
          where: { workspaceId: issued.workspaceId, userId: owner.userId },
        })
      ).toBe(0)
      expect(
        await db.workspaceInvitation.findUnique({ where: { id: invitation.id } })
      ).toMatchObject({ acceptedById: customerUser.id, revokedAt: null })

      await expect(
        acceptCustomerInvitation({
          token: issued.token,
          email: customerEmail,
          name: 'Replay',
          password: 'Valid-test-password-123!',
        })
      ).rejects.toMatchObject({ status: 400 })
      expect(await db.workspaceMember.count({ where: { workspaceId: issued.workspaceId } })).toBe(1)
    } finally {
      if (customerWorkspaceId) await cleanupTestWorkspace(customerWorkspaceId)
      if (customerUserId) await cleanupTestUser(customerUserId)
      if (conflictingUserId) await cleanupTestUser(conflictingUserId)
      await cleanupTestWorkspace(owner.workspaceId)
      await cleanupTestUser(owner.userId)
    }
  })
})
