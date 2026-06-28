/**
 * Circuit breaker — per (workspace, platform) trip.
 * 5 consecutive failures in 60s → OPEN.
 * OPEN: new jobs held in pending; health-check every 60s.
 * HALF-OPEN: health check passes → release; 1 failure → OPEN.
 * CLOSED: after 5 consecutive successes, reset.
 */

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

export class CircuitBreakerRegistry {
  private breakers = new Map<string, BreakerState>()

  private key(workspaceId: string, platform: string): string {
    return `${workspaceId}:${platform}`
  }

  private get(workspaceId: string, platform: string): BreakerState {
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

  /** Whether new jobs for this channel should be dispatched. */
  canDispatch(workspaceId: string, platform: string): boolean {
    const b = this.get(workspaceId, platform)
    if (b.state === 'closed') return true
    if (b.state === 'open') {
      // Check if enough time has passed to try a half-open probe
      if (b.openedAt && Date.now() - b.openedAt >= OPEN_TTL_MS) {
        b.state = 'half_open'
        return true
      }
      return false
    }
    // half_open: allow one probe
    return true
  }

  recordSuccess(workspaceId: string, platform: string): void {
    const b = this.get(workspaceId, platform)
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

  recordFailure(workspaceId: string, platform: string): void {
    const b = this.get(workspaceId, platform)
    b.consecutiveSuccesses = 0
    b.consecutiveFailures++
    b.lastFailureAt = Date.now()
    if (b.state === 'half_open') {
      // Probe failed — back to open
      b.state = 'open'
      b.openedAt = Date.now()
    } else if (b.consecutiveFailures >= FAILURE_THRESHOLD) {
      b.state = 'open'
      b.openedAt = Date.now()
    }
  }

  getState(workspaceId: string, platform: string): 'closed' | 'open' | 'half_open' {
    return this.get(workspaceId, platform).state
  }

  /** Snapshot for debugging / status API. */
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
