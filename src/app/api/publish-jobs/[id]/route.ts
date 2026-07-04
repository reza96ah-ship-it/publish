/**
 * PATCH /api/publish-jobs/[id] — retry / cancel / discard / reschedule.
 * Thin transport: auth → parse → validate → service.patchJob() → map errors.
 */
import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { rescheduleSchema, validateBody } from '@/lib/validations'
import { PublishJobService, ReconciliationRequiredError } from '@/modules/publications/job-service'
import { PublicationError } from '@/modules/publications/errors'

export const dynamic = 'force-dynamic'

type PatchBody = { action: 'retry' } | { action: 'discard' } | { action: 'cancel' } | { action: 'reschedule'; scheduledAt: string }

const service = new PublishJobService()

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermissionApi('job.schedule')
  if (guard.error) return guard.error

  const { id } = await params
  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'بدنه درخواست نامعتبر است' }, { status: 400 }) }

  const body = raw as PatchBody
  if (body.action === 'reschedule') {
    const parsed = validateBody(rescheduleSchema, body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  try {
    const result = await service.patchJob({ workspaceId: guard.workspaceId, userId: guard.userId }, id, body)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof ReconciliationRequiredError)
      return NextResponse.json({ error: err.message, publicationId: err.publicationId, requiresManualResolution: true }, { status: 409 })
    if (err instanceof PublicationError)
      return NextResponse.json({ error: (err as { userMessage?: string }).userMessage ?? err.message }, { status: (err as { statusCode: number }).statusCode })
    throw err
  }
}
