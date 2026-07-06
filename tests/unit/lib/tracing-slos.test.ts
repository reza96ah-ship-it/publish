import { describe, it, expect } from 'vitest'
import {
  startTrace,
  parseTraceparent,
  childSpan,
  injectTraceHeaders,
  type TraceContext,
} from '../../../src/lib/tracing'
import {
  SLOS,
  RELEASE_TARGETS,
  errorBudgetRemaining,
  burnRate,
} from '../../../src/lib/slos'

describe('Issue #155 — Distributed tracing', () => {
  describe('startTrace', () => {
    it('generates a valid W3C traceparent', () => {
      const trace = startTrace()
      expect(trace.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/)
    })

    it('generates unique trace IDs', () => {
      const t1 = startTrace()
      const t2 = startTrace()
      expect(t1.traceId).not.toBe(t2.traceId)
    })

    it('generates unique span IDs', () => {
      const t1 = startTrace()
      const t2 = startTrace()
      expect(t1.spanId).not.toBe(t2.spanId)
    })

    it('defaults to sampled=true', () => {
      const trace = startTrace()
      expect(trace.flags).toBe('01')
    })

    it('respects sampled=false', () => {
      const trace = startTrace(false)
      expect(trace.flags).toBe('00')
    })
  })

  describe('parseTraceparent', () => {
    it('parses a valid traceparent header', () => {
      const header = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01'
      const trace = parseTraceparent(header)
      expect(trace).not.toBeNull()
      expect(trace!.traceId).toBe('0af7651916cd43dd8448eb211c80319c')
      expect(trace!.spanId).toBe('b7ad6b7169203331')
      expect(trace!.flags).toBe('01')
    })

    it('returns null for missing header', () => {
      expect(parseTraceparent(null)).toBeNull()
      expect(parseTraceparent(undefined)).toBeNull()
      expect(parseTraceparent('')).toBeNull()
    })

    it('returns null for malformed header (wrong version)', () => {
      expect(parseTraceparent('01-abc-def-01')).toBeNull()
    })

    it('returns null for malformed header (wrong trace ID length)', () => {
      expect(parseTraceparent('00-short-b7ad6b7169203331-01')).toBeNull()
    })

    it('returns null for malformed header (non-hex chars)', () => {
      expect(parseTraceparent('00-0af7651916cd43dd8448eb211c80319g-b7ad6b7169203331-01')).toBeNull()
    })
  })

  describe('childSpan', () => {
    it('keeps the same trace ID', () => {
      const parent = startTrace()
      const child = childSpan(parent)
      expect(child.traceId).toBe(parent.traceId)
    })

    it('generates a new span ID', () => {
      const parent = startTrace()
      const child = childSpan(parent)
      expect(child.spanId).not.toBe(parent.spanId)
    })

    it('inherits parent flags by default', () => {
      const parent = startTrace(false)
      const child = childSpan(parent)
      expect(child.flags).toBe(parent.flags)
    })

    it('can override sampling', () => {
      const parent = startTrace(false)
      const child = childSpan(parent, true)
      expect(child.flags).toBe('01')
    })
  })

  describe('injectTraceHeaders', () => {
    it('adds traceparent to existing headers', () => {
      const trace = startTrace()
      const headers = injectTraceHeaders({ 'Content-Type': 'application/json' }, trace)
      expect(headers.traceparent).toBe(trace.traceparent)
      expect(headers['Content-Type']).toBe('application/json')
    })
  })
})

describe('Issue #155 — SLOs and error budgets', () => {
  describe('SLOS array', () => {
    it('defines all required SLOs', () => {
      const requiredNames = [
        'api_acceptance_availability',
        'publish_correctness',
        'schedule_punctuality',
        'queue_durability',
        'duplicate_rate',
        'unknown_outcome_rate',
        'credential_readiness',
        'user_experience_lcp',
        'user_experience_inp',
      ]
      for (const name of requiredNames) {
        expect(SLOS.find(s => s.name === name)).toBeDefined()
      }
    })

    it('all SLOs have targets between 0 and 1', () => {
      for (const slo of SLOS) {
        expect(slo.target).toBeGreaterThan(0)
        expect(slo.target).toBeLessThanOrEqual(1)
      }
    })

    it('all SLOs have a Prometheus metric name', () => {
      for (const slo of SLOS) {
        expect(slo.sliMetric).toBeTruthy()
        expect(slo.sliMetric.startsWith('nashrino_')).toBe(true)
      }
    })
  })

  describe('RELEASE_TARGETS', () => {
    it('targets zero known duplicates', () => {
      expect(RELEASE_TARGETS.zeroKnownDuplicates).toBe(true)
    })

    it('targets zero silently lost publications', () => {
      expect(RELEASE_TARGETS.zeroSilentlyLostPublications).toBe(true)
    })

    it('targets 100% terminal/repair traceability', () => {
      expect(RELEASE_TARGETS.terminalRepairTraceability).toBe(1.0)
    })

    it('targets schedule delay p95 under 60s', () => {
      expect(RELEASE_TARGETS.scheduleDelayP95Seconds).toBe(60)
    })

    it('targets 99.5% publication success rate', () => {
      expect(RELEASE_TARGETS.publicationSuccessRate).toBe(0.995)
    })
  })

  describe('errorBudgetRemaining', () => {
    it('returns 1 when no errors observed', () => {
      const slo = SLOS.find(s => s.name === 'publish_correctness')!
      expect(errorBudgetRemaining(slo, 1.0)).toBe(1) // 100% good = full budget
    })

    it('returns 0 when budget exhausted', () => {
      const slo = SLOS.find(s => s.name === 'publish_correctness')! // target 0.995
      expect(errorBudgetRemaining(slo, 0.99)).toBe(0) // 1% error > 0.5% budget
    })

    it('returns fraction when partially consumed', () => {
      const slo = SLOS.find(s => s.name === 'publish_correctness')! // budget = 0.005
      // observed 0.25% error, budget 0.5% → half consumed
      const remaining = errorBudgetRemaining(slo, 0.9975)
      expect(remaining).toBeCloseTo(0.5, 1)
    })
  })

  describe('burnRate', () => {
    it('returns 0 when no errors', () => {
      const slo = SLOS.find(s => s.name === 'publish_correctness')!
      expect(burnRate(slo, 1.0)).toBe(0)
    })

    it('returns 1 when burning at budget rate', () => {
      const slo = SLOS.find(s => s.name === 'publish_correctness')! // budget 0.005
      expect(burnRate(slo, 0.995)).toBe(1) // exactly at budget
    })

    it('returns >1 when burning faster than budget', () => {
      const slo = SLOS.find(s => s.name === 'publish_correctness')! // budget 0.005
      expect(burnRate(slo, 0.99)).toBeGreaterThan(1) // 1% error vs 0.5% budget
    })

    it('returns >2 for fast-burn alert threshold', () => {
      const slo = SLOS.find(s => s.name === 'publish_correctness')! // budget 0.005
      expect(burnRate(slo, 0.985)).toBeGreaterThan(2) // 1.5% error → 3x burn
    })
  })
})
