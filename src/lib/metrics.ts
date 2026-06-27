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

export const publishJobDuration = new Histogram({
  name: 'nashrino_publish_job_duration_seconds',
  help: 'Publish job execution duration in seconds',
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

export const activeConnections = new Gauge({
  name: 'nashrino_active_connections',
  help: 'Active WebSocket connections',
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
