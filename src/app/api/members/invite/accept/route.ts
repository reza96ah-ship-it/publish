/**
 * POST /api/members/invite/accept — accept a workspace invitation (Issue #143).
 *
 * Flow:
 *   1. User signs in (authenticated, not workspace-scoped)
 *   2. Submits the plaintext invite token
 *   3. We hash it and look up the invitation by tokenHash
 *   4. Validate: not expired, not revoked, not already accepted
 *   5. Verify the signed-in user's email matches the invitation email
 *   6. In one transaction: create WorkspaceMember + mark invitation accepted
 *
 * Acceptance is idempotent: if the user already accepted, return success
 * without creating a duplicate membership.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { hashToken, normalizeEmail, isInvitationValid } from '@/lib/invitations'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Must be authenticated (but not workspace-scoped — the token determines the workspace)
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'برای پذیرش دعوت‌نامه باید وارد شوید' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.token || typeof body.token !== 'string') {
    return NextResponse.json({ error: 'توکن دعوت‌نامه الزامی است' }, { status: 400 })
  }

  // Hash the plaintext token and look up the invitation
  const tokenHash = hashToken(body.token)
  const invitation = await db.workspaceInvitation.findUnique({
    where: { tokenHash },
    include: { workspace: { select: { id: true, name: true } } },
  })

  // Issue #143: reject nonexistent tokens with a generic response (no existence leak)
  if (!invitation) {
    return NextResponse.json(
      { error: 'دعوت‌نامه نامعتبر است یا منقضی شده است' },
      { status: 404 }
    )
  }

  // Check validity (expired, revoked, accepted)
  if (!isInvitationValid(invitation)) {
    if (invitation.acceptedAt) {
      // Idempotent: if this user already accepted, return success
      if (invitation.acceptedById === (session.user as any).id) {
        return NextResponse.json({
          ok: true,
          message: 'شما قبلاً این دعوت‌نامه را پذیرفته‌اید',
          workspaceId: invitation.workspaceId,
        })
      }
      return NextResponse.json({ error: 'این دعوت‌نامه قبلاً پذیرفته شده است' }, { status: 410 })
    }
    if (invitation.revokedAt) {
      return NextResponse.json({ error: 'این دعوت‌نامه لغو شده است' }, { status: 410 })
    }
    return NextResponse.json({ error: 'این دعوت‌نامه منقضی شده است' }, { status: 410 })
  }

  // Issue #143: verify the signed-in user's email matches the invitation email
  const userEmail = normalizeEmail((session.user as any).email ?? '')
  if (userEmail !== invitation.emailNormalized) {
    return NextResponse.json(
      { error: 'این دعوت‌نامه برای ایمیل دیگری صادر شده است' },
      { status: 403 }
    )
  }

  const userId = (session.user as any).id as string

  // Issue #143: atomic acceptance in one transaction
  const result = await db.$transaction(async (tx) => {
    // Check if already a member (idempotent — could have accepted in a concurrent request)
    const existingMember = await tx.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: invitation.workspaceId,
          userId,
        },
      },
    })

    if (existingMember) {
      // Already a member — re-read invitation inside tx to get current acceptedAt (not stale snapshot)
      const currentInv = await tx.workspaceInvitation.findUnique({ where: { id: invitation.id } })
      if (!currentInv?.acceptedAt) {
        await tx.workspaceInvitation.update({
          where: { id: invitation.id },
          data: {
            acceptedAt: new Date(),
            acceptedById: userId,
          },
        })
      }
      return { member: existingMember, alreadyMember: true }
    }

    // Create the real WorkspaceMember with the real User.id
    const member = await tx.workspaceMember.create({
      data: {
        workspaceId: invitation.workspaceId,
        userId, // real User.id — no more fake UUIDs
        name: (session.user as any).name || invitation.emailNormalized.split('@')[0],
        email: invitation.emailNormalized,
        role: invitation.role,
      },
    })

    // Mark invitation as accepted
    await tx.workspaceInvitation.update({
      where: { id: invitation.id },
      data: {
        acceptedAt: new Date(),
        acceptedById: userId,
      },
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

    return { member, alreadyMember: false }
  })

  // Write audit event — failure must not crash the happy path (membership already committed)
  try {
    await db.auditLog.create({
      data: {
        userId,
        workspaceId: invitation.workspaceId,
        action: 'invitation.accepted',
        resource: 'WorkspaceInvitation',
        metadata: {
          invitationId: invitation.id,
          email: invitation.emailNormalized,
          role: invitation.role,
          alreadyMember: result.alreadyMember,
        },
      },
    })
  } catch {
    // audit write failure is non-fatal
  }

  return NextResponse.json({
    ok: true,
    message: result.alreadyMember
      ? 'شما قبلاً عضو این فضای کاری بودید'
      : `به «${invitation.workspace.name}» پیوستید`,
    workspaceId: invitation.workspaceId,
    role: invitation.role,
  })
}
