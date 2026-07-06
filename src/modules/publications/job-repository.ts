/**
 * Issue #156: Publications module — publish-job lifecycle repository.
 *
 * Data access for retry/cancel/reschedule/discard. Kept separate from
 * repository.ts (Issue #124) so the original publication-creation
 * repository stays focused.
 *
 * BullMQ queue operations (publishQueue.remove / enqueuePublishJob) are
 * NOT done here — they are infrastructure. The service orchestrates them
 * alongside repository mutations.
 */

import { db } from '@/lib/db'
import type { PublishJobRow, PublicationRow } from './job-types'

function toJobRow(j: NonNullable<Awaited<ReturnType<typeof db.publishJob.findFirst>>>): PublishJobRow {
  return {
    id: j.id,
    workspaceId: j.workspaceId,
    contentId: j.contentId,
    platformId: j.platformId,
    status: j.status,
    processLabel: j.processLabel,
    progress: j.progress,
    retryCount: j.retryCount,
    error: j.error,
    idempotencyKey: j.idempotencyKey,
    scheduledAt: j.scheduledAt,
    startedAt: j.startedAt,
    completedAt: j.completedAt,
    externalId: j.externalId,
    thumbnailUrl: j.thumbnailUrl,
  }
}

export class PublishJobRepository {
  /** Find a PublishJob by id, scoped to a workspace (object-level tenant auth). */
  async findByIdInWorkspace(
    id: string,
    workspaceId: string
  ): Promise<PublishJobRow | null> {
    const job = await db.publishJob.findFirst({ where: { id, workspaceId } })
    return job ? toJobRow(job) : null
  }

  /** Reschedule: new scheduledAt, status=scheduled, new idempotency key. */
  async reschedule(
    id: string,
    scheduledAt: Date,
    newIdempotencyKey: string
  ): Promise<PublishJobRow> {
    const updated = await db.publishJob.update({
      where: { id },
      data: {
        scheduledAt,
        status: 'scheduled',
        processLabel: 'زمان‌بندی مجدد شد',
        error: null,
        idempotencyKey: newIdempotencyKey,
      },
    })
    return toJobRow(updated)
  }

  /** Retry: re-arm idempotency key, reset retryCount, status=pending, clear terminal fields. */
  async retry(
    id: string,
    newIdempotencyKey: string
  ): Promise<PublishJobRow> {
    const updated = await db.publishJob.update({
      where: { id },
      data: {
        status: 'pending',
        retryCount: 0,
        progress: 0,
        processLabel: 'در انتظار تلاش مجدد',
        error: null,
        idempotencyKey: newIdempotencyKey,
        scheduledAt: null,
        startedAt: null,
        completedAt: null,
        externalId: null,
      },
    })
    return toJobRow(updated)
  }

  /** Discard: terminal failed status, clear scheduledAt. */
  async discard(id: string): Promise<PublishJobRow> {
    const updated = await db.publishJob.update({
      where: { id },
      data: {
        status: 'failed',
        processLabel: 'دست‌نگار discard شد',
        scheduledAt: null,
        completedAt: new Date(),
      },
    })
    return toJobRow(updated)
  }

  /**
   * Cancel with optimistic concurrency: only flip status if it's still
   * cancellable at the moment of the write — guards against a race with the
   * worker claiming the job between our read above and this update.
   *
   * Returns 1 if the flip happened, 0 if a concurrent change beat us.
   */
  async cancelIfStillCancellable(
    id: string,
    workspaceId: string,
    nonCancellableStatuses: string[]
  ): Promise<number> {
    const claimed = await db.publishJob.updateMany({
      where: {
        id,
        workspaceId,
        status: { notIn: nonCancellableStatuses },
      },
      data: {
        status: 'cancelled',
        processLabel: 'لغو شد',
        scheduledAt: null,
        completedAt: new Date(),
      },
    })
    return claimed.count
  }

  /** Sync the first-class Publication record to cancelled (best-effort). */
  async syncPublicationCancelled(
    publishJobId: string
  ): Promise<void> {
    await (db as unknown as {
      publication: {
        update: (args: unknown) => Promise<unknown>
      }
    }).publication
      .update({
        where: { publishJobId },
        data: { status: 'cancelled', completedAt: new Date() },
      })
      .catch((err: unknown) =>
        // eslint-disable-next-line no-console
        console.error('[publish-jobs] failed to sync Publication on cancel:', err)
      )
  }

  /** Find the first-class Publication tied to a PublishJob (cancel guard). */
  async findPublicationForJob(
    publishJobId: string
  ): Promise<PublicationRow | null> {
    const pub = await (db as unknown as {
      publication: {
        findFirst: (args: unknown) => Promise<PublicationRow | null>
      }
    }).publication.findFirst({ where: { publishJobId } })
    return pub
  }
}
