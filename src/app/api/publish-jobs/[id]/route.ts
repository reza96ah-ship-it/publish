import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermissionApi } from '@/lib/auth-guards'
import { randomUUID } from 'crypto'
import { rescheduleSchema, validateBody } from '@/lib/validations'
import { enqueuePublishJob, publishQueue } from '@/lib/queue'
import { writeAuditLog } from '@/lib/audit'
import { checkContentPublished } from '@/lib/content-aggregate'

export const dynamic = 'force-dynamic'

type PatchBody =
  | { action: 'retry' }
  | { action: 'discard' }
  | { action: 'cancel' }
  | { action: 'reschedule'; scheduledAt: string }

// Issue #147 C: statuses where the provider has already acknowledged the
// post or the job has otherwise reached a terminal state — cancellation
// must be rejected (not silently no-op'd) once a job is here.
const NON_CANCELLABLE_STATUSES = new Set(['success', 'cancelled', 'failed', 'action'])

/**
 * Best-effort removal of the BullMQ job tied to a given idempotencyKey
 * (used as the BullMQ jobId). Issue #147 C: prevents a stale waiting/delayed
 * job from firing independently after its DB record has moved on (cancel,
 * retry with a new key, or reschedule with a new key) — which would
 * otherwise duplicate the publish. A job that's already `active` can't be
 * force-removed here; the worker's own preflight DB check (see
 * mini-services/publish-worker/index.ts) makes that case a clean no-op
 * instead of a duplicate provider call.
 */
async function removeOldBullJob(idempotencyKey: string | null | undefined, context: string): Promise<void> {
  if (!idempotencyKey) return
  try {
    await publishQueue.remove(idempotencyKey)
  } catch (err) {
    console.error(`[publish-jobs] failed to remove old BullMQ job (${context}):`, err)
  }
}

/**
 * PATCH /api/publish-jobs/[id]
 * - retry: re-arm idempotency key (new), reset retryCount, set status=pending
 * - discard: set status=failed permanently, clear scheduledAt
 * - reschedule: change scheduledAt to a new future timestamp (used by calendar drag-drop)
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermissionApi('job.schedule')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

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
    const newScheduledAt = new Date(parsed.data.scheduledAt)
    const oldKey = job.idempotencyKey
    const newKey = randomUUID()
    const updated = await db.publishJob.update({
      where: { id },
      data: {
        scheduledAt: newScheduledAt,
        status: 'scheduled',
        processLabel: 'زمان‌بندی مجدد شد',
        error: null,
        idempotencyKey: newKey,
      },
    })
    // Issue #147 C: remove the BullMQ job tied to the previous key so it
    // can't fire independently (with the old schedule) and duplicate the
    // publish once the new one is added below.
    await removeOldBullJob(oldKey, 'reschedule')
    await enqueuePublishJob({
      jobId: updated.id,
      idempotencyKey: newKey,
      contentId: updated.contentId,
      platformId: updated.platformId,
      workspaceId: updated.workspaceId,
      scheduledAt: newScheduledAt,
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
    const oldKey = job.idempotencyKey
    const newKey = randomUUID()
    const updated = await db.publishJob.update({
      where: { id },
      data: {
        status: 'pending',
        retryCount: 0,
        progress: 0,
        processLabel: 'در انتظار تلاش مجدد',
        error: null,
        idempotencyKey: newKey,
        scheduledAt: null,
        startedAt: null,
        completedAt: null,
        externalId: null,
      },
    })
    // Issue #147 C: same reasoning as reschedule — the old key must not be
    // able to fire independently anymore.
    await removeOldBullJob(oldKey, 'retry')
    await enqueuePublishJob({
      jobId: updated.id,
      idempotencyKey: newKey,
      contentId: updated.contentId,
      platformId: updated.platformId,
      workspaceId: updated.workspaceId,
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

  // ── cancel ── (#113: user-facing clean cancellation; hardened in #147 C)
  if (body.action === 'cancel') {
    // Issue #147 C: never claim "cancelled" once a job is terminal or the
    // provider has already accepted the post — return a clear error instead
    // of silently no-op'ing or silently succeeding.
    if (NON_CANCELLABLE_STATUSES.has(job.status) || job.externalId) {
      const message =
        job.status === 'cancelled'
          ? 'این کار قبلاً لغو شده است'
          : job.externalId || job.status === 'success'
            ? 'این انتشار قبلاً توسط سرویس‌دهنده تأیید شده است و قابل لغو نیست'
            : 'این کار در وضعیت پایانی است و قابل لغو نیست'
      return NextResponse.json({ error: message }, { status: 409 })
    }

    // Cross-check the first-class Publication record too — it may already
    // be provider-acknowledged even if the legacy PublishJob row hasn't
    // caught up yet (e.g. worker crashed between the two updates).
    const publication = await db.publication.findFirst({ where: { publishJobId: job.id } })
    if (
      publication &&
      (publication.providerAcknowledgedAt ||
        publication.status === 'published' ||
        publication.status === 'action_required' ||
        publication.status === 'cancelled')
    ) {
      return NextResponse.json(
        { error: 'این انتشار قبلاً توسط سرویس‌دهنده تأیید شده است و قابل لغو نیست' },
        { status: 409 }
      )
    }

    // Optimistic concurrency: only flip status if it's still cancellable at
    // the moment of the write — guards against a race with the worker
    // claiming the job between our read above and this update.
    const claimed = await db.publishJob.updateMany({
      where: {
        id: job.id,
        workspaceId,
        status: { notIn: Array.from(NON_CANCELLABLE_STATUSES) },
      },
      data: {
        status: 'cancelled',
        processLabel: 'لغو شد',
        scheduledAt: null,
        completedAt: new Date(),
      },
    })

    if (claimed.count === 0) {
      return NextResponse.json(
        { error: 'وضعیت کار هم‌زمان تغییر کرد — لغو ممکن نشد. صفحه را به‌روزرسانی کنید' },
        { status: 409 }
      )
    }

    if (publication) {
      await db.publication
        .update({
          where: { id: publication.id },
          data: { status: 'cancelled', completedAt: new Date() },
        })
        .catch((err) => console.error('[publish-jobs] failed to sync Publication on cancel:', err))
    }

    // Issue #147 C: remove the BullMQ job so a still-waiting/delayed job
    // can't fire independently. Active jobs can't be force-removed here —
    // the worker's preflight DB check makes that a clean no-op instead.
    await removeOldBullJob(job.idempotencyKey, 'cancel')

    await writeAuditLog({
      action: 'publish.cancelled',
      workspaceId,
      userId: guard.userId,
      metadata: { jobId: job.id, previousStatus: job.status, platformId: job.platformId },
    })

    // Issue #147 B: recompute the parent Content aggregate immediately —
    // don't wait for the worker to run checkContentPublished, since a
    // waiting/delayed job that's cancelled here may never reach the worker.
    await checkContentPublished(job.contentId)

    return NextResponse.json({
      ok: true,
      jobId: job.id,
      status: 'cancelled',
      message: 'انتشار لغو شد',
    })
  }

  return NextResponse.json(
    { error: 'action نامعتبر است (retry، cancel، discard یا reschedule)' },
    { status: 400 }
  )
}
