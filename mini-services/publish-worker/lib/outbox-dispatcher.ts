/**
 * MISS-01: Transactional outbox dispatcher.
 *
 * Polls OutboxEvent rows with status='pending' and availableAt <= now,
 * claims them with FOR UPDATE SKIP LOCKED (prevents double-delivery by
 * concurrent dispatcher instances), then enqueues to BullMQ and marks
 * them as delivered.
 *
 * If BullMQ is unavailable, the event stays pending and will be retried
 * on the next poll tick with exponential backoff via availableAt.
 */

import { db } from './db'
import { enqueuePublishJob } from './queue'
import { randomUUID } from 'crypto'

const POLL_INTERVAL_MS = 2_000 // poll every 2 seconds
const BATCH_SIZE = 20 // max events per poll tick
const MAX_ATTEMPTS = 10 // give up after 10 consecutive failures

const INSTANCE_ID = randomUUID() // unique per dispatcher process

let running = false
let timer: ReturnType<typeof setTimeout> | null = null

export function startOutboxDispatcher(): void {
  if (running) return
  running = true
  console.log(`[outbox] dispatcher started (instance=${INSTANCE_ID}, poll=${POLL_INTERVAL_MS}ms)`)
  scheduleTick()
}

export function stopOutboxDispatcher(): void {
  running = false
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  console.log('[outbox] dispatcher stopped')
}

function scheduleTick() {
  if (!running) return
  timer = setTimeout(async () => {
    try {
      await tick()
    } catch (err) {
      console.error('[outbox] tick error:', err)
    }
    scheduleTick()
  }, POLL_INTERVAL_MS)
}

async function tick(): Promise<void> {
  // Claim a batch of pending events with FOR UPDATE SKIP LOCKED.
  // Prisma doesn't support SKIP LOCKED natively — use $queryRaw.
  const now = new Date()
  const events = await db.$queryRaw<
    {
      id: string
      payload: Record<string, unknown>
      attemptCount: number
    }[]
  >`
    SELECT id, payload, "attemptCount"
    FROM "OutboxEvent"
    WHERE status = 'pending'
      AND "availableAt" <= ${now}
      AND "attemptCount" < ${MAX_ATTEMPTS}
    ORDER BY "availableAt" ASC
    LIMIT ${BATCH_SIZE}
    FOR UPDATE SKIP LOCKED
  `

  if (events.length === 0) return

  console.log(`[outbox] claiming ${events.length} event(s)`)

  for (const event of events) {
    try {
      const p = event.payload as {
        jobId: string
        contentId: string
        platformId: string
        workspaceId: string
        scheduledAt: string | null
        idempotencyKey: string
      }

      await enqueuePublishJob({
        jobId: p.jobId,
        idempotencyKey: p.idempotencyKey,
        contentId: p.contentId,
        platformId: p.platformId,
        workspaceId: p.workspaceId,
        scheduledAt: p.scheduledAt ? new Date(p.scheduledAt) : null,
      })

      await db.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: 'delivered',
          deliveredAt: new Date(),
          lockedBy: INSTANCE_ID,
          lastError: null,
        },
      })

      console.log(`[outbox] delivered event ${event.id} → job ${p.jobId}`)
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      const attempt = event.attemptCount + 1
      // Exponential backoff: 2^attempt seconds (capped at 5 minutes)
      const backoffSec = Math.min(Math.pow(2, attempt), 300)
      const availableAt = new Date(Date.now() + backoffSec * 1000)

      await db.outboxEvent.update({
        where: { id: event.id },
        data: {
          attemptCount: attempt,
          availableAt,
          lastError: error,
          lockedBy: null,
          lockedAt: null,
          status: attempt >= MAX_ATTEMPTS ? 'failed' : 'pending',
        },
      })

      console.error(
        `[outbox] failed event ${event.id} (attempt ${attempt}/${MAX_ATTEMPTS}): ${error}`
      )
    }
  }
}
