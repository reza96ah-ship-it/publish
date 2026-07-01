/**
 * BullMQ Queue instance for the worker.
 * Mirrors src/lib/queue.ts but for the worker process.
 * Also exports enqueuePublishJob for use by the outbox dispatcher.
 */

import { Queue } from 'bullmq'

// #111: REDIS_QUEUE_URL for BullMQ (noeviction policy); falls back to REDIS_URL
const REDIS_URL = process.env.REDIS_QUEUE_URL || process.env.REDIS_URL || 'redis://localhost:6379'

export const connection = {
  url: REDIS_URL,
}

export const publishQueue = new Queue('publish-jobs', { connection })

export async function enqueuePublishJob(opts: {
  jobId: string
  idempotencyKey: string
  contentId: string
  platformId: string
  workspaceId: string
  scheduledAt?: Date | null
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
      jobId: opts.idempotencyKey,
      delay: delay > 0 ? delay : undefined,
    }
  )
}
