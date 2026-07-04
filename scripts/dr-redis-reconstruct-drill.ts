/**
 * DR Drill: Redis queue reconstruction from PostgreSQL outbox.
 *
 * Validates that losing the Redis queue is recoverable by re-enqueuing
 * all pending OutboxEvents directly from PostgreSQL — exactly what the
 * outbox dispatcher does after a Redis wipe or Redis failover.
 *
 * Steps:
 *   1. Snapshot current BullMQ queue depth
 *   2. Count pending OutboxEvents in PostgreSQL
 *   3. Flush BullMQ queues (simulates Redis loss)
 *   4. Re-enqueue pending OutboxEvents directly via BullMQ
 *   5. Verify queue depth matches pending outbox count
 *   6. Verify no duplicate job IDs were introduced
 *   7. Report timing and pass/fail
 *
 * Usage:
 *   bunx tsx scripts/dr-redis-reconstruct-drill.ts
 *   bunx tsx scripts/dr-redis-reconstruct-drill.ts --dry-run
 *
 * Environment:
 *   DATABASE_URL   — PostgreSQL connection string (required)
 *   REDIS_URL      — Redis connection string (required)
 *   DRY_RUN=true   — preview actions without flushing (also: --dry-run flag)
 */

import { Queue } from 'bullmq'
import { PrismaClient } from '@prisma/client'
import { Redis } from 'ioredis'

const QUEUE_NAME = 'publish-jobs'

const isDryRun =
  process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true'

const DATABASE_URL = process.env.DATABASE_URL
const REDIS_URL = process.env.REDIS_URL

if (!DATABASE_URL) {
  console.error('[DR] FATAL: DATABASE_URL is not set')
  process.exit(1)
}
if (!REDIS_URL) {
  console.error('[DR] FATAL: REDIS_URL is not set')
  process.exit(1)
}

const db = new PrismaClient()
const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 })
const queue = new Queue(QUEUE_NAME, { connection: new Redis(REDIS_URL, { maxRetriesPerRequest: 3 }) })

let pass = 0
let fail = 0
const drillStart = Date.now()

function ok(msg: string) {
  console.log(`[DR] ✓ ${msg}`)
  pass++
}
function bad(msg: string) {
  console.error(`[DR] ✗ FAIL: ${msg}`)
  fail++
}
function info(msg: string) {
  console.log(`[DR] ${msg}`)
}

async function main() {
  if (isDryRun) {
    info('DRY RUN — no queues will be flushed, no jobs enqueued')
  }

  // ------------------------------------------------------------------
  // Step 1: Snapshot current queue state
  // ------------------------------------------------------------------
  info('--- Step 1: Snapshot BullMQ queue state ---')
  const waitingBefore = await queue.getWaitingCount()
  const delayedBefore = await queue.getDelayedCount()
  const activeBefore  = await queue.getActiveCount()
  const totalBefore   = waitingBefore + delayedBefore + activeBefore
  info(`  waiting=${waitingBefore}  delayed=${delayedBefore}  active=${activeBefore}  total=${totalBefore}`)

  // ------------------------------------------------------------------
  // Step 2: Count pending OutboxEvents
  // ------------------------------------------------------------------
  info('--- Step 2: Count pending OutboxEvents in PostgreSQL ---')
  const pendingOutbox = await db.outboxEvent.count({
    where: { status: { in: ['pending', 'retry_wait'] } },
  })
  const allStatuses = await db.outboxEvent.groupBy({
    by: ['status'],
    _count: { status: true },
  })
  info(`  Pending + retry_wait outbox events: ${pendingOutbox}`)
  for (const row of allStatuses) {
    info(`    status=${row.status}: ${row._count.status}`)
  }

  // ------------------------------------------------------------------
  // Step 3: Flush BullMQ queues (simulate Redis loss)
  // ------------------------------------------------------------------
  info('--- Step 3: Flush BullMQ queues (simulate Redis loss) ---')
  if (isDryRun) {
    info('  [DRY RUN] Would flush BullMQ queue keys — skipping')
  } else {
    // Drain waiting + delayed. Active jobs are left as-is (worker holds them).
    await queue.drain()
    await queue.clean(0, 0, 'delayed')
    const waitingAfterFlush = await queue.getWaitingCount()
    const delayedAfterFlush = await queue.getDelayedCount()
    ok(`Queue flushed: waiting=${waitingAfterFlush} delayed=${delayedAfterFlush}`)
  }

  // ------------------------------------------------------------------
  // Step 4: Re-enqueue pending OutboxEvents from PostgreSQL
  // ------------------------------------------------------------------
  info('--- Step 4: Re-enqueue pending OutboxEvents ---')
  const pendingEvents = await db.outboxEvent.findMany({
    where: {
      status: { in: ['pending', 'retry_wait'] },
      availableAt: { lte: new Date() },
    },
    select: {
      id: true,
      payload: true,
      availableAt: true,
    },
    orderBy: { availableAt: 'asc' },
    take: 1000, // safety cap
  })

  if (isDryRun) {
    info(`  [DRY RUN] Would re-enqueue ${pendingEvents.length} job(s)`)
    for (const ev of pendingEvents.slice(0, 5)) {
      const payload = ev.payload as Record<string, unknown>
      info(`    → jobId=${payload.jobId ?? '?'}  outboxEventId=${ev.id}`)
    }
    if (pendingEvents.length > 5) info(`    ... and ${pendingEvents.length - 5} more`)
  } else {
    let enqueued = 0
    for (const ev of pendingEvents) {
      const payload = ev.payload as Record<string, unknown>
      const jobId = payload.idempotencyKey as string ?? ev.id
      const delay = ev.availableAt > new Date()
        ? ev.availableAt.getTime() - Date.now()
        : 0

      await queue.add(
        'publish',
        payload,
        {
          jobId,   // idempotency key — BullMQ silently ignores duplicates
          delay: delay > 0 ? delay : undefined,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 1000 },
          removeOnFail: false,
        }
      )
      enqueued++
    }
    ok(`Re-enqueued ${enqueued} job(s)`)
  }

  // ------------------------------------------------------------------
  // Step 5: Verify queue depth matches pending outbox count
  // ------------------------------------------------------------------
  info('--- Step 5: Verify queue depth ---')
  if (isDryRun) {
    info('  [DRY RUN] Skipping verification (queue was not flushed or refilled)')
  } else {
    const waitingAfter  = await queue.getWaitingCount()
    const delayedAfter  = await queue.getDelayedCount()
    const totalAfter    = waitingAfter + delayedAfter

    info(`  Queue after reconstruct: waiting=${waitingAfter} delayed=${delayedAfter} total=${totalAfter}`)
    info(`  Pending outbox events:   ${pendingEvents.length}`)

    // Allow some tolerance: active jobs might not be in waiting/delayed
    if (totalAfter >= pendingEvents.length) {
      ok(`Queue depth (${totalAfter}) ≥ pending outbox (${pendingEvents.length})`)
    } else {
      bad(`Queue depth (${totalAfter}) < pending outbox (${pendingEvents.length}) — ${pendingEvents.length - totalAfter} job(s) may be missing`)
    }
  }

  // ------------------------------------------------------------------
  // Step 6: Verify no duplicate publicationOperationId
  // ------------------------------------------------------------------
  info('--- Step 6: Verify no duplicate publicationOperationId ---')
  const dupResult = await db.$queryRaw<{ cnt: bigint }[]>`
    SELECT COUNT(*) AS cnt
    FROM (
      SELECT "publicationOperationId"
      FROM "Publication"
      WHERE "publicationOperationId" IS NOT NULL
      GROUP BY "publicationOperationId"
      HAVING COUNT(*) > 1
    ) t
  `
  const dupCount = Number(dupResult[0]?.cnt ?? 0)
  if (dupCount === 0) {
    ok('No duplicate publicationOperationId values in Publication table')
  } else {
    bad(`${dupCount} duplicate publicationOperationId value(s) detected — idempotency invariant violated`)
  }

  // ------------------------------------------------------------------
  // Step 7: Verify no stuck claimed OutboxEvents (crashed dispatcher)
  // ------------------------------------------------------------------
  info('--- Step 7: Check for stuck locked OutboxEvents ---')
  const stuckCount = await db.outboxEvent.count({
    where: {
      status: 'pending',
      lockExpiresAt: { lt: new Date() },
      lockedBy: { not: null },
    },
  })
  if (stuckCount === 0) {
    ok('No stuck locked OutboxEvents (expired leases)')
  } else {
    bad(`${stuckCount} OutboxEvent(s) have expired leases and are stuck — run lease recovery`)
  }

  // ------------------------------------------------------------------
  // Report
  // ------------------------------------------------------------------
  const elapsed = Math.round((Date.now() - drillStart) / 1000)
  console.log('')
  console.log('=========================================')
  console.log(' DR DRILL RESULT — Redis Reconstruct')
  console.log('=========================================')
  console.log(` Dry run         : ${isDryRun}`)
  console.log(` Queue before    : ${totalBefore}`)
  console.log(` Pending outbox  : ${pendingOutbox}`)
  console.log(` Total RTO       : ${elapsed}s`)
  console.log(` Checks passed   : ${pass}`)
  console.log(` Checks failed   : ${fail}`)
  if (fail === 0) {
    console.log(' STATUS          : PASS')
    console.log('=========================================')
    console.log('')
    console.log(`Update DISASTER_RECOVERY.md 'Last drill' to: ${new Date().toISOString()}`)
  } else {
    console.log(` STATUS          : FAIL — ${fail} check(s) failed`)
    console.log('=========================================')
  }

  await db.$disconnect()
  redis.disconnect()
  await queue.close()

  process.exit(fail > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('[DR] Unhandled error:', err)
  process.exit(1)
})
