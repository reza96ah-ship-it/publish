/**
 * DELETE /api/media/[id] — remove a validated media asset. (Issue #146, #156)
 *
 * Thin transport handler: auth → service.delete() → map.
 *
 * The service (src/modules/media/service.ts) owns the deletion policy:
 *   idempotent on already-deleted, refuses assets still referenced by a
 *   non-terminal publication, marks "deleting" → deletes storage object(s)
 *   → marks "deleted".
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { mediaService, MediaError } from '@/modules/media'

export const dynamic = 'force-dynamic'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const guard = await requirePermissionApi('media.delete')
  if (guard.error) return guard.error

  try {
    await mediaService.delete({ workspaceId: guard.workspaceId, userId: guard.userId }, id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof MediaError) {
      return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
    }
    throw err
  }
}
