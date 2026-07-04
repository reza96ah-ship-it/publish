/**
 * GET /api/dashboard/action-center — primary critical task + secondary tasks.
 *
 * Issue #200: thin handler. All aggregation + Persian label/color mapping
 * lives in src/modules/dashboard/service.ts.
 */

import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { dashboardService } from '@/modules/dashboard'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermissionApi('analytics.view')
  if (guard.error) return guard.error

  const result = await dashboardService.getActionCenter(guard.workspaceId)
  return NextResponse.json(result)
}
