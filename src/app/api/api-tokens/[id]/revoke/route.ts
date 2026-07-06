/**
 * Issue #255: API tokens — revoke (soft revoke).
 *
 *   POST /api/api-tokens/[id]/revoke  — set revokedAt = now() (soft revoke)
 *
 * Revoked tokens can no longer authenticate API requests, but the row is
 * retained for audit history. Use DELETE on the parent route to hard-delete.
 *
 * Requires `workspace.settings`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateId } from '@/lib/validations'
import { apiTokensService, ApiTokenError } from '@/modules/api-tokens'

export const dynamic = 'force-dynamic'

export async function POST(
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
    await apiTokensService.revoke(guard.workspaceId, idCheck.data)
    return NextResponse.json({ ok: true })
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
