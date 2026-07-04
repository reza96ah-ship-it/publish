/**
 * GET /api/readyz — readiness probe.
 *
 * Thin transport handler delegating to OperationsService.
 * Returns 200 if ready to serve traffic (DB connected), or 503.
 */

import { NextResponse } from 'next/server'
import { operationsService } from '@/modules/operations'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { result, statusCode } = await operationsService.readiness()

  return NextResponse.json(result, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
