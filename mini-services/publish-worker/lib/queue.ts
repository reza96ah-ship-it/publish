/**
 * BullMQ Queue instance for the worker.
 * Mirrors src/lib/queue.ts but for the worker process.
 * Also exports enqueuePublishJob for use by the outbox dispatcher.
 *
 * Issue #148: enqueuePublishJob now uses deterministic job IDs (tied to the
 * publication, not random). "Job already exists" is treated as idempotent
 * success — the event is already in the queue.
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
}): Promise<void> {
  const delay = opts.scheduledAt ? Math.max(0, opts.scheduledAt.getTime() - Date.now()) : 0

  try {
    await publishQueue.add(
      'publish',
      {
        jobId: opts.jobId,
        contentId: opts.contentId,
        platformId: opts.platformId,
        workspaceId: opts.workspaceId,
      },
      {
        // Issue #148: deterministic job ID = idempotencyKey (publicationId or stable key)
        // This ensures a retried delivery doesn't create a duplicate BullMQ job.
        jobId: opts.idempotencyKey,
        delay: delay > 0 ? delay : undefined,
      }
    )
  } catch (err: any) {
    // Issue #148: BullMQ throws if a job with the same ID already exists.
    // This is an idempotent success — the job is already in the queue.
    if (err?.message?.includes('Job already exists') || err?.code === 'EEXIST') {
      console.log(`[queue] job ${opts.idempotencyKey} already exists — treating as idempotent success`)
      return
    }
    throw err
  }
}
