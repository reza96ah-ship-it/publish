import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { notificationsService } from '@/modules/notifications'

export const dynamic = 'force-dynamic'

/**
 * POST /api/notifications/mark-all-read
 * Bulk-mark every unread notification in the caller's workspace as read (P1-21).
 * Replaces the previous "fire-and-forget" optimistic-only update in the
 * notification popover, which was reverted by the next refetch.
 */
export async function POST() {
  const guard = await requirePermissionApi('analytics.view')
  if (guard.error) return guard.error

  const result = await notificationsService.markAllRead({
    workspaceId: guard.workspaceId,
    userId: guard.userId,
  })
  return NextResponse.json(result)
}
