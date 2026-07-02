/**
 * GET /api/analytics/real — fetch real analytics from platform APIs.
 *
 * For platforms with valid tokens, calls:
 * - Telegram: getChatMemberCount (channel subscribers)
 * - Instagram: /{ig-user-id}/insights (reach, impressions, engagement)
 * - LinkedIn: organizationalEntityShareStatistics
 *
 * Falls back to DB-stored AnalyticsSnapshot if API call fails.
 */
import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { analyticsService } from '@/modules/analytics'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermissionApi('analytics.view')
  if (guard.error) return guard.error

  const result = await analyticsService.getRealStats(
    { workspaceId: guard.workspaceId, userId: guard.userId }
  )
  return NextResponse.json(result)
}
