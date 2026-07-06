/**
 * Issue #252: AI evaluation harness API — list + create.
 *
 *   GET    /api/ai-evaluation   — list all evaluation sets (incl. seeds)
 *   POST   /api/ai-evaluation   — create a new evaluation set
 *
 * Permission: workspace.settings (admin-only — developer tool).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, evaluationSetCreateSchema } from '@/lib/validations'
import { aiEvaluationService, AIEvaluationError } from '@/modules/ai-evaluation'

export const dynamic = 'force-dynamic'

function mapError(err: unknown): NextResponse {
  if (err instanceof AIEvaluationError) {
    return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
  }
  throw err
}

export async function GET() {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  try {
    const sets = aiEvaluationService.listSets({ workspaceId: guard.workspaceId, userId: guard.userId })
    return NextResponse.json({ data: sets })
  } catch (err) { return mapError(err) }
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })
  const v = validateBody(evaluationSetCreateSchema, raw)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
  try {
    const set = aiEvaluationService.createSet(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      v.data
    )
    return NextResponse.json(set, { status: 201 })
  } catch (err) { return mapError(err) }
}
