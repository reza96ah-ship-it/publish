/**
 * GET /api/ai/drafts — list AI-saved caption drafts.
 * POST /api/ai/drafts — save a new draft.
 *
 * Reuses the Content model with status='draft' and an `[ai-draft]{...metadata}`
 * prefix on internalNote. Issue #200: thin handler — persistence + metadata
 * extraction lives in src/modules/ai/service.ts.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, aiDraftSchema } from '@/lib/validations'
import { aiService } from '@/modules/ai'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermissionApi('content.create')
  if (guard.error) return guard.error

  const items = await aiService.listDrafts({ workspaceId: guard.workspaceId, userId: guard.userId })
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('content.create')
  if (guard.error) return guard.error

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'بدنه نامعتبر' }, { status: 400 })

  const validation = validateBody(aiDraftSchema, body)
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 })

  // Zod min(1) catches empty string; reject whitespace-only to preserve old behavior.
  if (!validation.data.body.trim()) {
    return NextResponse.json({ error: 'متن کپشن خالی است' }, { status: 400 })
  }

  const result = await aiService.saveDraft(
    { workspaceId: guard.workspaceId, userId: guard.userId },
    validation.data,
  )
  return NextResponse.json(result, { status: 201 })
}
