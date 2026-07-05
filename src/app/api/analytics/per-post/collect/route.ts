/**
 * POST /api/analytics/per-post/collect — Issue #215: on-demand collection of
 * per-post insights from providers that expose them (currently Instagram).
 */
import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { collectPostMetrics } from '@/modules/analytics/post-metrics'

export const dynamic = 'force-dynamic'

export async function POST() {
  const guard = await requirePermissionApi('analytics.view')
  if (guard.error) return guard.error

  const result = await collectPostMetrics(guard.workspaceId)
  return NextResponse.json(result)
}
