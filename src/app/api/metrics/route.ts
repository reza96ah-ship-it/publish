/**
 * Prometheus metrics — request count, latency, error rate.
 *
 * GET /api/metrics — returns Prometheus text format metrics.
 *
 * Metrics exposed:
 *   - nashrino_http_requests_total{method,route,status}
 *   - nashrino_http_request_duration_seconds{method,route} (histogram)
 *   - nashrino_db_query_duration_seconds (histogram)
 *   - nashrino_publish_jobs_total{platform,status}
 *   - process_* (default Node.js metrics)
 *
 * P1-9: Auth — if METRICS_TOKEN env is set, requires
 * `Authorization: Bearer <token>` header (constant-time comparison). If the
 * env var is NOT set, falls back to the standard Prometheus pattern of
 * allowing only localhost requests (via `x-forwarded-for` header).
 */

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { register, collectDefaultMetrics } from 'prom-client'

// Initialize default metrics (memory, CPU, event loop) once
collectDefaultMetrics({ register })

export const dynamic = 'force-dynamic'

/** Constant-time string equality. Returns false for differing lengths. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/**
 * P1-9: Auth gate for /metrics.
 * - If METRICS_TOKEN is set: require `Authorization: Bearer <token>`.
 * - Otherwise: only allow requests whose `x-forwarded-for` first hop is
 *   localhost (`::1`, `127.0.0.1`, `::ffff:127.0.0.1`).
 *
 * Returns an error NextResponse (401/403) on failure, or null when allowed.
 */
function authorizeMetrics(req: NextRequest): NextResponse | null {
  const expectedToken = process.env.METRICS_TOKEN

  if (expectedToken) {
    const authHeader = req.headers.get('authorization') ?? ''
    const match = /^Bearer\s+(.+)$/i.exec(authHeader)
    if (!match) {
      return NextResponse.json({ error: 'مجوز دسترسی به متریک‌ها لازم است' }, { status: 401 })
    }
    if (!safeEqual(match[1], expectedToken)) {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 401 })
    }
    return null
  }

  // No token configured: allow localhost only (Prometheus standard pattern).
  const forwardedFor = req.headers.get('x-forwarded-for') ?? ''
  const firstHop = forwardedFor.split(',')[0]?.trim() ?? ''
  const localhostHops = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1', ''])
  // Empty x-forwarded-for means no proxy header — accept only if the request
  // reaches us directly on loopback (host header begins with localhost).
  const host = req.headers.get('host') ?? ''
  const isLoopback =
    localhostHops.has(firstHop) && (/^localhost(:\d+)?$/i.test(host) || /^127\./.test(host) || host.startsWith('[::1]'))
  if (!isLoopback) {
    return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  }
  return null
}

export async function GET(req: NextRequest) {
  const authError = authorizeMetrics(req)
  if (authError) return authError

  const metrics = await register.metrics()

  return new NextResponse(metrics, {
    headers: {
      'Content-Type': register.contentType,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
