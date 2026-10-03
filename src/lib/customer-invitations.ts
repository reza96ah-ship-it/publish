import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { generateInvitationToken, hashToken, isInvitationValid, normalizeEmail } from '@/lib/invitations'
import { hashPassword } from '@/lib/password'

export class CustomerInvitationError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

const INVALID = 'دعوت‌نامه نامعتبر یا منقضی شده است'

export async function issueCustomerInvitation(input: {
  ownerId: string
  email: string
  workspaceName: string
}) {
  const email = normalizeEmail(input.email)
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new CustomerInvitationError('این ایمیل قبلاً حساب دارد؛ از دعوت اعضای فضای کاری استفاده کنید', 409)
  }

  const token = generateInvitationToken()
  const workspace = await db.$transaction(async (tx) => {
    const created = await tx.workspace.create({
      data: {
        name: input.workspaceName,
        slug: `customer-${randomBytes(12).toString('hex')}`,
        invitations: {
          create: {
            emailNormalized: email,
            role: 'admin',
            tokenHash: token.hash,
            expiresAt: token.expiresAt,
            invitedById: input.ownerId,
          },
        },
      },
      select: { id: true },
    })
    await tx.auditLog.create({
      data: {
        userId: input.ownerId,
        workspaceId: created.id,
        action: 'customer_invitation.created',
        resource: 'WorkspaceInvitation',
        metadata: { email },
      },
    })
    return created
  })
  return { workspaceId: workspace.id, email, token: token.plaintext, expiresAt: token.expiresAt }
}

export async function listCustomerInvitations(ownerId: string) {
  return db.workspaceInvitation.findMany({
    where: {
      invitedById: ownerId,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      workspace: { members: { none: {} } },
    },
    select: {
      id: true,
      emailNormalized: true,
      expiresAt: true,
      workspace: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

export async function revokeCustomerInvitation(ownerId: string, invitationId: string) {
  const revoked = await db.$transaction(async (tx) => {
    const result = await tx.workspaceInvitation.updateMany({
      where: {
        id: invitationId,
        invitedById: ownerId,
        acceptedAt: null,
        revokedAt: null,
        workspace: { members: { none: {} } },
      },
      data: { revokedAt: new Date() },
    })
    if (result.count !== 1) throw new CustomerInvitationError('دعوت‌نامه فعال پیدا نشد', 404)
    const invitation = await tx.workspaceInvitation.findUnique({
      where: { id: invitationId },
      select: { workspaceId: true },
    })
    await tx.auditLog.create({
      data: {
        userId: ownerId,
        workspaceId: invitation?.workspaceId,
        action: 'customer_invitation.revoked',
        resource: 'WorkspaceInvitation',
        metadata: { invitationId },
      },
    })
    return true
  })
  return revoked
}

export async function acceptCustomerInvitation(input: {
  token: string
  email: string
  name: string
  password: string
}) {
  const tokenHash = hashToken(input.token)
  const email = normalizeEmail(input.email)
  const invitation = await db.workspaceInvitation.findUnique({
    where: { tokenHash },
    select: {
      id: true, workspaceId: true, emailNormalized: true, role: true,
      acceptedAt: true, revokedAt: true, expiresAt: true,
      workspace: { select: { members: { select: { id: true }, take: 1 } } },
    },
  })
  if (!invitation || !isInvitationValid(invitation) || invitation.emailNormalized !== email ||
      invitation.role !== 'admin' || invitation.workspace.members.length !== 0) {
    throw new CustomerInvitationError(INVALID, 400)
  }

  // Hash before acquiring the invitation row lock. The transaction below claims
  // the token first; a concurrent replay then observes count=0 and rolls back.
  const passwordHash = await hashPassword(input.password)
  try {
    const user = await db.$transaction(async (tx) => {
      const claimed = await tx.workspaceInvitation.updateMany({
        where: {
          id: invitation.id,
          tokenHash,
          emailNormalized: email,
          role: 'admin',
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          workspace: { members: { none: {} } },
        },
        data: { acceptedAt: new Date() },
      })
      if (claimed.count !== 1) throw new CustomerInvitationError(INVALID, 400)

      const created = await tx.user.create({
        data: { email, name: input.name, passwordHash },
        select: { id: true, email: true },
      })
      await tx.workspaceMember.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId: created.id,
          email,
          name: input.name,
          role: 'admin',
        },
      })
      await tx.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { acceptedById: created.id },
      })
      await tx.auditLog.create({
        data: {
          userId: created.id,
          workspaceId: invitation.workspaceId,
          action: 'customer_invitation.accepted',
          resource: 'WorkspaceInvitation',
          metadata: { invitationId: invitation.id },
        },
      })
      return created
    })
    return { email: user.email, workspaceId: invitation.workspaceId }
  } catch (error) {
    if (error instanceof CustomerInvitationError) throw error
    if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') {
      throw new CustomerInvitationError('این ایمیل قبلاً حساب دارد؛ وارد شوید', 409)
    }
    throw error
  }
}
