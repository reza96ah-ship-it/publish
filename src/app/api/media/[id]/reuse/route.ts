/**
 * Issue #210: Media reuse-tracking API.
 *
 *   GET /api/media/[id]/reuse — count Content rows in the workspace whose body
 *   or internalNote mentions this media id. Surfaces an "Used in N content"
 *   indicator in the media library detail dialog.
 *
 * Permission: media.upload / content.review — same as /api/media.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAnyPermissionApi } from '@/lib/auth-guards'
import { validateId } from '@/lib/validations'
import { mediaService } from '@/modules/media'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params
  const idCheck = validateId(rawId)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })

  const guard = await requireAnyPermissionApi(['media.upload', 'content.review'])
  if (guard.error) return guard.error

  const count = await mediaService.getReuseCount(
    { workspaceId: guard.workspaceId, userId: guard.userId },
    idCheck.data
  )
  return NextResponse.json({ count })
}
