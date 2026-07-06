/**
 * Issue #254: Agency API — revoke a portal-access token.
 *
 *   DELETE /api/agency/portal-access/[id]  — revoke (deactivate) a token
 *
 * Requires `workspace.settings`. The token row is preserved (audit); only
 * `isActive` flips to false. Next 16: `params` is a Promise.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateId } from '@/lib/validations'
import { agencyService, AgencyError } from '@/modules/agency'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  try {
    await agencyService.revokePortalAccess(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      idCheck.data
    )
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof AgencyError) {
      return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
    }
    throw err
  }
}
