import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWorkspaceApi } from '@/lib/auth-guards'
import { randomUUID } from 'crypto'
import { rescheduleSchema, validateBody } from '@/lib/validations'

type PatchBody =
  | { action: 'retry' }
  | { action: 'discard' }
  | { action: 'reschedule'; scheduledAt: string }

/**
 * PATCH /api/publish-jobs/[id]
 * - retry: re-arm idempotency key (new), reset retryCount, set status=pending
 * - discard: set status=failed permanently, clear scheduledAt
 * - reschedule: change scheduledAt to a new future timestamp (used by calendar drag-drop)
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireWorkspaceApi()
  if (guard.error) return guard.error
  const workspaceId = guard.workspace.id

  const { id } = await params
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است' }, { status: 400 })
  }

  const body = raw as PatchBody

  const job = await db.publishJob.findFirst({
    where: { id, workspaceId },
  })
  if (!job) {
    return NextResponse.json({ error: 'کار یافت نشد' }, { status: 404 })
  }

  // ── reschedule ── (validated)
  if (body.action === 'reschedule') {
    const parsed = validateBody(rescheduleSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const updated = await db.publishJob.update({
      where: { id },
      data: {
        scheduledAt: new Date(parsed.data.scheduledAt),
        status: job.status === 'failed' ? 'scheduled' : job.status,
        processLabel: 'زمان‌بندی مجدد شد',
        error: null,
      },
    })
    return NextResponse.json({
      ok: true,
      jobId: updated.id,
      status: updated.status,
      scheduledAt: updated.scheduledAt?.toISOString(),
      message: 'زمان‌بندی با موفقیت به‌روزرسانی شد',
    })
  }

  // ── retry ──
  if (body.action === 'retry') {
    const updated = await db.publishJob.update({
      where: { id },
      data: {
        status: 'pending',
        retryCount: 0,
        progress: 0,
        processLabel: 'در انتظار تلاش مجدد',
        error: null,
        idempotencyKey: randomUUID(),
        scheduledAt: null,
        startedAt: null,
        completedAt: null,
        externalId: null,
      },
    })
    return NextResponse.json({
      ok: true,
      jobId: updated.id,
      status: updated.status,
      message: 'کار برای تلاش مجدد به صف بازگردانده شد',
    })
  }

  // ── discard ──
  if (body.action === 'discard') {
    const updated = await db.publishJob.update({
      where: { id },
      data: {
        status: 'failed',
        processLabel: 'دست‌نگار discard شد',
        scheduledAt: null,
        completedAt: new Date(),
      },
    })
    return NextResponse.json({
      ok: true,
      jobId: updated.id,
      status: updated.status,
      message: 'کار discarded شد',
    })
  }

  return NextResponse.json(
    { error: 'action نامعتبر است (retry، discard یا reschedule)' },
    { status: 400 },
  )
}
