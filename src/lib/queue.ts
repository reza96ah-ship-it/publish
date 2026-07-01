/**
 * BullMQ Queue — publish-jobs queue.
 *
 * Used by:
 *   - /api/publish (Next.js API) → enqueue jobs via publishQueue.add()
 *   - publish-worker (mini-service) → Worker processes jobs from this queue
 *
 * Redis connection from REDIS_URL env var.
 */

import { Queue } from 'bullmq'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

export const connection = {
  url: REDIS_URL,
}

export const publishQueue = new Queue('publish-jobs', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 1000, // base 1s, factor 2, BullMQ caps at 5min automatically
    },
    removeOnComplete: { count: 100 }, // keep last 100 completed jobs
    removeOnFail: { count: 500 }, // keep last 500 failed jobs for debugging
  },
})

/**
 * Enqueue a publish job.
 * Called from /api/publish/route.ts after creating the DB PublishJob record.
 *
 * Uses idempotencyKey as BullMQ jobId — prevents duplicate enqueues.
 * Supports delayed scheduling via the `delay` option.
 */
export async function enqueuePublishJob(opts: {
  jobId: string // PublishJob.id (DB record)
  idempotencyKey: string // Used as BullMQ jobId for dedup
  contentId: string
  platformId: string
  workspaceId: string
  scheduledAt?: Date | null // If set, delay the job until this time
  /**
   * Issue #155: W3C traceparent header value. Propagated through BullMQ job
   * data so the worker can continue the trace when it picks up the job.
   * The outbox dispatcher reads this from OutboxEvent.traceParent.
   */
  traceParent?: string | null
}): Promise<void> {
  const delay = opts.scheduledAt ? Math.max(0, opts.scheduledAt.getTime() - Date.now()) : 0

  await publishQueue.add(
    'publish',
    {
      jobId: opts.jobId,
      contentId: opts.contentId,
      platformId: opts.platformId,
      workspaceId: opts.workspaceId,
      // Issue #155: traceparent for distributed tracing continuity.
      ...(opts.traceParent ? { traceParent: opts.traceParent } : {}),
    },
    {
      jobId: opts.idempotencyKey, // BullMQ dedup — same key = same job
      delay: delay > 0 ? delay : undefined,
    }
  )
}
