/**
 * Issue #156: Publications module — publish-job lifecycle service.
 *
 * Business logic for retry/cancel/reschedule/discard. Uses PublishJobRepository
 * for data access + src/lib/queue for BullMQ orchestration +
 * src/lib/content-aggregate for the parent Content recompute +
 * src/lib/audit for the audit log.
 *
 * Kept separate from service.ts (Issue #124 publication creation) so the
 * original surface stays stable.
 */

import { randomUUID } from 'crypto'
import { PublishJobRepository } from './job-repository'
import { enqueuePublishJob, publishQueue } from '@/lib/queue'
import { writeAuditLog } from '@/lib/audit'
import { checkContentPublished } from '@/lib/content-aggregate'
import { db } from '@/lib/db'
import { assertExhaustive } from '@/lib/api-contracts'
import {
  JobNotFoundError,
  JobNotCancellableError,
  JobConcurrentChangeError,
  InvalidActionError,
  ValidationError,
  ReconciliationRequiredError,
} from './job-errors'
import type {
  JobAction,
  RetryJobResult,
  DiscardJobResult,
  CancelJobResult,
  RescheduleJobResult,
  PublishJobRow,
} from './job-types'

// Issue #147 C: statuses where the provider has already acknowledged the
// post or the job has otherwise reached a terminal state — cancellation
// must be rejected (not silently no-op'd) once a job is here.
const NON_CANCELLABLE_STATUSES = new Set(['success', 'cancelled', 'failed', 'action'])

// Re-export error classes for route handlers (thin transport layer)
export {
  JobNotFoundError,
  JobNotCancellableError,
  JobConcurrentChangeError,
  InvalidActionError,
  ValidationError,
  ReconciliationRequiredError,
}

export interface JobAuthContext {
  workspaceId: string
  userId: string
}

export class PublishJobService {
  constructor(
    private readonly repo: PublishJobRepository = new PublishJobRepository()
  ) {}

  /**
   * PATCH /api/publish-jobs/[id] — dispatch a job lifecycle action.
   *
   * @throws {InvalidActionError} — unknown action
   * @throws {JobNotFoundError}
   * @throws {JobNotCancellableError} — job is terminal / provider-acknowledged
   * @throws {JobConcurrentChangeError} — optimistic concurrency failed
   * @throws {ValidationError} — reschedule scheduledAt invalid
   */
  async patchJob(
    auth: JobAuthContext,
    jobId: string,
    body: { action: JobAction; scheduledAt?: string }
  ): Promise<RetryJobResult | DiscardJobResult | CancelJobResult | RescheduleJobResult> {
    const job = await this.repo.findByIdInWorkspace(jobId, auth.workspaceId)
    if (!job) throw new JobNotFoundError()

    switch (body.action) {
      case 'reschedule':
        return this.reschedule(auth, job, body.scheduledAt)
      case 'retry':
        return this.retry(auth, job)
      case 'discard':
        return this.discard(job)
      case 'cancel':
        return this.cancel(auth, job)
      default:
        return assertExhaustive(body.action)
    }
  }

  /**
   * Reschedule: new scheduledAt, new idempotency key, re-enqueue BullMQ job
   * with delay, remove the old BullMQ job (prevents duplicate firing).
   */
  private async reschedule(
    _auth: JobAuthContext,
    job: PublishJobRow,
    scheduledAt: string | undefined
  ): Promise<RescheduleJobResult> {
    if (!scheduledAt) {
      throw new ValidationError('تاریخ زمان‌بندی الزامی است')
    }
    const newScheduledAt = new Date(scheduledAt)
    if (isNaN(newScheduledAt.getTime())) {
      throw new ValidationError('تاریخ معتبر نیست')
    }
    if (newScheduledAt.getTime() < Date.now() - 60_000) {
      throw new ValidationError('تاریخ باید در آینده باشد')
    }

    const oldKey = job.idempotencyKey
    const newKey = randomUUID()
    const updated = await this.repo.reschedule(job.id, newScheduledAt, newKey)

    // Issue #147 C: remove the BullMQ job tied to the previous key so it
    // can't fire independently (with the old schedule) and duplicate the
    // publish once the new one is added below.
    await this.removeOldBullJob(oldKey, 'reschedule')
    await enqueuePublishJob({
      jobId: updated.id,
      idempotencyKey: newKey,
      contentId: updated.contentId,
      platformId: updated.platformId,
      workspaceId: updated.workspaceId,
      scheduledAt: newScheduledAt,
    })

    return {
      ok: true,
      jobId: updated.id,
      status: updated.status,
      scheduledAt: updated.scheduledAt?.toISOString() ?? null,
      message: 'زمان‌بندی با موفقیت به‌روزرسانی شد',
    }
  }

  /**
   * Retry: re-arm idempotency key, reset retryCount, status=pending,
   * re-enqueue BullMQ job (immediate), remove the old BullMQ job.
   */
  private async retry(
    _auth: JobAuthContext,
    job: PublishJobRow
  ): Promise<RetryJobResult> {
    // Issue #149: Prevent blind retry if previous attempt outcome is unknown
    const publication = await db.publication.findFirst({
      where: { publishJobId: job.id },
      select: { id: true, reconciliationStatus: true },
    })
    if (publication?.reconciliationStatus === 'still_unknown') {
      throw new ReconciliationRequiredError(
        'وضعیت انتشار قبلی نامشخص است و هنوز حل نشده — تلاش مجدد خودکار مجاز نیست. لطفاً از بخش «حل دستی» استفاده کنید.',
        publication.id
      )
    }

    const oldKey = job.idempotencyKey
    const newKey = randomUUID()
    const updated = await this.repo.retry(job.id, newKey)

    // Issue #147 C: same reasoning as reschedule — the old key must not be
    // able to fire independently anymore.
    await this.removeOldBullJob(oldKey, 'retry')
    await enqueuePublishJob({
      jobId: updated.id,
      idempotencyKey: newKey,
      contentId: updated.contentId,
      platformId: updated.platformId,
      workspaceId: updated.workspaceId,
    })

    return {
      ok: true,
      jobId: updated.id,
      status: updated.status,
      message: 'کار برای تلاش مجدد به صف بازگردانده شد',
    }
  }

  /**
   * Discard: terminal failed status, clear scheduledAt. No BullMQ interaction
   * — the worker preflight check will treat the discarded job as a no-op.
   */
  private async discard(job: PublishJobRow): Promise<DiscardJobResult> {
    const updated = await this.repo.discard(job.id)
    return {
      ok: true,
      jobId: updated.id,
      status: updated.status,
      message: 'کار discarded شد',
    }
  }

  /**
   * Cancel (#113: user-facing clean cancellation; hardened in #147 C).
   *
   * Never claims "cancelled" once a job is terminal or the provider has
   * already accepted the post — returns a clear error instead of silently
   * no-op'ing or silently succeeding.
   *
   * Cross-checks the first-class Publication record too — it may already be
   * provider-acknowledged even if the legacy PublishJob row hasn't caught
   * up yet (e.g. worker crashed between the two updates).
   */
  private async cancel(
    auth: JobAuthContext,
    job: PublishJobRow
  ): Promise<CancelJobResult> {
    if (NON_CANCELLABLE_STATUSES.has(job.status) || job.externalId) {
      const message =
        job.status === 'cancelled'
          ? 'این کار قبلاً لغو شده است'
          : job.externalId || job.status === 'success'
            ? 'این انتشار قبلاً توسط سرویس‌دهنده تأیید شده است و قابل لغو نیست'
            : 'این کار در وضعیت پایانی است و قابل لغو نیست'
      throw new JobNotCancellableError(message)
    }

    // Cross-check the first-class Publication record
    const publication = await this.repo.findPublicationForJob(job.id)
    if (
      publication &&
      (publication.providerAcknowledgedAt ||
        publication.status === 'published' ||
        publication.status === 'action_required' ||
        publication.status === 'cancelled')
    ) {
      throw new JobNotCancellableError(
        'این انتشار قبلاً توسط سرویس‌دهنده تأیید شده است و قابل لغو نیست'
      )
    }

    // Optimistic concurrency: only flip status if it's still cancellable at
    // the moment of the write — guards against a race with the worker
    // claiming the job between our read above and this update.
    const claimedCount = await this.repo.cancelIfStillCancellable(
      job.id,
      auth.workspaceId,
      Array.from(NON_CANCELLABLE_STATUSES)
    )
    if (claimedCount === 0) {
      throw new JobConcurrentChangeError()
    }

    if (publication) {
      await this.repo.syncPublicationCancelled(job.id)
    }

    // Issue #147 C: remove the BullMQ job so a still-waiting/delayed job
    // can't fire independently. Active jobs can't be force-removed here —
    // the worker's preflight DB check makes that a clean no-op instead.
    await this.removeOldBullJob(job.idempotencyKey, 'cancel')

    await writeAuditLog({
      action: 'publish.cancelled',
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      metadata: { jobId: job.id, previousStatus: job.status, platformId: job.platformId },
    })

    // Issue #147 B: recompute the parent Content aggregate immediately —
    // don't wait for the worker to run checkContentPublished, since a
    // waiting/delayed job that's cancelled here may never reach the worker.
    await checkContentPublished(job.contentId)

    return {
      ok: true,
      jobId: job.id,
      status: 'cancelled',
      message: 'انتشار لغو شد',
    }
  }

  /**
   * Best-effort removal of the BullMQ job tied to a given idempotencyKey
   * (used as the BullMQ jobId). Issue #147 C: prevents a stale waiting/delayed
   * job from firing independently after its DB record has moved on (cancel,
   * retry with a new key, or reschedule with a new key) — which would
   * otherwise duplicate the publish. A job that's already `active` can't be
   * force-removed here; the worker's own preflight DB check makes that case a
   * clean no-op instead of a duplicate provider call.
   */
  private async removeOldBullJob(
    idempotencyKey: string | null | undefined,
    context: string
  ): Promise<void> {
    if (!idempotencyKey) return
    try {
      await publishQueue.remove(idempotencyKey)
    } catch (err) {
      console.error(`[publish-jobs] failed to remove old BullMQ job (${context}):`, err)
    }
  }
}

