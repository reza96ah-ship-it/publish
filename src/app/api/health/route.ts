/**
 * GET /api/health — liveness probe.
 *
 * Returns 200 if the process is alive and can serve requests.
 * Does NOT check DB connectivity (that's /api/readyz).
 *
 * Used by container orchestrators (Kubernetes, Docker Compose) to know
 * whether to restart the container.
 */

import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const startTime = Date.now()

export async function GET() {
  const uptime = Math.floor((Date.now() - startTime) / 1000)

  logger.debug({ msg: 'health check', uptime })

  return NextResponse.json(
    {
      ok: true,
      status: 'alive',
      uptime,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      environment: process.env.NODE_ENV || 'development',
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  )
}
