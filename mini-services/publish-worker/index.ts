/**
 * Nashrino Publish Worker — BullMQ event-driven queue worker.
 *
 * Sprint B: Replaced DB-polling with BullMQ Worker.
 * - Zero DB queries on idle (no polling)
 * - Sub-second job dispatch (event-driven, not 2s poll)
 * - Built-in retry with exponential backoff
 * - Circuit breaker still enforced before processing
 * - DB PublishJob records updated from BullMQ events (audit log)
 * - Bull Board dashboard at /board (basic auth protected)
 *
 * Architecture:
 *   /api/publish → publishQueue.add() → Redis → Worker (this) → adapter.publish()
 *                                                       ↓
 *                                               DB PublishJob update (audit)
 *                                                       ↓
 *                                               emitJobStatus → realtime
 */

import { Worker, UnrecoverableError, type Job } from 'bullmq'
import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { db } from './lib/db'
import { getAdapter } from './adapters'
import type { AdapterJob, PlatformType } from './adapters/types'
import { circuitBreakers } from './lib/circuit'
import { emitJobStatus } from './lib/emit'
import { decrypt } from './lib/crypto'
import { writeAuditLog } from './lib/audit'
import { publishQueue, connection } from './lib/queue'
import { deriveContentStatus, type JobStatus } from './lib/state-reducer'
import { startOutboxDispatcher, stopOutboxDispatcher } from './lib/outbox-dispatcher'
import { startTokenExpiryScanner, stopTokenExpiryScanner } from './lib/token-expiry-scanner'
import {
  publishJobsCompleted,
  publishJobsFailed,
  publishDurationHistogram,
} from './lib/metrics'
import {
  buildFingerprint,
  findPreviousSuccess,
  startAttempt,
  markProviderSuccess,
  markLocalSuccess,
  markFailure,
} from './lib/attempt-ledger'

const HEALTH_PORT = parseInt(process.env.WORKER_HEALTH_PORT || '3002', 10)
const BOARD_PASSWORD = process.env.BOARD_PASSWORD || 'nashrino'
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5', 10)

const startTime = Date.now()

// ── BullMQ Worker ──────────────────────────────────────────────

const worker = new Worker(
  'publish-jobs',
  async (bullJob: Job) => {
    const { jobId, contentId, platformId, workspaceId } = bullJob.data

    // Fetch the PublishJob + Content + Platform from DB
    const job = await db.publishJob.findFirst({
      where: { id: jobId, workspaceId },
      include: {
        content: true,
        platform: true,
        workspace: { select: { id: true } },
      },
    })

    if (!job) {
      console.error(`[worker] job ${jobId} not found in DB`)
      throw new Error(`PublishJob ${jobId} not found`)
    }

    // MISS-02: check attempt ledger BEFORE calling the provider.
    // If a previous attempt already reached provider_success, we have the
    // providerPostId — reconcile local state and skip the provider call to
    // prevent a duplicate post.
    const previousSuccess = await findPreviousSuccess(job.id)
    if (previousSuccess) {
      const extId = previousSuccess.providerPostId ?? job.externalId ?? ''
      console.log(
        `[worker] job ${job.id} — previous provider_success found, reconciling (${extId})`
      )
      await updateJobStatus(job, 'success', 100, 'منتشر شد (تأیید همخوانی)', null, extId)
      if (previousSuccess.outcome !== 'local_success') {
        await markLocalSuccess(previousSuccess.id)
      }
      await checkContentPublished(job.contentId)
      return { status: 'success', externalId: extId }
    }

    // Existing idempotency guard (externalId already set in PublishJob)
    if (job.externalId) {
      console.log(`[worker] job ${job.id} already published (externalId=${job.externalId})`)
      await updateJobStatus(job, 'success', 100, 'منتشر شد (تأیید همخوانی)', null, job.externalId)
      return { status: 'success', externalId: job.externalId }
    }

    // Circuit breaker check — defer the job (not retry) until circuit recovers
    if (!circuitBreakers.canDispatch(job.workspaceId, job.platform.type)) {
      console.log(`[worker] circuit OPEN for ${job.platform.type}, deferring job ${job.id}`)
      await bullJob.moveToDelayed(Date.now() + 60_000)
      return
    }

    // Issue #116: expired OAuth token guard — never retry, surface as auth error.
    // The token-expiry scanner sets Platform.status='expired' when a 60-day
    // Instagram/LinkedIn token passes its expiry date. Retrying would waste
    // quota and confuse the user; instead we mark the job as 'action' with
    // errorCategory='auth' so the worker throws UnrecoverableError.
    if (job.platform.status === 'expired') {
      const authError = `توکن ${job.platform.type} منقضی شده است. لطفاً حساب را مجدداً متصل کنید.`
      console.log(`[worker] job ${job.id} skipped — platform ${job.platform.type} token expired`)
      const fingerprint = buildFingerprint(job.platform.id, job.content.id, bullJob.attemptsMade)
      const attemptId = await startAttempt({
        publishJobId: job.id,
        attemptNumber: bullJob.attemptsMade,
        requestFingerprint: fingerprint,
      })
      await markFailure(attemptId, {
        outcome: 'permanent_failure',
        errorCategory: 'auth',
        safeUserMessage: authError,
      })
      await markFailed(job, authError, false, true)
      throw new UnrecoverableError(authError)
    }

    // Update DB: processing
    await updateJobStatus(job, 'processing', 5, 'شروع پردازش', null)
    await emit(job, 'processing', 5, 'شروع پردازش', null)

    // Issue #126: record job start time for duration histogram
    const jobStartedAt = Date.now()

    // Issue #145: Load the immutable revision + ordered media + channel variant caption.
    // This replaces the old pattern of manufacturing a single photo from Content.thumbnailUrl.
    // The worker now reads the revision (immutable snapshot) — never the mutable Content row.
    let revisionData: {
      title: string
      body: string | null
      hashtags: string | null
      mediaItems: { type: 'photo' | 'video' | 'document'; url: string }[] | undefined
      platformCaption: string | undefined
    } | null = null

    try {
      // Try to load the revision from the new Publication entity
      const publication = await (db as any).publication.findFirst({
        where: { publishJobId: job.id },
        include: {
          revision: {
            include: {
              media: { orderBy: { position: 'asc' } },
              variants: { where: { platformId: job.platform.id } },
            },
          },
        },
      })

      if (publication?.revision) {
        const rev = publication.revision

        // Load the actual media URLs from the Media table
        const mediaIds = rev.media.map((rm: any) => rm.mediaId)
        const mediaRecords = mediaIds.length > 0
          ? await db.media.findMany({
              where: { id: { in: mediaIds } },
              select: { id: true, url: true, thumbnailUrl: true, fileType: true },
            })
          : []

        // Build ordered media items with REAL types (not all 'photo')
        const mediaItems = rev.media.map((rm: any) => {
          const media = mediaRecords.find((m: any) => m.id === rm.mediaId)
          const url = media?.url ?? media?.thumbnailUrl ?? ''
          const type = rm.role === 'video' ? 'video' as const
            : rm.role === 'document' ? 'document' as const
            : 'photo' as const
          return { type, url }
        }).filter((m: any) => m.url) // filter out missing media

        // Get per-channel caption override (Issue #145: platformCaption)
        const variant = rev.variants[0]
        const platformCaption = variant?.caption ?? undefined

        revisionData = {
          title: rev.title,
          body: rev.body,
          hashtags: rev.hashtags,
          mediaItems: mediaItems.length > 0 ? mediaItems : undefined,
          platformCaption,
        }
      }
    } catch (err) {
      // If the revision lookup fails (e.g. legacy job without Publication), fall back to old behavior
      console.log(`[worker] job ${job.id} — no revision found, using legacy content fields`)
    }

    // Build adapter job — Issue #145: use revision data if available, else fall back
    const adapterJob: AdapterJob = {
      id: job.id,
      idempotencyKey: job.idempotencyKey || job.id,
      retryCount: bullJob.attemptsMade,
      content: {
        id: job.content.id,
        title: revisionData?.title ?? job.content.title,
        body: revisionData?.body ?? job.content.body,
        hashtags: revisionData?.hashtags ?? job.content.hashtags,
        thumbnailUrl: job.content.thumbnailUrl,
        // Issue #145: use ordered validated media from the revision (not thumbnailUrl)
        mediaItems: revisionData?.mediaItems
          ?? (job.content.thumbnailUrl
            ? [{ type: 'photo' as const, url: job.content.thumbnailUrl }]
            : undefined),
      },
      // Issue #145: populate platformCaption from the ChannelVariant
      platformCaption: revisionData?.platformCaption,
      account: {
        id: job.platform.id,
        type: job.platform.type as PlatformType,
        username: job.platform.username,
        status: job.platform.status,
        circuitState: job.platform.circuitState as 'closed' | 'open' | 'half_open',
        token: (job.platform as any).tokenSecret
          ? decrypt((job.platform as any).tokenSecret)
          : undefined,
        targetId: (job.platform as any).targetId ?? undefined,
      },
    }

    // MISS-02: open an attempt ledger record BEFORE calling the provider
    const fingerprint = buildFingerprint(job.platform.id, job.content.id, bullJob.attemptsMade)
    const attemptId = await startAttempt({
      publishJobId: job.id,
      attemptNumber: bullJob.attemptsMade,
      requestFingerprint: fingerprint,
    })

    await emit(job, 'job:progress', 20, 'آماده‌سازی محتوا', null)

    // Publish via adapter
    const result = await getAdapter(job.platform.type)?.publish(adapterJob)

    if (!result) {
      await markFailure(attemptId, {
        outcome: 'outcome_unknown',
        safeUserMessage: 'آداپتور یافت نشد',
      })
      throw new Error(`آداپتور پلتفرم «${job.platform.type}» یافت نشد`)
    }

    if (result.status === 'success') {
      // MISS-02: record provider_success BEFORE updating local DB.
      // If the process crashes here, the next retry will find this record
      // and reconcile without calling the provider again.
      await markProviderSuccess(attemptId, result.externalId ?? '')

      circuitBreakers.recordSuccess(job.workspaceId, job.platform.type)
      await updateJobStatus(job, 'success', 100, 'منتشر شد', null, result.externalId ?? undefined)

      // Update platform
      await db.platform.update({
        where: { id: job.platform.id },
        data: { lastSuccessAt: new Date(), lastError: null, circuitState: 'closed' },
      })

      // Check if all jobs for this content are done
      await checkContentPublished(job.contentId)

      // MISS-02: local DB committed — finalize the ledger record
      await markLocalSuccess(attemptId)

      await emit(job, 'success', 100, 'منتشر شد', null)
      await writeAuditLog({
        action: 'publish.success',
        workspaceId: job.workspaceId,
        metadata: { jobId: job.id, platform: job.platform.type, externalId: result.externalId },
      })

      console.log(`[worker] job ${job.id} → success (${result.externalId})`)
      // Issue #126: increment completed counter + observe duration
      publishJobsCompleted.inc({ platform: job.platform.type, outcome: 'success' })
      publishDurationHistogram.observe(
        { platform: job.platform.type },
        (Date.now() - jobStartedAt) / 1000
      )
      return { status: 'success', externalId: result.externalId }
    }

    // Failure — throw so BullMQ retries with backoff
    circuitBreakers.recordFailure(job.workspaceId, job.platform.type)

    // Issue #126: increment failed counter + observe duration for all failure paths
    const errorCategory = result.errorCategory ?? 'unknown'
    publishJobsFailed.inc({ platform: job.platform.type, category: errorCategory })
    publishDurationHistogram.observe(
      { platform: job.platform.type },
      (Date.now() - jobStartedAt) / 1000
    )

    // BUG-05: typed errorCategory instead of matching Persian error strings
    const needsAction = result.errorCategory === 'auth'

    if (needsAction) {
      await markFailure(attemptId, {
        outcome: 'permanent_failure',
        errorCategory: result.errorCategory ?? undefined,
        safeUserMessage: result.error ?? undefined,
      })
      publishJobsCompleted.inc({ platform: job.platform.type, outcome: 'permanent_failure' })
      await markFailed(job, result.error ?? 'خطای نامشخص', false, true)
      throw new UnrecoverableError(result.error ?? 'خطای نامشخص')
    }

    // Retryable failure
    await markFailure(attemptId, {
      outcome: 'retryable_failure',
      errorCategory: result.errorCategory ?? undefined,
      safeUserMessage: result.error ?? undefined,
    })
    await updateJobStatus(
      job,
      'processing',
      0,
      `تلاش مجدد (${bullJob.attemptsMade + 1})`,
      result.error
    )
    await emit(
      job,
      'job:progress',
      0,
      `تلاش مجدد در ${Math.pow(2, bullJob.attemptsMade)}ث`,
      result.error
    )
    console.log(`[worker] job ${job.id} → retry ${bullJob.attemptsMade + 1}/5: ${result.error}`)
    throw new Error(result.error ?? 'خطای نامشخص')
  },
  {
    connection,
    concurrency: CONCURRENCY,
    // #112: allow up to 30s for in-progress jobs to complete on SIGTERM.
    // (stopTimeout is a valid BullMQ option but missing from some type defs)
    ...({ stopTimeout: 30_000 } as object),
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
)

// ── BullMQ event listeners (update DB audit log) ───────────────

worker.on('completed', (job: Job, result: any) => {
  console.log(`[worker] job ${job.id} completed: ${result?.status}`)
})

worker.on('failed', async (job: Job | undefined, err: Error) => {
  if (!job) return
  console.error(`[worker] job ${job.id} failed permanently: ${err.message}`)

  // Update DB: mark as failed (all retries exhausted)
  const { jobId, workspaceId } = job.data
  try {
    const dbJob = await db.publishJob.findFirst({
      where: { id: jobId, workspaceId },
      include: { platform: true },
    })
    if (dbJob && dbJob.status !== 'success' && dbJob.status !== 'action') {
      // BUG-05: check UnrecoverableError type (thrown only for auth failures above)
      const needsAction = err instanceof UnrecoverableError
      await markFailed(dbJob, err.message, false, needsAction)
    }
  } catch (dbErr) {
    console.error('[worker] failed to update DB on job failure:', dbErr)
  }
})

worker.on('error', (err: Error) => {
  console.error('[worker] worker error:', err)
})

// ── DB helpers ─────────────────────────────────────────────────

async function updateJobStatus(
  job: any,
  status: string,
  progress: number,
  processLabel: string,
  error: string | null,
  externalId?: string
): Promise<void> {
  await db.publishJob.update({
    where: { id: job.id },
    data: {
      status,
      progress,
      processLabel,
      error,
      ...(externalId ? { externalId } : {}),
      ...(status === 'success' ? { completedAt: new Date() } : {}),
      ...(status === 'processing' ? { startedAt: new Date() } : {}),
    },
  })
}

async function markFailed(
  job: any,
  error: string,
  _retryable: boolean,
  needsAction = false
): Promise<void> {
  const breakerState = circuitBreakers.getState(job.workspaceId, job.platform.type)
  const status = needsAction ? 'action' : 'failed'
  const label = needsAction
    ? 'نیازمند اقدام دستی'
    : breakerState === 'open'
      ? 'مدار قطع شد — نیازمند بررسی'
      : 'ناموفق (تلاش‌ها تمام شد)'

  await db.publishJob.update({
    where: { id: job.id },
    data: { status, progress: 100, processLabel: label, error, completedAt: new Date() },
  })

  await db.platform.update({
    where: { id: job.platform.id },
    data: {
      circuitState: breakerState,
      lastError: error,
      primaryIssue: breakerState === 'open' ? 'اختلال API' : null,
    },
  })

  await emit(job, status, 100, label, error)
  await writeAuditLog({
    action: `publish.${status}`,
    workspaceId: job.workspaceId,
    metadata: { jobId: job.id, platform: job.platform.type, error, breakerState },
  })
  console.log(`[worker] job ${job.id} → ${status}: ${error}`)
}

// MISS-06: derive content status from all job outcomes instead of naive "all done → published"
async function checkContentPublished(contentId: string): Promise<void> {
  const jobs = await db.publishJob.findMany({
    where: { contentId },
    select: { status: true },
  })
  if (jobs.length === 0) return

  const statuses = jobs.map((j) => j.status as JobStatus)
  const { status, markPublishedAt } = deriveContentStatus(statuses)

  // Only update content if it has reached a terminal or different aggregate state
  const terminalOrActive = [
    'published',
    'partially_published',
    'failed',
    'action_required',
    'cancelled',
    'publishing',
  ]
  if (terminalOrActive.includes(status)) {
    await db.content.update({
      where: { id: contentId },
      data: {
        status,
        ...(markPublishedAt ? { publishedAt: new Date() } : {}),
      },
    })
  }
}

async function emit(
  job: any,
  status: string,
  progress: number,
  processLabel: string,
  error: string | null
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

// ── Health HTTP server + Bull Board ────────────────────────────

let inFlightJobs = 0
worker.on('active', () => {
  inFlightJobs++
})
worker.on('completed', () => {
  inFlightJobs--
})
worker.on('failed', () => {
  inFlightJobs--
})

function startHealthServer() {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url?.split('?')[0]

    // GET /health — liveness + queue depth
    if (req.method === 'GET' && url === '/health') {
      let queueDepth = 0
      let failedCount = 0
      try {
        const counts = await publishQueue.getJobCounts()
        queueDepth = (counts.waiting ?? 0) + (counts.active ?? 0) + (counts.delayed ?? 0)
        failedCount = counts.failed ?? 0
      } catch {
        // Redis might not be connected yet
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          ok: true,
          status: 'running',
          uptime: Math.floor((Date.now() - startTime) / 1000),
          inFlightJobs,
          queueDepth,
          failedCount,
          timestamp: new Date().toISOString(),
        })
      )
      return
    }

    // GET /board — Bull Board dashboard (basic auth protected)
    if (req.method === 'GET' && url === '/board') {
      // Basic auth
      const auth = req.headers.authorization
      if (!auth || !auth.startsWith('Basic ')) {
        res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Bull Board"' })
        res.end('Authentication required')
        return
      }
      const decoded = Buffer.from(auth.slice(6), 'base64').toString()
      const colonIdx = decoded.indexOf(':')
      const password = colonIdx >= 0 ? decoded.slice(colonIdx + 1) : ''
      if (password !== BOARD_PASSWORD) {
        res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Bull Board"' })
        res.end('Invalid password')
        return
      }

      // Serve a simple queue status page (Bull Board Express adapter needs express,
      // but we're using raw http — so serve a JSON status instead)
      try {
        const counts = await publishQueue.getJobCounts()
        const jobs = await publishQueue.getJobs(['waiting', 'active', 'failed', 'completed'], 0, 20)

        const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Nashrino — Bull Board</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; }
  h1 { color: #333; } h2 { color: #666; margin-top: 30px; }
  .stat { display: inline-block; margin: 10px 20px 10px 0; padding: 10px 20px; background: #f5f5f5; border-radius: 8px; }
  .stat strong { font-size: 24px; display: block; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #eee; }
  th { background: #f5f5f5; }
  .status-success { color: green; } .status-failed { color: red; }
  .status-active { color: blue; } .status-waiting { color: orange; }
</style></head><body>
<h1>🐂 Nashrino Publish Queue</h1>
<div>
  <div class="stat"><strong>${counts.waiting}</strong>Waiting</div>
  <div class="stat"><strong>${counts.active}</strong>Active</div>
  <div class="stat"><strong>${counts.delayed}</strong>Delayed</div>
  <div class="stat"><strong>${counts.completed}</strong>Completed</div>
  <div class="stat"><strong>${counts.failed}</strong>Failed</div>
</div>
<h2>Recent Jobs</h2>
<table><tr><th>ID</th><th>Status</th><th>Attempts</th><th>Error</th></tr>
${jobs
  .map(
    (j) => `<tr>
  <td>${j.id?.slice(0, 12) ?? '—'}</td>
  <td class="status-${j.finishedOn ? (j.failedReason ? 'failed' : 'success') : 'active'}">
    ${j.finishedOn ? (j.failedReason ? 'failed' : 'completed') : j.processedOn ? 'active' : 'waiting'}
  </td>
  <td>${j.attemptsMade}</td>
  <td>${j.failedReason ? j.failedReason.slice(0, 80) : '—'}</td>
</tr>`
  )
  .join('')}
</table>
</body></html>`

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(html)
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Failed to fetch queue data', detail: String(err) }))
      }
      return
    }

    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'not found' }))
  })

  server.listen(HEALTH_PORT, () => {
    console.log(`[worker] health on http://localhost:${HEALTH_PORT}/health`)
    console.log(
      `[worker] bull board on http://localhost:${HEALTH_PORT}/board (password: ${BOARD_PASSWORD === 'nashrino' ? 'default' : 'custom'})`
    )
  })
}

// ── Graceful shutdown ──────────────────────────────────────────

let shuttingDown = false

async function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  // #112: log clearly so ops can confirm graceful drain in logs
  console.log(`\n[worker] ${signal} — graceful shutdown started (stopTimeout=30s)`)
  stopOutboxDispatcher()
  stopTokenExpiryScanner()
  await worker.close() // waits up to stopTimeout for in-progress jobs
  await publishQueue.close() // close queue's Redis connection
  console.log('[worker] shutdown complete')
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// ── Boot ───────────────────────────────────────────────────────

console.log(`[worker] BullMQ worker started (concurrency: ${CONCURRENCY}, health: :${HEALTH_PORT})`)
startHealthServer()
// MISS-01: start outbox dispatcher — polls OutboxEvent → enqueues to BullMQ
startOutboxDispatcher()
// Issue #116: start token expiry scanner — daily check for Instagram/LinkedIn
// OAuth tokens expiring within 7 days; creates in-app notifications.
startTokenExpiryScanner()
