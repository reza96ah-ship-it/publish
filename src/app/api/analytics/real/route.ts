/**
 * GET /api/analytics/real — fetch real analytics from platform APIs.
 *
 * For platforms with valid tokens, calls provider APIs directly and
 * falls back to DB-stored AnalyticsSnapshot if the API call fails.
 */
import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { analyticsService } from '@/modules/analytics'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermissionApi('analytics.view')
  if (guard.error) return guard.error

  return NextResponse.json(await analyticsService.fetchRealStats(guard.workspaceId))
}
