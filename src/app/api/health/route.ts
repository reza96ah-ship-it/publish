/**
 * GET /api/health — liveness probe.
 *
 * Thin transport handler delegating to OperationsService.
 * Exposes uptime, environment, and package version.
 */

import { NextResponse } from 'next/server'
import { operationsService } from '@/modules/operations'

export const dynamic = 'force-dynamic'

export async function GET() {
  const result = operationsService.liveness()

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
