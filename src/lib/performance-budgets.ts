/**
 * Issue #157: Performance budgets — configuration + CI enforcement.
 *
 * Defines per-route JavaScript budgets, API latency SLOs, and resource ceilings.
 * Used by CI to fail on regressions.
 */

export interface RouteBudget {
  route: string
  /** Max JS bundle size in KB (gzipped) */
  maxJsKb: number
  /** Max CSS size in KB */
  maxCssKb: number
}

export const ROUTE_BUDGETS: RouteBudget[] = [
  { route: '/auth/signin', maxJsKb: 100, maxCssKb: 20 },
  { route: '/', maxJsKb: 200, maxCssKb: 30 }, // dashboard
  { route: '/compose', maxJsKb: 350, maxCssKb: 40 }, // editor + media + AI
  { route: '/calendar', maxJsKb: 250, maxCssKb: 30 },
  { route: '/content', maxJsKb: 200, maxCssKb: 30 },
  { route: '/channels', maxJsKb: 150, maxCssKb: 20 },
  { route: '/analytics', maxJsKb: 300, maxCssKb: 30 }, // charts
  { route: '/settings', maxJsKb: 150, maxCssKb: 20 },
  { route: '/inbox', maxJsKb: 200, maxCssKb: 20 },
  { route: '/media', maxJsKb: 200, maxCssKb: 20 },
  { route: '/campaigns', maxJsKb: 150, maxCssKb: 20 },
]

export interface ApiLatencySLO {
  endpoint: string
  method: string
  /** p95 latency target in ms */
  p95Ms: number
  /** p99 latency target in ms */
  p99Ms: number
}

export const API_LATENCY_SLOS: ApiLatencySLO[] = [
  { endpoint: '/api/health', method: 'GET', p95Ms: 50, p99Ms: 100 },
  { endpoint: '/api/readyz', method: 'GET', p95Ms: 200, p99Ms: 500 },
  { endpoint: '/api/publish', method: 'POST', p95Ms: 500, p99Ms: 1000 },
  { endpoint: '/api/content', method: 'GET', p95Ms: 300, p99Ms: 800 },
  { endpoint: '/api/dashboard/summary', method: 'GET', p95Ms: 300, p99Ms: 800 },
  { endpoint: '/api/platforms', method: 'GET', p95Ms: 200, p99Ms: 500 },
  { endpoint: '/api/media', method: 'GET', p95Ms: 200, p99Ms: 500 },
  { endpoint: '/api/inbox', method: 'GET', p95Ms: 200, p99Ms: 500 },
]

export const RESOURCE_CEILINGS = {
  app: { memoryMb: 1024, cpus: 1.0 },
  worker: { memoryMb: 512, cpus: 0.5 },
  realtime: { memoryMb: 256, cpus: 0.25 },
  redis: { memoryMb: 512, cpus: 0.5 },
  pgbouncer: { memoryMb: 256, cpus: 0.25 },
  postgres: { memoryMb: 1024, cpus: 1.0 },
} as const

export const WEB_VITALS_BUDGETS = {
  LCP_MS: 2500, // ≤ 2.5s at p75
  INP_MS: 200, // ≤ 200ms at p75
  CLS: 0.1, // ≤ 0.1 at p75
  TTFB_MS: 800, // ≤ 800ms at p75
} as const

export const MEDIA_UPLOAD_BUDGETS = {
  small: { maxSizeMb: 5, maxValidationMs: 2000 }, // images < 5MB
  medium: { maxSizeMb: 25, maxValidationMs: 10000 }, // large images / short videos
  large: { maxSizeMb: 100, maxValidationMs: 30000 }, // videos
} as const

export const REALTIME_LATENCY_BUDGETS = {
  eventDeliveryMs: 500, // worker → realtime → browser
  reconnectMs: 2000, // reconnect should complete in < 2s
} as const

export const SCHEDULE_LATENESS_BUDGET = {
  p95Seconds: 60, // p95 lateness from scheduledAt to provider request
  p99Seconds: 120, // p99 lateness
} as const
