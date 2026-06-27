/**
 * Nashrino Publish Worker — polls the DB for pending/scheduled publish jobs,
 * processes them through channel adapters with retry/backoff/circuit-breaker,
 * and emits status changes to the realtime WebSocket service.
 *
 * Architecture (per docs/05_TECHNICAL_ARCHITECTURE.md §4):
 * - Per-channel polling (all channels polled in one loop)
 * - Idempotent: checks externalId before retry
 * - Exponential backoff: base 1s, factor 2, cap 5min, jitter ±20%
 * - Circuit breaker: 5 consecutive failures → OPEN, health-check every 60s
 * - Job state machine: pending → processing → success|failed|action
 *
 * Phase 2 additions:
 * - Health HTTP server on port 3002 (GET /health)
 * - Graceful shutdown (SIGTERM/SIGINT) — stops polling, awaits in-flight jobs
 */
import { createServer } from 'http'
import { db } from './lib/db'
import { getAdapter } from './adapters'
import type { AdapterJob } from './adapters/types'
import { CHANNEL_RETRY_POLICIES, computeBackoff, shouldRetry, sleep } from './lib/retry'
import { circuitBreakers } from './lib/circuit'
import { emitJobStatus } from './lib/emit'
import { decrypt } from './lib/crypto'

const POLL_INTERVAL_MS = 2000 // poll every 2s
const VISIBILITY_TIMEOUT_MS = 5 * 60 * 1000 // requeue processing jobs stuck for 5min
const HEALTH_PORT = parseInt(process.env.WORKER_HEALTH_PORT || '3002', 10)

// ── Graceful shutdown state ───────────────────────────────────
let shuttingDown = false
let inFlightJobs = 0
const startTime = Date.now()

async function main() {
  console.log(`[worker] publish-worker started (health on :${HEALTH_PORT})`)
  console.log(`[worker] polling DB every ${POLL_INTERVAL_MS}ms`)

  // Start health HTTP server
  startHealthServer()

  // Main loop
  while (!shuttingDown) {
    try {
      await processDueJobs()
      await requeueStuckJobs()
    } catch (err) {
      console.error('[worker] error in poll cycle:', err)
    }
    await sleep(POLL_INTERVAL_MS)
  }

  console.log('[worker] polling stopped, waiting for in-flight jobs...')
  // Wait for in-flight jobs to complete (max 30s)
  const shutdownStart = Date.now()
  while (inFlightJobs > 0 && Date.now() - shutdownStart < 30_000) {
    console.log(`[worker] waiting for ${inFlightJobs} in-flight job(s)...`)
    await sleep(1000)
  }
  console.log('[worker] shutdown complete')
  process.exit(0)
}

async function processDueJobs(): Promise<void> {
  const now = new Date()

  // Find pending jobs that are due (scheduledAt is null or in the past)
  const jobs = await db.publishJob.findMany({
    where: {
      status: 'pending',
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
    },
    include: {
      content: true,
      platform: true,
      workspace: { select: { id: true } },
    },
    take: 10, // process up to 10 per cycle
    orderBy: { createdAt: 'asc' },
  })

  for (const job of jobs) {
    // Check circuit breaker
    if (!circuitBreakers.canDispatch(job.workspaceId, job.platform.type)) {
      console.log(`[worker] circuit OPEN for ${job.platform.type}, skipping ${job.id}`)
      continue
    }

    // Process asynchronously so jobs run concurrently
    inFlightJobs++
    processJob(job)
      .catch((err) => {
        console.error(`[worker] unhandled error processing job ${job.id}:`, err)
      })
      .finally(() => {
        inFlightJobs--
      })
  }
}

async function requeueStuckJobs(): Promise<void> {
  const cutoff = new Date(Date.now() - VISIBILITY_TIMEOUT_MS)
  const stuck = await db.publishJob.findMany({
    where: {
      status: 'processing',
      startedAt: { lt: cutoff },
    },
    select: { id: true },
  })
  for (const job of stuck) {
    await db.publishJob.update({
      where: { id: job.id },
      data: { status: 'pending', processLabel: 'بازگردانده شده به صف (worker timeout)' },
    })
    console.log(`[worker] requeued stuck job ${job.id}`)
  }
}

async function processJob(job: any): Promise<void> {
  const adapter = getAdapter(job.platform.type)
  if (!adapter) {
    await markFailed(job, `آداپتور پلتفرم «${job.platform.type}» یافت نشد`, false)
    return
  }

  // Transition to processing (outbox pattern — persist before side effect)
  await db.publishJob.update({
    where: { id: job.id },
    data: {
      status: 'processing',
      startedAt: new Date(),
      processLabel: 'شروع پردازش',
      progress: 5,
    },
  })
  await emit(job, 'processing', 5, 'شروع پردازش', null)

  // Idempotency check: if already has externalId, skip
  if (job.externalId) {
    await db.publishJob.update({
      where: { id: job.id },
      data: {
        status: 'success',
        progress: 100,
        processLabel: 'منتشر شد (تأیید همخوانی)',
        completedAt: new Date(),
      },
    })
    await emit(job, 'success', 100, 'منتشر شد', null)
    return
  }

  const adapterJob: AdapterJob = {
    id: job.id,
    idempotencyKey: job.idempotencyKey || job.id,
    retryCount: job.retryCount,
    content: {
      id: job.content.id,
      title: job.content.title,
      body: job.content.body,
      hashtags: job.content.hashtags,
      thumbnailUrl: job.content.thumbnailUrl,
      // If content has a thumbnail, pass it as a media item so adapters can publish it
      mediaItems: job.content.thumbnailUrl
        ? [{ type: 'photo' as const, url: job.content.thumbnailUrl }]
        : undefined,
    },
    account: {
      id: job.platform.id,
      type: job.platform.type,
      username: job.platform.username,
      status: job.platform.status,
      circuitState: job.platform.circuitState as 'closed' | 'open' | 'half_open',
      // Pass the real bot token / OAuth token from the platform record
      token: (job.platform as any).tokenSecret ? decrypt((job.platform as any).tokenSecret) : undefined,
      // Pass the platform-specific target (chat_id, ig-user-id, author URN)
      targetId: (job.platform as any).targetId ?? undefined,
    },
  }

  // Emit progress for multi-step adapters (e.g., IG two-step)
  await emit(job, 'job:progress', 20, 'آماده‌سازی محتوا', null)

  const result = await adapter.publish(adapterJob)

  if (result.status === 'success') {
    circuitBreakers.recordSuccess(job.workspaceId, job.platform.type)
    await db.publishJob.update({
      where: { id: job.id },
      data: {
        status: 'success',
        progress: 100,
        processLabel: 'منتشر شد',
        completedAt: new Date(),
        externalId: result.externalId,
        error: null,
      },
    })
    // Update platform lastSuccessAt
    await db.platform.update({
      where: { id: job.platform.id },
      data: { lastSuccessAt: new Date(), lastError: null, circuitState: 'closed' },
    })
    // Update content status if all jobs done
    await checkContentPublished(job.contentId)
    await emit(job, 'success', 100, 'منتشر شد', null)
    console.log(`[worker] job ${job.id} → success (${result.externalId})`)
    return
  }

  // Failure — decide retry vs action vs DLQ
  const policy = CHANNEL_RETRY_POLICIES[job.platform.type] ?? CHANNEL_RETRY_POLICIES.instagram
  const attempt = job.retryCount + 1

  if (shouldRetry(attempt, result.retryable, policy)) {
    const backoff = computeBackoff(attempt, policy)
    const nextRun = new Date(Date.now() + backoff)

    await db.publishJob.update({
      where: { id: job.id },
      data: {
        status: 'pending', // back to pending for retry
        retryCount: attempt,
        processLabel: `تلاش مجدد در ${Math.round(backoff / 1000)} ثانیه`,
        progress: 0,
        error: result.error,
        scheduledAt: nextRun, // delay the retry
      },
    })
    await emit(job, 'job:progress', 0, `تلاش مجدد در ${Math.round(backoff / 1000)}ث`, result.error)
    console.log(`[worker] job ${job.id} → retry ${attempt}/${policy.maxAttempts} in ${backoff}ms`)
    return
  }

  // Non-retryable or exhausted → action needed (if 401/403) or failed (DLQ)
  const needsAction = result.error?.includes('احراز') || result.error?.includes('توکن') || result.error?.includes('مجوز')
  await markFailed(job, result.error ?? 'خطای نامشخص', result.retryable, needsAction)
}

async function markFailed(
  job: any,
  error: string,
  _retryable: boolean,
  needsAction = false,
): Promise<void> {
  circuitBreakers.recordFailure(job.workspaceId, job.platform.type)
  const breakerState = circuitBreakers.getState(job.workspaceId, job.platform.type)

  const status = needsAction ? 'action' : 'failed'
  const label = needsAction
    ? 'نیازمند اقدام دستی'
    : breakerState === 'open'
      ? 'مدار قطع شد — نیازمند بررسی'
      : 'ناموفق (تلاش‌ها تمام شد)'

  await db.publishJob.update({
    where: { id: job.id },
    data: {
      status,
      progress: 100,
      processLabel: label,
      error,
      completedAt: new Date(),
    },
  })

  // Update platform circuit state in DB
  await db.platform.update({
    where: { id: job.platform.id },
    data: {
      circuitState: breakerState,
      lastError: error,
      primaryIssue: breakerState === 'open' ? 'اختلال API' : null,
    },
  })

  await emit(job, status, 100, label, error)
  console.log(`[worker] job ${job.id} → ${status}: ${error}`)
}

async function checkContentPublished(contentId: string): Promise<void> {
  const remaining = await db.publishJob.count({
    where: { contentId, status: { in: ['pending', 'processing', 'scheduled'] } },
  })
  if (remaining === 0) {
    await db.content.update({
      where: { id: contentId },
      data: { status: 'published', publishedAt: new Date() },
    })
  }
}

async function emit(
  job: any,
  status: string,
  progress: number,
  processLabel: string,
  error: string | null,
): Promise<void> {
  await emitJobStatus({
    workspaceId: job.workspaceId,
    event: status === 'job:progress' ? 'job:progress' : 'job:status',
    payload: {
      jobId: job.id,
      status,
      progress,
      processLabel,
      error,
      platform: job.platform?.type ?? 'unknown',
      externalId: job.externalId ?? null,
    },
  })
}

// ── Health HTTP server ────────────────────────────────────────

function startHealthServer() {
  const server = createServer((req, res) => {
    if (req.url === '/health') {
      const uptime = Math.floor((Date.now() - startTime) / 1000)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        ok: true,
        status: shuttingDown ? 'shutting_down' : 'running',
        uptime,
        inFlightJobs,
        timestamp: new Date().toISOString(),
      }))
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'not found' }))
    }
  })

  server.listen(HEALTH_PORT, () => {
    console.log(`[worker] health endpoint on http://localhost:${HEALTH_PORT}/health`)
  })
}

// ── Graceful shutdown ─────────────────────────────────────────

function handleShutdown(signal: string) {
  console.log(`[worker] ${signal} received, initiating graceful shutdown...`)
  shuttingDown = true
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'))
process.on('SIGINT', () => handleShutdown('SIGINT'))

main().catch((err) => {
  console.error('[worker] fatal:', err)
  process.exit(1)
})
