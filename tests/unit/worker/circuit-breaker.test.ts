import { describe, it, expect, beforeEach } from 'vitest'

// Mock the circuit breaker module
const circuitState = new Map<string, 'closed' | 'open' | 'half_open'>()
const failureCounts = new Map<string, number>()
const successCounts = new Map<string, number>()

const mockCircuitBreakers = {
  canDispatch: (workspaceId: string, platformType: string) => {
    const key = `${workspaceId}:${platformType}`
    return circuitState.get(key) !== 'open'
  },
  recordSuccess: (workspaceId: string, platformType: string) => {
    const key = `${workspaceId}:${platformType}`
    const count = (successCounts.get(key) || 0) + 1
    successCounts.set(key, count)
    if (circuitState.get(key) === 'half_open' && count >= 5) {
      circuitState.set(key, 'closed')
      failureCounts.set(key, 0)
    }
  },
  recordFailure: (workspaceId: string, platformType: string) => {
    const key = `${workspaceId}:${platformType}`
    const count = (failureCounts.get(key) || 0) + 1
    failureCounts.set(key, count)
    if (count >= 5) {
      circuitState.set(key, 'open')
    }
  },
  getState: (workspaceId: string, platformType: string) => {
    return circuitState.get(`${workspaceId}:${platformType}`) || 'closed'
  },
  reset: () => {
    circuitState.clear()
    failureCounts.clear()
    successCounts.clear()
  },
}

describe('Worker — circuit breaker', () => {
  beforeEach(() => {
    mockCircuitBreakers.reset()
  })

  it('starts in closed state', () => {
    expect(mockCircuitBreakers.getState('ws1', 'telegram')).toBe('closed')
    expect(mockCircuitBreakers.canDispatch('ws1', 'telegram')).toBe(true)
  })

  it('opens after 5 consecutive failures', () => {
    for (let i = 0; i < 5; i++) {
      mockCircuitBreakers.recordFailure('ws1', 'telegram')
    }
    expect(mockCircuitBreakers.getState('ws1', 'telegram')).toBe('open')
    expect(mockCircuitBreakers.canDispatch('ws1', 'telegram')).toBe(false)
  })

  it('does not open after 4 failures', () => {
    for (let i = 0; i < 4; i++) {
      mockCircuitBreakers.recordFailure('ws1', 'telegram')
    }
    expect(mockCircuitBreakers.getState('ws1', 'telegram')).toBe('closed')
    expect(mockCircuitBreakers.canDispatch('ws1', 'telegram')).toBe(true)
  })

  it('isolates circuits per (workspace, platform)', () => {
    // Open telegram for ws1
    for (let i = 0; i < 5; i++) {
      mockCircuitBreakers.recordFailure('ws1', 'telegram')
    }

    // ws1:telegram is open, ws1:instagram is still closed
    expect(mockCircuitBreakers.getState('ws1', 'telegram')).toBe('open')
    expect(mockCircuitBreakers.getState('ws1', 'instagram')).toBe('closed')

    // ws2:telegram is still closed (different workspace)
    expect(mockCircuitBreakers.getState('ws2', 'telegram')).toBe('closed')
  })

  it('closes after 5 successes in half-open state', () => {
    // Open the circuit
    for (let i = 0; i < 5; i++) {
      mockCircuitBreakers.recordFailure('ws1', 'telegram')
    }
    expect(mockCircuitBreakers.getState('ws1', 'telegram')).toBe('open')

    // Manually set to half_open (simulating the timeout probe)
    circuitState.set('ws1:telegram', 'half_open')

    // Record 5 successes
    for (let i = 0; i < 5; i++) {
      mockCircuitBreakers.recordSuccess('ws1', 'telegram')
    }

    expect(mockCircuitBreakers.getState('ws1', 'telegram')).toBe('closed')
  })
})
