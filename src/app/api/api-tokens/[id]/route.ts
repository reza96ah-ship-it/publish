/**
 * Issue #255: API tokens — delete (hard delete).
 *
 *   DELETE /api/api-tokens/[id]  — permanently delete a token (204)
 *
 * Tokens are immutable except for revocation; there is no PATCH. Use the
 * /revoke sub-route to soft-revoke (set revokedAt) without losing audit
 * history, or this route to hard-delete.
 *
 * Requires `workspace.settings`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateId } from '@/lib/validations'
import { apiTokensService, ApiTokenError } from '@/modules/api-tokens'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error

  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) {
    return NextResponse.json({ error: idCheck.error }, { status: 400 })
  }

  try {
    await apiTokensService.delete(guard.workspaceId, idCheck.data)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof ApiTokenError) {
      return NextResponse.json(
        { error: err.userMessage ?? err.message },
        { status: err.statusCode }
      )
    }
    throw err
  }
}
