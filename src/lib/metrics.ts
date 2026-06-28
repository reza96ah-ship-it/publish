/**
 * Prometheus metrics registry — shared across all API routes.
 *
 * Usage in API routes (or middleware):
 *   import { httpRequestsTotal, httpRequestDuration } from '@/lib/metrics'
 *   const labels = { method: 'GET', route: '/api/content', status: '200' }
 *   httpRequestsTotal.inc(labels)
 *   httpRequestDuration.observe(labels, durationSeconds)
 */

import { Registry, Counter, Histogram, Gauge } from 'prom-client'

export const registry = new Registry()

// ── HTTP metrics ──────────────────────────────────────────────

export const httpRequestsTotal = new Counter({
  name: 'nashrino_http_requests_total',
  help: 'Total HTTP requests by method, route, and status',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [registry],
})

export const httpRequestDuration = new Histogram({
  name: 'nashrino_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
})

// ── Database metrics ──────────────────────────────────────────

export const dbQueryDuration = new Histogram({
  name: 'nashrino_db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [registry],
})

// ── Business metrics ──────────────────────────────────────────

export const publishJobsTotal = new Counter({
  name: 'nashrino_publish_jobs_total',
  help: 'Total publish jobs by platform and status',
  labelNames: ['platform', 'status'] as const,
  registers: [registry],
})

// Issue #126: granular publish-job metrics (accepted/completed/failed + duration)
export const publishJobsAccepted = new Counter({
  name: 'nashrino_publish_jobs_accepted_total',
  help: 'Publish jobs accepted by the API (queued to outbox)',
  labelNames: ['workspace', 'platform'] as const,
  registers: [registry],
})

export const publishJobsCompleted = new Counter({
  name: 'nashrino_publish_jobs_completed_total',
  help: 'Publish jobs completed by the worker, by platform and outcome',
  labelNames: ['platform', 'outcome'] as const,
  registers: [registry],
})

export const publishJobsFailed = new Counter({
  name: 'nashrino_publish_jobs_failed_total',
  help: 'Publish jobs that failed, by platform and error category',
  labelNames: ['platform', 'category'] as const,
  registers: [registry],
})

export const publishDurationHistogram = new Histogram({
  name: 'nashrino_publish_duration_seconds',
  help: 'Publish job execution duration in seconds (worker processing time)',
  labelNames: ['platform'] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
  registers: [registry],
})

export const queueDepth = new Gauge({
  name: 'nashrino_queue_depth',
  help: 'Number of pending jobs in the queue',
  labelNames: ['status'] as const,
  registers: [registry],
})

// Issue #126: active WebSocket connections gauge (set by realtime service)
export const activeSocketsGauge = new Gauge({
  name: 'nashrino_active_sockets',
  help: 'Active WebSocket connections to the realtime service',
  registers: [registry],
})

// Issue #126: auth failure counter (invalid credentials, account locked)
export const authFailuresTotal = new Counter({
  name: 'nashrino_auth_failures_total',
  help: 'Authentication failures by reason',
  labelNames: ['reason'] as const,
  registers: [registry],
})

// ── AI metrics ────────────────────────────────────────────────

export const aiRequestsTotal = new Counter({
  name: 'nashrino_ai_requests_total',
  help: 'Total AI requests by provider and status',
  labelNames: ['provider', 'status'] as const,
  registers: [registry],
})

export const aiRequestDuration = new Histogram({
  name: 'nashrino_ai_request_duration_seconds',
  help: 'AI request duration in seconds',
  labelNames: ['provider'] as const,
  buckets: [0.5, 1, 2, 5, 10, 20, 30, 60],
  registers: [registry],
})
