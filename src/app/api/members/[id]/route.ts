/**
 * PATCH /api/members/[id] — change a member's role (Issue #143, #156).
 * DELETE /api/members/[id] — remove a member from the workspace (Issue #143, #156).
 *
 * Thin transport handlers: auth → service.changeMemberRole() / removeMember() → map.
 *
 * The service (src/modules/membership/service.ts) owns the policy:
 *   last-admin guard (role change + removal), self-removal guard, audit log.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody } from '@/lib/validations'
import { z } from 'zod'
import { membershipService, MembershipError } from '@/modules/membership'

export const dynamic = 'force-dynamic'

const VALID_ROLES = ['admin', 'editor', 'approver', 'viewer'] as const
const roleChangeSchema = z.object({
  role: z.enum(VALID_ROLES),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const guard = await requirePermissionApi('member.manage')
  if (guard.error) return guard.error

  const raw = await req.json().catch(() => null)
  const validation = validateBody(roleChangeSchema, raw)
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 })

  try {
    const result = await membershipService.changeMemberRole(
      { workspaceId: guard.workspaceId, userId: guard.userId, role: guard.role },
      id,
      validation.data
    )
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof MembershipError) {
      return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
    }
    throw err
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const guard = await requirePermissionApi('member.manage')
  if (guard.error) return guard.error

  try {
    await membershipService.removeMember(
      { workspaceId: guard.workspaceId, userId: guard.userId, role: guard.role },
      id
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof MembershipError) {
      return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
    }
    throw err
  }
}
