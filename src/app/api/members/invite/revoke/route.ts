/**
 * POST /api/members/invite/revoke — revoke a pending invitation (Issue #143, #156).
 *
 * Thin transport handler: auth → validate → service.revokeInvitation() → map.
 *
 * The service (src/modules/membership/service.ts) owns the revoke policy:
 *   idempotent on already-revoked, refuses to revoke an already-accepted
 *   invitation, audit log.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { membershipService, MembershipError } from '@/modules/membership'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('member.invite')
  if (guard.error) return guard.error

  const body = await req.json().catch(() => null)
  if (!body?.id || typeof body.id !== 'string') {
    return NextResponse.json({ error: 'شناسه دعوت‌نامه الزامی است' }, { status: 400 })
  }

  try {
    const result = await membershipService.revokeInvitation(
      { workspaceId: guard.workspaceId, userId: guard.userId, role: guard.role },
      { id: body.id }
    )
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof MembershipError) {
      return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
    }
    throw err
  }
}
