/**
 * GET /api/members — list workspace members (Issue #142, #156).
 * POST /api/members — DEPRECATED (use /api/members/invite instead).
 *
 * Thin transport handler: auth → validate query → service.listMembers() → map.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateParams, cursorPaginationSchema } from '@/lib/validations'
import { membershipService } from '@/modules/membership'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requirePermissionApi('security.admin')
  if (guard.error) return guard.error

  const query = Object.fromEntries(req.nextUrl.searchParams.entries())
  const queryCheck = validateParams(cursorPaginationSchema, query)
  if (!queryCheck.success) return NextResponse.json({ error: queryCheck.error }, { status: 400 })
  const { cursor, limit } = queryCheck.data

  const result = await membershipService.listMembers(
    { workspaceId: guard.workspaceId, userId: guard.userId, role: guard.role },
    { cursor, limit }
  )
  return NextResponse.json(result)
}

// Issue #143: POST /api/members is DEPRECATED — direct member creation with
// fabricated userId is removed. Use POST /api/members/invite to create
// invitations instead. Invitations create real WorkspaceMember records only
// when the invited user accepts.
export async function POST() {
  return NextResponse.json(
    {
      error: 'ایجاد مستقیم عضو حذف شده است. از دعوت‌نامه استفاده کنید: POST /api/members/invite',
      redirect: '/api/members/invite',
    },
    { status: 410 }
  )
}
