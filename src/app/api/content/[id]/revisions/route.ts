/**
 * Issue #212: Content revision history API.
 *
 *   GET /api/content/[id]/revisions
 *     — list all revision snapshots for a content row, newest first.
 *
 * Permission: content.review (admin + approver) — revision history is a
 * review surface, not an editor one. Editors see revisions only via the
 * review/approval flow itself.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAnyPermissionApi } from '@/lib/auth-guards'
import { validateId } from '@/lib/validations'
import { revisionsService, RevisionError } from '@/modules/revisions'

export const dynamic = 'force-dynamic'

function mapError(err: unknown): NextResponse {
  if (err instanceof RevisionError) {
    return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
  }
  throw err
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params
  const idCheck = validateId(rawId)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })

  // Approvers + editors can both see revision history (editors need to see
  // what they submitted, approvers need to see what they're approving).
  const guard = await requireAnyPermissionApi(['content.review', 'content.edit'])
  if (guard.error) return guard.error

  try {
    const revisions = await revisionsService.listRevisions(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      idCheck.data
    )
    return NextResponse.json({ data: revisions })
  } catch (err) {
    return mapError(err)
  }
}
