/**
 * Circuit breaker — per (workspace, platform) trip.
 * 5 consecutive failures in 60s → OPEN.
 * OPEN: new jobs held in pending; health-check every 60s.
 * HALF-OPEN: health check passes → release; 1 failure → OPEN.
 * CLOSED: after 5 consecutive successes, reset.
 *
 * Issue #147 (horizontal scaling): state lives in Redis so N worker
 * replicas share one breaker per (workspace, platform). All state
 * transitions are atomic Lua scripts — concurrent worker instances
 * can race `canDispatch()` / `recordFailure()` without corrupting
 * the breaker (e.g. two workers transitioning open→half_open would
 * otherwise both think they're the single probe).
 *
 * If Redis is unavailable, falls back to per-process in-memory state
 * (same Map-based logic as pre-scaling). This is a degraded mode —
 * with N replicas you effectively get N independent breakers — but
 * it's strictly better than blocking publishing because Redis is down.
 * A warning is logged on the first fallback; further warnings are
 * rate-limited to once per 60s.
 *
 * Public API is async (was sync). Callers in index.ts await every call.
 */

import { getRedisClient } from './redis-client'

interface BreakerState {
  state: 'closed' | 'open' | 'half_open'
  consecutiveFailures: number
  consecutiveSuccesses: number
  openedAt: number | null
  lastFailureAt: number | null
}

const FAILURE_THRESHOLD = 5
const SUCCESS_THRESHOLD = 5
const OPEN_TTL_MS = 60_000 // health-check interval

// ── Lua scripts ────────────────────────────────────────────────
//
// All three scripts are EVAL'd atomically inside Redis, so concurrent
// worker instances can't race on read-modify-write of the breaker hash.
//
// Key schema (Redis hash):
//   circuit:{workspaceId}:{platform}
//     state         — closed | open | half_open
//     failures      — consecutiveFailures (integer string)
//     successes     — consecutiveSuccesses (integer string)
//     openedAt      — ms timestamp or empty string
//     lastFailureAt — ms timestamp or empty string

const CAN_DISPATCH_SCRIPT = `
-- KEYS[1] = circuit key
-- ARGV[1] = now (ms)
-- ARGV[2] = open_ttl_ms
-- returns: 'closed' | 'open' | 'half_open'  (effective state AFTER any open→half_open transition)
local state = redis.call('HGET', KEYS[1], 'state')
if not state or state == false then
  return 'closed'
end
if state == 'open' then
  local openedAt = tonumber(redis.call('HGET', KEYS[1], 'openedAt')) or 0
  local now = tonumber(ARGV[1])
  local ttl = tonumber(ARGV[2])
  if openedAt > 0 and (now - openedAt) >= ttl then
    -- Promote to half_open: reset success counter so the probe starts fresh.
    redis.call('HSET', KEYS[1], 'state', 'half_open', 'successes', '0')
    redis.call('EXPIRE', KEYS[1], 86400)
    return 'half_open'
  end
  return 'open'
end
return state
`

const RECORD_SUCCESS_SCRIPT = `
-- KEYS[1] = circuit key
-- ARGV[1] = success_threshold
-- returns: resulting state string
local state = redis.call('HGET', KEYS[1], 'state')
local successes
if not state or state == false then
  redis.call('HSET', KEYS[1], 'state', 'closed', 'failures', '0', 'successes', '1', 'openedAt', '', 'lastFailureAt', '')
  redis.call('EXPIRE', KEYS[1], 86400)
  return 'closed'
end
successes = (tonumber(redis.call('HGET', KEYS[1], 'successes')) or 0) + 1
redis.call('HSET', KEYS[1], 'successes', tostring(successes), 'failures', '0')
local threshold = tonumber(ARGV[1])
-- Original in-memory logic: a single success in half_open (or while open
-- with successes>=1) closes the breaker; otherwise SUCCESS_THRESHOLD closes.
if state == 'half_open' or (state == 'open' and successes >= 1) or successes >= threshold then
  redis.call('HSET', KEYS[1], 'state', 'closed', 'openedAt', '')
  redis.call('EXPIRE', KEYS[1], 86400)
  return 'closed'
end
return state
`

const RECORD_FAILURE_SCRIPT = `
-- KEYS[1] = circuit key
-- ARGV[1] = now (ms)
-- ARGV[2] = failure_threshold
-- returns: resulting state string
local state = redis.call('HGET', KEYS[1], 'state')
local now = ARGV[1]
local threshold = tonumber(ARGV[2])
if not state or state == false then
  redis.call('HSET', KEYS[1], 'state', 'closed', 'failures', '1', 'successes', '0', 'openedAt', '', 'lastFailureAt', now)
  redis.call('EXPIRE', KEYS[1], 86400)
  return 'closed'
end
local failures = (tonumber(redis.call('HGET', KEYS[1], 'failures')) or 0) + 1
redis.call('HSET', KEYS[1], 'failures', tostring(failures), 'successes', '0', 'lastFailureAt', now)
if state == 'half_open' or failures >= threshold then
  redis.call('HSET', KEYS[1], 'state', 'open', 'openedAt', now)
  redis.call('EXPIRE', KEYS[1], 86400)
  return 'open'
end
return state
`

const GET_STATE_SCRIPT = `
-- KEYS[1] = circuit key
-- ARGV[1] = now (ms)
-- ARGV[2] = open_ttl_ms
-- returns: state string (with open→half_open promotion applied for reads,
--   matching canDispatch's behaviour so external observers see consistency)
local state = redis.call('HGET', KEYS[1], 'state')
if not state or state == false then
  return 'closed'
end
if state == 'open' then
  local openedAt = tonumber(redis.call('HGET', KEYS[1], 'openedAt')) or 0
  local now = tonumber(ARGV[1])
  local ttl = tonumber(ARGV[2])
  if openedAt > 0 and (now - openedAt) >= ttl then
    return 'half_open'
  end
end
return state
`

// SHA1 cache per script so we use EVALSHA after the first EVAL (cheaper).
// Each entry is the SHA1 of the script, or null until loaded.
const shaCache: Record<'canDispatch' | 'recordSuccess' | 'recordFailure' | 'getState', string | null> = {
  canDispatch: null,
  recordSuccess: null,
  recordFailure: null,
  getState: null,
}

type RedisClient = NonNullable<Awaited<ReturnType<typeof getRedisClient>>>

async function runScript(
  redis: RedisClient,
  slot: keyof typeof shaCache,
  script: string,
  keys: string[],
  argv: (string | number)[]
): Promise<unknown> {
  // Try EVALSHA first (cheap); on NOSCRIPT fall back to EVAL + cache the SHA.
  const sha = shaCache[slot]
  if (sha) {
    try {
      return await redis.evalsha(sha, keys.length, ...keys, ...argv)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (!msg.includes('NOSCRIPT')) throw err
      shaCache[slot] = null
    }
  }
  const result = await redis.eval(script, keys.length, ...keys, ...argv)
  if (!shaCache[slot]) {
    try {
      shaCache[slot] = (await redis.script('LOAD', script)) as string
    } catch {
      // Non-fatal — next call will just EVAL again.
    }
  }
  return result
}

function stateFromRedis(value: unknown): 'closed' | 'open' | 'half_open' {
  if (value === 'open' || value === 'half_open') return value
  return 'closed'
}

export class CircuitBreakerRegistry {
  /** In-memory fallback (used only when Redis is unavailable). */
  private breakers = new Map<string, BreakerState>()
  private fallbackWarned = false

  private key(workspaceId: string, platform: string): string {
    return `circuit:${workspaceId}:${platform}`
  }

  private getMem(workspaceId: string, platform: string): BreakerState {
    const k = this.key(workspaceId, platform)
    let b = this.breakers.get(k)
    if (!b) {
      b = {
        state: 'closed',
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        openedAt: null,
        lastFailureAt: null,
      }
      this.breakers.set(k, b)
    }
    return b
  }

  private warnFallbackOnce(err: unknown): void {
    if (this.fallbackWarned) return
    this.fallbackWarned = true
    console.warn(
      '[circuit] Redis op failed, using in-memory fallback (will retry Redis on next op):',
      err instanceof Error ? err.message : err
    )
    // Re-enable the warning after a cooldown so a transient blip doesn't
    // permanently silence future fallbacks.
    const t = setTimeout(() => {
      this.fallbackWarned = false
    }, 60_000)
    // .unref exists on Node timers; in Bun it's also a no-op-friendly call.
    if (typeof (t as any).unref === 'function') (t as any).unref()
  }

  /** Whether new jobs for this channel should be dispatched. */
  async canDispatch(workspaceId: string, platform: string): Promise<boolean> {
    const redis = await getRedisClient()
    if (redis) {
      try {
        const eff = await runScript(
          redis,
          'canDispatch',
          CAN_DISPATCH_SCRIPT,
          [this.key(workspaceId, platform)],
          [Date.now(), OPEN_TTL_MS]
        )
        return stateFromRedis(eff) !== 'open'
      } catch (err) {
        this.warnFallbackOnce(err)
        // fall through to in-memory
      }
    }
    // In-memory fallback (identical to pre-Redis logic)
    const b = this.getMem(workspaceId, platform)
    if (b.state === 'closed') return true
    if (b.state === 'open') {
      if (b.openedAt && Date.now() - b.openedAt >= OPEN_TTL_MS) {
        b.state = 'half_open'
        return true
      }
      return false
    }
    return true // half_open: allow one probe
  }

  async recordSuccess(workspaceId: string, platform: string): Promise<void> {
    const redis = await getRedisClient()
    if (redis) {
      try {
        await runScript(
          redis,
          'recordSuccess',
          RECORD_SUCCESS_SCRIPT,
          [this.key(workspaceId, platform)],
          [SUCCESS_THRESHOLD]
        )
        return
      } catch (err) {
        this.warnFallbackOnce(err)
      }
    }
    const b = this.getMem(workspaceId, platform)
    b.consecutiveFailures = 0
    b.consecutiveSuccesses++
    if (b.state === 'half_open' || (b.state === 'open' && b.consecutiveSuccesses >= 1)) {
      b.state = 'closed'
      b.openedAt = null
    }
    if (b.consecutiveSuccesses >= SUCCESS_THRESHOLD) {
      b.state = 'closed'
      b.openedAt = null
    }
  }

  async recordFailure(workspaceId: string, platform: string): Promise<void> {
    const redis = await getRedisClient()
    if (redis) {
      try {
        await runScript(
          redis,
          'recordFailure',
          RECORD_FAILURE_SCRIPT,
          [this.key(workspaceId, platform)],
          [Date.now(), FAILURE_THRESHOLD]
        )
        return
      } catch (err) {
        this.warnFallbackOnce(err)
      }
    }
    const b = this.getMem(workspaceId, platform)
    b.consecutiveSuccesses = 0
    b.consecutiveFailures++
    b.lastFailureAt = Date.now()
    if (b.state === 'half_open') {
      b.state = 'open'
      b.openedAt = Date.now()
    } else if (b.consecutiveFailures >= FAILURE_THRESHOLD) {
      b.state = 'open'
      b.openedAt = Date.now()
    }
  }

  async getState(
    workspaceId: string,
    platform: string
  ): Promise<'closed' | 'open' | 'half_open'> {
    const redis = await getRedisClient()
    if (redis) {
      try {
        const eff = await runScript(
          redis,
          'getState',
          GET_STATE_SCRIPT,
          [this.key(workspaceId, platform)],
          [Date.now(), OPEN_TTL_MS]
        )
        return stateFromRedis(eff)
      } catch (err) {
        this.warnFallbackOnce(err)
      }
    }
    return this.getMem(workspaceId, platform).state
  }

  /**
   * Snapshot for debugging / status API. Reads in-memory only — a full Redis
   * HSCAN across every breaker key would be expensive and isn't needed by
   * current callers (which only display this in dev/admin endpoints). Use
   * `getState(workspaceId, platform)` for an authoritative per-key read.
   */
  snapshot(): Record<string, { state: string; failures: number; successes: number }> {
    const out: Record<string, { state: string; failures: number; successes: number }> = {}
    for (const [k, b] of this.breakers) {
      out[k] = {
        state: b.state,
        failures: b.consecutiveFailures,
        successes: b.consecutiveSuccesses,
      }
    }
    return out
  }
}

export const circuitBreakers = new CircuitBreakerRegistry()
