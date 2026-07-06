/**
 * Issue #253: Competitor tracking API — single-competitor CRUD.
 *
 *   GET    /api/competitors/[id]   — get a competitor
 *   PATCH  /api/competitors/[id]  — update a competitor
 *   DELETE /api/competitors/[id]  — delete a competitor
 *
 * Next 16: `params` is a Promise. Permission: workspace.settings.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, validateId, competitorUpdateSchema } from '@/lib/validations'
import { competitorsService, CompetitorError } from '@/modules/competitors'

export const dynamic = 'force-dynamic'

function mapError(err: unknown): NextResponse {
  if (err instanceof CompetitorError) {
    return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
  }
  throw err
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  try {
    return NextResponse.json(
      competitorsService.getCompetitor({ workspaceId: guard.workspaceId, userId: guard.userId }, idCheck.data)
    )
  } catch (err) { return mapError(err) }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })
  const v = validateBody(competitorUpdateSchema, raw)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
  try {
    return NextResponse.json(
      competitorsService.updateCompetitor(
        { workspaceId: guard.workspaceId, userId: guard.userId },
        idCheck.data,
        v.data
      )
    )
  } catch (err) { return mapError(err) }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  try {
    competitorsService.deleteCompetitor({ workspaceId: guard.workspaceId, userId: guard.userId }, idCheck.data)
    return new NextResponse(null, { status: 204 })
  } catch (err) { return mapError(err) }
}
