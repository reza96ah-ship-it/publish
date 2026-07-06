/**
 * Issue #255: Webhook delivery dispatcher.
 *
 * Mirrors the outbox-dispatcher pattern (./outbox-dispatcher.ts) but for
 * outbound webhook HTTP delivery. Polls the WebhookDelivery table for
 * `status='pending'` rows, atomically claims a batch with a short lease,
 * POSTs each payload to the configured webhook URL with an HMAC-SHA256
 * signature, and marks the row delivered / retry-wait / dead-lettered
 * based on the response.
 *
 * Lifecycle of a WebhookDelivery row:
 *   pending → claimed → delivered         (2xx response)
 *                    → retry_wait → …     (non-2xx or network error, attempts < 10)
 *                    → dead_letter        (attempts exhausted)
 *
 * Crash safety: every claimed row carries a 30s lease. If this dispatcher
 * crashes after claiming but before delivering, the lease expires and another
 * tick reclaims the row. The mark-delivered / mark-failed writes use fencing
 * (`WHERE lockedBy = INSTANCE_ID`) so a stale dispatcher can't overwrite a
 * newer owner's result after its lease expired.
 *
 * Retry policy: exponential backoff with jitter — 1s, 2s, 4s, 8s, 16s, …
 * capped at 5 minutes — plus up to 1s of jitter so a thundering herd of
 * retrials doesn't all hit the receiver at the same instant. After 10
 * attempts the row is dead-lettered for operator inspection.
 */

import { createHmac, randomUUID } from 'crypto'
import { db } from './db'
import { decrypt } from './crypto'
import { fetchWithTimeout, FetchTimeoutError } from './fetch-with-timeout'
import { createStructuredLogger } from './structured-logger'

const log = createStructuredLogger({ operation: 'webhook-dispatcher' })

const POLL_INTERVAL_MS = 5_000
const BATCH_SIZE = 5
const MAX_ATTEMPTS = 10
const LEASE_DURATION_MS = 30_000 // 30s — shorter than outbox (5min) because HTTP deliveries are fast
const FETCH_TIMEOUT_MS = 15_000 // 15s per outbound POST
const MAX_BACKOFF_MS = 300_000 // 5 minutes cap on retry backoff
const SHUTDOWN_POLL_INTERVAL_MS = 100
const SHUTDOWN_DRAIN_TIMEOUT_MS = 30_000

const INSTANCE_ID = randomUUID()

let running = false
let timer: ReturnType<typeof setTimeout> | null = null
let activeClaims = 0

// ── Public lifecycle ────────────────────────────────────────────────────────

export function startWebhookDispatcher(): void {
  if (running) return
  running = true
  log.info({
    msg: `webhook dispatcher started (instance=${INSTANCE_ID}, poll=${POLL_INTERVAL_MS}ms, lease=${LEASE_DURATION_MS}ms)`,
  })
  scheduleTick()
}

export async function stopWebhookDispatcher(
  timeoutMs: number = SHUTDOWN_DRAIN_TIMEOUT_MS
): Promise<void> {
  running = false
  if (timer) {
    clearTimeout(timer)
    timer = null
  }

  if (activeClaims === 0) {
    log.info({ msg: 'webhook dispatcher stopped — no active claims' })
    return
  }

  log.warn({
    msg: `webhook dispatcher stopping — waiting for ${activeClaims} active delivery/ies to finish (timeout=${timeoutMs}ms)`,
  })

  const deadline = Date.now() + timeoutMs
  while (activeClaims > 0 && Date.now() < deadline) {
    await sleep(SHUTDOWN_POLL_INTERVAL_MS)
  }

  if (activeClaims > 0) {
    log.error({
      msg: `webhook dispatcher stop timed out with ${activeClaims} active delivery/ies still in flight`,
    })
  } else {
    log.info({ msg: 'webhook dispatcher stopped — active claims drained' })
  }
}

/** Health/readiness — exposed by the worker's /health endpoint. */
export function getWebhookDispatcherHealth() {
  return {
    running,
    instanceId: INSTANCE_ID,
    activeClaims,
    pollIntervalMs: POLL_INTERVAL_MS,
    maxAttempts: MAX_ATTEMPTS,
    leaseDurationMs: LEASE_DURATION_MS,
  }
}

// ── Tick loop ────────────────────────────────────────────────────────────────

function scheduleTick() {
  if (!running) return
  timer = setTimeout(async () => {
    try {
      await tick()
    } catch (err) {
      log.error({ msg: `webhook dispatcher tick error: ${(err as Error).message}` })
    }
    scheduleTick()
  }, POLL_INTERVAL_MS)
}

async function tick(): Promise<void> {
  // Step 1: recover expired leases (crashed dispatchers)
  await recoverExpiredLeases()

  // Step 2: transition retry_wait → pending when backoff expires so the
  // claimBatch() query (which only matches pending) picks them up.
  await recoverRetryWaitDeliveries()

  // Step 3: atomically claim a batch of pending rows
  const claimed = await claimBatch()
  if (claimed.length === 0) return

  log.info({ msg: `claimed ${claimed.length} webhook delivery/ies` })
  activeClaims = claimed.length

  // Step 4: deliver each claimed row sequentially. The batch is small (5)
  // so we don't overload the receiver; the 15s fetch timeout caps worst-case
  // tick duration at ~75s for a fully-saturated batch of slow receivers.
  for (const delivery of claimed) {
    try {
      await deliverOne(delivery)
    } catch (err) {
      await handleDeliveryFailure(delivery, err)
    }
  }

  activeClaims = 0
}

// ── Lease recovery ──────────────────────────────────────────────────────────

/**
 * Move expired `claimed` rows back to `pending` so another tick can reclaim
 * them. Fencing: only rows whose `lockExpiresAt` has passed are eligible —
 * a still-lease-holding dispatcher is left alone.
 */
async function recoverExpiredLeases(): Promise<void> {
  const now = new Date()
  try {
    const result = await db.webhookDelivery.updateMany({
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
      log.warn({ msg: `recovered ${result.count} expired webhook delivery lease(s)` })
    }
  } catch (err) {
    log.error({ msg: `webhook lease recovery error: ${(err as Error).message}` })
  }
}

/**
 * Transition `retry_wait` rows whose backoff has elapsed back to `pending`.
 * The claim query only matches `pending`, so this must happen before claim.
 */
async function recoverRetryWaitDeliveries(): Promise<void> {
  const now = new Date()
  const result = await db.webhookDelivery.updateMany({
    where: {
      status: 'retry_wait',
      availableAt: { lte: now },
    },
    data: {
      status: 'pending',
    },
  })
  if (result.count > 0) {
    log.info({ msg: `transitioned ${result.count} retry_wait → pending (backoff expired)` })
  }
}

// ── Atomic batch claim ──────────────────────────────────────────────────────

interface ClaimedDelivery {
  id: string
  webhookId: string
  eventId: string
  eventType: string
  payload: unknown // Prisma JsonValue — JSON.parse'd already by the client
  attemptCount: number
  url: string
  secretEncrypted: string
  isActive: boolean
}

/**
 * Atomically claim up to BATCH_SIZE pending deliveries for this instance.
 *
 * Two-step inside `db.$transaction` because Prisma's `updateMany` doesn't
 * return rows:
 *   1. UPDATE rows WHERE status='pending' AND availableAt<=now AND
 *      (lock free OR expired) SET status='claimed', lockedBy, lockedAt,
 *      lockExpiresAt=now+30s.
 *   2. SELECT rows WHERE lockedBy=instanceId AND lockedAt >= claimStart,
 *      include webhook.{url, secretEncrypted, isActive}.
 *
 * The transaction + conditional WHERE makes the claim atomic against
 * competing dispatchers — only one dispatcher's updateMany can win each row.
 */
async function claimBatch(): Promise<ClaimedDelivery[]> {
  const now = new Date()
  const claimStart = new Date(now.getTime() - 1000) // 1s window for clock skew
  const lockExpiresAt = new Date(now.getTime() + LEASE_DURATION_MS)

  try {
    return await db.$transaction(async (tx) => {
      await tx.webhookDelivery.updateMany({
        where: {
          status: 'pending',
          availableAt: { lte: now },
          OR: [{ lockedAt: null }, { lockExpiresAt: { lt: now } }],
        },
        data: {
          status: 'claimed',
          lockedAt: now,
          lockedBy: INSTANCE_ID,
          lockExpiresAt,
        },
      })

      const rows = await tx.webhookDelivery.findMany({
        where: {
          lockedBy: INSTANCE_ID,
          lockedAt: { gte: claimStart },
        },
        include: {
          webhook: {
            select: { url: true, secretEncrypted: true, isActive: true },
          },
        },
        orderBy: { availableAt: 'asc' },
        take: BATCH_SIZE,
      })

      return rows.map((r) => ({
        id: r.id,
        webhookId: r.webhookId,
        eventId: r.eventId,
        eventType: r.eventType,
        payload: r.payload,
        attemptCount: r.attemptCount,
        url: r.webhook.url,
        secretEncrypted: r.webhook.secretEncrypted,
        isActive: r.webhook.isActive,
      }))
    })
  } catch (err) {
    log.error({ msg: `webhook claim error: ${(err as Error).message}` })
    return []
  }
}

// ── Delivery ────────────────────────────────────────────────────────────────

/**
 * Sign `timestamp.payload` with HMAC-SHA256 using the webhook secret, and
 * return the hex digest. Mirrors src/lib/webhook-signing.ts but inlined
 * here because the worker can't import from `src/`. The receiver verifies
 * the signature using the same algorithm + shared secret.
 *
 * The `timestamp.payload` format (with a literal dot separator) prevents an
 * attacker from reinterpreting the boundary between the two fields.
 */
function signPayload(secret: string, timestamp: number, payload: string): string {
  return createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex')
}

/**
 * Deliver a single claimed row. Decides delivered vs failed based on the
 * HTTP response, then writes the outcome with fencing (only if our lease
 * is still held). Throws on network errors so the caller routes them through
 * handleDeliveryFailure for retry/backoff.
 */
async function deliverOne(delivery: ClaimedDelivery): Promise<void> {
  // Skip deliveries for webhooks the admin deactivated between trigger and
  // dispatch — the receiver probably doesn't want them anymore. We mark the
  // row as cancelled (terminal) so it's not retried.
  if (!delivery.isActive) {
    await db.webhookDelivery.updateMany({
      where: { id: delivery.id, lockedBy: INSTANCE_ID, status: 'claimed' },
      data: {
        status: 'cancelled',
        lockedAt: null,
        lockedBy: null,
        lockExpiresAt: null,
      },
    })
    log.info({ msg: `delivery ${delivery.id} cancelled (webhook inactive)` })
    return
  }

  const secret = decrypt(delivery.secretEncrypted)
  const timestamp = Math.floor(Date.now() / 1000)
  const body = JSON.stringify(delivery.payload)
  const signatureHex = signPayload(secret, timestamp, body)

  let response: Response
  try {
    response = await fetchWithTimeout(
      delivery.url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Nashrino-Signature': `sha256=${signatureHex}`,
          'X-Nashrino-Timestamp': String(timestamp),
          'X-Nashrino-Event': delivery.eventType,
        },
        body,
      },
      FETCH_TIMEOUT_MS
    )
  } catch (err) {
    // Network errors, DNS failures, timeouts — throw so the caller routes
    // through handleDeliveryFailure for retry/backoff. The fetch-with-timeout
    // helper converts AbortController timeouts into FetchTimeoutError so we
    // get a distinguishable error category.
    throw err
  }

  // 2xx → delivered. Anything else (3xx, 4xx, 5xx) is a failure — the
  // receiver either rejected the payload or had an internal error, and
  // retrying is appropriate (with backoff) since the receiver may recover.
  if (response.status >= 200 && response.status < 300) {
    const result = await db.webhookDelivery.updateMany({
      where: { id: delivery.id, lockedBy: INSTANCE_ID, status: 'claimed' },
      data: {
        status: 'delivered',
        deliveredAt: new Date(),
        responseStatus: response.status,
        lastError: null,
        lockedAt: null,
        lockedBy: null,
        lockExpiresAt: null,
      },
    })
    if (result.count === 0) {
      log.warn({
        msg: `delivery ${delivery.id} lease expired before ack — another dispatcher may have reclaimed it`,
      })
    } else {
      log.info({
        msg: `delivered webhook ${delivery.id} → ${delivery.url} (${response.status})`,
      })
    }
    return
  }

  // Non-2xx — synthesize an error so handleDeliveryFailure schedules a retry.
  // Include the status + a snippet of the response body so the operator can
  // see why the receiver rejected it.
  let bodySnippet = ''
  try {
    bodySnippet = await response.text()
    if (bodySnippet.length > 200) bodySnippet = bodySnippet.slice(0, 200) + '…'
  } catch {
    // ignore — body may already be consumed or empty
  }
  const error = new Error(
    `webhook returned HTTP ${response.status}${bodySnippet ? `: ${bodySnippet}` : ''}`
  )
  ;(error as Error & { responseStatus?: number }).responseStatus = response.status
  throw error
}

// ── Failure handling ────────────────────────────────────────────────────────

/**
 * Handle a delivery failure: increment attemptCount, schedule a retry with
 * exponential backoff + jitter, or dead-letter if MAX_ATTEMPTS is reached.
 *
 * Fencing: only writes if `lockedBy = INSTANCE_ID` so a stale dispatcher
 * (whose lease expired mid-delivery) can't overwrite a newer owner's result.
 */
async function handleDeliveryFailure(
  delivery: ClaimedDelivery,
  err: unknown
): Promise<void> {
  const error = err instanceof Error ? err.message : String(err)
  const attempt = delivery.attemptCount + 1
  const errorCategory = classifyError(err)
  const isExhausted = attempt >= MAX_ATTEMPTS

  // Exponential backoff — 1s, 2s, 4s, 8s, 16s, … capped at 5min.
  // attempt=1 → 2^0 * 1000 = 1s, attempt=2 → 2^1 * 1000 = 2s, …
  const baseBackoff = Math.min(Math.pow(2, attempt - 1) * 1000, MAX_BACKOFF_MS)
  const jitter = Math.random() * 1000 // 0–1s jitter
  const backoffMs = baseBackoff + jitter
  const availableAt = new Date(Date.now() + backoffMs)

  const result = await db.webhookDelivery.updateMany({
    where: {
      id: delivery.id,
      lockedBy: INSTANCE_ID,
      status: 'claimed',
    },
    data: {
      attemptCount: attempt,
      availableAt,
      lastError: error,
      lastErrorCategory: errorCategory,
      lockedAt: null,
      lockedBy: null,
      lockExpiresAt: null,
      status: isExhausted ? 'dead_letter' : 'retry_wait',
      deadLetteredAt: isExhausted ? new Date() : null,
      // Preserve the response status from the original error (if any) so the
      // admin UI can show "last response code" alongside the error message.
      responseStatus:
        (err as Error & { responseStatus?: number }).responseStatus ?? null,
    },
  })

  if (result.count === 0) {
    log.warn({
      msg: `delivery ${delivery.id} lease expired during failure — another dispatcher may have reclaimed it`,
    })
    return
  }

  if (isExhausted) {
    log.error({
      msg: `delivery ${delivery.id} → DEAD LETTER (exhausted ${attempt} attempts): ${error}`,
    })
  } else {
    log.warn({
      msg: `delivery ${delivery.id} failed (attempt ${attempt}/${MAX_ATTEMPTS}): ${error} — retry in ${Math.round(
        backoffMs / 1000
      )}s`,
    })
  }
}

/**
 * Classify a delivery error for metrics + retry decisions. Mirrors the
 * outbox-dispatcher's classifyError but with webhook-specific categories.
 */
function classifyError(err: unknown): string {
  if (err instanceof FetchTimeoutError) return 'timeout'
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('ENOTFOUND') || msg.includes('EAI_AGAIN')) return 'dns'
  if (msg.includes('ECONNREFUSED') || msg.includes('ECONNRESET')) return 'network'
  if (msg.includes('ETIMEDOUT')) return 'timeout'
  if (msg.includes('certificate') || msg.includes('CERT')) return 'tls'
  if (msg.includes('HTTP 4')) return 'client_error'
  if (msg.includes('HTTP 5')) return 'server_error'
  return 'unknown'
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
