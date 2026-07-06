/**
 * Issue #252: AI evaluation harness API — run a set.
 *
 *   POST /api/ai-evaluation/[id]/run   — generate captions for every prompt
 *
 * Calls /api/ai/caption once per prompt (server-side fetch, buffered). Returns
 * the newly-created EvaluationResult rows. Permission: workspace.settings.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, validateId, evaluationRunSchema } from '@/lib/validations'
import { aiEvaluationService, AIEvaluationError } from '@/modules/ai-evaluation'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  const raw = await req.json().catch(() => ({}))
  const v = validateBody(evaluationRunSchema, raw ?? {})
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
  try {
    const results = await aiEvaluationService.runEvaluation(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      idCheck.data,
      v.data
    )
    return NextResponse.json({ data: results }, { status: 201 })
  } catch (err) {
    if (err instanceof AIEvaluationError) {
      return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
    }
    throw err
  }
}
