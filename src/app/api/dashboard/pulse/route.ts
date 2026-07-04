/**
 * GET /api/dashboard/pulse — live activity feed.
 *
 * Issue #200: thin handler. Query + label/color mapping lives in
 * src/modules/dashboard/service.ts.
 */

import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { dashboardService } from '@/modules/dashboard'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermissionApi('analytics.view')
  if (guard.error) return guard.error

  const pulse = await dashboardService.getPulse(guard.workspaceId)
  return NextResponse.json(pulse)
}
