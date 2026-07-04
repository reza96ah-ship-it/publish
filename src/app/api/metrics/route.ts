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
 */

import { NextResponse } from 'next/server'
import { register, collectDefaultMetrics } from 'prom-client'

// Initialize default metrics (memory, CPU, event loop) once
collectDefaultMetrics({ register })

export const dynamic = 'force-dynamic'

export async function GET() {
  const metrics = await register.metrics()

  return new NextResponse(metrics, {
    headers: {
      'Content-Type': register.contentType,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
