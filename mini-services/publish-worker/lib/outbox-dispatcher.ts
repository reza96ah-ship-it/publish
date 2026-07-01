/**
 * Issue #148: Crash-safe, multi-dispatcher outbox with atomic claiming,
 * lease recovery, bounded retry, dead-letter handling, and operator replay.
 *
 * Key changes from the old dispatcher:
 *   1. Atomic claim: CTE SELECT FOR UPDATE SKIP LOCKED + UPDATE in one transaction
 *   2. Lease/fencing: lockExpiresAt prevents stale dispatchers from overwriting
 *   3. Dead-letter: exhausted events go to dead_letter state (not just 'failed')
 *   4. Deterministic BullMQ job IDs: tied to the publication, not random
 *   5. Graceful shutdown: stops claiming, releases active claims
 *   6. Metrics: pending age, claimed count, expired leases, DLQ count
 */

import { db } from './db'
import {
  outboxPendingGauge,
  outboxClaimedGauge,
  outboxDeadLetterGauge,
  outboxOldestPendingAgeGauge,
  outboxExpiredLeasesCounter,
  outboxDispatchFailuresCounter,
  outboxDeliveryLatencyHistogram,
} from './metrics'
import { enqueuePublishJob } from './queue'
import { randomUUID } from 'crypto'

const POLL_INTERVAL_MS = 2_000
const BATCH_SIZE = 20
const MAX_ATTEMPTS = 10
const LEASE_DURATION_MS = 30_000 // 30 seconds — if a dispatcher crashes, another can reclaim after this
const MAX_BACKOFF_MS = 300_000 // 5 minutes max backoff
const METRICS_REFRESH_INTERVAL_MS = 15_000 // how often to recompute pending/DLQ gauges

const INSTANCE_ID = randomUUID()

let running = false
let timer: ReturnType<typeof setTimeout> | null = null
let activeClaims = 0
let metricsTimer: ReturnType<typeof setInterval> | null = null

export function startOutboxDispatcher(): void {
  if (running) return
  running = true
  console.log(`[outbox] dispatcher started (instance=${INSTANCE_ID}, poll=${POLL_INTERVAL_MS}ms, lease=${LEASE_DURATION_MS}ms)`)
  scheduleTick()

  // Issue #148: periodically refresh the point-in-time gauges (pending count,
  // dead-letter count, oldest pending age) that aren't naturally updated by
  // the claim/delivery path.
  refreshGauges().catch((err) => console.error('[outbox] metrics refresh error:', err))
  metricsTimer = setInterval(() => {
    refreshGauges().catch((err) => console.error('[outbox] metrics refresh error:', err))
  }, METRICS_REFRESH_INTERVAL_MS)
}

/**
 * Issue #148: Recompute the outbox gauges that reflect point-in-time state
 * (as opposed to counters incremented at the moment something happens).
 */
async function refreshGauges(): Promise<void> {
  const [pendingCount, deadLetterCount, oldestPending] = await Promise.all([
    db.outboxEvent.count({ where: { status: 'pending' } }),
    db.outboxEvent.count({ where: { status: 'dead_letter' } }),
    db.outboxEvent.findFirst({
      where: { status: 'pending' },
      orderBy: { availableAt: 'asc' },
      select: { createdAt: true },
    }),
  ])

  outboxPendingGauge.set(pendingCount)
  outboxDeadLetterGauge.set(deadLetterCount)
  outboxOldestPendingAgeGauge.set(
    oldestPending ? (Date.now() - oldestPending.createdAt.getTime()) / 1000 : 0
  )
}

const SHUTDOWN_POLL_INTERVAL_MS = 100
const SHUTDOWN_DRAIN_TIMEOUT_MS = 30_000 // matches worker's overall stopTimeout

/**
 * Issue #148: Graceful shutdown — stop claiming new batches and actually
 * wait (poll) for any in-flight claims to finish delivering before
 * returning, up to a bounded timeout. Callers should `await` this before
 * proceeding with the rest of process shutdown.
 */
export async function stopOutboxDispatcher(timeoutMs: number = SHUTDOWN_DRAIN_TIMEOUT_MS): Promise<void> {
  running = false
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (metricsTimer) {
    clearInterval(metricsTimer)
    metricsTimer = null
  }

  if (activeClaims === 0) {
    console.log('[outbox] dispatcher stopped — no active claims')
    return
  }

  console.log(`[outbox] dispatcher stopping — waiting for ${activeClaims} active claim(s) to finish (timeout=${timeoutMs}ms)`)

  const deadline = Date.now() + timeoutMs
  while (activeClaims > 0 && Date.now() < deadline) {
    await sleep(SHUTDOWN_POLL_INTERVAL_MS)
  }

  if (activeClaims > 0) {
    console.warn(`[outbox] dispatcher stop timed out with ${activeClaims} active claim(s) still in flight`)
  } else {
    console.log('[outbox] dispatcher stopped — active claims drained')
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Issue #148: health/readiness for the dispatcher (separate from worker health).
 */
export function getDispatcherHealth() {
  return {
    running,
    instanceId: INSTANCE_ID,
    activeClaims,
    pollIntervalMs: POLL_INTERVAL_MS,
    maxAttempts: MAX_ATTEMPTS,
    leaseDurationMs: LEASE_DURATION_MS,
  }
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
  // Step 1: Recover expired leases (Issue #148: crash recovery)
  await recoverExpiredLeases()

  // Step 1b: Transition retry_wait events back to pending when backoff expires
  await recoverRetryWaitEvents()

  // Step 2: Atomically claim a batch of pending events
  const claimed = await claimBatch()
  if (claimed.length === 0) return

  console.log(`[outbox] claimed ${claimed.length} event(s) by ${INSTANCE_ID}`)
  activeClaims = claimed.length
  outboxClaimedGauge.set(activeClaims)

  // Step 3: Deliver each claimed event
  for (const event of claimed) {
    try {
      await deliverEvent(event)
    } catch (err) {
      await handleDeliveryFailure(event, err)
    }
  }

  activeClaims = 0
}

/**
 * Issue #148: Recover expired leases.
 * If a dispatcher crashed after claiming but before delivering, another
 * dispatcher can reclaim the row after the lease expires.
 * Uses conditional update (fencing) so a stale dispatcher can't overwrite
 * a newer owner's result.
 */
async function recoverExpiredLeases(): Promise<void> {
  const now = new Date()
  try {
    // Move expired claimed rows back to pending (fencing: only if lockExpiresAt < now)
    const result = await db.outboxEvent.updateMany({
      where: {
        status: 'claimed',
        lockExpiresAt: { lt: now },
      },
      data: {
        status: 'pending',
        lockedBy: null,
        lockedAt: null,
        lockExpiresAt: null,
      },
    })

    if (result.count > 0) {
      console.log(`[outbox] recovered ${result.count} expired lease(s)`)
    outboxExpiredLeasesCounter.inc(result.count)
    }
  } catch (err) {
    console.error('[outbox] lease recovery error:', err)
  }
}

/**
 * Issue #148: Atomically claim a batch of pending events.
 *
 * Uses a CTE (WITH ... SELECT FOR UPDATE SKIP LOCKED ... UPDATE ... RETURNING)
 * in a single transaction so the lock is held until the claim is recorded.
 * This prevents concurrent dispatchers from claiming the same rows.
 */
async function claimBatch(): Promise<ClaimedEvent[]> {
  const now = new Date()
  const lockExpiresAt = new Date(now.getTime() + LEASE_DURATION_MS)

  try {
    // Use $transaction with $executeRaw + $queryRaw for atomic claim
    const claimed = await db.$transaction(async (tx) => {
      // CTE: SELECT FOR UPDATE SKIP LOCKED then UPDATE in one atomic operation
      const rows = await tx.$queryRaw<ClaimedEvent[]>`
        WITH claimable AS (
          SELECT id
          FROM "OutboxEvent"
          WHERE status = 'pending'
            AND "availableAt" <= ${now}
            AND "attemptCount" < ${MAX_ATTEMPTS}
          ORDER BY "availableAt" ASC
          LIMIT ${BATCH_SIZE}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE "OutboxEvent"
        SET status = 'claimed',
            "lockedBy" = ${INSTANCE_ID},
            "lockedAt" = ${now},
            "lockExpiresAt" = ${lockExpiresAt},
            "updatedAt" = ${now}
        FROM claimable
        WHERE "OutboxEvent".id = claimable.id
        RETURNING
          "OutboxEvent".id,
          "OutboxEvent".payload,
          "OutboxEvent"."attemptCount",
          "OutboxEvent"."workspaceId",
          "OutboxEvent"."createdAt"
      `
      return rows
    })

    return claimed
  } catch (err) {
    console.error('[outbox] claim error:', err)
    return []
  }
}

interface ClaimedEvent {
  id: string
  payload: Record<string, unknown>
  attemptCount: number
  workspaceId: string
  createdAt: Date
}

/**
 * Issue #148: Deliver a claimed event to BullMQ.
 * Uses deterministic job ID tied to the publication (not random).
 * Marks delivered only after BullMQ acknowledges.
 */
async function deliverEvent(event: ClaimedEvent): Promise<void> {
  const p = event.payload as {
    jobId: string
    contentId: string
    platformId: string
    workspaceId: string
    scheduledAt: string | null
    idempotencyKey: string
    publicationId?: string
    revisionId?: string
  }

  // Issue #148: deterministic BullMQ job ID = publicationId (or idempotencyKey)
  // This ensures a retried delivery doesn't create a duplicate BullMQ job
  const deterministicJobId = p.publicationId || p.idempotencyKey || p.jobId

  await enqueuePublishJob({
    jobId: p.jobId,
    idempotencyKey: deterministicJobId, // Issue #148: deterministic, not random
    contentId: p.contentId,
    platformId: p.platformId,
    workspaceId: p.workspaceId,
    scheduledAt: p.scheduledAt ? new Date(p.scheduledAt) : null,
  })

  // Issue #148: mark delivered only after BullMQ acks (fencing: only update if still owned by us)
  const result = await db.outboxEvent.updateMany({
    where: {
      id: event.id,
      lockedBy: INSTANCE_ID, // fencing: don't overwrite if another dispatcher reclaimed it
      status: 'claimed',
    },
    data: {
      status: 'delivered',
      deliveredAt: new Date(),
      lockedBy: null,
      lockedAt: null,
      lockExpiresAt: null,
      lastError: null,
    },
  })

  if (result.count === 0) {
    // Our lease expired and another dispatcher reclaimed it — don't overwrite
    console.warn(`[outbox] event ${event.id} lease expired before delivery — another dispatcher may have reclaimed it`)
  } else {
    // Issue #148: observe end-to-end latency from event creation to delivery
    const latencySeconds = (Date.now() - event.createdAt.getTime()) / 1000
    outboxDeliveryLatencyHistogram.observe(latencySeconds)
    console.log(`[outbox] delivered event ${event.id} → job ${deterministicJobId}`)
  }
}

/**
 * Issue #148: Handle delivery failure with bounded retry + dead-letter.
 * Classifies errors: redis, db, serialization, payload, config.
 */
async function handleDeliveryFailure(event: ClaimedEvent, err: unknown): Promise<void> {
  const error = err instanceof Error ? err.message : String(err)
  const attempt = event.attemptCount + 1
  const errorCategory = classifyError(err)

  // Exponential backoff with jitter
  const baseBackoff = Math.min(Math.pow(2, attempt) * 1000, MAX_BACKOFF_MS)
  const jitter = Math.random() * 1000 // 0-1s jitter
  const backoffMs = baseBackoff + jitter
  const availableAt = new Date(Date.now() + backoffMs)

  // Fencing: only update if still owned by us
  const isExhausted = attempt >= MAX_ATTEMPTS

  const result = await db.outboxEvent.updateMany({
    where: {
      id: event.id,
      lockedBy: INSTANCE_ID,
      status: 'claimed',
    },
    data: {
      attemptCount: attempt,
      availableAt,
      lastError: error,
      lastErrorCategory: errorCategory,
      lastSafeError: safeErrorMessage(errorCategory, error),
      lockedBy: null,
      lockedAt: null,
      lockExpiresAt: null,
      status: isExhausted ? 'dead_letter' : 'retry_wait',
      deadLetteredAt: isExhausted ? new Date() : null,
    },
  })

  // Issue #148: increment dispatch failure + dead-letter metrics based on the
  // status we actually wrote (not a fake column on the Prisma model).
  outboxDispatchFailuresCounter.inc({ category: errorCategory })

  if (result.count === 0) {
    console.warn(`[outbox] event ${event.id} lease expired during failure — another dispatcher may have reclaimed it`)
  } else if (isExhausted) {
    console.error(`[outbox] event ${event.id} → DEAD LETTER (exhausted ${attempt} attempts): ${error}`)
  } else {
    console.error(`[outbox] event ${event.id} failed (attempt ${attempt}/${MAX_ATTEMPTS}): ${error} — retry in ${Math.round(backoffMs / 1000)}s`)
  }
}

/**
 * Classify errors into categories for metrics + retry decisions.
 */
export function classifyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('ECONNREFUSED') || msg.includes('Redis') || msg.includes('redis')) return 'redis'
  if (msg.includes('database') || msg.includes('prisma') || msg.includes('PG')) return 'db'
  if (msg.includes('serialize') || msg.includes('JSON')) return 'serialization'
  if (msg.includes('payload') || msg.includes('invalid')) return 'payload'
  return 'unknown'
}

/**
 * Safe error message (no secrets, no stack traces).
 */
export function safeErrorMessage(category: string, raw: string): string {
  switch (category) {
    case 'redis':
      return 'خطای ارتباط با صف Redis — سیستم بعداً تلاش می‌کند'
    case 'db':
      return 'خطای پایگاه داده — سیستم بعداً تلاش می‌کند'
    case 'serialization':
      return 'خطای پردازش داده — نیاز به بررسی'
    case 'payload':
      return 'داده نامعتبر — نیاز به بررسی'
    default:
      return 'خطای ناشناخته — سیستم بعداً تلاش می‌کند'
  }
}

/**
 * Issue #148: Cancel an outbox event (called when a publication is cancelled).
 * Prevents future enqueue of cancelled publications.
 */
export async function cancelOutboxEvent(eventId: string): Promise<boolean> {
  const result = await db.outboxEvent.updateMany({
    where: {
      id: eventId,
      status: { in: ['pending', 'claimed', 'retry_wait'] },
    },
    data: {
      status: 'cancelled',
      lockedBy: null,
      lockedAt: null,
      lockExpiresAt: null,
    },
  })
  return result.count > 0
}

/**
 * Issue #148: Replay a dead-lettered event.
 * Creates a new pending event from the dead-lettered one, preserving the original.
 */
export async function replayOutboxEvent(eventId: string, replayedByUserId: string): Promise<string | null> {
  const original = await db.outboxEvent.findUnique({
    where: { id: eventId },
  })

  if (!original) return null
  if (original.status !== 'dead_letter') return null

  // Create a new pending event from the original payload
  const newEventId = randomUUID()
  await db.outboxEvent.create({
    data: {
      id: newEventId,
      workspaceId: original.workspaceId,
      aggregateType: original.aggregateType,
      aggregateId: original.aggregateId,
      eventType: original.eventType,
      payload: original.payload as any, // Prisma JSON type
      traceParent: original.traceParent,
      status: 'pending',
      attemptCount: 0,
      availableAt: new Date(),
      replayedFromId: original.id,
    },
  })

  // Write audit event
  try {
    await db.auditLog.create({
      data: {
        userId: replayedByUserId,
        workspaceId: original.workspaceId,
        action: 'outbox.replayed',
        resource: 'OutboxEvent',
        metadata: {
          originalEventId: eventId,
          newEventId,
          originalAttempts: original.attemptCount,
        },
      },
    })
  } catch {
    // Non-fatal — audit log failure shouldn't block replay
  }

  console.log(`[outbox] replayed event ${eventId} → new event ${newEventId}`)
  return newEventId
}

/**
 * Issue #148: Transition retry_wait events back to pending when their backoff expires.
 */
async function recoverRetryWaitEvents(): Promise<void> {
  const now = new Date()
  const result = await db.outboxEvent.updateMany({
    where: {
      status: 'retry_wait',
      availableAt: { lte: now },
    },
    data: {
      status: 'pending',
    },
  })

  if (result.count > 0) {
    console.log(`[outbox] transitioned ${result.count} retry_wait → pending (backoff expired)`)
  }
}
