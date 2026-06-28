/**
 * BullMQ Queue instance for the worker.
 * Mirrors src/lib/queue.ts but for the worker process.
 * Also exports enqueuePublishJob for use by the outbox dispatcher.
 */

import { Queue } from 'bullmq'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

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
  await publishQueue.add(
    'publish',
    {
      jobId: opts.jobId,
      contentId: opts.contentId,
      platformId: opts.platformId,
      workspaceId: opts.workspaceId,
    },
    {
      jobId: opts.idempotencyKey,
      delay: delay > 0 ? delay : undefined,
    }
  )
}
