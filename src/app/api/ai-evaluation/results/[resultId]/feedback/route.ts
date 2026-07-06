/**
 * Issue #252: AI evaluation harness API — submit human feedback on a result.
 *
 *   POST /api/ai-evaluation/results/[resultId]/feedback
 *
 * Body: { score: 1–5, feedback?: string }. Marks the result as reviewed.
 * Permission: workspace.settings.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, validateId, evaluationFeedbackSchema } from '@/lib/validations'
import { aiEvaluationService, AIEvaluationError } from '@/modules/ai-evaluation'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ resultId: string }> }) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  const { resultId } = await params
  const idCheck = validateId(resultId)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })
  const v = validateBody(evaluationFeedbackSchema, raw)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
  try {
    const updated = aiEvaluationService.submitFeedback(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      idCheck.data,
      v.data
    )
    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof AIEvaluationError) {
      return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
    }
    throw err
  }
}
