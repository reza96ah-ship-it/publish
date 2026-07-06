/**
 * Issue #254: Agency API — aggregated overview.
 *
 *   GET /api/agency/overview  — dashboard rollup (totalClients, pendingApprovals,
 *                               atRiskClients, upcomingRenewals, usageSummary)
 *
 * Requires `workspace.settings`.
 */

import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { agencyService, AgencyError } from '@/modules/agency'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  try {
    return NextResponse.json(
      await agencyService.getOverview({
        workspaceId: guard.workspaceId,
        userId: guard.userId,
      })
    )
  } catch (err) {
    if (err instanceof AgencyError) {
      return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
    }
    throw err
  }
}
