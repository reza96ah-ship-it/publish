/**
 * Issue #212: Content revision history API.
 *
 *   POST /api/content/[id]/revisions/[revId]/restore
 *     — restore a revision: writes its content back onto the Content row
 *       AND creates a new revision snapshot (append-only audit trail).
 *
 * Permission: content.edit — restore is an edit action (it mutates the
 * Content row). Approvers can see revisions but not restore them; that's
 * an editor decision.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateId } from '@/lib/validations'
import { revisionsService, RevisionError } from '@/modules/revisions'

export const dynamic = 'force-dynamic'

function mapError(err: unknown): NextResponse {
  if (err instanceof RevisionError) {
    return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
  }
  throw err
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; revId: string }> }
) {
  const { revId: rawRevId } = await params
  const revIdCheck = validateId(rawRevId)
  if (!revIdCheck.success) return NextResponse.json({ error: revIdCheck.error }, { status: 400 })

  const guard = await requirePermissionApi('content.edit')
  if (guard.error) return guard.error

  try {
    const result = await revisionsService.restoreRevision(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      revIdCheck.data
    )
    return NextResponse.json(result)
  } catch (err) {
    return mapError(err)
  }
}
