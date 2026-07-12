import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { inboxService } from '@/modules/inbox'

export const dynamic = 'force-dynamic'

/**
 * GET /api/inbox/threads/counts — per-queue thread counts for the queue rail
 * badges, plus the caller's membership id (the UI uses it to hide its own
 * presence lock from "X در حال پاسخ" chips).
 */
export async function GET() {
  const guard = await requirePermissionApi('inbox.reply')
  if (guard.error) return guard.error

  const result = await inboxService.threadQueueCounts({
    workspaceId: guard.workspaceId,
    userId: guard.userId,
  })
  return NextResponse.json(result)
}
