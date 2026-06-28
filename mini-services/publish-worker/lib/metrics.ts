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
