/**
 * Issue #126: Prometheus metrics for the publish worker.
 *
 * The worker has its own prom-client registry (separate from the app's)
 * because it runs as a different process. The /health endpoint exposes
 * these metrics so Prometheus can scrape them.
 *
 * Metrics instrumented:
 *   - publishJobsCompleted {platform, outcome} — incremented on success/failure
 *   - publishJobsFailed {platform, category} — incremented on failure with errorCategory
 *   - publishDurationHistogram {platform} — observed on every job completion
 */

import { Registry, Counter, Histogram } from 'prom-client'

export const workerRegistry = new Registry()

export const publishJobsCompleted = new Counter({
  name: 'nashrino_publish_jobs_completed_total',
  help: 'Publish jobs completed by the worker, by platform and outcome',
  labelNames: ['platform', 'outcome'] as const,
  registers: [workerRegistry],
})

export const publishJobsFailed = new Counter({
  name: 'nashrino_publish_jobs_failed_total',
  help: 'Publish jobs that failed, by platform and error category',
  labelNames: ['platform', 'category'] as const,
  registers: [workerRegistry],
})

export const publishDurationHistogram = new Histogram({
  name: 'nashrino_publish_duration_seconds',
  help: 'Publish job execution duration in seconds (worker processing time)',
  labelNames: ['platform'] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
  registers: [workerRegistry],
})

// Issue #148: Outbox operational metrics
// These gauges/counters give operators visibility into outbox health.

export const outboxPendingGauge = new (require('prom-client').Gauge)({
  name: 'nashrino_outbox_pending_count',
  help: 'Number of outbox events in pending state',
  registers: [workerRegistry],
})

export const outboxClaimedGauge = new (require('prom-client').Gauge)({
  name: 'nashrino_outbox_claimed_count',
  help: 'Number of outbox events currently claimed (leased) by dispatchers',
  registers: [workerRegistry],
})

export const outboxDeadLetterGauge = new (require('prom-client').Gauge)({
  name: 'nashrino_outbox_dead_letter_count',
  help: 'Number of outbox events in dead_letter state',
  registers: [workerRegistry],
})

export const outboxOldestPendingAgeGauge = new (require('prom-client').Gauge)({
  name: 'nashrino_outbox_oldest_pending_age_seconds',
  help: 'Age in seconds of the oldest pending outbox event',
  registers: [workerRegistry],
})

export const outboxExpiredLeasesCounter = new Counter({
  name: 'nashrino_outbox_expired_leases_total',
  help: 'Number of outbox leases that expired (dispatcher crash recovery)',
  registers: [workerRegistry],
})

export const outboxDispatchFailuresCounter = new Counter({
  name: 'nashrino_outbox_dispatch_failures_total',
  help: 'Outbox dispatch failures by error category',
  labelNames: ['category'] as const,
  registers: [workerRegistry],
})

export const outboxDeliveryLatencyHistogram = new Histogram({
  name: 'nashrino_outbox_delivery_latency_seconds',
  help: 'Time from outbox event creation to delivery (enqueue to BullMQ)',
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10, 30, 60],
  registers: [workerRegistry],
})
