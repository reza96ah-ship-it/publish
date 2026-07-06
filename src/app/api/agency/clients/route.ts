/**
 * Issue #254: Agency API — list client workspaces.
 *
 *   GET /api/agency/clients  — list all client workspaces with summaries
 *                              (name, plan, status, pendingApprovals, usage)
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
      await agencyService.listClients({
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
