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

// Issue #127: Core Web Vitals histogram — observed by /api/vitals endpoint
export const webVitalsHistogram = new Histogram({
  name: 'nashrino_web_vitals_seconds',
  help: 'Core Web Vitals (LCP, INP, CLS, FCP, TTFB) in seconds, by metric name and rating',
  labelNames: ['metric', 'rating'] as const,
  // CLS is unitless (0-1 range), others are ms → convert to seconds at observe time
  buckets: [0.05, 0.1, 0.15, 0.2, 0.25, 0.5, 0.75, 1, 2, 3, 5],
  registers: [registry],
})

// ── Issue #155: SLO/SLI metrics ────────────────────────────────

// Duplicate post detection (target: zero)
export const duplicatePostsTotal = new Counter({
  name: 'nashrino_duplicate_posts_total',
  help: 'Confirmed duplicate external posts (target: zero)',
  labelNames: ['provider'] as const,
  registers: [registry],
})

// Unknown outcome tracking (target: <1% after 1h)
export const unknownOutcomesTotal = new Counter({
  name: 'nashrino_unknown_outcomes_total',
  help: 'Publications with unknown outcome (not yet reconciled)',
  labelNames: ['provider', 'age_bucket'] as const, // age_bucket: <1h, 1h-24h, >24h
  registers: [registry],
})

// Credential health gauge (target: 95% ready)
export const credentialHealthGauge = new Gauge({
  name: 'nashrino_credential_health',
  help: 'Channel credential health: 1=active, 0=expired/revoked/invalid',
  labelNames: ['provider', 'status'] as const,
  registers: [registry],
})

// Outbox age (target: oldest pending < 60s)
export const outboxAgeSeconds = new Gauge({
  name: 'nashrino_outbox_age_seconds',
  help: 'Age of the oldest pending outbox event in seconds',
  registers: [registry],
})

// Schedule punctuality (target: p95 < 60s)
export const scheduleDelaySeconds = new Histogram({
  name: 'nashrino_schedule_delay_seconds',
  help: 'Delay between scheduledAt and provider request, in seconds',
  labelNames: ['provider'] as const,
  buckets: [1, 5, 10, 30, 60, 120, 300, 600, 1800, 3600],
  registers: [registry],
})

// Reconciliation state tracking
export const reconciliationStateGauge = new Gauge({
  name: 'nashrino_reconciliation_state',
  help: 'Publications in each reconciliation state',
  labelNames: ['state'] as const, // pending, confirmed_success, confirmed_failure, still_unknown
  registers: [registry],
})

// Dead-letter count (target: zero growth)
export const deadLetterCount = new Gauge({
  name: 'nashrino_dead_letter_count',
  help: 'Number of dead-lettered outbox events',
  registers: [registry],
})

// Expired lease count (target: zero)
export const expiredLeaseCount = new Counter({
  name: 'nashrino_expired_leases_total',
  help: 'Number of outbox leases that expired (dispatcher crash recovery)',
  registers: [registry],
})
