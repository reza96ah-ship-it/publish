import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateParams, cursorPaginationSchema } from '@/lib/validations'
import { notificationsService } from '@/modules/notifications'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requirePermissionApi('analytics.view')
  if (guard.error) return guard.error

  const query = Object.fromEntries(req.nextUrl.searchParams.entries())
  const queryCheck = validateParams(cursorPaginationSchema, query)
  if (!queryCheck.success) return NextResponse.json({ error: queryCheck.error }, { status: 400 })

  const result = await notificationsService.listNotifications(
    { workspaceId: guard.workspaceId, userId: guard.userId },
    queryCheck.data
  )
  return NextResponse.json(result)
}
