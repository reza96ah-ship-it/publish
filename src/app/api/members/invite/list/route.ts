/**
 * GET /api/members/invite/list — list pending invitations (Issue #143, #156).
 *
 * Thin transport handler: auth → service.listInvitations() → map.
 *
 * The service (src/modules/membership/service.ts) + repository enforce that
 * tokenHash is NEVER selected — it must never appear in API responses.
 */

import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { membershipService } from '@/modules/membership'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermissionApi('member.invite')
  if (guard.error) return guard.error

  const result = await membershipService.listInvitations({
    workspaceId: guard.workspaceId,
    userId: guard.userId,
    role: guard.role,
  })
  return NextResponse.json(result)
}
