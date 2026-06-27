/**
 * BullMQ Queue instance for the worker.
 * Mirrors src/lib/queue.ts but for the worker process.
 */

import { Queue } from 'bullmq'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

export const connection = {
  url: REDIS_URL,
}

export const publishQueue = new Queue('publish-jobs', { connection })
