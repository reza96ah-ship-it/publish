import { describe, it, expect } from 'vitest'
import {
  registry,
  httpRequestsTotal,
  publishJobsAccepted,
  publishJobsCompleted,
  publishJobsFailed,
  publishDurationHistogram,
  activeSocketsGauge,
  authFailuresTotal,
  aiRequestsTotal,
} from '../../../src/lib/metrics'

/**
 * Issue #126: Prometheus metrics instrumentation tests.
 *
 * Verifies that all metrics are declared, registered, and incrementable
 * with the correct label names. The actual increment-at-call-site is
 * verified by integration/E2E; here we verify the metric contracts.
 */

describe('Issue #126 — Prometheus metrics are declared and incrementable', () => {
  describe('registry contains all expected metrics', () => {
    it('registry has publish_jobs_accepted_total', () => {
      expect(registry.getSingleMetric('nashrino_publish_jobs_accepted_total')).toBeDefined()
    })

    it('registry has publish_jobs_completed_total', () => {
      expect(registry.getSingleMetric('nashrino_publish_jobs_completed_total')).toBeDefined()
    })

    it('registry has publish_jobs_failed_total', () => {
      expect(registry.getSingleMetric('nashrino_publish_jobs_failed_total')).toBeDefined()
    })

    it('registry has publish_duration_seconds', () => {
      expect(registry.getSingleMetric('nashrino_publish_duration_seconds')).toBeDefined()
    })

    it('registry has active_sockets gauge', () => {
      expect(registry.getSingleMetric('nashrino_active_sockets')).toBeDefined()
    })

    it('registry has auth_failures_total', () => {
      expect(registry.getSingleMetric('nashrino_auth_failures_total')).toBeDefined()
    })
  })

  describe('metrics are incrementable with correct labels', () => {
    it('publishJobsAccepted increments with workspace + platform labels', () => {
      // Incrementing with correct labels should not throw
      expect(() =>
        publishJobsAccepted.inc({ workspace: 'ws-test', platform: 'telegram' })
      ).not.toThrow()
    })

    it('publishJobsCompleted increments with platform + outcome labels', () => {
      publishJobsCompleted.inc({ platform: 'instagram', outcome: 'success' })
      publishJobsCompleted.inc({ platform: 'instagram', outcome: 'permanent_failure' })
      // No throw = pass
      expect(publishJobsCompleted).toBeDefined()
    })

    it('publishJobsFailed increments with platform + category labels', () => {
      publishJobsFailed.inc({ platform: 'linkedin', category: 'auth' })
      publishJobsFailed.inc({ platform: 'linkedin', category: 'rate_limit' })
      expect(publishJobsFailed).toBeDefined()
    })

    it('publishDurationHistogram observes duration with platform label', () => {
      publishDurationHistogram.observe({ platform: 'telegram' }, 1.5)
      expect(publishDurationHistogram).toBeDefined()
    })

    it('activeSocketsGauge sets to a specific value', () => {
      activeSocketsGauge.set(5)
      activeSocketsGauge.set(0)
      expect(activeSocketsGauge).toBeDefined()
    })

    it('authFailuresTotal increments with reason label', () => {
      authFailuresTotal.inc({ reason: 'invalid_credentials' })
      authFailuresTotal.inc({ reason: 'account_locked' })
      authFailuresTotal.inc({ reason: 'mfa_invalid' })
      expect(authFailuresTotal).toBeDefined()
    })

    it('httpRequestsTotal increments with method + route + status labels', () => {
      httpRequestsTotal.inc({ method: 'POST', route: '/api/publish', status: '201' })
      expect(httpRequestsTotal).toBeDefined()
    })

    it('aiRequestsTotal increments with provider + status labels', () => {
      aiRequestsTotal.inc({ provider: 'gemini', status: 'success' })
      expect(aiRequestsTotal).toBeDefined()
    })
  })

  describe('metrics produce Prometheus-format output', () => {
    it('registry.metrics() returns text containing HELP + TYPE lines', async () => {
      const output = await registry.metrics()
      expect(output).toContain('# HELP nashrino_publish_jobs_accepted_total')
      expect(output).toContain('# TYPE nashrino_publish_jobs_accepted_total counter')
      expect(output).toContain('# HELP nashrino_active_sockets')
      expect(output).toContain('# TYPE nashrino_active_sockets gauge')
    })
  })
})
