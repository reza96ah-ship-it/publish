/**
 * POST /api/members/invite/revoke — revoke a pending invitation (Issue #143).
 *
 * Sets revokedAt on the invitation, making it unusable for acceptance.
 * Permission: member.invite (admin-only).
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermissionApi } from '@/lib/auth-guards'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('member.invite')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

  const body = await req.json().catch(() => null)
  if (!body?.id || typeof body.id !== 'string') {
    return NextResponse.json({ error: 'شناسه دعوت‌نامه الزامی است' }, { status: 400 })
  }

  // Find the invitation — must belong to this workspace (object-level auth)
  const invitation = await db.workspaceInvitation.findFirst({
    where: { id: body.id, workspaceId },
  })

  if (!invitation) {
    return NextResponse.json({ error: 'دعوت‌نامه یافت نشد' }, { status: 404 })
  }

  if (invitation.revokedAt) {
    return NextResponse.json({ ok: true, message: 'دعوت‌نامه قبلاً لغو شده است' })
  }

  if (invitation.acceptedAt) {
    return NextResponse.json(
      { error: 'نمی‌توان دعوت‌نامه پذیرفته‌شده را لغو کرد' },
      { status: 400 }
    )
  }

  await db.workspaceInvitation.update({
    where: { id: body.id },
    data: { revokedAt: new Date() },
  })

  // Write audit event
  await db.auditLog.create({
    data: {
      userId: guard.userId,
      workspaceId,
      action: 'invitation.revoked',
      resource: 'WorkspaceInvitation',
      metadata: {
        invitationId: body.id,
        email: invitation.emailNormalized,
      },
    },
  })

  return NextResponse.json({ ok: true, message: 'دعوت‌نامه لغو شد' })
}
