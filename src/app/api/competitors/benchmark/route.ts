/**
 * Issue #253: Competitor benchmark API.
 *
 *   GET /api/competitors/benchmark?days=30   — workspace metrics vs each competitor
 *
 * Permission: workspace.settings.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { competitorsService, CompetitorError } from '@/modules/competitors'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  const daysParam = req.nextUrl.searchParams.get('days')
  const days = daysParam ? Number.parseInt(daysParam, 10) : 30
  if (!Number.isFinite(days) || days < 1 || days > 365) {
    return NextResponse.json({ error: 'بازه روزها باید بین ۱ تا ۳۶۵ باشد' }, { status: 400 })
  }
  try {
    const result = await competitorsService.getBenchmark(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      { days }
    )
    return NextResponse.json({ data: result })
  } catch (err) {
    if (err instanceof CompetitorError) {
      return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
    }
    throw err
  }
}
