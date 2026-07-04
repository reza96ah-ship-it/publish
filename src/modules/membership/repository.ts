/**
 * Issue #156: Membership domain module — repository layer.
 *
 * Data access only — no business logic. Wraps Prisma calls so the service
 * layer can be unit-tested with a mock repository.
 *
 * Token hashing/generation lives in src/lib/invitations (infrastructure), not
 * here — the repository only persists hashes.
 */

import { db } from '@/lib/db'
import type {
  InvitationRole,
  MemberRow,
  InvitationRow,
} from './types'

type TxClient = Parameters<Parameters<typeof db.$transaction>[0]>[0]

function toMemberRow(m: NonNullable<Awaited<ReturnType<typeof db.workspaceMember.findFirst>>>): MemberRow {
  return {
    id: m.id,
    workspaceId: m.workspaceId,
    userId: m.userId,
    name: m.name,
    email: m.email,
    role: m.role,
    avatarUrl: m.avatarUrl,
  }
}

export class MembershipRepository {
  /** Find an active membership by workspace + email (used to reject duplicate invites). */
  async findMemberByEmail(
    workspaceId: string,
    email: string
  ): Promise<{ id: string } | null> {
    return db.workspaceMember.findFirst({
      where: { workspaceId, email },
      select: { id: true },
    })
  }

  /** Find an invitation by (workspaceId, emailNormalized) — the unique key. */
  async findInvitationByWorkspaceEmail(
    workspaceId: string,
    emailNormalized: string
  ): Promise<InvitationRow | null> {
    const inv = await db.workspaceInvitation.findUnique({
      where: { workspaceId_emailNormalized: { workspaceId, emailNormalized } },
    })
    if (!inv) return null
    return {
      id: inv.id,
      workspaceId: inv.workspaceId,
      emailNormalized: inv.emailNormalized,
      role: inv.role as InvitationRole,
      tokenHash: inv.tokenHash,
      invitedById: inv.invitedById,
      acceptedAt: inv.acceptedAt,
      acceptedById: inv.acceptedById,
      revokedAt: inv.revokedAt,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
    }
  }

  /** Find an invitation by its token hash (accept flow), including workspace name. */
  async findInvitationByTokenHash(
    tokenHash: string
  ): Promise<InvitationRow | null> {
    const inv = await db.workspaceInvitation.findUnique({
      where: { tokenHash },
      include: { workspace: { select: { id: true, name: true } } },
    })
    if (!inv) return null
    return {
      id: inv.id,
      workspaceId: inv.workspaceId,
      emailNormalized: inv.emailNormalized,
      role: inv.role as InvitationRole,
      tokenHash: inv.tokenHash,
      invitedById: inv.invitedById,
      acceptedAt: inv.acceptedAt,
      acceptedById: inv.acceptedById,
      revokedAt: inv.revokedAt,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
      workspace: (inv as { workspace?: { id: string; name: string } }).workspace,
    }
  }

  /** Find an invitation by id, scoped to a workspace (revoke flow). */
  async findInvitationByIdInWorkspace(
    id: string,
    workspaceId: string
  ): Promise<InvitationRow | null> {
    const inv = await db.workspaceInvitation.findFirst({
      where: { id, workspaceId },
    })
    if (!inv) return null
    return {
      id: inv.id,
      workspaceId: inv.workspaceId,
      emailNormalized: inv.emailNormalized,
      role: inv.role as InvitationRole,
      tokenHash: inv.tokenHash,
      invitedById: inv.invitedById,
      acceptedAt: inv.acceptedAt,
      acceptedById: inv.acceptedById,
      revokedAt: inv.revokedAt,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
    }
  }

  /** List invitations for a workspace. NEVER selects tokenHash. */
  async listInvitations(
    workspaceId: string
  ): Promise<InvitationRow[]> {
    // NEVER select tokenHash — it must never appear in API responses.
    const rows = await db.workspaceInvitation.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        emailNormalized: true,
        role: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        createdAt: true,
        workspaceId: true,
        invitedById: true,
        acceptedById: true,
      },
    })
    // Map to InvitationRow shape; tokenHash is intentionally left as an empty
    // string since it is never selected and never used by the service.
    return rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspaceId,
      emailNormalized: r.emailNormalized,
      role: r.role as InvitationRole,
      tokenHash: '', // intentionally blank — never surfaced
      invitedById: r.invitedById,
      acceptedAt: r.acceptedAt,
      acceptedById: r.acceptedById,
      revokedAt: r.revokedAt,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
    }))
  }

  /** Resend: replace token + expiry on an existing pending invitation. */
  async resetInvitationToken(
    id: string,
    tokenHash: string,
    expiresAt: Date,
    role: InvitationRole
  ): Promise<void> {
    await db.workspaceInvitation.update({
      where: { id },
      data: { tokenHash, expiresAt, role, revokedAt: null },
    })
  }

  /** Create a new invitation. Throws Prisma P2002 on concurrent duplicate. */
  async createInvitation(input: {
    workspaceId: string
    emailNormalized: string
    role: InvitationRole
    tokenHash: string
    invitedById: string
    expiresAt: Date
  }): Promise<void> {
    await db.workspaceInvitation.create({
      data: {
        workspaceId: input.workspaceId,
        emailNormalized: input.emailNormalized,
        role: input.role,
        tokenHash: input.tokenHash,
        invitedById: input.invitedById,
        expiresAt: input.expiresAt,
      },
    })
  }

  /** Atomic accept: upsert WorkspaceMember + mark invitation accepted + revoke competitors. */
  async acceptInvitationTx(
    invitation: InvitationRow,
    userId: string,
    fallbackName: string
  ): Promise<{ alreadyMember: boolean }> {
    return db.$transaction(async (tx: TxClient) => {
      // Check if already a member (idempotent — could have accepted concurrently)
      const existingMember = await tx.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: invitation.workspaceId,
            userId,
          },
        },
      })

      if (existingMember) {
        // Re-read invitation inside tx to get current acceptedAt (not stale)
        const currentInv = await tx.workspaceInvitation.findUnique({
          where: { id: invitation.id },
        })
        if (!currentInv?.acceptedAt) {
          await tx.workspaceInvitation.update({
            where: { id: invitation.id },
            data: { acceptedAt: new Date(), acceptedById: userId },
          })
        }
        return { alreadyMember: true }
      }

      // Upsert: a concurrent double-submit (two tabs, client retry) is idempotent
      await tx.workspaceMember.upsert({
        where: {
          workspaceId_userId: { workspaceId: invitation.workspaceId, userId },
        },
        create: {
          workspaceId: invitation.workspaceId,
          userId,
          name: fallbackName,
          email: invitation.emailNormalized,
          role: invitation.role,
        },
        update: {},
      })

      // Mark invitation as accepted
      await tx.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date(), acceptedById: userId },
      })

      // Invalidate competing invitations for the same email in this workspace
      await tx.workspaceInvitation.updateMany({
        where: {
          workspaceId: invitation.workspaceId,
          emailNormalized: invitation.emailNormalized,
          id: { not: invitation.id },
          acceptedAt: null,
        },
        data: { revokedAt: new Date() },
      })

      return { alreadyMember: false }
    })
  }

  /** Revoke: set revokedAt on the invitation. */
  async revokeInvitation(id: string): Promise<void> {
    await db.workspaceInvitation.update({
      where: { id },
      data: { revokedAt: new Date() },
    })
  }

  /** Cursor-paginated list of workspace members. */
  async listMembers(
    workspaceId: string,
    query: { cursor?: string; limit: number }
  ): Promise<MemberRow[]> {
    const rows = await db.workspaceMember.findMany({
      where: {
        workspaceId,
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
      },
      orderBy: { id: 'desc' },
      take: query.limit + 1,
    })
    return rows.map(toMemberRow)
  }

  /** Find a member by id, scoped to a workspace. */
  async findMemberByIdInWorkspace(
    id: string,
    workspaceId: string
  ): Promise<MemberRow | null> {
    const m = await db.workspaceMember.findFirst({ where: { id, workspaceId } })
    return m ? toMemberRow(m) : null
  }

  /** Count admins in a workspace (used to prevent last-admin demotion/removal). */
  async countAdmins(workspaceId: string): Promise<number> {
    return db.workspaceMember.count({
      where: { workspaceId, role: 'admin' },
    })
  }

  /** Patch a member's role. */
  async updateMemberRole(
    id: string,
    role: InvitationRole
  ): Promise<MemberRow> {
    const m = await db.workspaceMember.update({
      where: { id },
      data: { role },
    })
    return toMemberRow(m)
  }

  /** Delete a member. */
  async deleteMember(id: string): Promise<void> {
    await db.workspaceMember.delete({ where: { id } })
  }

  /** Write a notification (post-transaction, fire-and-forget). */
  async createNotification(
    workspaceId: string,
    type: string,
    title: string,
    body?: string
  ): Promise<void> {
    await db.notification.create({
      data: { workspaceId, type, title, body, isRead: false },
    })
  }

  /** Write an audit log entry (best-effort, non-fatal on failure). */
  async writeAudit(input: {
    userId: string
    workspaceId: string
    action: string
    resource: string
    metadata: Record<string, unknown>
  }): Promise<void> {
    try {
      await db.auditLog.create({
        data: {
          userId: input.userId,
          workspaceId: input.workspaceId,
          action: input.action,
          resource: input.resource,
          metadata: JSON.stringify(input.metadata),
        },
      })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[membership] audit log write failed (non-fatal):', err)
    }
  }
}
