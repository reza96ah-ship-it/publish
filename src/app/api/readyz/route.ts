/**
 * GET /api/readyz — readiness probe.
 *
 * Returns 200 if the app is ready to serve traffic (DB is connected).
 * Returns 503 if the DB is unreachable.
 *
 * Used by container orchestrators to know whether to route traffic
 * to this instance. Unlike /api/health, this checks DB connectivity.
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET() {
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {}

  // Check 1: Database connectivity
  try {
    const start = Date.now()
    await db.$queryRaw`SELECT 1`
    const latencyMs = Date.now() - start
    checks.database = { ok: true, latencyMs }
  } catch (err) {
    checks.database = { ok: false, error: err instanceof Error ? err.message : 'unknown' }
    logger.error({ msg: 'readiness check: database unreachable', error: err })
  }

  const allOk = Object.values(checks).every((c) => c.ok)
  const status = allOk ? 200 : 503

  return NextResponse.json(
    {
      ok: allOk,
      status: allOk ? 'ready' : 'not_ready',
      checks,
      timestamp: new Date().toISOString(),
    },
    {
      status,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  )
}
