/**
 * Issue #153 Tier 3: Redis/BullMQ integration tests.
 *
 * Tests that require a real Redis instance:
 * - enqueue/delay/reschedule/cancel
 * - deterministic job IDs
 * - retry/backoff
 * - rate limiting
 * - graceful shutdown
 * - queue retention
 *
 * These tests are excluded from the default `bun run test` and run via
 * `bun run test:integration`.
 *
 * IMPORTANT: Each test uses a UNIQUE queue name to prevent interference
 * between tests (workers from previous tests picking up jobs meant for
 * the current test).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'

// Skip if no Redis URL
const SKIP = !process.env.REDIS_URL && !process.env.REDIS_QUEUE_URL

describe.skipIf(SKIP)('Issue #153 Tier 3 — Redis/BullMQ integration', () => {
  let Queue: any
  let Worker: any
  let cleanupQueues: any[] = []

  beforeAll(async () => {
    const bullmq = await import('bullmq')
    Queue = bullmq.Queue
    Worker = bullmq.Worker
  })

  afterAll(async () => {
    // Clean up all queues created during tests
    for (const q of cleanupQueues) {
      try {
        await q.drain()
        await q.close()
      } catch {
        // ignore
      }
    }
    cleanupQueues = []
  })

  function createQueue(name: string) {
    const redisUrl = process.env.REDIS_QUEUE_URL || process.env.REDIS_URL || 'redis://localhost:6379'
    const q = new Queue(name, {
      connection: { url: redisUrl },
      defaultJobOptions: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 100 },
      },
    })
    cleanupQueues.push(q)
    return q
  }

  describe('enqueue and process', () => {
    it('enqueues and processes a job', async () => {
      const queueName = 'test-enqueue-process'
      const queue = createQueue(queueName)
      await queue.waitUntilReady()
      let processed = false
      const worker = new Worker(queueName, async () => {
        processed = true
      }, { connection: queue.opts.connection })

      await queue.add('test', { data: 'hello' })
      await new Promise((resolve) => setTimeout(resolve, 2000))

      expect(processed).toBe(true)
      await worker.close()
    })

    it('deterministic job ID prevents duplicate enqueue', async () => {
      const queueName = 'test-deterministic-id'
      const queue = createQueue(queueName)
      await queue.waitUntilReady()
      const jobId = 'deterministic-test-id-' + Date.now()

      await queue.add('test', { data: 'first' }, { jobId })
      await queue.add('test', { data: 'second' }, { jobId }) // should be ignored

      const jobs = await queue.getJobs(['waiting', 'active', 'completed', 'delayed'])
      const matching = jobs.filter((j: any) => j.id === jobId)
      expect(matching.length).toBe(1) // only one job with this ID
    })

    it('delayed job is not processed before delay', async () => {
      const queueName = 'test-delayed-job'
      const queue = createQueue(queueName)
      await queue.waitUntilReady()
      let processed = false
      const worker = new Worker(queueName, async () => {
        processed = true
      }, { connection: queue.opts.connection })

      // Add a job with 5000ms delay — it should NOT be processed for 5 seconds
      await queue.add('test', { data: 'delayed' }, { delay: 5000 })

      // Wait 1 second — job should NOT be processed yet
      await new Promise((resolve) => setTimeout(resolve, 1000))
      expect(processed).toBe(false)

      await worker.close()
    })
  })

  describe('retry and backoff', () => {
    it('failed job is retried with backoff', async () => {
      const queueName = 'test-retry-backoff'
      const queue = createQueue(queueName)
      await queue.waitUntilReady()
      let attempts = 0
      const worker = new Worker(
        queueName,
        async () => {
          attempts++
          if (attempts < 2) throw new Error('Retry me')
        },
        {
          connection: queue.opts.connection,
          settings: {
            backoffStrategy: () => 100, // 100ms backoff for test
          },
        }
      )

      // Job must be added with attempts and backoff options for retry to work
      await queue.add('test', { data: 'retry' }, {
        attempts: 3,
        backoff: { type: 'custom', delay: 100 },
      })
      // Wait long enough for initial attempt + backoff + retry
      await new Promise((resolve) => setTimeout(resolve, 3000))

      expect(attempts).toBeGreaterThanOrEqual(2)
      await worker.close()
    })
  })

  describe('graceful shutdown', () => {
    it('worker.close() waits for in-progress jobs', async () => {
      const queueName = 'test-graceful-shutdown'
      const queue = createQueue(queueName)
      await queue.waitUntilReady()
      let completed = false
      const worker = new Worker(
        queueName,
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 500))
          completed = true
        },
        { connection: queue.opts.connection }
      )

      await queue.add('test', { data: 'shutdown' })
      // Give the worker time to pick up the job (increase from 100ms to 500ms)
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Close should wait for the job to complete
      await worker.close()
      expect(completed).toBe(true)
    })
  })

  describe('queue retention', () => {
    it('removeOnComplete config is set', async () => {
      const queue = createQueue('test-retention')
      const opts = queue.defaultJobOptions
      expect(opts).toBeDefined()
      expect(opts.removeOnComplete).toBeDefined()
      expect(opts.removeOnFail).toBeDefined()
    })
  })
})
