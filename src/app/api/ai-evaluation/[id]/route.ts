/**
 * Issue #252: AI evaluation harness API — single-set read + delete.
 *
 *   GET    /api/ai-evaluation/[id]   — get a single evaluation set
 *   DELETE /api/ai-evaluation/[id]  — delete an evaluation set (cascades results)
 *
 * Next 16: `params` is a Promise. Permission: workspace.settings.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateId } from '@/lib/validations'
import { aiEvaluationService, AIEvaluationError } from '@/modules/ai-evaluation'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  try {
    return NextResponse.json(
      aiEvaluationService.getSet({ workspaceId: guard.workspaceId, userId: guard.userId }, idCheck.data)
    )
  } catch (err) {
    if (err instanceof AIEvaluationError) {
      return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
    }
    throw err
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  try {
    aiEvaluationService.deleteSet({ workspaceId: guard.workspaceId, userId: guard.userId }, idCheck.data)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof AIEvaluationError) {
      return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
    }
    throw err
  }
}
