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

// Issue #149: configure BullMQ job retention — bounded but sufficient for dedupe.
// Completed jobs kept for 24h (dedupe evidence), failed for 7 days (investigation).
// Never rely solely on Redis retention — durable identity is in PostgreSQL.
export const publishQueue = new Queue('publish-jobs', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 1000, age: 24 * 3600 }, // keep 1000 or 24h
    removeOnFail: { count: 5000, age: 7 * 24 * 3600 }, // keep 5000 or 7 days
  },
})

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
