/**
 * POST /api/members/invite — create a workspace invitation (Issue #143).
 *
 * Before: created a WorkspaceMember with userId = inviteToken (fake user,
 * FK violation, token returned in plaintext).
 *
 * After: creates a WorkspaceInvitation with hashed token. The plaintext
 * token is returned ONCE so the admin can send it to the invitee. The
 * invitee accepts via POST /api/members/invite/accept with the token.
 *
 * Permission: member.invite (admin-only, enforced by requirePermissionApi).
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, memberInviteSchema } from '@/lib/validations'
import { generateInvitationToken, normalizeEmail } from '@/lib/invitations'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Issue #142: require member.invite permission (admin-only)
  const guard = await requirePermissionApi('member.invite')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId
  const invitedById = guard.userId

  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })

  const validation = validateBody(memberInviteSchema, raw)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }
  const { email, name, role } = validation.data
  const emailNormalized = normalizeEmail(email)

  // Issue #143: reject if the email already has an active membership
  const existingMember = await db.workspaceMember.findFirst({
    where: { workspaceId, email: emailNormalized },
    select: { id: true },
  })
  if (existingMember) {
    return NextResponse.json(
      { error: 'این کاربر قبلاً عضو این فضای کاری است' },
      { status: 409 }
    )
  }

  // Issue #143: check for existing active invitation — if found, replace it
  const existingInvitation = await db.workspaceInvitation.findUnique({
    where: { workspaceId_emailNormalized: { workspaceId, emailNormalized } },
  })

  // Generate token (plaintext returned once, hash stored)
  const { plaintext, hash, expiresAt } = generateInvitationToken()

  if (existingInvitation) {
    // Resend: update the existing invitation with a new token + expiry
    await db.workspaceInvitation.update({
      where: { id: existingInvitation.id },
      data: {
        tokenHash: hash,
        expiresAt,
        role,
        revokedAt: null,
        acceptedAt: null,
        acceptedById: null,
      },
    })
  } else {
    // Create new invitation
    await db.workspaceInvitation.create({
      data: {
        workspaceId,
        emailNormalized,
        role,
        tokenHash: hash,
        invitedById,
        expiresAt,
      },
    })
  }

  // Create notification for workspace admins
  await db.notification.create({
    data: {
      workspaceId,
      type: 'approval_requested',
      title: 'دعوت‌نامه جدید ارسال شد',
      body: `${name || email} با نقش ${role} دعوت شد`,
    },
  })

  // Issue #143: return the plaintext token ONCE — never persist or log it
  return NextResponse.json(
    {
      ok: true,
      email: emailNormalized,
      role,
      expiresAt: expiresAt.toISOString(),
      // The plaintext token is returned so the admin can share it.
      // It is NEVER stored in plaintext — only the hash is in the DB.
      inviteToken: plaintext,
      message: 'دعوت‌نامه ایجاد شد. لینک دعوت را به کاربر ارسال کنید.',
    },
    { status: 201 }
  )
}
