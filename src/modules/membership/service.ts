/**
 * Issue #156: Membership domain module — service layer.
 *
 * Business logic only — no HTTP, no direct Prisma. Uses the repository for
 * data access and src/lib/invitations for token generation/hashing.
 *
 * Orchestrates: duplicate check → token issue → persist hash, or
 * token lookup → validity check → atomic accept → audit log.
 */

import {
  generateInvitationToken,
  hashToken,
  normalizeEmail,
  isInvitationValid,
} from '@/lib/invitations'
import { MembershipRepository } from './repository'
import {
  AlreadyMemberError,
  InvitationAlreadyAcceptedError,
  InvitationConflictError,
  InvitationInvalidError,
  InvitationExpiredError,
  InvitationRevokedError,
  InvitationAcceptMismatchError,
  InvitationNotFoundError,
  CannotRevokeAcceptedInvitationError,
  MemberNotFoundError,
  LastAdminError,
  CannotRemoveLastAdminError,
  CannotRemoveSelfError,
} from './errors'
import type {
  AuthContext,
  AcceptAuthContext,
  InvitationRole,
  CreateInvitationRequest,
  CreateInvitationResult,
  AcceptInvitationRequest,
  AcceptInvitationResult,
  RevokeInvitationRequest,
  RevokeInvitationResult,
  ListInvitationsResult,
  ListMembersResult,
  ChangeRoleRequest,
  ChangeRoleResult,
  RemoveMemberResult,
  ListQuery,
  InvitationListItem,
  MemberListItem,
} from './types'

export class MembershipService {
  constructor(
    private readonly repo: MembershipRepository = new MembershipRepository()
  ) {}

  /**
   * POST /api/members/invite — create (or resend) a workspace invitation.
   *
   * @throws {AlreadyMemberError} — email already has an active membership
   * @throws {InvitationAlreadyAcceptedError} — invitation already accepted
   * @throws {InvitationConflictError} — concurrent duplicate (P2002)
   */
  async createInvitation(
    auth: AuthContext,
    body: CreateInvitationRequest
  ): Promise<CreateInvitationResult> {
    const workspaceId = auth.workspaceId
    const emailNormalized = normalizeEmail(body.email)

    // Reject if the email already has an active membership
    const existingMember = await this.repo.findMemberByEmail(workspaceId, emailNormalized)
    if (existingMember) {
      throw new AlreadyMemberError()
    }

    // Check for an existing active invitation — if found, replace it
    const existingInvitation = await this.repo.findInvitationByWorkspaceEmail(
      workspaceId,
      emailNormalized
    )

    // Generate token (plaintext returned once, hash stored)
    const { plaintext, hash, expiresAt } = generateInvitationToken()

    if (existingInvitation) {
      if (existingInvitation.acceptedAt) {
        throw new InvitationAlreadyAcceptedError()
      }
      // Resend: update the existing invitation with a new token + expiry
      await this.repo.resetInvitationToken(existingInvitation.id, hash, expiresAt, body.role)
    } else {
      // Create new invitation — catch concurrent duplicate (two admins invite same email)
      try {
        await this.repo.createInvitation({
          workspaceId,
          emailNormalized,
          role: body.role,
          tokenHash: hash,
          invitedById: auth.userId,
          expiresAt,
        })
      } catch (err) {
        if (isPrismaUniqueViolation(err)) {
          throw new InvitationConflictError()
        }
        throw err
      }
    }

    // Notify workspace admins (non-fatal)
    await this.repo.createNotification(
      workspaceId,
      'approval_requested',
      'دعوت‌نامه جدید ارسال شد',
      `${body.name || body.email} با نقش ${body.role} دعوت شد`
    )

    return {
      ok: true,
      email: emailNormalized,
      role: body.role,
      expiresAt: expiresAt.toISOString(),
      // Plaintext token returned ONCE — never persisted or logged.
      inviteToken: plaintext,
      message: 'دعوت‌نامه ایجاد شد. لینک دعوت را به کاربر ارسال کنید.',
    }
  }

  /**
   * POST /api/members/invite/accept — accept a workspace invitation.
   *
   * Acceptance is idempotent: if the user already accepted, return success
   * without creating a duplicate membership.
   *
   * @throws {InvitationInvalidError} — token doesn't match any invitation
   * @throws {InvitationExpiredError} — invitation expired
   * @throws {InvitationRevokedError} — invitation revoked
   * @throws {InvitationAlreadyAcceptedError} — invitation already accepted by another user
   * @throws {InvitationAcceptMismatchError} — signed-in user's email doesn't match
   */
  async acceptInvitation(
    auth: AcceptAuthContext,
    body: AcceptInvitationRequest
  ): Promise<AcceptInvitationResult> {
    const tokenHash = hashToken(body.token)
    const invitation = await this.repo.findInvitationByTokenHash(tokenHash)

    // Reject nonexistent tokens with a generic response (no existence leak)
    if (!invitation) {
      throw new InvitationInvalidError()
    }

    if (!isInvitationValid(invitation)) {
      if (invitation.acceptedAt) {
        // Idempotent: if this user already accepted, return success
        if (invitation.acceptedById === auth.userId) {
          return {
            ok: true,
            message: 'شما قبلاً این دعوت‌نامه را پذیرفته‌اید',
            workspaceId: invitation.workspaceId,
            role: invitation.role,
          }
        }
        throw new InvitationAlreadyAcceptedError('این دعوت‌نامه قبلاً پذیرفته شده است')
      }
      if (invitation.revokedAt) {
        throw new InvitationRevokedError()
      }
      throw new InvitationExpiredError()
    }

    // Verify the signed-in user's email matches the invitation email
    const userEmail = normalizeEmail(auth.email)
    if (userEmail !== invitation.emailNormalized) {
      throw new InvitationAcceptMismatchError()
    }

    // Atomic accept: upsert member + mark invitation + revoke competitors
    const result = await this.repo.acceptInvitationTx(
      invitation,
      auth.userId,
      auth.name || invitation.emailNormalized.split('@')[0] || invitation.emailNormalized
    )

    // Audit (best-effort)
    await this.repo.writeAudit({
      userId: auth.userId,
      workspaceId: invitation.workspaceId,
      action: 'invitation.accepted',
      resource: 'WorkspaceInvitation',
      metadata: {
        invitationId: invitation.id,
        email: invitation.emailNormalized,
        role: invitation.role,
        alreadyMember: result.alreadyMember,
      },
    })

    const workspaceName = invitation.workspace?.name ?? 'فضای کاری'
    return {
      ok: true,
      message: result.alreadyMember
        ? 'شما قبلاً عضو این فضای کاری بودید'
        : `به «${workspaceName}» پیوستید`,
      workspaceId: invitation.workspaceId,
      role: invitation.role,
    }
  }

  /**
   * POST /api/members/invite/revoke — revoke a pending invitation.
   * Idempotent: revoking an already-revoked invitation returns ok.
   *
   * @throws {InvitationNotFoundError}
   * @throws {CannotRevokeAcceptedInvitationError}
   */
  async revokeInvitation(
    auth: AuthContext,
    body: RevokeInvitationRequest
  ): Promise<RevokeInvitationResult> {
    const { workspaceId } = auth

    const invitation = await this.repo.findInvitationByIdInWorkspace(body.id, workspaceId)
    if (!invitation) {
      throw new InvitationNotFoundError()
    }

    if (invitation.revokedAt) {
      return { ok: true, message: 'دعوت‌نامه قبلاً لغو شده است' }
    }

    if (invitation.acceptedAt) {
      throw new CannotRevokeAcceptedInvitationError()
    }

    await this.repo.revokeInvitation(body.id)

    await this.repo.writeAudit({
      userId: auth.userId,
      workspaceId,
      action: 'invitation.revoked',
      resource: 'WorkspaceInvitation',
      metadata: {
        invitationId: body.id,
        email: invitation.emailNormalized,
      },
    })

    return { ok: true, message: 'دعوت‌نامه لغو شد' }
  }

  /**
   * GET /api/members/invite/list — list invitations for the workspace.
   * Never returns tokenHash.
   */
  async listInvitations(auth: AuthContext): Promise<ListInvitationsResult> {
    const invitations = await this.repo.listInvitations(auth.workspaceId)
    const now = new Date()
    const data: InvitationListItem[] = invitations.map((inv) => ({
      id: inv.id,
      email: inv.emailNormalized,
      role: inv.role,
      status: inv.acceptedAt
        ? 'accepted'
        : inv.revokedAt
          ? 'revoked'
          : inv.expiresAt < now
            ? 'expired'
            : 'pending',
      expiresAt: inv.expiresAt.toISOString(),
      acceptedAt: inv.acceptedAt?.toISOString() ?? null,
      revokedAt: inv.revokedAt?.toISOString() ?? null,
      createdAt: inv.createdAt.toISOString(),
    }))
    return { data }
  }

  /**
   * GET /api/members — cursor-paginated list of workspace members.
   */
  async listMembers(auth: AuthContext, query: ListQuery): Promise<ListMembersResult> {
    const members = await this.repo.listMembers(auth.workspaceId, query)
    const hasMore = members.length > query.limit
    const data = hasMore ? members.slice(0, query.limit) : members
    const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null
    const items: MemberListItem[] = data.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role as InvitationRole,
      roleLabel: roleLabel(m.role),
      avatar: m.avatarUrl,
    }))
    return { data: items, nextCursor }
  }

  /**
   * PATCH /api/members/[id] — change a member's role.
   *
   * @throws {MemberNotFoundError}
   * @throws {LastAdminError} — demoting the last admin
   */
  async changeMemberRole(
    auth: AuthContext,
    memberId: string,
    body: ChangeRoleRequest
  ): Promise<ChangeRoleResult> {
    const { workspaceId } = auth

    const member = await this.repo.findMemberByIdInWorkspace(memberId, workspaceId)
    if (!member) throw new MemberNotFoundError()

    // Prevent demoting the last admin
    if (member.role === 'admin' && body.role !== 'admin') {
      const adminCount = await this.repo.countAdmins(workspaceId)
      if (adminCount <= 1) {
        throw new LastAdminError()
      }
    }

    const updated = await this.repo.updateMemberRole(memberId, body.role)

    await this.repo.writeAudit({
      userId: auth.userId,
      workspaceId,
      action: 'member.role_changed',
      resource: 'WorkspaceMember',
      metadata: { memberId, previousRole: member.role, newRole: body.role },
    })

    return { ok: true, id: updated.id, role: body.role }
  }

  /**
   * DELETE /api/members/[id] — remove a member from the workspace.
   *
   * @throws {MemberNotFoundError}
   * @throws {CannotRemoveLastAdminError}
   * @throws {CannotRemoveSelfError}
   */
  async removeMember(
    auth: AuthContext,
    memberId: string
  ): Promise<RemoveMemberResult> {
    const { workspaceId } = auth

    const member = await this.repo.findMemberByIdInWorkspace(memberId, workspaceId)
    if (!member) throw new MemberNotFoundError()

    // Prevent removing the last admin
    if (member.role === 'admin') {
      const adminCount = await this.repo.countAdmins(workspaceId)
      if (adminCount <= 1) {
        throw new CannotRemoveLastAdminError()
      }
    }

    // Prevent self-removal (use member management UI instead)
    if (member.userId === auth.userId) {
      throw new CannotRemoveSelfError()
    }

    await this.repo.deleteMember(memberId)

    await this.repo.writeAudit({
      userId: auth.userId,
      workspaceId,
      action: 'member.removed',
      resource: 'WorkspaceMember',
      metadata: { memberId, email: member.email, role: member.role },
    })

    return { ok: true }
  }
}

/**
 * Detect a Prisma unique-constraint violation (P2002) without importing Prisma.
 * The repository surfaces the raw error; the service inspects it.
 */
function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 'P2002'
  )
}

function roleLabel(r: string): string {
  switch (r) {
    case 'admin':
      return 'مدیر'
    case 'editor':
      return 'ویراستار'
    case 'approver':
      return 'تأییدکننده'
    case 'viewer':
      return 'بیننده'
    default:
      return r
  }
}
