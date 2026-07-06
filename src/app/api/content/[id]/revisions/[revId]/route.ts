/**
 * Issue #212: Content revision history API.
 *
 *   GET /api/content/[id]/revisions/[revId]
 *     — get a single revision + its field-level diff against the previous
 *       revision (so the UI can render the changed-fields panel inline).
 *
 * Permission: content.review / content.edit — same as the list endpoint.
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
  { params }: { params: Promise<{ id: string; revId: string }> }
) {
  const { revId: rawRevId } = await params
  const revIdCheck = validateId(rawRevId)
  if (!revIdCheck.success) return NextResponse.json({ error: revIdCheck.error }, { status: 400 })

  const guard = await requireAnyPermissionApi(['content.review', 'content.edit'])
  if (guard.error) return guard.error

  try {
    const auth = { workspaceId: guard.workspaceId, userId: guard.userId }
    const [revision, diff] = await Promise.all([
      revisionsService.getRevision(auth, revIdCheck.data),
      revisionsService.getRevisionDiff(auth, revIdCheck.data),
    ])
    return NextResponse.json({ revision, diff })
  } catch (err) {
    return mapError(err)
  }
}
