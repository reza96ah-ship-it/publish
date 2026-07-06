/**
 * Issue #253: Competitor tracking API — list + create.
 *
 *   GET    /api/competitors   — list competitors for the active workspace
 *   POST   /api/competitors   — add a competitor profile
 *
 * Permission: workspace.settings (admin-only — strategic data).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, competitorCreateSchema } from '@/lib/validations'
import { competitorsService, CompetitorError } from '@/modules/competitors'

export const dynamic = 'force-dynamic'

function mapError(err: unknown): NextResponse {
  if (err instanceof CompetitorError) {
    return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
  }
  throw err
}

export async function GET() {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  try {
    const list = competitorsService.listCompetitors({ workspaceId: guard.workspaceId, userId: guard.userId })
    return NextResponse.json({ data: list })
  } catch (err) { return mapError(err) }
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })
  const v = validateBody(competitorCreateSchema, raw)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
  try {
    const competitor = competitorsService.createCompetitor(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      v.data
    )
    return NextResponse.json(competitor, { status: 201 })
  } catch (err) { return mapError(err) }
}
