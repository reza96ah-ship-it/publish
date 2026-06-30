/**
 * POST /api/members/invite â€” invite a team member by email.
 * Creates a WorkspaceMember with role + generates invite token.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermissionApi } from '@/lib/auth-guards'
import { randomUUID } from 'crypto'
import { validateBody, memberInviteSchema } from '@/lib/validations'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Issue #142: inviting members requires member.invite permission (admin-only)
  const guard = await requirePermissionApi('member.invite')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'ط¨ط¯ظ†ظ‡ ظ†ط§ظ…ط¹طھط¨ط±' }, { status: 400 })

  const validation = validateBody(memberInviteSchema, raw)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }
  const { email, name, role } = validation.data

  // Check if member already exists
  const existing = await db.workspaceMember.findFirst({
    where: { workspaceId, email },
  })
  if (existing) {
    return NextResponse.json(
      { error: 'ط§غŒظ† ط¹ط¶ظˆ ظ‚ط¨ظ„ط§ظ‹ ط§ط¶ط§ظپظ‡ ط´ط¯ظ‡ ط§ط³طھ' },
      { status: 409 }
    )
  }

  // Create member with a temporary userId (will be linked when user registers)
  const inviteToken = randomUUID()
  const member = await db.workspaceMember.create({
    data: {
      workspaceId,
      userId: inviteToken, // temporary â€” replaced when user accepts invite
      name: name || email.split('@')[0],
      email,
      role,
    },
  })

  // Create notification
  await db.notification.create({
    data: {
      workspaceId,
      type: 'approval_requested',
      title: 'ط¹ط¶ظˆ ط¬ط¯غŒط¯ ط§ط¶ط§ظپظ‡ ط´ط¯',
      body: `${name || email} ط¨ط§ ظ†ظ‚ط´ ${role} ط¨ظ‡ طھغŒظ… ط§ط¶ط§ظپظ‡ ط´ط¯`,
    },
  })

  return NextResponse.json(
    {
      ok: true,
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
      },
      inviteToken,
    },
    { status: 201 }
  )
}
