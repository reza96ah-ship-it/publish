/**
 * Singleton ioredis client shared by the circuit breaker and rate limiter.
 *
 * Issue #147 (horizontal scaling): both `circuit.ts` and `rate-limiter.ts`
 * previously held per-process state in `Map`s, which broke under N worker
 * replicas (N× the rate limit, N independent circuit breakers that never
 * tripped correctly). This module gives them a single shared Redis client
 * so atomic Lua scripts can coordinate state across worker instances.
 *
 * BullMQ already pulls `ioredis` in transitively; we declare it explicitly
 * in package.json so the dependency is direct and survives a bullmq upgrade
 * that drops ioredis.
 *
 * The client is created lazily on first access and reused for the lifetime
 * of the process. Callers MUST tolerate a `null` return — when REDIS_URL is
 * not set, or the client fails to connect, callers fall back to in-memory.
 *
 * Retry policy: on a failed connect attempt we set a 5s cooldown during
 * which `getRedisClient()` returns null immediately (no reconnect attempt).
 * This prevents every canDispatch / tryAcquire call from paying the 2s
 * connect-timeout cost when Redis is down. After the cooldown expires, the
 * next call retries.
 */

import Redis from 'ioredis'

const REDIS_URL = process.env.REDIS_QUEUE_URL || process.env.REDIS_URL

let client: Redis | null = null
let connecting: Promise<Redis | null> | null = null
let nextRetryAt = 0 // ms timestamp; 0 means "no cooldown, can try immediately"
const RETRY_COOLDOWN_MS = 5_000

/**
 * Returns a connected ioredis client, or `null` if Redis is not configured
 * (no REDIS_URL) or the connection is currently in cooldown after a failure.
 * Concurrent callers share the same in-flight connect promise.
 */
export async function getRedisClient(): Promise<Redis | null> {
  if (!REDIS_URL) return null
  if (client) return client
  if (connecting) return connecting
  // Cooldown after a failed connect — avoids paying 2s connect-timeout on
  // every canDispatch/tryAcquire call when Redis is down.
  if (Date.now() < nextRetryAt) return null
  connecting = (async () => {
    try {
      const r = new Redis(REDIS_URL, {
        // Don't queue commands forever if Redis is down — surface errors
        // to the caller immediately so it can fall back to in-memory.
        enableOfflineQueue: false,
        // One quick retry per command — fail fast, fall back.
        maxRetriesPerRequest: 1,
        // Don't hang the worker boot on Redis — give it 2s to connect.
        connectTimeout: 2000,
        // Auto-reconnect in the background; once a live connection is
        // re-established, subsequent commands resume using Redis.
        retryStrategy: (times) => Math.min(times * 200, 2000),
        lazyConnect: true,
      })
      r.on('error', (err) => {
        // ioredis emits 'error' for transient blips; log at debug so we
        // don't spam, but don't tear down — the next failed command will
        // surface in the caller's try/catch and trigger in-memory fallback.
        console.warn('[redis-client] connection error:', err.message)
      })
      await r.connect()
      client = r
      console.log('[redis-client] connected to Redis for circuit/rate-limit state')
      // Clear cooldown — we're back in business.
      nextRetryAt = 0
      return r
    } catch (err: any) {
      console.warn(
        `[redis-client] Redis unavailable, using in-memory fallback for circuit/rate-limit:`,
        err?.message ?? err
      )
      // Set cooldown so subsequent calls within the window skip the
      // connect attempt and use in-memory immediately.
      nextRetryAt = Date.now() + RETRY_COOLDOWN_MS
      return null
    } finally {
      connecting = null
    }
  })()
  return connecting
}

/**
 * Close the shared client (graceful shutdown).
 */
export async function closeRedisClient(): Promise<void> {
  if (client) {
    try {
      await client.quit()
    } catch {
      // ignore — best-effort
    }
    client = null
  }
}
